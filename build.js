const fs = require('fs');
const path = require('path');

function getBase64Image(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return Buffer.from(bitmap).toString('base64');
}

function build() {
  console.log('Building standalone single-file ArgoCD Builder...');

  const srcDir = path.join(__dirname, 'src');
  const distDir = path.join(__dirname, 'dist');
  const assetsDir = path.join(__dirname, 'assets');

  let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf-8');

  // 1. Inline Favicons as base64 Data URIs
  const lightIconB64 = getBase64Image(path.join(assetsDir, 'favicon-light.png'));
  const darkIconB64 = getBase64Image(path.join(assetsDir, 'favicon-dark.png'));
  const appleIconB64 = getBase64Image(path.join(assetsDir, 'apple-touch-icon.png'));

  html = html.replace('../assets/favicon-light.png', `data:image/png;base64,${lightIconB64}`);
  html = html.replace('../assets/favicon-dark.png', `data:image/png;base64,${darkIconB64}`);
  html = html.replace('../assets/apple-touch-icon.png', `data:image/png;base64,${appleIconB64}`);

  // 2. Inline Styles
  const mainCss = fs.readFileSync(path.join(srcDir, 'styles/main.css'), 'utf-8');
  const layoutCss = fs.readFileSync(path.join(srcDir, 'styles/layout.css'), 'utf-8');
  const i18nCss = fs.readFileSync(path.join(srcDir, 'styles/i18n.css'), 'utf-8');
  const tooltipsCss = fs.readFileSync(path.join(srcDir, 'styles/tooltips.css'), 'utf-8');
  const cardOpsCss = fs.readFileSync(path.join(srcDir, 'styles/card-operations.css'), 'utf-8');

  const inlinedStyles = `
<style>
${mainCss}
</style>
<style id="argocd-i18n-style">
${i18nCss}
</style>
<style id="independent-pane-scroll">
${layoutCss}
</style>
<style id="builder-tooltip-accessibility">
${tooltipsCss}
</style>
<style id="card-operation-styles">
${cardOpsCss}
</style>
`;

  html = html.replace(/<!-- STYLES_START -->[\s\S]*?<!-- STYLES_END -->/, inlinedStyles.trim());

  // 3. Inline Scripts (Part 1: YAML vendor + Builder core)
  const yamlJs = fs.readFileSync(path.join(srcDir, 'js/vendor/yaml.min.js'), 'utf-8');
  const builderAppJs = fs.readFileSync(path.join(srcDir, 'js/core/builder-app.js'), 'utf-8');

  const inlinedScripts1 = `
<script>
${yamlJs}
</script>
<script>
${builderAppJs}
</script>
`;
  html = html.replace(/<!-- SCRIPTS_START -->[\s\S]*?<!-- SCRIPTS_PART1_END -->/, inlinedScripts1.trim());

  // 4. Inline Scripts (Part 2: i18n + Git Push)
  const i18nJs = fs.readFileSync(path.join(srcDir, 'js/modules/i18n.js'), 'utf-8');
  const gitPushJs = fs.readFileSync(path.join(srcDir, 'js/modules/git-push.js'), 'utf-8');

  const inlinedScripts2 = `
<script id="argocd-i18n">
${i18nJs}
</script>
<script id="argocd-git-push">
${gitPushJs}
</script>
`;
  html = html.replace(/<!-- SCRIPTS_PART2_START -->[\s\S]*?<!-- SCRIPTS_PART2_END -->/, inlinedScripts2.trim());

  fs.mkdirSync(distDir, { recursive: true });
  const outPath = path.join(distDir, 'argocd-builder.html');
  fs.writeFileSync(outPath, html, 'utf-8');

  console.log(`Build completed: ${outPath} (${(Buffer.byteLength(html, 'utf-8') / 1024 / 1024).toFixed(2)} MB)`);
}

build();
