# Open Terms Archive Ops

Recipes to set up the infrastructure of and deploy Open Terms Archive.

## Requirements

- Install [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

## Usage

_To avoid making changes on the production server by mistake, by default all commands will only affect the Vagrant development virtual machine (VM), see [Development section](#development) for more details._

_To execute commands on the production server you should specify it by adding the option `--inventory ops/inventories/production.yml` to the following commands:_

- To set up a full [(phoenix)](https://martinfowler.com/bliki/PhoenixServer.html) server:

```
ansible-playbook ops/site.yml
```

- To setup the infrastructure only:

```
ansible-playbook ops/infra.yml
```

- To setup the `Open Terms Archive` app only:

```
ansible-playbook ops/app.yml
```

Setting up the production infrastructure for publishing on the shared versions repository entails decrypting a private key managed with [Ansible Vault](https://docs.ansible.com/ansible/latest/user_guide/vault.html). It is decrypted with a password that we keep safe. You do not need to decrypt this specific private key on your own production server.

Note that executing the playbook on the `production` inventory will affect **all** production servers.

If you want to execute a playbook on a specific server only, add the `--limit` option with the `hostname` as parameter:

```
ansible-playbook --inventory ops/inventories/production.yml ops/site.yml --limit $hostname
```

The hostname is the one defined in the `ops/inventories/production.yml` inventory file.

### Tags

Some tags are available to refine what will happen, use them with `--tags`:

- `setup`: to only setup system dependencies required by the app (cloning repo, installing app dependencies, all config files, and so on…)
- `start`: to start the app
- `stop`: to stop the app
- `restart`: to restart the app
- `update`: to update the app (pull code, install dependencies and restart app)
- `update-declarations`: to update services declarations (pull declarations, install dependencies and restart app)

For example, you can update `Open Terms Archive` by running:

```
ansible-playbook ops/app.yml --tags update
```

### Commands examples

- Deploy Open Terms Archive application on all servers declared in the `ops/inventories/production.yml` inventory file:
  ```
  ansible-playbook --inventory ops/inventories/production.yml ops/app.yml
  ```

- Check deployment without applying changes for the `dating` instance:
  ```
  ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit dating --check --diff
  ```

- Deploy Open Terms Archive application only on the `dating` instance and without applying changes to the infrastructure:
  ```
  ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit dating
  ```

- Update and restart the Open Terms Archive application only on `dating` instance:
  ```
  ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit dating --tag update
  ```

- Update services declarations only on the `france` instance:
  ```
  ansible-playbook -i ops/inventories/production.yml ops/app.yml -l france -t update-declarations
  ```

- Stop the Open Terms Archive application only on the `france` instance:
  ```
  ansible-playbook -i ops/inventories/production.yml ops/app.yml -l france -t stop
  ```

- Deploy the infrastructure and the Open Terms Archive application on all servers:
  ```
  ansible-playbook -i ops/inventories/production.yml ops/site.yml
  ```

### Logs

You can get logs by connecting to the target machine over SSH and obtaining logs from the process manager:

```
ssh user@machine pm2 logs ota
```

### Troubleshooting

If you have the following error:

```
Failed to connect to the host via ssh: ssh: connect to host 127.0.0.1 port 2222: Connection refused
```

You may have a collision on the default port `2222` used by vagrant to forward ssh commands.
Run the following command to know which ports are forwarded for the virtual machine:

```
vagrant port
```

It should display something like that:

```
The forwarded ports for the machine are listed below. Please note that
these values may differ from values configured in the Vagrantfile if the
provider supports automatic port collision detection and resolution.

    22 (guest) => 2200 (host)
```

Modify ansible ssh options to the `ops/inventories/dev.yml` file with the proper `ansible_ssh_port`:

```
all:
  children:
    dev:
      hosts:
        '127.0.0.1':
          […]
          ansible_ssh_port: 2200
          […]
```

## Process

To avoid breaking the production when making changes you can follow this process:

- Start by applying your changes on your Vagrant virtual machine
  `ansible-playbook ops/site.yml`.
- Connect through SSH to the virtual machine and check that everything is ok
  `vagrant ssh`, `pm2 logs`…
- **As you will test the PRODUCTION environnement, stop the OTA application server to avoid sending emails to our users**
  `ansible-playbook ops/app.yml -t stop`
- If everything works, destroy that machine and re-run the entire installation on a clean machine to ensure that your changes do not work by coincidence
  `vagrant destroy && vagrant up && ansible-playbook ops/site.yml`
- Re-check that everything is ok
  `vagrant ssh`, `pm2 logs`…
- Then you can now deploy the changes in production
  `ansible-playbook -i ops/inventories/production.yml ops/site.yml`.

## Initialize a new instance

### Provision a server

If you use [OVH Horizon](https://horizon.cloud.ovh.net/project/instances/), click on the `Launch Instance` button. Then fill, at least, the following fields:
  - `Instance name`.
  - `Source`. Suggested: `Debian 11`.
  - `Flavor`. Suggested: `b2-30-flex`.
  - `Key pair`. Suggested: Your own personal SSH key, to allow you to connect to the freshly created server.

### Add host configuration

Add an entry to the production inventory file `ops/inventories/production.yml` for the created host with the server address and proper variables.

### Create repositories

Create the `snapshot` and `version` repositories, with:

- A `main` branch.
- The `main` branch should be the default branch.
- At least one commit on this branch with some content (`README.md` and `LICENSE`).

### Set up permissions

The @OTA-Bot GitHub user should have write access to all three (declarations, snapshots, versions) repositories, so it can publish data, create issues, and publish dataset releases.

Each instance should have a responsible entity, which we currently model as a [“team” in the @OpenTermsArchive](https://github.com/orgs/OpenTermsArchive/teams) GitHub organisation. Each team has write access to the three repositories, and @OTA-Bot should be added to that team along with the human maintainers.

## Development

In order to try out the infrastructure setup, we use virtual machines. We use [Vagrant](https://www.vagrantup.com) to describe and spawn these virtual machines with a simple `vagrant up` command.

### Dependencies

In order to automatically set up a virtual machine:

1. Install [Vagrant](https://www.vagrantup.com/docs/installation/).
2. Install [VirtualBox](https://www.virtualbox.org/wiki/Downloads) to manage virtual machines. If you prefer Docker, or have an Apple Silicon machine, install [Docker](https://docs.docker.com/get-docker/) instead.
3. Create a dedicated SSH key with no password: `ssh-keygen -f ~/.ssh/ota-vagrant -q -N ""`. This key will be automatically used by Vagrant.

> VirtualBox is not compatible with Apple Silicon (M1…) processors. If you have such a machine, you will need to use the Docker provider. Since MongoDB cannot be installed on ARM, it is skipped in the infrastructure installation process. This means you cannot test the MongoDB storage adapter with Vagrant with an Apple Silicon processor.

### Launch

If you’re on an Apple Silicon processor or want to use Docker instead of VirtualBox, use `vagrant up --provider=docker`.

In all other cases, use `vagrant up` 🙂

You can then deploy the code to the running machine with `ansible-playbook ops/site.yml` and all the options described above.

### Vagrant quick reference

#### Connect to the virtual machine

```
vagrant up
vagrant ssh  # use "vagrant" as password
```

#### Start again with a clean virtual machine

```
vagrant halt  # stop machine
vagrant destroy  # remove machine
vagrant up
```

#### Troubleshooting: Remote host identification has changed

In case you get that kind of error:

```
fatal: [127.0.0.1]: UNREACHABLE! => changed=false
  msg: |-
    Failed to connect to the host via ssh: @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
    …
  unreachable: true
```

It may be because you already have a `known_host` registered with the same IP and port. To solve this, remove it from the entries using `ssh-keygen -R [127.0.0.1]:2222`.
