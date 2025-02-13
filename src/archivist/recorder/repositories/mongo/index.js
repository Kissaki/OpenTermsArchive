/**
 * This module is the boundary beyond which the usage of MongoDB is abstracted.
 * Object IDs are used as opaque unique IDs.
 */

import { MongoClient, ObjectId, Binary } from 'mongodb';

import RepositoryInterface from '../interface.js';

import * as DataMapper from './dataMapper.js';

export default class MongoRepository extends RepositoryInterface {
  constructor({ database: databaseName, collection: collectionName, connectionURI }) {
    super();

    this.client = new MongoClient(connectionURI);
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  async initialize() {
    await this.client.connect();
    const db = this.client.db(this.databaseName);

    this.collection = db.collection(this.collectionName);

    return this;
  }

  async finalize() {
    return this.client.close();
  }

  async save(record) {
    const { serviceId, documentType } = record;

    if (record.isFirstRecord === undefined || record.isFirstRecord === null) {
      record.isFirstRecord = !await this.collection.findOne({ serviceId, documentType });
    }

    const documentFields = await this.#toPersistence(record);
    const previousRecord = await this.findLatest(serviceId, documentType);

    if (previousRecord?.content == documentFields.content) {
      return Object(null);
    }

    const insertResult = await this.collection.insertOne(documentFields);

    record.id = insertResult.insertedId.toString();

    return record;
  }

  async findLatest(serviceId, documentType) {
    const [mongoDocument] = await this.collection.find({ serviceId, documentType }).limit(1).sort({ fetchDate: -1 }).toArray(); // `findOne` doesn't support the `sort` method, so even for only one document use `find`

    return this.#toDomain(mongoDocument);
  }

  async findById(recordId) {
    const mongoDocument = await this.collection.findOne({ _id: new ObjectId(recordId) });

    return this.#toDomain(mongoDocument);
  }

  async findAll() {
    return Promise.all((await this.collection.find().project({ content: 0 }).sort({ fetchDate: 1 }).toArray())
      .map(mongoDocument => this.#toDomain(mongoDocument, { deferContentLoading: true })));
  }

  async count() {
    return this.collection.find().count();
  }

  async* iterate() {
    const cursor = this.collection.find().sort({ fetchDate: 1 });

    /* eslint-disable no-await-in-loop */
    while (await cursor.hasNext()) {
      const mongoDocument = await cursor.next();

      yield this.#toDomain(mongoDocument);
    }
    /* eslint-enable no-await-in-loop */
  }

  async removeAll() {
    return this.collection.deleteMany();
  }

  async loadRecordContent(record) {
    const { content } = await this.collection.findOne({ _id: new ObjectId(record.id) }, { projection: { content: 1 } });

    record.content = content instanceof Binary ? content.buffer : content;
  }

  async #toDomain(document, { deferContentLoading } = {}) {
    if (!document) {
      return null;
    }

    const record = DataMapper.toDomain(document);

    if (deferContentLoading) {
      return record;
    }

    await this.loadRecordContent(record);

    return record;
  }

  async #toPersistence(record) {
    if (record.content === undefined || record.content === null) {
      await this.repository.loadRecordContent(record);
    }

    return DataMapper.toPersistence(record);
  }
}
