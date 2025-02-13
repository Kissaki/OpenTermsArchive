import serviceA from './service_A.js';
import serviceB from './service_B.js';
import serviceWithDeclarationHistory from './service_with_declaration_history.js';
import serviceWithFiltersHistory from './service_with_filters_history.js';
import serviceWithHistory from './service_with_history.js';
import serviceWithMultipageDocument from './service_with_multipage_document.js';
import serviceWithoutHistory from './service_without_history.js';

const services = {
  service_with_history: serviceWithHistory,
  service_without_history: serviceWithoutHistory,
  service_with_filters_history: serviceWithFiltersHistory,
  service_with_declaration_history: serviceWithDeclarationHistory,
  service_with_multipage_document: serviceWithMultipageDocument,
  service_A: serviceA,
  service_B: serviceB,
};

export default services;
