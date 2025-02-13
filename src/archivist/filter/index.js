import url from 'url';

import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import TurndownService from '@opentermsarchive/turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

import { InaccessibleContentError } from '../errors.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"]):not([href=""])';

const { PdfTransformer } = mardownPdf;
const { CiceroMarkTransformer } = ciceroMark;

const ciceroMarkTransformer = new CiceroMarkTransformer();

/**
 * Filter document content and convert it to Markdown
 *
 * @param {Object} params - Filter parameters
 * @param {string|Buffer} params.content - Content to filter: a buffer containing PDF data in case mimetype associated is PDF or a DOM dump of an HTML page given as a string
 * @param {string} params.mimeType - MIME type of the given content
 * @param {string} params.pageDeclaration - see {@link ./src/archivist/services/pageDeclaration.js}
 * @returns {Promise<string>} Promise which is fulfilled once the content is filtered and converted in Markdown. The promise will resolve into a string containing the filtered content in Markdown format
*/
export default async function filter({ content, mimeType, pageDeclaration }) {
  if (mimeType == 'application/pdf') {
    return filterPDF({ content });
  }

  return filterHTML({
    content,
    pageDeclaration,
  });
}

export async function filterHTML({ content, pageDeclaration }) {
  const {
    location,
    contentSelectors = [],
    noiseSelectors = [],
    filters: serviceSpecificFilters = [],
  } = pageDeclaration;

  const jsdomInstance = new JSDOM(content, {
    url: location,
    virtualConsole: new jsdom.VirtualConsole(),
  });
  const { document: webPageDOM } = jsdomInstance.window;

  for (const filterFunction of serviceSpecificFilters) {
    try {
      /* eslint-disable no-await-in-loop */
      // We want this to be made in series
      await filterFunction(webPageDOM, {
        fetch: location,
        select: contentSelectors,
        remove: noiseSelectors,
        filter: serviceSpecificFilters.map(filter => filter.name),
      });
      /* eslint-enable no-await-in-loop */
    } catch (error) {
      throw new InaccessibleContentError(`The filter function "${filterFunction.name}" failed: ${error}`);
    }
  }

  remove(webPageDOM, noiseSelectors); // remove function works in place

  const domFragment = select(webPageDOM, contentSelectors);

  if (!domFragment.children.length) {
    throw new InaccessibleContentError(`The provided selector "${contentSelectors}" has no match in the web page at '${location}'`);
  }

  convertRelativeURLsToAbsolute(domFragment, location);

  domFragment.querySelectorAll('script, style').forEach(node => node.remove());

  // clean code from common changing patterns - initially for Windstream
  domFragment.querySelectorAll('a[href*="/email-protection"]').forEach(node => {
    if (node.href.match(/((.*?)\/email-protection#)[0-9a-fA-F]+/gim)) {
      node.href = `${node.href.split('#')[0]}#removed`;
    }
  });

  const markdownContent = transform(domFragment);

  if (!markdownContent) {
    throw new InaccessibleContentError(`The provided selector "${contentSelectors}" matches an empty content in the web page at '${location}'`);
  }

  return markdownContent;
}

export async function filterPDF({ content: pdfBuffer }) {
  try {
    const ciceroMarkdown = await PdfTransformer.toCiceroMark(pdfBuffer);

    return ciceroMarkTransformer.toMarkdown(ciceroMarkdown);
  } catch (error) {
    if (error.parserError) {
      throw new InaccessibleContentError("Can't parse PDF file");
    }

    throw error;
  }
}

function selectRange(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  const selection = document.createRange();
  const startNode = document.querySelector(startBefore || startAfter);
  const endNode = document.querySelector(endBefore || endAfter);

  if (!startNode) {
    throw new InaccessibleContentError(`The "start" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  if (!endNode) {
    throw new InaccessibleContentError(`The "end" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  selection[startBefore ? 'setStartBefore' : 'setStartAfter'](startNode);
  selection[endBefore ? 'setEndBefore' : 'setEndAfter'](endNode);

  return selection;
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}

// Works in place
function remove(webPageDOM, noiseSelectors) {
  const rangeSelections = [];
  const nodes = [];

  [].concat(noiseSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      rangeSelections.push(selectRange(webPageDOM, selector));
    } else {
      nodes.push(...webPageDOM.querySelectorAll(selector));
    }
  });

  // Removing range selections still works even if the starting or ending node is deleted. So, start by removing all nodes selected by a direct CSS selector, then delete all contents selections.
  nodes.forEach(node => node.remove());
  rangeSelections.forEach(rangeSelection => rangeSelection.deleteContents());
}

function select(webPageDOM, contentSelectors) {
  const result = webPageDOM.createDocumentFragment();

  [].concat(contentSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);

      result.appendChild(rangeSelection.cloneContents());
    } else {
      webPageDOM.querySelectorAll(selector).forEach(element => result.appendChild(element.cloneNode(true)));
    }
  });

  return result;
}

function transform(domFragment) {
  return turndownService.turndown(domFragment);
}
