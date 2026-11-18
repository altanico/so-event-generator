// Paths used by the browser tests. Override with environment variables when running elsewhere.
const path = require('path');
const NM = process.env.NODE_MODULES || path.join(__dirname, '..', 'node_modules');
module.exports = {
  PW: process.env.PLAYWRIGHT || path.join(NM, 'playwright'),
  CHROME: process.env.CHROME || undefined,               // e.g. /usr/bin/google-chrome; undefined = Playwright's bundled Chromium
  LMOCK: path.join(__dirname, 'mocks', 'lmock3.js'),      // offline Leaflet stand-in (no tiles, no network)
  PPTX: path.join(NM, 'pptxgenjs', 'dist', 'pptxgen.bundle.js'),
  PDFLIB: path.join(NM, 'pdf-lib', 'dist', 'pdf-lib.min.js'),
  BASE: process.env.BASE_URL || 'http://localhost:8765',
  FIX: f => path.join(__dirname, f),
  PREVIEW_OUT: path.join(__dirname, '..', 'dist', 'index_pub.html'),
};
