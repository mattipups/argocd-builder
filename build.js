const fs = require('fs');
const path = require('path');

function getBase64(fileRelPath) {
  const buf = fs.readFileSync(path.join(__dirname, fileRelPath));
  return buf.toString('base64');
}

function build() {
  const srcHtmlPath = path.join(__dirname, 'src/index.html');
  let html = fs.readFileSync(srcHtmlPath, 'utf-8');

  // 1. Restore exact base64 data URIs for favicons
  const favLight = getBase64('assets/favicon-light.png');
  const favDark = getBase64('assets/favicon-dark.png');
  const favApple = getBase64('assets/apple-touch-icon.png');

  html = html.replace('../assets/favicon-light.png', () => `data:image/png;base64,${favLight}`);
  html = html.replace('../assets/favicon-dark.png', () => `data:image/png;base64,${favDark}`);
  html = html.replace('../assets/apple-touch-icon.png', () => `data:image/png;base64,${favApple}`);

  // 2. Assemble exact styles
  const styleMain = fs.readFileSync(path.join(__dirname, 'src/styles/main.css'), 'utf-8');
  const styleI18n = fs.readFileSync(path.join(__dirname, 'src/styles/i18n.css'), 'utf-8');
  const styleLightTip = fs.readFileSync(path.join(__dirname, 'src/styles/light-tooltip-fix.css'), 'utf-8');
  const styleScroll = fs.readFileSync(path.join(__dirname, 'src/styles/independent-pane-scroll.css'), 'utf-8');
  const styleTipAcc = fs.readFileSync(path.join(__dirname, 'src/styles/tooltip-accessibility.css'), 'utf-8');
  const styleCardOps = fs.readFileSync(path.join(__dirname, 'src/styles/card-operations.css'), 'utf-8');

  const reconstructedStyles =
    '<style>' + styleMain + '</style>\n' +
    '<style id="argocd-i18n-style">' + styleI18n + '</style>' +
    '<style id="argocd-light-tooltip-fix">' + styleLightTip + '</style>\n' +
    '<style id="independent-pane-scroll">' + styleScroll + '</style>\n' +
    '<style id="builder-tooltip-accessibility">' + styleTipAcc + '</style>\n' +
    '<style id="card-operation-styles">' + styleCardOps + '</style>';

  html = html.replace(/<!-- (BUILD:STYLES_START|STYLES_START) -->[\s\S]*?<!-- (BUILD:STYLES_END|STYLES_END) -->/, () => reconstructedStyles);

  // 3. Assemble exact scripts part 1
  const scriptYaml = fs.readFileSync(path.join(__dirname, 'src/js/vendor/yaml.min.js'), 'utf-8');
  const scriptApp = fs.readFileSync(path.join(__dirname, 'src/js/core/builder-app.js'), 'utf-8');

  const reconstructedScripts1 =
    '<script>' + scriptYaml + '</script>' +
    '<script>' + scriptApp + '</script>';

  html = html.replace(/<!-- (BUILD:SCRIPTS_PART1_START|SCRIPTS_START) -->[\s\S]*?<!-- (BUILD:SCRIPTS_PART1_END|SCRIPTS_PART1_END) -->/, () => reconstructedScripts1);

  // 4. Assemble exact scripts part 2
  const scriptI18n = fs.readFileSync(path.join(__dirname, 'src/js/modules/i18n.js'), 'utf-8');
  const scriptGitPush = fs.readFileSync(path.join(__dirname, 'src/js/modules/git-push.js'), 'utf-8');

  const reconstructedScripts2 =
    '<script id="argocd-i18n">' + scriptI18n + '</script>' +
    '<script id="argocd-git-push">' + scriptGitPush + '</script>';

  html = html.replace(/<!-- (BUILD:SCRIPTS_PART2_START|SCRIPTS_PART2_START) -->[\s\S]*?<!-- (BUILD:SCRIPTS_PART2_END|SCRIPTS_PART2_END) -->/, () => reconstructedScripts2);

  const distDir = path.join(__dirname, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  const distFile = path.join(distDir, 'argocd-builder-v2.3.7.html');
  fs.writeFileSync(distFile, html, 'utf-8');
  console.log(`Build complete: ${distFile}`);
  return html;
}

if (require.main === module) {
  build();
}

module.exports = { build };
