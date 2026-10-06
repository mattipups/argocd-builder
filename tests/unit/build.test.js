const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { build } = require('../../build.js');

const builtHtml = build();
const distFile = path.join(__dirname, '../../dist/argocd-builder-v2.3.7.html');

assert(fs.existsSync(distFile), 'dist/argocd-builder-v2.3.7.html must exist');
assert(builtHtml.length > 1300000, 'HTML size should be around 1.37 MB');
assert(builtHtml.includes('<title id="appPageTitle">ArgoCD Builder v2.3.7</title>'), 'Title present');
assert(builtHtml.includes('id="argocd-i18n"'), 'i18n script present');
assert(builtHtml.includes('id="argocd-git-push"'), 'git-push script present');

console.log('✓ Build verification test passed successfully!');
