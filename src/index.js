import scheduler from 'node-schedule';

import { publishRelease } from '../scripts/release/releasedataset.js';

import Archivist from './app/index.js';
import * as services from './app/services/index.js';
import GitHub from './github/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';

const args = process.argv.slice(2);
const modifiedOnly = args.includes('--modified-only');
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');

(async () => {
  const app = new Archivist();

  app.attach(logger);
  await app.init();

  logger.info('Starting Service');

  let serviceIds = args.filter(arg => !arg.startsWith('--'));

  if (modifiedOnly) {
    serviceIds = await services.getIdsOfModified();
  }

  serviceIds = serviceIds.filter(serviceId => {
    const isServiceDeclared = app.serviceDeclarations[serviceId];

    if (!isServiceDeclared) {
      logger.warn(`Service ${serviceId} does not exist and will be ignored.`);
    }

    return isServiceDeclared;
  });

  if (modifiedOnly && !serviceIds.length) {
    logger.warn('No services have been modified');

    return;
  }

  serviceIds = serviceIds.length ? serviceIds : app.serviceIds;

  const numberOfDocuments = serviceIds.reduce((acc, serviceId) => acc + app.serviceDeclarations[serviceId].getNumberOfDocuments(), 0);

  serviceIds = serviceIds.sort((a, b) => a.localeCompare(b));

  logger.info(`👇 Refiltering ${numberOfDocuments} documents from ${serviceIds.length} services…`);
  await app.refilterAndRecord(serviceIds);
  logger.info(`👆 Refiltered ${numberOfDocuments} documents from ${serviceIds.length} services.\n`);

  if (refilterOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    app.attach(new Notifier(app.serviceDeclarations));
  }

  if (process.env.GITHUB_TOKEN) {
    app.attach(new GitHub());
  }

  logger.info(`👇 Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
  await app.trackChanges(serviceIds);
  logger.info(`👆 Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);

  if (!schedule) {
    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every 6 hours.');
  scheduler.scheduleJob('30 */6 * * *', async () => {
    logger.info(`Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
    await app.trackChanges(serviceIds);
    logger.info(`Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);
  });

  logger.info('Release will be created if needed every night at 4:15am');
  scheduler.scheduleJob('15 4 * * *', async () => {
    logger.info(`Start Release ${new Date()}`);
    await publishRelease();
    logger.info(`End Release ${new Date()}`);
  });
})();
