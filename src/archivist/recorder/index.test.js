import chai from 'chai';
import config from 'config';

import Recorder from './index.js';

const { expect } = chai;

const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');

describe('Recorder', () => {
  const SERVICE_ID = 'test_service';
  const TYPE = 'Terms of Service';

  for (const repositoryType of [ 'git', 'mongo' ]) {
    describe(repositoryType, () => {
      let recorder;

      before(async () => {
        const options = config.util.cloneDeep(config.recorder);

        options.versions.storage.type = repositoryType;
        options.snapshots.storage.type = repositoryType;

        recorder = new Recorder(options);
        await recorder.initialize();
      });

      after(async () => recorder.finalize());

      describe('#recordSnapshot', () => {
        const CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';

        let id;
        let isFirstRecord;
        let record;

        context('when a required param is missing', () => {
          after(async () => recorder.snapshotsRepository.removeAll());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: MIME_TYPE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            fetchDate: 'fetch date',
            content: 'content',
            mimeType: 'mime type',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordSnapshot(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            }));

            record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.snapshotsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.snapshotsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(UPDATED_CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.snapshotsRepository.removeAll());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });

      describe('#recordVersion', () => {
        const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
        const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';

        let id;
        let isFirstRecord;
        let record;

        context('when a required param is missing', () => {
          after(async () => recorder.versionsRepository.removeAll());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            snapshotIds: [SNAPSHOT_ID],
            fetchDate: FETCH_DATE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            snapshotIds: 'snapshot ID',
            fetchDate: 'fetch date',
            content: 'content',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordVersion(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(UPDATED_CONTENT);
          });

          it('records in the document that it is not a refilter', async () => {
            expect(record.isRefilter).to.equal(false);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });

      describe('#recordRefilter', () => {
        const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
        const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';

        let id;
        let isFirstRecord;
        let record;

        context('when a required param is missing', () => {
          after(async () => recorder.versionsRepository.removeAll());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            snapshotIds: [SNAPSHOT_ID],
            fetchDate: FETCH_DATE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            snapshotIds: 'snapshot ID',
            fetchDate: 'fetch date',
            content: 'content',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordRefilter(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll()); after(async () => recorder.versionsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll());

          it('records the document with the proper content', async () => {
            expect(await record.content).to.equal(UPDATED_CONTENT);
          });

          it('records in the document that it is a refilter', async () => {
            expect(record.isRefilter).to.equal(true);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotIds: [SNAPSHOT_ID],
              fetchDate: FETCH_DATE_LATER,
            }));

            record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
          });

          after(async () => recorder.versionsRepository.removeAll());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });
    });
  }
});
