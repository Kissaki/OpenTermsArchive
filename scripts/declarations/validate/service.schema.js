import { DOCUMENT_TYPES } from '../../../src/archivist/services/index.js';

import definitions from './definitions.js';

const AVAILABLE_TYPES_NAME = Object.keys(DOCUMENT_TYPES);

const documentsProperties = () => {
  const result = {};

  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = {
      oneOf: [
        { $ref: '#/definitions/singlePageDocument' },
        { $ref: '#/definitions/multiPageDocument' },
        { $ref: '#/definitions/pdfDocument' },
      ],
    };
  });

  return result;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  title: 'Service declaration',
  required: [ 'name', 'documents' ],
  properties: {
    name: {
      type: 'string',
      title: 'Service public name',
      examples: ['Facebook'],
    },
    documents: {
      type: 'object',
      properties: documentsProperties(),
      propertyNames: { enum: AVAILABLE_TYPES_NAME },
    },
    importedFrom: {
      type: 'string',
      title: 'Imported from',
      examples: [
        'https://github.com/tosdr/tosback2/blob/5acac7abb5e967cfafd124a5e275f98f6ecd423e/rules/4shared.com.xml',
      ],
    },
  },
  definitions: {
    ...definitions,
    pdfDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['fetch'],
      properties: { fetch: { $ref: '#/definitions/pdfLocation' } },
    },
    page: {
      type: 'object',
      additionalProperties: false,
      required: ['fetch'],
      properties: {
        fetch: { $ref: '#/definitions/location' },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/noiseSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
      },
    },
    singlePageDocument: {
      allOf: [
        { $ref: '#/definitions/page' },
        { required: [ 'fetch', 'select' ] },
      ],
    },
    multiPageDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['combine'],
      properties: {
        combine: {
          type: 'array',
          items: { $ref: '#/definitions/page' },
        },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/noiseSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
      },
    },
  },
};

export default schema;
