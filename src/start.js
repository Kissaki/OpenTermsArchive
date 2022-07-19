import config from 'config';
import cron from 'croner';

import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import Tracker from './tracker/index.js';

async function startOpenTermsArchive({ services, refilterOnly, schedule }) {
  const archivist = new Archivist({ recorderConfig: config.get('recorder') });

  archivist.attach(logger);

  await archivist.initialize();

  logger.info('Start Open Terms Archive\n');

  let serviceIds;

  if (services.length) {
    serviceIds = services.filter(serviceId => {
      const isServiceDeclared = archivist.serviceDeclarations[serviceId];

      if (!isServiceDeclared) {
        logger.warn(`Parameter "${serviceId}" was interpreted as a service ID to update, but no matching declaration was found; it will be ignored`);
      }

      return isServiceDeclared;
    });
  }

  await archivist.refilterAndRecord(serviceIds);

  if (refilterOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    archivist.attach(new Notifier(archivist.serviceDeclarations));
  }

  if (process.env.GITHUB_TOKEN) {
    const tracker = new Tracker();

    await tracker.initialize();
    archivist.attach(tracker);
  }

  await archivist.trackChanges(serviceIds);

  if (!schedule) {
    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked every six hours starting at half past midnight');

  cron('30 */6 * * *', () => archivist.trackChanges(serviceIds));
}

export default startOpenTermsArchive;
