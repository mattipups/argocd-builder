const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Execute build
require('../../build.js');

const distFile = path.join(__dirname, '../../dist/argocd-builder.html');
assert(fs.existsSync(distFile), 'dist/argocd-builder.html exists');

const content = fs.readFileSync(distFile, 'utf-8');
assert(content.includes('ArgoCD Builder'), 'Contains title');
assert(content.includes('YAML library'), 'Contains bundled yaml library');
assert(content.includes('argocd-i18n'), 'Contains i18n script');
assert(content.includes('gitPushModal'), 'Contains modal markup');

console.log('All build tests passed successfully!');
