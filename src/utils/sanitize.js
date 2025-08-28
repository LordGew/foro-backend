const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

const sanitizeContent = (content) => DOMPurify.sanitize(content);

module.exports = { sanitizeContent };