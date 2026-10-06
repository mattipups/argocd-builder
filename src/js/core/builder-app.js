(function () {
  var sourcesContainer = document.getElementById('sourcesContainer');
  var asTplSourcesContainer = document.getElementById('asTplSourcesContainer');
  var ignoreDiffContainer = document.getElementById('ignoreDiffContainer');
  var generatorsContainer = document.getElementById('generatorsContainer');
  var prjDestContainer = document.getElementById('prjDestContainer');
  var prjClusterResContainer = document.getElementById('prjClusterResContainer');
  var prjNsResContainer = document.getElementById('prjNsResContainer');
  var prjRolesContainer = document.getElementById('prjRolesContainer');
  var infoContainer = document.getElementById('infoContainer');
  var syncWindowsContainer = document.getElementById('syncWindowsContainer');
  var sourceCount = 0, asTplSourceCount = 0, generatorCount = 0, prjDestCount = 0, prjClusterResCount = 0, prjNsResCount = 0, prjRoleCount = 0, infoCount = 0, syncWindowCount = 0;
  var currentMode = 'application';
  var captureOutput=false,capturedOutput='',pendingRenderFrame=0,outputWrites=0;

  function byId(id) { return document.getElementById(id); }

  function needsQuoting(str) {
    if (str === '') return true;
    return /^[\s]|[:#{}\[\],&*!|>'"%@`]|^-|^\?|\s$/.test(str) || /^(true|false|null|~|yes|no)$/i.test(str) || /^[-+]?[0-9]/.test(str);
  }
  function q(str) {
    var s = str === undefined || str === null ? '' : String(str);
    return needsQuoting(s) || /[\x00-\x1f\\]/.test(s) || /^(on|off)$/i.test(s) ? JSON.stringify(s) : s;
  }
  function qSingle(str) {
    var s = (str === undefined || str === null) ? '' : String(str);
    return "'" + s.replace(/'/g, "''") + "'";
  }
  function kvLines(text) {
    var seen = new Set();
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      var idx = line.indexOf('=');
      if (idx <= 0) throw new Error('key=value erwartet: ' + line);
      var key = line.slice(0,idx).trim(); safeFieldKey(key);
      if (seen.has(key)) throw new Error('Doppelter Schlüssel: ' + key);
      seen.add(key); return [key,line.slice(idx+1).trim()];
    });
  }
  function indentBlock(text, spaces) {
    var pad = new Array(spaces + 1).join(' ');
    return text.split('\n').map(function (l) { return pad + l; }).join('\n');
  }
  function toBase64(text) {
    var bytes=new TextEncoder().encode(String(text)), binary='';
    for(var i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
    return btoa(binary);
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('highlight-flash');
    void el.offsetWidth;
    el.classList.add('highlight-flash');
  }

  function setMode(mode) {
    byId('guidePane').hidden = true;
    document.querySelector('main').hidden = false;
    byId('modeGuideBtn').classList.remove('active');
    currentMode = mode;
    var panes = { application: 'appModePane', applicationset: 'appSetModePane', project: 'projectModePane', registry: 'registryModePane' };
    var buttons = { application: 'modeAppBtn', applicationset: 'modeAppSetBtn', project: 'modeProjectBtn', registry: 'modeRegistryBtn' };
    Object.keys(panes).forEach(function (k) {
      byId(panes[k]).style.display = (k === mode) ? 'block' : 'none';
      byId(buttons[k]).classList.toggle('active', k === mode);
    });
    generateYaml();
  }
  byId('modeAppBtn').addEventListener('click', function () { setMode('application'); });
  byId('modeAppSetBtn').addEventListener('click', function () { setMode('applicationset'); });
  byId('modeProjectBtn').addEventListener('click', function () { setMode('project'); });
  byId('modeRegistryBtn').addEventListener('click', function () { setMode('registry'); });
  byId('modeGuideBtn').addEventListener('click', function () {
    document.querySelector('main').hidden = true;
    byId('guidePane').hidden = false;
    document.querySelectorAll('.mode-switch button').forEach(function (button) { button.classList.remove('active'); });
    byId('modeGuideBtn').classList.add('active');
    window.scrollTo(0, 0);
  });

  // ---------------- CLEAR BUTTONS ----------------
  function clearAppMode() {
    resetRaw('application');
    byId('appExtraSyncOptions').value = '';
    byId('appName').value = 'my-app';
    byId('appNamespace').value = 'argocd';
    byId('project').value = 'default';
    byId('labels').value = '';
    byId('annotations').value = '';
    byId('finalizersText').value = '';
    byId('destMode').value = 'server';
    byId('destValue').value = 'https://kubernetes.default.svc';
    byId('destNamespace').value = 'default';
    byId('syncAutomated').checked = true;
    byId('syncPrune').checked = true;
    byId('syncSelfHeal').checked = true;
    byId('syncAllowEmpty').checked = false;
    byId('optCreateNs').checked = true;
    byId('optPruneLast').checked = false;
    byId('optApplyOutOfSyncOnly').checked = false;
    byId('optServerSideApply').checked = false;
    byId('optReplace').checked = false;
    byId('optValidate').checked = true;
    byId('optRespectIgnoreDiff').checked = false;
    byId('optFailOnSharedResource').checked = false;
    byId('optPruneForeground').checked = false;
    byId('optPruneBackground').checked = false;
    byId('optPruneOrphan').checked = false;
    byId('optSkipSchemaValidation').checked = false;
    byId('optDryRunOnPreview').checked = false;
    byId('enableRetry').checked = false;
    byId('retryLimit').value = '5';
    byId('retryDuration').value = '5s';
    byId('retryFactor').value = '2';
    byId('retryMaxDuration').value = '3m';
    sourcesContainer.innerHTML = '';
    sourceCount = 0;
    createSourceBlock(sourceCount++, true);

    ignoreDiffContainer.innerHTML = '';
    infoContainer.innerHTML = '';
    byId('automatedOptions').style.opacity = '1';
    byId('retryOptions').style.display = 'none';
    byId('retryOptions2').style.display = 'none';
    generateYaml();
  }
  byId('clearAppBtn').addEventListener('click', clearAppMode);

  function clearAppSetMode() {
    resetRaw('applicationset');
    byId('asName').value = 'my-appset';
    byId('asNamespace').value = 'argocd';
    byId('asGoTemplate').checked = true;
    byId('asPreserveOnDelete').checked = false;
    byId('asFinalizers').value = '';
    byId('asLabels').value = '';
    byId('asAnnotations').value = '';
    byId('asGoTemplateOptsEnable').checked = false;
    byId('asGoTemplateMissingKey').value = 'error';
    byId('asCombineMode').value = 'list';
    if (byId('asMergeOptionsBlock')) byId('asMergeOptionsBlock').style.display = 'none';
    byId('asMergeKeys').value = '';
    generatorsContainer.innerHTML = '';
    generatorCount = 0;
    createGeneratorBlock(generatorCount++, { type: 'list' }, true);
    byId('asPostSelectorEnable').checked = false;
    byId('asPostSelectorAction').value = 'include';
    byId('asPostSelectorName').value = '';
    byId('asPostSelectorNamespace').value = '';
    byId('asGeneratorSelector').value = '';
    byId('asPostSelectorBlock').style.display = 'none';
    byId('asTplName').value = '{{.name}}';
    byId('asTplProject').value = 'default';
    byId('asTplLabels').value = '';
    byId('asTplAnnotations').value = '';
    asTplSourcesContainer.innerHTML = ''; asTplSourceCount = 0;
    createSourceBlock(asTplSourceCount++, true, {repoUrl:'{{.repoURL}}',targetRevision:'{{.branch}}',path:'{{.path}}'}, asTplSourcesContainer);
    byId('asTplDestMode').value = 'server';
    byId('asTplDestValue').value = '{{.server}}';
    byId('asTplDestNamespace').value = '{{.namespace}}';
    byId('asTplSyncAutomated').checked = true;
    byId('asTplPrune').checked = true;
    byId('asTplSelfHeal').checked = true;
    byId('asTplCreateNs').checked = true;
    byId('asTplAllowEmpty').checked = false;
    ['asTplPruneLast','asTplApplyOutOfSyncOnly','asTplServerSideApply','asTplReplace','asTplSkipDryRun','asTplRespectIgnoreDiff','asTplFailOnSharedResource','asTplRetryEnable'].forEach(function (id) { byId(id).checked = false; });
    byId('asTplValidate').checked = true;
    byId('asTplPrunePropagation').value = '';
    byId('asTplExtraSyncOptions').value = '';
    byId('asTplRetryLimit').value = '5';
    byId('asTplRetryDuration').value = '5s';
    byId('asTplRetryFactor').value = '2';
    byId('asTplRetryMaxDuration').value = '3m';
    byId('asTplIgnoreDiff').value = '';
    byId('asPolicy').value = '';
    byId('asGoTemplateOptsBlock').style.display = 'none';
    generateYaml();
  }
  byId('clearAppSetBtn').addEventListener('click', clearAppSetMode);

  function clearProjectMode() {
    resetRaw('project');
    byId('enableSyncWindows').checked = false;
    byId('syncWindowsContainer').innerHTML = '';
    byId('syncWindowsContainer').style.display = 'none';
    byId('addSyncWindowBtn').style.display = 'none';

    byId('prjName').value = 'my-project';
    byId('prjNamespace').value = 'argocd';
    byId('prjDescription').value = '';
    byId('prjSourceRepos').value = '*';
    prjDestContainer.innerHTML = '';
    prjDestCount = 0;
    createPrjDestRow();
    byId('prjClusterMode').value = 'whitelist';
    prjClusterResContainer.innerHTML = '';
    prjClusterResCount = 0;
    byId('prjNsMode').value = 'blacklist';
    prjNsResContainer.innerHTML = '';
    prjNsResCount = 0;
    byId('prjOrphanEnable').checked = false;
    byId('prjOrphanWarn').checked = true;
    byId('prjSignatureKeys').value = '';
    prjRolesContainer.innerHTML = '';
    prjRoleCount = 0;
    generateYaml();
  }
  byId('clearProjectBtn').addEventListener('click', clearProjectMode);

  function clearRegistryMode() {
    byId('regEsoTlsSeparatePaths').checked = false;
    byId("regEsoSshRemoteKey").value = "git/ssh";
    byId("regEsoSshProp").value = "sshPrivateKey";
    byId("regEsoTlsRemoteKey").value = "git/tls";
    byId("regEsoTlsPropCert").value = "tlsClientCertData";
    byId("regEsoTlsPropKey").value = "tlsClientCertKey";
    byId("regEsoTlsRemoteKeyCert").value = "git/tls-cert";
    byId("regEsoTlsRemoteKeyKey").value = "git/tls-key";

    resetRaw('registry');
    byId('regSecretName').value = 'harbor-charts';
    byId('regNamespace').value = 'argocd';
    byId('regLabels').value = '';
    byId('regAnnotations').value = '';
    byId('regSecretType').value = 'Opaque';
    byId('regSecretTypeCustom').value = '';
    byId('regSecretTypeCustomBlock').style.display = 'none';
    byId('regEncoding').value = 'stringdata';
    byId('regEsoApiVersion').value = 'external-secrets.io/v1';
    byId('regEsoCreationPolicy').value = 'Owner';
    byId('regKind').value = 'repository';
    byId('regType').value = 'git';
    byId('regAuthMethod').value = 'none';
    byId('regCredSource').value = 'inline';
    byId('regUsername').value = '';
    byId('regPassword').value = '';
    byId('regSshKey').value = '';
    byId('regTlsCert').value = '';
    byId('regTlsKey').value = '';
    byId('regUrl').value = '';
    byId('regName').value = '';
    byId('regInsecure').checked = false;
    byId('regEsoStoreKind').value = 'ClusterSecretStore';
    byId('regEsoStoreName').value = 'vault-backend';
    byId('regEsoRefreshInterval').value = '1h';
    byId('regEsoSeparatePaths').checked = false;
    byId('regEsoRemoteKey').value = 'secret/data/harbor/robot-account';
    byId('regEsoPropUser').value = 'username';
    byId('regEsoPropPass').value = 'password';
    byId('regEsoRemoteKeyUser').value = 'secret/data/harbor/robot-account';
    byId('regEsoRemoteKeyPass').value = 'secret/data/harbor/robot-account';
    byId('regProjectEnabled').checked = false;
    byId('regProject').value = '';
    byId('regProjectFromVault').checked = false;
    byId('regUrlFromVault').checked = false;
    byId('regNameFromVault').checked = false;
    byId('regUrlVaultKey').value = '';
    byId('regUrlVaultProp').value = 'url';
    byId('regNameVaultKey').value = '';
    byId('regNameVaultProp').value = 'name';
    byId('regProjectVaultKey').value = '';
    byId('regProjectVaultProp').value = 'project';
    byId('regSshBlock').style.display = 'none';
    byId('regTlsBlock').style.display = 'none';
    byId('regUserpassBlock').style.display = 'none';
    byId('regInlineCredsBlock').style.display = 'none';
    byId('regEsoBlock').style.display = 'none';
    byId('regUrlEsoBlock').style.display = 'none';
    byId('regUrlVaultFields').style.display = 'none';
    byId('regNameEsoBlock').style.display = 'none';
    byId('regNameVaultFields').style.display = 'none';
    byId('regProjectFields').style.display = 'none';
    byId('regProjectEsoBlock').style.display = 'none';
    byId('regProjectVaultFields').style.display = 'none';
    byId('regEsoPropRow').style.display = 'grid';
    byId('regEsoRemoteKeyLabel').style.display = 'block';
    byId('regEsoRemoteKey').style.display = 'block';
    byId('regEsoSeparateBlock').style.display = 'none';
    updateRegistryVisibility();
    applyEsoFieldVisibility();
    generateYaml();
  }
  byId('clearRegistryBtn').addEventListener('click', clearRegistryMode);

  // ---------------- INFO FIELDS ----------------
  function createInfoRow() {
    var div = document.createElement('div');
    div.className = 'source-block';
    div.innerHTML =
      '<button type="button" class="btn-remove remove-info" style="position:absolute;top:10px;right:10px;">Entfernen</button>' +
      '<div class="row"><div><label>Name</label><input type="text" class="info-name" placeholder="CI-Pipeline"></div><div><label>Wert</label><input type="text" class="info-value" placeholder="jenkins-12345"></div></div>';
    infoContainer.appendChild(div);
    div.querySelector('.remove-info').addEventListener('click', function () { div.remove(); generateYaml(); });
    div.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', generateYaml); });
    return div;
  }
  byId('addInfoBtn').addEventListener('click', function () { createInfoRow(); generateYaml(); });

  // ---------------- SYNC WINDOWS ----------------
  function createSyncWindowRow() {
    var div = document.createElement('div');
    div.className = 'source-block';
    div.innerHTML =
      '<button type="button" class="btn-remove remove-syncwindow" style="position:absolute;top:10px;right:10px;">Entfernen</button>' +
      '<div class="row"><div><label>Kind</label><select class="sw-kind"><option value="allow">allow</option><option value="deny">deny</option></select></div><div><label>Schedule (Cron)</label><input type="text" class="sw-schedule" value="0 2 * * 1"></div></div>' +
      '<div class="row"><div><label>Duration</label><input type="text" class="sw-duration" value="2h"></div><div><label>Timezone</label><input type="text" class="sw-timezone" value="Europe/Berlin"></div></div>' +
      '<label>Applications (optional, Komma-getrennt)</label><input type="text" class="sw-applications" placeholder="critical-*,my-app">';
    div.insertAdjacentHTML('beforeend','<label>Namespaces (kommagetrennt)</label><input class="sw-namespaces" type="text"><label>Cluster (kommagetrennt)</label><input class="sw-clusters" type="text"><div class="checkbox-row"><input type="checkbox" class="sw-manualSync"><label>Manual Sync erlauben</label></div>');
    syncWindowsContainer.appendChild(div);
    div.querySelector('.remove-syncwindow').addEventListener('click', function () { div.remove(); generateYaml(); });
    div.querySelectorAll('input,select').forEach(function (el) { el.addEventListener('input', generateYaml); });
    return div;
  }
  byId('enableSyncWindows').addEventListener('change', function (e) {
    syncWindowsContainer.style.display = e.target.checked ? 'block' : 'none';
    byId('addSyncWindowBtn').style.display = e.target.checked ? 'inline-block' : 'none';
    generateYaml();
  });
  byId('addSyncWindowBtn').addEventListener('click', function () { createSyncWindowRow(); generateYaml(); });

  // ---------------- SOURCE BLOCKS ----------------
  function createSourceBlock(index, isFirst, opts, targetContainer) {
    opts = Object.assign({}, opts || {});
    Object.keys(opts).forEach(function(k){if(typeof opts[k]==='string') opts[k]=escapeHtml(opts[k]);});
    targetContainer = targetContainer || sourcesContainer;
    var div = document.createElement('div');
    div.className = 'source-block';
    var removeBtnHtml = isFirst ? '' : '<button type="button" class="btn-remove remove-source" style="position:absolute;top:10px;right:10px;">Entfernen</button>';
    div.innerHTML =
      '<h4>Source #' + (index + 1) + '</h4>' + removeBtnHtml +
      '<label>Repository URL</label><input type="text" class="src-repoUrl" value="' + (opts.repoUrl || 'https://github.com/example/repo.git') + '">' +
      '<div class="row"><div><label>Target Revision</label><input type="text" class="src-targetRevision" value="' + (opts.targetRevision || 'HEAD') + '"></div>' +
      '<div><label>Pfad im Repo (Path)</label><input type="text" class="src-path" value="' + (opts.path || 'apps/my-app') + '"></div></div>' +
      '<label>Ref-Name (optional)</label><input type="text" class="src-ref" value="' + (opts.ref || '') + '">' +
      '<label>Quelltyp</label><select class="src-type"><option value="plain">Plain</option><option value="directory">Directory/Recurse</option><option value="helm">Helm Chart</option><option value="kustomize">Kustomize</option><option value="refonly">Nur Referenz-Quelle</option><option value="plugin">Plugin</option></select>' +
      '<div class="src-helm-block" style="display:none;margin-top:8px;"><div class="row"><div><label>Chart Name</label><input type="text" class="src-chart" value="' + (opts.chart || '') + '"></div><div><label>Release Name</label><input type="text" class="src-releaseName" value="' + (opts.releaseName || '') + '"></div></div>' +
      '<label>Value Files (eine pro Zeile)</label><textarea class="src-valueFiles">' + (opts.valueFiles || '') + '</textarea>' +
      '<label>Inline Helm Values</label><textarea class="src-helmValues">' + (opts.helmValues || '') + '</textarea>' +
      '<label>Helm valuesObject (YAML-Block)</label><textarea class="src-helmValuesObjects" placeholder="global:\n  environment: production"></textarea>' +
      '<label>Helm Parameter (name=value)</label><textarea class="src-helmParams">' + (opts.helmParams || '') + '</textarea>' +
      '<label>File Parameters (name=path)</label><textarea class="src-helmFileParams">' + (opts.helmFileParams || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px;"><div class="checkbox-row"><input type="checkbox" class="src-helm-skipCrds"><label>skipCrds</label></div><div class="checkbox-row"><input type="checkbox" class="src-helm-ignoreMissingValueFiles"><label>ignoreMissingValueFiles</label></div></div>' +
      '<div class="row" style="margin-top:4px;"><div class="checkbox-row"><input type="checkbox" class="src-helm-passCredentials"><label>passCredentials</label></div><div class="checkbox-row"><input type="checkbox" class="src-helm-releaseNamespace"><label>releaseNamespace</label></div></div>' +
      '<div class="row" style="margin-top:4px;"><div><label>namespace</label><input type="text" class="src-helm-namespace" placeholder="kube-system"></div><div><label>kubeVersion</label><input type="text" class="src-helm-kubeVersion" placeholder="1.29.0"></div></div>' +
      '<label>apiVersions (eine pro Zeile)</label><textarea class="src-helm-apiVersions" placeholder="policy/v1&#10;networking.k8s.io/v1"></textarea></div>' +
      '<div class="src-kustomize-block" style="display:none;margin-top:8px;"><label>Image Overrides (name=image:tag)</label><textarea class="src-kustomizeImages" placeholder="myapp=harbor.example.com/team/myapp:1.4.2"></textarea><label>Namespace-Override</label><input type="text" class="src-kustomizeNamespace" placeholder="payments">' +
      '<label>Kustomize Version</label><input type="text" class="src-kustomizeVersion" placeholder="v4.6.0">' +
      '<label>Name Prefix</label><input type="text" class="src-kustomizeNamePrefix" placeholder="prod-">' +
      '<label>Name Suffix</label><input type="text" class="src-kustomizeNameSuffix" placeholder="-v2">' +
      '<label>Common Labels (key=value)</label><textarea class="src-kustomizeCommonLabels" placeholder="team=platform"></textarea>' +
      '<label>Common Annotations (key=value)</label><textarea class="src-kustomizeCommonAnnotations" placeholder="owner=platform-team"></textarea>' +
      '<label>Replicas (name=count)</label><textarea class="src-kustomizeReplicas" placeholder="myapp-deployment=3"></textarea>' +
      '<label>Patches (JSON, eine pro Zeile)</label><textarea class="src-kustomizePatches" placeholder="{&quot;op&quot;:&quot;replace&quot;,&quot;path&quot;:&quot;/spec/replicas&quot;,&quot;value&quot;:3}"></textarea>' +
      '<label>Patches JSON6902 (eine pro Zeile)</label><textarea class="src-kustomizePatchesJson6902" placeholder="target:&#10;  kind: Deployment&#10;  name: myapp&#10;patch: |-&#10;  - op: replace&#10;    path: /spec/replicas&#10;    value: 3"></textarea>' +
      '<label>Patches Strategic Merge (YAML-Block)</label><textarea class="src-kustomizePatchesStrategicMerge" placeholder="apiVersion: apps/v1&#10;kind: Deployment&#10;metadata:&#10;  name: myapp&#10;spec:&#10;  replicas: 3"></textarea></div>' +
      '<div class="src-plugin-block" style="display:none;margin-top:8px;"><label>Plugin Name</label><input type="text" class="src-pluginName" placeholder="my-custom-plugin">' +
      '<label>Environment (name=value)</label><textarea class="src-pluginEnv" placeholder="ENVIRONMENT=production"></textarea>' +
      '<label>Plugin Parameters (name=value)</label><textarea class="src-pluginParams" placeholder="image-tag=1.4.2"></textarea>' +
      '<label>ConfigMapRef (optional)</label><input type="text" class="src-pluginConfigMapRef" placeholder="my-plugin-cm"></div>' +
      '<div class="src-directory-block" style="display:none;margin-top:8px;"><div class="checkbox-row"><input type="checkbox" class="src-recurse" checked><label>recurse</label></div>' +
      '<label>Include-Glob (eine pro Zeile)</label><textarea class="src-directoryInclude" placeholder="*.yaml"></textarea><label>Exclude-Glob (eine pro Zeile)</label><textarea class="src-directoryExclude" placeholder="*-test.yaml"></textarea></div>' +
      '<div class="src-refonly-hint hint" style="display:none;margin-top:8px;">Nur repoURL/targetRevision/path/ref werden ausgegeben.</div>';
    div.insertAdjacentHTML('beforeend','<details style="margin-top:12px;"><summary>Weitere Source-Felder</summary><p class="hint">YAML-Mapping. Diese Felder übersteuern die Formularwerte; importierte erweiterte Parameter bleiben hier erhalten.</p><textarea class="src-extraFields" placeholder="helm:\n  version: v3"></textarea></details>');
    var hs=div.querySelector('.helm-block')||div.querySelector('.src-helm-block');
    div.querySelector('.src-helm-releaseNamespace').disabled=true;
    div.querySelector('.src-helm-releaseNamespace').closest('.checkbox-row').title='Nicht Teil der Application-Helm-Spezifikation; wird nicht exportiert.';
    var row=document.createElement('div');row.className='checkbox-row';row.innerHTML='<input type="checkbox" class="src-helm-skipSchemaValidation"><label>Helm skipSchemaValidation</label>';
    div.querySelector('.src-helm-skipCrds').closest('.checkbox-row').parentElement.appendChild(row);
    div.querySelector('.src-kustomizePatches').previousElementSibling.textContent='Patches (YAML-Liste mit target und patch)';
    div.querySelector('.src-pluginConfigMapRef').disabled=true;
    targetContainer.appendChild(div);
    var typeSelect = div.querySelector('.src-type');
    var helmBlock = div.querySelector('.src-helm-block');
    var kustomizeBlock = div.querySelector('.src-kustomize-block');
    var pluginBlock = div.querySelector('.src-plugin-block');
    var directoryBlock = div.querySelector('.src-directory-block');
    var refonlyHint = div.querySelector('.src-refonly-hint');
    function updateVis() {
      helmBlock.style.display = typeSelect.value === 'helm' ? 'block' : 'none';
      kustomizeBlock.style.display = typeSelect.value === 'kustomize' ? 'block' : 'none';
      pluginBlock.style.display = typeSelect.value === 'plugin' ? 'block' : 'none';
      directoryBlock.style.display = typeSelect.value === 'directory' ? 'block' : 'none';
      refonlyHint.style.display = typeSelect.value === 'refonly' ? 'block' : 'none';
    }
    typeSelect.addEventListener('change', function () { updateVis(); generateYaml(); });
    if (opts.type) typeSelect.value = opts.type;
    updateVis();
    var removeBtn = div.querySelector('.remove-source');
    if (removeBtn) removeBtn.addEventListener('click', function () { div.remove(); generateYaml(); });

    return div;
  }

  function createIgnoreDiffRow() {
    var div = document.createElement('div');
    div.className = 'source-block';
    div.innerHTML =
      '<button type="button" class="btn-remove remove-idiff" style="position:absolute;top:10px;right:10px;">Entfernen</button>' +
      '<div class="row"><div><label>Group</label><input type="text" class="idiff-group" placeholder="apps"></div><div><label>Kind</label><input type="text" class="idiff-kind" placeholder="Deployment"></div></div>' +
      '<div class="row"><div><label>Name</label><input type="text" class="idiff-name" placeholder="my-app"></div><div><label>Namespace</label><input type="text" class="idiff-namespace" placeholder="production"></div></div>' +
      '<label>JSON Pointers (eine pro Zeile)</label><textarea class="idiff-jsonpointers" placeholder="/spec/replicas"></textarea>' +
      '<label>JQ Path Expressions (eine pro Zeile)</label><textarea class="idiff-jqpath" placeholder=".spec.template.spec.containers[].image"></textarea>' +
      '<label>Managed Fields Managers (eine pro Zeile)</label><textarea class="idiff-managedFieldsManagers" placeholder="kube-controller-manager"></textarea>';
    ignoreDiffContainer.appendChild(div);
    div.querySelector('.remove-idiff').addEventListener('click', function () { div.remove(); generateYaml(); });
    div.querySelectorAll('input,textarea').forEach(function (el) { el.addEventListener('input', generateYaml); });
    return div;
  }

  byId('addAsTplSourceBtn').addEventListener('click', function () {
    createSourceBlock(asTplSourceCount++, false, {}, asTplSourcesContainer);
    generateYaml();
  });
  byId('presetAsTplHarborBtn').addEventListener('click', function () {
    asTplSourcesContainer.innerHTML = ''; asTplSourceCount = 0;
    var values = createSourceBlock(asTplSourceCount++, true,
      {repoUrl:'https://git.example.com/team/gitops-values.git',targetRevision:'main',ref:'values',type:'refonly'}, asTplSourcesContainer);
    values.querySelector('.src-path').value = '';
    var chart = createSourceBlock(asTplSourceCount++, false,
      {repoUrl:'harbor.example.com/my-project',targetRevision:'1.4.2',chart:'my-app',type:'helm',valueFiles:'$values/apps/my-app/values.yaml'}, asTplSourcesContainer);
    chart.querySelector('.src-path').value = '';
    generateYaml();
  });
    byId('addSourceBtn').addEventListener('click', function () { createSourceBlock(sourceCount++, sourceCount === 1); generateYaml(); });
  byId('addIgnoreDiffBtn').addEventListener('click', function () { createIgnoreDiffRow(); generateYaml(); });
  byId('presetHarborBtn').addEventListener('click', function () {
    sourcesContainer.innerHTML = ''; sourceCount = 0;
    createSourceBlock(sourceCount++, true, { repoUrl: 'https://git.example.com/team/gitops-values.git', targetRevision: 'main', path: 'apps/my-app', ref: 'values', type: 'refonly' });
    createSourceBlock(sourceCount++, false, { repoUrl: 'https://harbor.example.com/chartrepo/my-project', targetRevision: '1.4.2', chart: 'my-app', type: 'helm', valueFiles: '$values/apps/my-app/values.yaml' });
    generateYaml();
  });
  byId('destMode').addEventListener('change', function (e) {
    var label = byId('destValueLabel'); var input = byId('destValue');
    label.textContent=e.target.value==='server'?'Server':'Cluster Name';
    generateYaml();
  });
  byId('syncAutomated').addEventListener('change', function (e) { byId('automatedOptions').style.opacity = e.target.checked ? '1' : '0.4'; generateYaml(); });
  byId('enableRetry').addEventListener('change', function (e) {
    byId('retryOptions').style.display = e.target.checked ? 'grid' : 'none';
    byId('retryOptions2').style.display = e.target.checked ? 'grid' : 'none';
    generateYaml();
  });

  // ---------------- FINALIZER PRESETS (Application) ----------------
  byId('presetFinalizerDefaultBtn').addEventListener('click', function () {
    byId('finalizersText').value = 'resources-finalizer.argocd.argoproj.io';
    generateYaml();
    flash(byId('finalizersText').parentElement);
  });
  byId('presetFinalizerNoCascadeBtn').addEventListener('click', function () {
    byId('finalizersText').value = '';
    generateYaml();
    flash(byId('finalizersText').parentElement);
  });
  byId('presetFinalizerCustomBtn').addEventListener('click', function () {
    byId('finalizersText').value = 'resources-finalizer.argocd.argoproj.io\nfinalizer.argocd.argoproj.io/custom-cascade';
    generateYaml();
    flash(byId('finalizersText').parentElement);
  });

  // ---------------- FINALIZER PRESETS (ApplicationSet) ----------------
  byId('presetFinalizerDefaultBtn2').addEventListener('click', function () {
    byId('asFinalizers').value = 'resources-finalizer.argocd.argoproj.io';
    generateYaml();
    flash(byId('asFinalizers').parentElement);
  });
  byId('presetFinalizerNoCascadeBtn2').addEventListener('click', function () {
    byId('asFinalizers').value = '';
    generateYaml();
    flash(byId('asFinalizers').parentElement);
  });
  byId('presetFinalizerCustomBtn2').addEventListener('click', function () {
    byId('asFinalizers').value = 'resources-finalizer.argocd.argoproj.io\nfinalizer.argocd.argoproj.io/custom-cascade';
    generateYaml();
    flash(byId('asFinalizers').parentElement);
  });

  function buildSourceObject(block) {
    function v(cls){return block.querySelector('.'+cls).value.trim();}
    function on(cls){return block.querySelector('.'+cls).checked;}
    var type=v('src-type'), source={repoURL:v('src-repoUrl'),targetRevision:v('src-targetRevision')};
    if(v('src-ref'))source.ref=v('src-ref');
    if(type==='helm'&&v('src-chart'))source.chart=v('src-chart');
    else if(v('src-path')&&type!=='refonly')source.path=v('src-path');
    if(type==='helm') {
      var h={};
      if(v('src-releaseName'))h.releaseName=v('src-releaseName');
      if(v('src-valueFiles'))h.valueFiles=linesOf(v('src-valueFiles'));
      if(v('src-helmParams'))h.parameters=kvLines(v('src-helmParams')).map(function(p){return {name:p[0],value:p[1]};});
      if(v('src-helmFileParams'))h.fileParameters=kvLines(v('src-helmFileParams')).map(function(p){return {name:p[0],path:p[1]};});
      var inline=block.querySelector('.src-helmValues').value;
      if(inline)h.values=inline;
      if(v('src-helmValuesObjects'))h.valuesObject=yamlBlock(v('src-helmValuesObjects'),'object','Helm valuesObject');
      [['src-helm-skipCrds','skipCrds'],['src-helm-ignoreMissingValueFiles','ignoreMissingValueFiles'],['src-helm-passCredentials','passCredentials'],['src-helm-skipSchemaValidation','skipSchemaValidation']].forEach(function(p){if(on(p[0]))h[p[1]]=true;});
      if(v('src-helm-namespace'))h.namespace=v('src-helm-namespace');
      if(v('src-helm-kubeVersion'))h.kubeVersion=v('src-helm-kubeVersion');
      if(v('src-helm-apiVersions'))h.apiVersions=linesOf(v('src-helm-apiVersions'));
      if(Object.keys(h).length)source.helm=h;
    }else if(type==='kustomize'){
      var k={};
      [['src-kustomizeVersion','version'],['src-kustomizeNamespace','namespace'],['src-kustomizeNamePrefix','namePrefix'],['src-kustomizeNameSuffix','nameSuffix']].forEach(function(p){if(v(p[0]))k[p[1]]=v(p[0]);});
      if(v('src-kustomizeImages'))k.images=linesOf(v('src-kustomizeImages'));
      if(v('src-kustomizeCommonLabels'))k.commonLabels=kvObject(v('src-kustomizeCommonLabels'));
      if(v('src-kustomizeCommonAnnotations'))k.commonAnnotations=kvObject(v('src-kustomizeCommonAnnotations'));
      if(v('src-kustomizeReplicas'))k.replicas=kvLines(v('src-kustomizeReplicas')).map(function(p){return {name:p[0],count:integerValue(p[1],1,0,'replicas')};});
      if(v('src-kustomizePatches'))k.patches=yamlBlock(v('src-kustomizePatches'),'array','Kustomize patches');
      if(v('src-kustomizePatchesJson6902')||v('src-kustomizePatchesStrategicMerge'))throw new Error('Legacy-Kustomize-Patches bitte in das YAML-Listenfeld patches übertragen.');
      source.kustomize=k;
    }else if(type==='plugin'){
      var p={};if(v('src-pluginName'))p.name=v('src-pluginName');
      if(v('src-pluginEnv'))p.env=kvLines(v('src-pluginEnv')).map(function(e){return {name:e[0],value:e[1]};});
      if(v('src-pluginParams'))p.parameters=kvLines(v('src-pluginParams')).map(function(e){return {name:e[0],string:e[1]};});
      if(v('src-pluginConfigMapRef'))throw new Error('configMapRef gehört nicht zu Application.spec.source.plugin.');
      source.plugin=p;
    }else if(type==='directory'){
      var d={recurse:on('src-recurse')};
      [['src-directoryInclude','include'],['src-directoryExclude','exclude']].forEach(function(p){var items=linesOf(v(p[0]));if(items.length)d[p[1]]=items.length===1?items[0]:'{'+items.join(',')+'}';});source.directory=d;
    }
    if(v('src-extraFields'))source=mergeOverlay(source,yamlBlock(v('src-extraFields'),'object','Weitere Source-Felder'));
    return source;
  }
  function buildSourceYaml(block, indentLevel) {return objectToYaml(buildSourceObject(block),indentLevel);}
  function populateSource(block, source) {
    var extra=JSON.parse(JSON.stringify(source));
    function take(obj,key,cls){if(obj&&obj[key]!==undefined){block.querySelector('.'+cls).value=Array.isArray(obj[key])?obj[key].join('\n'):String(obj[key]);delete obj[key];}}
    ['repoURL','targetRevision','path','ref','chart'].forEach(function(k){take(extra,k,{'repoURL':'src-repoUrl',targetRevision:'src-targetRevision',path:'src-path',ref:'src-ref',chart:'src-chart'}[k]);});
    var type=source.chart||source.helm?'helm':source.kustomize?'kustomize':source.plugin?'plugin':source.directory?'directory':source.ref&&!source.path?'refonly':'plain';
    var selector=block.querySelector('.src-type');selector.value=type;selector.dispatchEvent(new Event('change'));
    var h=extra.helm;
    if(h){
      take(h,'releaseName','src-releaseName');take(h,'valueFiles','src-valueFiles');take(h,'values','src-helmValues');take(h,'namespace','src-helm-namespace');take(h,'kubeVersion','src-helm-kubeVersion');take(h,'apiVersions','src-helm-apiVersions');
      if(h.valuesObject!==undefined){block.querySelector('.src-helmValuesObjects').value=objectToYaml(h.valuesObject);delete h.valuesObject;}
      [['skipCrds','src-helm-skipCrds'],['ignoreMissingValueFiles','src-helm-ignoreMissingValueFiles'],['passCredentials','src-helm-passCredentials'],['skipSchemaValidation','src-helm-skipSchemaValidation']].forEach(function(p){if(h[p[0]]===true){block.querySelector('.'+p[1]).checked=true;delete h[p[0]];}});
      if(h.parameters&&h.parameters.every(function(p){return Object.keys(p).every(function(k){return ['name','value'].includes(k);})&&typeof p.value==='string'&&!/[\n\r]/.test(p.value);})) {block.querySelector('.src-helmParams').value=h.parameters.map(function(p){return p.name+'='+p.value;}).join('\n');delete h.parameters;}
      if(h.fileParameters){block.querySelector('.src-helmFileParams').value=h.fileParameters.map(function(p){return p.name+'='+p.path;}).join('\n');delete h.fileParameters;}
      if(!Object.keys(h).length)delete extra.helm;
    }
    var k=extra.kustomize;
    if(k){
      [['version','src-kustomizeVersion'],['namespace','src-kustomizeNamespace'],['namePrefix','src-kustomizeNamePrefix'],['nameSuffix','src-kustomizeNameSuffix'],['images','src-kustomizeImages']].forEach(function(p){take(k,p[0],p[1]);});
      ['commonLabels','commonAnnotations'].forEach(function(key){if(k[key]){block.querySelector('.src-kustomize'+(key==='commonLabels'?'CommonLabels':'CommonAnnotations')).value=objToKVLines(k[key]);delete k[key];}});
      if(k.replicas){block.querySelector('.src-kustomizeReplicas').value=k.replicas.map(function(r){return r.name+'='+r.count;}).join('\n');delete k.replicas;}
      if(k.patches){block.querySelector('.src-kustomizePatches').value=objectToYaml(k.patches);delete k.patches;}
      if(!Object.keys(k).length)delete extra.kustomize;
    }
    if(extra.directory){take(extra.directory,'include','src-directoryInclude');take(extra.directory,'exclude','src-directoryExclude');if(extra.directory.recurse!==undefined){block.querySelector('.src-recurse').checked=extra.directory.recurse;if(extra.directory.recurse)delete extra.directory.recurse;}if(!Object.keys(extra.directory).length)delete extra.directory;}
    if(extra.plugin){take(extra.plugin,'name','src-pluginName');if(!Object.keys(extra.plugin).length)delete extra.plugin;}
    block.querySelector('.src-extraFields').value=Object.keys(extra).length?objectToYaml(extra):'';
  }

  // ---------------- GENERATORS (v5: alle Typen) ----------------
  function createGeneratorBlock(index, opts, isFirst) {
    opts = opts || {};
    if (isFirst === undefined) {
      isFirst = (generatorsContainer.children.length === 0);
    }
    var div = document.createElement('div');
    div.className = 'source-block';
    var removeBtnHtml = isFirst ? '' : '<button type="button" class="btn-remove remove-gen" style="position:absolute;top:10px;right:10px;">Entfernen</button>';
    div.innerHTML =
      '<h4>Generator #' + (index + 1) + ' <span class="generator-type-badge" data-type="list">list</span></h4>' +
      removeBtnHtml +
      '<label>Generator-Typ</label><select class="gen-type"><option value="list">List</option><option value="clusters">Clusters</option><option value="git">Git</option><option value="scmProvider">SCM Provider</option><option value="pullRequest">Pull Request</option><option value="clusterDecisionResource">Cluster Decision Resource</option></select>' +
      '<div class="gen-list-block" style="display:none;margin-top:8px;"><label>Elemente (key=value, kommagetrennt, eine Zeile pro Element)</label><textarea class="gen-list-elements" placeholder="cluster=prod,region=eu&#10;cluster=staging,region=eu"></textarea></div>' +
      '<div class="gen-clusters-block" style="display:none;margin-top:8px;"><label>Label-Selector (key=value, matchLabels)</label><textarea class="gen-clusters-labels" placeholder="env=prod"></textarea>' +
      '<div class="sub-box"><div class="checkbox-row"><input type="checkbox" class="gen-clusters-values-enable"><label>values (Cluster-Metadaten injizieren)</label></div>' +
      '<label >values (key=Template, eine pro Zeile)</label><textarea class="gen-clusters-values"  placeholder="region={{metadata.labels.region}}"></textarea></div></div>' +
      '<div class="gen-git-block" style="display:none;margin-top:8px;"><label>Repository URL</label><input type="text" class="gen-git-repoUrl" value="https://github.com/org/app-configs"><label>Revision</label><input type="text" class="gen-git-revision" value="main">' +
      '<label>Directories (Glob, eine pro Zeile)</label><textarea class="gen-git-dirs">apps/production/*</textarea>' +
      '<label>Files (YAML-Pfade, eine pro Zeile)</label><textarea class="gen-git-files" placeholder="apps/*/config.yaml"></textarea></div>' +
      '<div class="gen-matrix-block" style="display:none;margin-top:8px;"><div class="hint">Matrix kombiniert die ersten 2 Sub-Generatoren als Kreuzprodukt. Füge unten mindestens 2 Generatoren hinzu.</div></div>' +
      '<div class="gen-merge-block" style="display:none;margin-top:8px;"><label>mergePriority (0-10, höher = Override)</label><input type="number" class="gen-merge-priority" value="2"></div>' +
      '<div class="gen-scm-block" style="display:none;margin-top:8px;"><label>Provider</label><select class="gen-scm-provider"><option value="github">GitHub</option><option value="gitlab">GitLab</option></select>' +
      '<div class="gen-scm-github-block"><label>API (optional, Enterprise)</label><input type="text" class="gen-scm-api" placeholder="https://api.github.com"><label>Organization</label><input type="text" class="gen-scm-org" value="mycompany">' +
      '<label>Team (optional)</label><input type="text" class="gen-scm-team" placeholder="platform-team"><label>Token-Secret (optional)</label><input type="text" class="gen-scm-tokenRef" placeholder="github-token-secret">' +
      '<label>Filters (name-Glob, eine pro Zeile)</label><textarea class="gen-scm-filters">^.*\\.prod\\..*$</textarea></div>' +
      '<div class="gen-scm-gitlab-block" style="display:none;"><label>API</label><input type="text" class="gen-scm-gitlab-api" value="https://gitlab.com"><label>Group</label><input type="text" class="gen-scm-gitlab-group" value="mygroup"></div></div>' +
      '<div class="gen-pr-block" style="display:none;margin-top:8px;"><label>Provider</label><select class="gen-pr-provider"><option value="github">GitHub</option></select>' +
      '<div class="gen-pr-github-block"><label>Owner</label><input type="text" class="gen-pr-owner" value="myorg"><label>Repository</label><input type="text" class="gen-pr-repo" value="app-manifests">' +
      '<label>API (optional)</label><input type="text" class="gen-pr-api" placeholder="https://api.github.com"><label>Labels (eine pro Zeile)</label><textarea class="gen-pr-labels">preview\nready-to-review</textarea></div></div>' +
      '<div class="gen-cdr-block" style="display:none;margin-top:8px;"><label>ConfigMap Name</label><input type="text" class="gen-cdr-configmap" value="cluster-deployment-decisions"><label>Key (optional)</label><input type="text" class="gen-cdr-key" value="clusters"></div>';
    div.insertAdjacentHTML('beforeend','<details><summary>Weitere Generator-Felder</summary><p class="hint">YAML-Mapping; übersteuert die Formularfelder. Auch selector, template und zusätzliche Generator-Typen bleiben hier erhalten.</p><textarea class="gen-extraFields"></textarea></details>');
    div.querySelector('.gen-scm-team').disabled=true;
    div.querySelector('.gen-scm-team').title='Team ist kein unterstütztes GitHub-SCM-Generator-Feld.';
    div.querySelector('.gen-scm-filters').previousElementSibling.textContent='Repository-Regex (eine pro Zeile)';
    div.querySelector('.gen-cdr-key').previousElementSibling.textContent='Resource-Name (optional; alternativ labelSelector in Weitere Generator-Felder)';
    div.querySelector('.gen-scm-tokenRef').previousElementSibling.textContent='Token-Secret: secretName/key (key standardmäßig token)';
    div.querySelector('.gen-scm-provider').addEventListener('change',function(){div.querySelector('.gen-scm-github-block').style.display=this.value==='github'?'block':'none';div.querySelector('.gen-scm-gitlab-block').style.display=this.value==='gitlab'?'block':'none';});
    if((opts.type||'list')==='list')div.querySelector('.gen-list-elements').value='name=example-app,server=https://kubernetes.default.svc,namespace=default,repoURL=https://github.com/argoproj/argocd-example-apps.git,branch=HEAD,path=guestbook';
    generatorsContainer.appendChild(div);
    var typeSelect = div.querySelector('.gen-type');
    var listBlock = div.querySelector('.gen-list-block');
    var clustersBlock = div.querySelector('.gen-clusters-block');
    var gitBlock = div.querySelector('.gen-git-block');
    var matrixBlock = div.querySelector('.gen-matrix-block');
    var mergeBlock = div.querySelector('.gen-merge-block');
    var scmBlock = div.querySelector('.gen-scm-block');
    var prBlock = div.querySelector('.gen-pr-block');
    var cdrBlock = div.querySelector('.gen-cdr-block');
    var typeBadge = div.querySelector('.generator-type-badge');
    function updateVis() {
      var t = typeSelect.value;
      typeBadge.setAttribute('data-type', t);
      typeBadge.textContent = t;
      listBlock.style.display = t === 'list' ? 'block' : 'none';
      clustersBlock.style.display = t === 'clusters' ? 'block' : 'none';
      gitBlock.style.display = t === 'git' ? 'block' : 'none';
      matrixBlock.style.display = t === 'matrix' ? 'block' : 'none';
      mergeBlock.style.display = t === 'merge' ? 'block' : 'none';
      scmBlock.style.display = t === 'scmProvider' ? 'block' : 'none';
      prBlock.style.display = t === 'pullRequest' ? 'block' : 'none';
      cdrBlock.style.display = t === 'clusterDecisionResource' ? 'block' : 'none';
    }
    typeSelect.addEventListener('change', function () { updateVis(); generateYaml(); });
    if (opts.type) typeSelect.value = opts.type;
    updateVis();
    var remGen = div.querySelector('.remove-gen'); if (remGen) remGen.addEventListener('click', function () { div.remove(); generateYaml(); });

    return div;
  }
  byId('addGeneratorBtn').addEventListener('click', function () { createGeneratorBlock(generatorCount++); generateYaml(); });
  byId('presetClusterGenBtn').addEventListener('click', function () {
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var b = createGeneratorBlock(generatorCount++, { type: 'clusters' });
    b.querySelector('.gen-clusters-labels').value = 'env=production';
    generateYaml();
  });
  byId('presetListGenBtn').addEventListener('click', function () {
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var b = createGeneratorBlock(generatorCount++, { type: 'list' }, true);
    b.querySelector('.gen-list-elements').value =
      'cluster=eu-west-1, namespace=prod-eu, repoURL=https://github.com/prod-eu-apps, branch=main, region=europe\n' +
      'cluster=us-east-1, namespace=prod-us, repoURL=https://github.com/prod-us-apps, branch=main, region=usa';
    generateYaml();
  });
  byId('presetGitGenBtn').addEventListener('click', function () {
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var b = createGeneratorBlock(generatorCount++, { type: 'git' });
    b.querySelector('.gen-git-dirs').value = 'apps/production/*';
    generateYaml();
  });
  byId('presetMatrixGenBtn').addEventListener('click', function () {
    byId('asCombineMode').value = 'matrix';
    if (byId('asMergeOptionsBlock')) byId('asMergeOptionsBlock').style.display = 'none';
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var l = createGeneratorBlock(generatorCount++, { type: 'list' }, true);
    l.querySelector('.gen-list-elements').value = 'env=prod\nenv=staging';
    var c = createGeneratorBlock(generatorCount++, { type: 'clusters' }, false);
    c.querySelector('.gen-clusters-labels').value = 'tier=backend';
    generateYaml();
    flash(generatorsContainer);
  });
  byId('presetMergeGenBtn').addEventListener('click', function () {
    byId('asCombineMode').value = 'merge';
    byId('asMergeOptionsBlock').style.display = 'block';
    byId('asMergeKeys').value = 'cluster';
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var base = createGeneratorBlock(generatorCount++, {type:'list'}, true);
    base.querySelector('.gen-list-elements').value = 'cluster=prod, replicas=2\ncluster=staging, replicas=1';
    var override = createGeneratorBlock(generatorCount++, {type:'list'}, false);
    override.querySelector('.gen-list-elements').value = 'cluster=prod, replicas=5';
    generateYaml(); flash(generatorsContainer);
  });
  byId('presetScmGenBtn').addEventListener('click', function () {
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var b = createGeneratorBlock(generatorCount++, { type: 'scmProvider' });
    b.querySelector('.gen-scm-org').value = 'mycompany';
    b.querySelector('.gen-scm-team').value = 'devops';
    b.querySelector('.gen-scm-filters').value = '^.*\\.prod\\..*$';
    generateYaml();
  });
  byId('presetPullRequestGenBtn').addEventListener('click', function () {
    generatorsContainer.innerHTML = ''; generatorCount = 0;
    var b = createGeneratorBlock(generatorCount++, { type: 'pullRequest' });
    b.querySelector('.gen-pr-owner').value = 'myorg';
    b.querySelector('.gen-pr-repo').value = 'app-manifests';
    b.querySelector('.gen-pr-labels').value = 'preview\nready-to-review';
    generateYaml();
  });

  function buildGeneratorObject(block) {
    function v(cls){return block.querySelector('.'+cls).value.trim();}
    var type=v('gen-type'), g={};
    if(type==='list')g.list={elements:parseListElements(v('gen-list-elements'))};
    else if(type==='clusters'){
      var c={};if(v('gen-clusters-labels'))c.selector={matchLabels:kvObject(v('gen-clusters-labels'))};
      if(block.querySelector('.gen-clusters-values-enable').checked&&v('gen-clusters-values'))c.values=kvObject(v('gen-clusters-values'));g.clusters=c;
    }else if(type==='git'){
      var git={repoURL:v('gen-git-repoUrl'),revision:v('gen-git-revision')};
      if(v('gen-git-dirs'))git.directories=linesOf(v('gen-git-dirs')).map(function(p){return {path:p};});
      if(v('gen-git-files'))git.files=linesOf(v('gen-git-files')).map(function(p){return {path:p};});g.git=git;
    }else if(type==='scmProvider'){
      var provider=v('gen-scm-provider'), scm={};
      if(provider==='github'){
        var github={organization:v('gen-scm-org')};if(v('gen-scm-api'))github.api=v('gen-scm-api');
        if(v('gen-scm-tokenRef')){var parts=v('gen-scm-tokenRef').split('/');github.tokenRef={secretName:parts[0],key:parts[1]||'token'};}scm.github=github;
        if(v('gen-scm-filters'))scm.filters=linesOf(v('gen-scm-filters')).map(function(pattern){return {repositoryMatch:pattern};});
      }else scm.gitlab={api:v('gen-scm-gitlab-api'),group:v('gen-scm-gitlab-group')};g.scmProvider=scm;
    }else if(type==='pullRequest'){
      var pr={owner:v('gen-pr-owner'),repo:v('gen-pr-repo')};if(v('gen-pr-api'))pr.api=v('gen-pr-api');
      if(v('gen-pr-labels'))pr.labels=linesOf(v('gen-pr-labels'));g.pullRequest={github:pr};
    }else if(type==='clusterDecisionResource'){
      var cdr={configMapRef:v('gen-cdr-configmap')};if(v('gen-cdr-key'))cdr.name=v('gen-cdr-key');g.clusterDecisionResource=cdr;
    }
    if(v('gen-extraFields')){
      var extra=yamlBlock(v('gen-extraFields'),'object','Weitere Generator-Felder');
      var types=['list','clusters','git','scmProvider','pullRequest','clusterDecisionResource','matrix','merge','plugin'];
      if(types.some(function(k){return extra[k]!==undefined;}))types.forEach(function(k){if(extra[k]===undefined)delete g[k];});
      g=mergeOverlay(g,extra);
    }return g;
  }
  function buildGeneratorEntryYaml(block, indentLevel){return objectToYaml([buildGeneratorObject(block)],indentLevel);}
  function populateGenerator(block,g) {
    var type=Object.keys(g).find(function(k){return ['selector','template'].indexOf(k)===-1;})||'list';
    var sel=block.querySelector('.gen-type');sel.value=type;
    if(!sel.value)sel.value='list';sel.dispatchEvent(new Event('change'));
    block.querySelector('.gen-scm-filters').value='';block.querySelector('.gen-git-dirs').value='';
    if(g.list&&g.list.elements)block.querySelector('.gen-list-elements').value=objectToYaml(g.list.elements);
    if(g.git){block.querySelector('.gen-git-repoUrl').value=g.git.repoURL||'';block.querySelector('.gen-git-revision').value=g.git.revision||'HEAD';if(g.git.directories)block.querySelector('.gen-git-dirs').value=g.git.directories.map(function(p){return p.path;}).join('\n');if(g.git.files)block.querySelector('.gen-git-files').value=g.git.files.map(function(p){return p.path;}).join('\n');}
    if(g.clusters){if(g.clusters.selector&&g.clusters.selector.matchLabels)block.querySelector('.gen-clusters-labels').value=objToKVLines(g.clusters.selector.matchLabels);if(g.clusters.values){block.querySelector('.gen-clusters-values-enable').checked=true;block.querySelector('.gen-clusters-values').value=objToKVLines(g.clusters.values);}}
    if(g.scmProvider){var scm=g.scmProvider;if(scm.github){block.querySelector('.gen-scm-org').value=scm.github.organization||'';block.querySelector('.gen-scm-api').value=scm.github.api||'';if(scm.github.tokenRef)block.querySelector('.gen-scm-tokenRef').value=scm.github.tokenRef.secretName+'/'+scm.github.tokenRef.key;}else if(scm.gitlab){block.querySelector('.gen-scm-provider').value='gitlab';block.querySelector('.gen-scm-gitlab-api').value=scm.gitlab.api||'';block.querySelector('.gen-scm-gitlab-group').value=scm.gitlab.group||'';}if(scm.filters&&scm.filters.every(function(f){return Object.keys(f).length===1&&f.repositoryMatch!==undefined;}))block.querySelector('.gen-scm-filters').value=scm.filters.map(function(f){return f.repositoryMatch;}).join('\n');}
    if(g.pullRequest&&g.pullRequest.github){var pr=g.pullRequest.github;block.querySelector('.gen-pr-owner').value=pr.owner||'';block.querySelector('.gen-pr-repo').value=pr.repo||'';block.querySelector('.gen-pr-api').value=pr.api||'';block.querySelector('.gen-pr-labels').value=(pr.labels||[]).join('\n');}
    if(g.clusterDecisionResource){block.querySelector('.gen-cdr-configmap').value=g.clusterDecisionResource.configMapRef||'';block.querySelector('.gen-cdr-key').value=g.clusterDecisionResource.name||'';}
    var extra=missingFields(g,buildGeneratorObject(block));block.querySelector('.gen-extraFields').value=Object.keys(extra).length?objectToYaml(extra):'';
  }

  // ---------------- PROJECT ROWS ----------------
  function createPrjDestRow(isFirst) {
    if (isFirst === undefined) {
      isFirst = (prjDestContainer.children.length === 0);
    }
    var div = document.createElement('div');
    div.className = 'source-block';
    var removeBtnHtml = isFirst ? '' : '<button type="button" class="btn-remove remove-prjdest" style="position:absolute;top:10px;right:10px;">Entfernen</button>';
    div.innerHTML =
      removeBtnHtml +
      '<div class="row"><div><label>Ziel über</label><select class="prjdest-mode"><option value="server">Server-URL</option><option value="name">Cluster-Name</option></select></div>' +
      '<div><label>Wert</label><input type="text" class="prjdest-value" value="https://kubernetes.default.svc"></div></div>' +
      '<div class="row"><div><label>Name (optional)</label><input type="text" class="prjdest-name" placeholder="z. B. in-cluster"></div>' +
      '<div><label>Namespace</label><input type="text" class="prjdest-namespace" value="*"></div></div>';
    prjDestContainer.appendChild(div);
    var removeBtn = div.querySelector('.remove-prjdest');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () { div.remove(); generateYaml(); });
    }
    div.querySelectorAll('input,select').forEach(function (el) { el.addEventListener('input', generateYaml); el.addEventListener('change', generateYaml); });
    return div;
  }
  function createPrjResRow(container, opts) {
    opts = Object.assign({}, opts || {});
    Object.keys(opts).forEach(function(k){if(typeof opts[k]==='string') opts[k]=escapeHtml(opts[k]);});
    var div = document.createElement('div');
    div.className = 'source-block';
    div.innerHTML =
      '<button type="button" class="btn-remove remove-res" style="position:absolute;top:10px;right:10px;">Entfernen</button>' +
      '<div class="row"><div><label>Group ("*" oder leer = core)</label><input type="text" class="res-group" value="' + (opts.group !== undefined ? opts.group : '*') + '"></div>' +
      '<div><label>Kind</label><input type="text" class="res-kind" value="' + (opts.kind !== undefined ? opts.kind : '*') + '"></div></div>';
    container.appendChild(div);
    div.querySelector('.remove-res').addEventListener('click', function () { div.remove(); generateYaml(); });
    div.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', generateYaml); });
    return div;
  }
  function createPrjRoleBlock(opts) {
    opts = Object.assign({}, opts || {});
    Object.keys(opts).forEach(function(k){if(typeof opts[k]==='string') opts[k]=escapeHtml(opts[k]);});
    var div = document.createElement('div');
    div.className = 'source-block';
    div.innerHTML =
      '<button type="button" class="btn-remove remove-role" style="position:absolute;top:10px;right:10px;">Entfernen</button>' +
      '<label>Name</label><input type="text" class="role-name" placeholder="read-only" value="' + (opts.name || '') + '">' +
      '<label>Beschreibung (optional)</label><input type="text" class="role-description" value="' + (opts.description || '') + '">' +
      '<label>Policies (ohne führendes "p, ")</label><textarea class="role-policies">' + (opts.policies || '') + '</textarea>' +
      '<label>Groups</label><textarea class="role-groups">' + (opts.groups || '') + '</textarea>';
    prjRolesContainer.appendChild(div);
    div.querySelector('.remove-role').addEventListener('click', function () { div.remove(); generateYaml(); });
    div.querySelectorAll('input,textarea').forEach(function (el) { el.addEventListener('input', generateYaml); });
    return div;
  }
  byId('addPrjDestBtn').addEventListener('click', function () { createPrjDestRow(); generateYaml(); });
  byId('addPrjClusterResBtn').addEventListener('click', function () { createPrjResRow(prjClusterResContainer); generateYaml(); });
  byId('addPrjNsResBtn').addEventListener('click', function () { createPrjResRow(prjNsResContainer); generateYaml(); });
  byId('addPrjRoleBtn').addEventListener('click', function () { createPrjRoleBlock(); generateYaml(); });
  byId('presetClusterAllowAllBtn').addEventListener('click', function () {
    prjClusterResContainer.innerHTML = '';
    byId('prjClusterMode').value = 'whitelist';
    createPrjResRow(prjClusterResContainer, { group: '*', kind: '*' });
    generateYaml();
    flash(byId('prjClusterResContainer').parentElement);
  });
  byId('presetClusterBlacklistBtn').addEventListener('click', function () {
    prjClusterResContainer.innerHTML = '';
    byId('prjClusterMode').value = 'blacklist';
    var rules = [
      { group: 'rbac.authorization.k8s.io', kind: 'ClusterRole' },
      { group: 'rbac.authorization.k8s.io', kind: 'ClusterRoleBinding' },
      { group: '', kind: 'Namespace' },
      { group: 'apiextensions.k8s.io', kind: 'CustomResourceDefinition' },
      { group: '', kind: 'PersistentVolume' },
      { group: 'admissionregistration.k8s.io', kind: 'ValidatingWebhookConfiguration' }
    ];
    rules.forEach(function (r) { createPrjResRow(prjClusterResContainer, r); });
    generateYaml();
    flash(byId('prjClusterResContainer').parentElement);
  });
  byId('presetNsWhitelistBtn').addEventListener('click', function () {
    prjNsResContainer.innerHTML = '';
    byId('prjNsMode').value = 'whitelist';
    var rules = [
      { group: 'apps', kind: 'Deployment' },
      { group: 'apps', kind: 'StatefulSet' },
      { group: 'apps', kind: 'ReplicaSet' },
      { group: '', kind: 'Service' },
      { group: '', kind: 'ConfigMap' },
      { group: '', kind: 'Secret' },
      { group: '', kind: 'ServiceAccount' },
      { group: 'networking.k8s.io', kind: 'Ingress' },
      { group: 'batch', kind: 'Job' },
      { group: 'batch', kind: 'CronJob' },
      { group: 'autoscaling', kind: 'HorizontalPodAutoscaler' }
    ];
    rules.forEach(function (r) { createPrjResRow(prjNsResContainer, r); });
    generateYaml();
    flash(byId('prjNsResContainer').parentElement);
  });
  byId('presetNsBlacklistBtn').addEventListener('click', function () {
    prjNsResContainer.innerHTML = '';
    byId('prjNsMode').value = 'blacklist';
    var rules = [
      { group: '', kind: 'ResourceQuota' },
      { group: '', kind: 'LimitRange' },
      { group: 'policy', kind: 'PodDisruptionBudget' },
      { group: 'networking.k8s.io', kind: 'NetworkPolicy' }
    ];
    rules.forEach(function (r) { createPrjResRow(prjNsResContainer, r); });
    generateYaml();
    flash(byId('prjNsResContainer').parentElement);
  });
  byId('presetRbacRolesBtn').addEventListener('click', function () {
    prjRolesContainer.innerHTML = '';
    var project = byId('prjName').value.trim() || 'my-project';
    createPrjRoleBlock({
      name: 'admin',
      description: 'Vollzugriff auf Applications, Repositories und Cluster im Projekt',
      policies: 'proj:' + project + ':admin, applications, *, ' + project + '/*, allow\nproj:' + project + ':admin, repositories, *, *, allow\nproj:' + project + ':admin, clusters, get, *, allow',
      groups: 'my-org:platform-admins'
    });
    createPrjRoleBlock({
      name: 'dev',
      description: 'Kann Applications syncen und Aktionen ausführen, aber nicht löschen',
      policies: 'proj:' + project + ':dev, applications, get, ' + project + '/*, allow\nproj:' + project + ':dev, applications, sync, ' + project + '/*, allow\nproj:' + project + ':dev, applications, action/*, ' + project + '/*, allow\nproj:' + project + ':dev, applications, delete, ' + project + '/*, deny',
      groups: 'my-org:developers'
    });
    createPrjRoleBlock({
      name: 'viewer',
      description: 'Nur Lesezugriff auf Applications und Logs',
      policies: 'proj:' + project + ':viewer, applications, get, ' + project + '/*, allow\nproj:' + project + ':viewer, logs, get, ' + project + '/*, allow',
      groups: 'my-org:viewers'
    });
    generateYaml();
    flash(byId('prjRolesContainer').parentElement);
  });

  // ---------------- REGISTRY VISIBILITY ----------------
  function updateRegistryVisibility() {
    var type=byId('regType').value, auth=byId('regAuthMethod').value;
    var sshOption=byId('regAuthMethod').querySelector('option[value="ssh"]');
    if(sshOption)sshOption.disabled=type!=='git';
    if(type!=='git'&&auth==='ssh'){byId('regAuthMethod').value='none';auth='none';}
    var supports=['userpass','ssh','tls'].includes(auth), eso=supports&&byId('regCredSource').value==='eso';
    byId('regCredSourceBlock').style.display=supports?'block':'none';
    byId('regUserpassBlock').style.display=auth==='userpass'&&!eso?'block':'none';
    byId('regInlineCredsBlock').style.display=auth==='userpass'&&!eso?'block':'none';
    byId('regSshBlock').style.display=auth==='ssh'&&!eso?'block':'none';
    byId('regTlsBlock').style.display=auth==='tls'&&!eso?'block':'none';
    byId('regEsoBlock').style.display=eso?'block':'none';
    byId('regEsoUserpassFields').style.display=auth==='userpass'?'block':'none';
    byId('regEsoSshFields').style.display=auth==='ssh'?'block':'none';
    byId('regEsoTlsFields').style.display=auth==='tls'?'block':'none';
    var separate=byId('regEsoSeparatePaths').checked;
    byId('regEsoPropRow').style.display='grid';
    byId('regEsoRemoteKeyLabel').style.display=separate?'none':'block';
    byId('regEsoRemoteKey').style.display=separate?'none':'block';
    byId('regEsoSeparateBlock').style.display=separate?'block':'none';
    var tlsSeparate=byId('regEsoTlsSeparatePaths').checked;
    byId('regEsoTlsCommonFields').style.display=tlsSeparate?'none':'block';
    byId('regEsoTlsSeparateFields').style.display=tlsSeparate?'block':'none';
    byId('regEncoding').disabled=eso;
    byId('regUrlHint').textContent=type==='oci'?'Bei Helm OCI ohne Schema, z. B. harbor.example.com/my-project.':type==='helm'?'Klassisches Helm-Repository inklusive https://.':'Git-Repository-URL (https://, ssh:// oder git@…).';
    byId('regNameFieldLabel').textContent=type==='git'?'Anzeigename (name) – bei Git optional':'Anzeigename (name) – bei Helm/OCI verwendet';
    applyEsoFieldVisibility();
  }

  function applyEsoFieldVisibility() {
    try {
      var auth = byId('regAuthMethod').value;
      var credSource = byId('regCredSource').value;
      var isEso = (['userpass','ssh','tls'].includes(auth) && credSource === 'eso');
      var projectEnabled = byId('regProjectEnabled').checked;

      byId('regProjectFields').style.display = projectEnabled ? 'block' : 'none';
      byId('regProjectEsoBlock').style.display = (projectEnabled && isEso) ? 'block' : 'none';
      var projectFromVault = isEso && byId('regProjectFromVault').checked;
      byId('regProjectVaultFields').style.display = (projectEnabled && projectFromVault) ? 'block' : 'none';
      if (!isEso) byId('regProjectFromVault').checked = false;
      byId('regProjectLabel').textContent = (projectEnabled && projectFromVault) ? 'AppProject-Name (nur als Fallback/Doku)' : 'AppProject-Name';

      byId('regUrlEsoBlock').style.display = isEso ? 'block' : 'none';
      var urlFromVault = isEso && byId('regUrlFromVault').checked;
      byId('regUrlVaultFields').style.display = urlFromVault ? 'block' : 'none';
      if (!isEso) byId('regUrlFromVault').checked = false;

      byId('regNameEsoBlock').style.display = isEso ? 'block' : 'none';
      var nameFromVault = isEso && byId('regNameFromVault').checked;
      byId('regNameVaultFields').style.display = nameFromVault ? 'block' : 'none';
      if (!isEso) byId('regNameFromVault').checked = false;

      var hint = byId('regProjectHint');
      if (byId('regKind').value === 'repository') {
        hint.innerHTML = 'Das Feld <code>project</code> wird direkt in das Secret (bzw. bei ESO in das Template) geschrieben.';
      } else {
        hint.innerHTML = 'Auch bei <code>repo-creds</code> wird <code>project</code> einfach als zusätzliches Feld in dieselben Daten geschrieben.';
      }
    } catch (e) {
      console.error('applyEsoFieldVisibility failed:', e);
    }
  }

  ['regKind', 'regType', 'regAuthMethod', 'regCredSource', 'regEsoSeparatePaths', 'regEsoTlsSeparatePaths', 'regEncoding'].forEach(function (id) {
    byId(id).addEventListener('change', function () { updateRegistryVisibility(); generateYaml(); });
  });
  byId('regSecretType').addEventListener('change', function () {
    byId('regSecretTypeCustomBlock').style.display = this.value === 'custom' ? 'block' : 'none';
    generateYaml();
  });
  byId('regProjectEnabled').addEventListener('change', function () { applyEsoFieldVisibility(); generateYaml(); });
  byId('regProjectEnabled').addEventListener('click', function () { applyEsoFieldVisibility(); });
  ['regProjectFromVault', 'regUrlFromVault', 'regNameFromVault'].forEach(function (id) {
    byId(id).addEventListener('change', function () { applyEsoFieldVisibility(); generateYaml(); });
  });
  ['regProject', 'regProjectVaultKey', 'regProjectVaultProp', 'regUrlVaultKey', 'regUrlVaultProp', 'regNameVaultKey', 'regNameVaultProp'].forEach(function (id) {
    byId(id).addEventListener('input', generateYaml);
    byId(id).addEventListener('change', generateYaml);
  });

  function applyRegistryProjectPreset(project, fromVault) {
    byId('regProjectEnabled').checked = true;
    byId('regProject').value = project;
    byId('regProjectFromVault').checked = !!fromVault;
    byId('regProjectFields').style.display = 'block';
  }

  byId('presetHarborRegistryBtn').addEventListener('click', function () {
    byId('regSecretName').value = 'harbor-oci-charts';
    byId('regEncoding').value = 'stringdata';
    byId('regKind').value = 'repo-creds';
    byId('regType').value = 'oci';
    byId('regUrl').value = 'harbor.example.com/my-project';
    byId('regName').value = 'harbor-oci-charts';
    byId('regAuthMethod').value = 'userpass';
    byId('regCredSource').value = 'inline';
    byId('regUsername').value = 'robot$my-project+robot1';
    byId('regPassword').value = '<robot-account-secret>';
    applyRegistryProjectPreset('platform', false);
    byId('regUrlFromVault').checked = false;
    byId('regNameFromVault').checked = false;
    updateRegistryVisibility();
    applyEsoFieldVisibility();
    generateYaml();
    flash(byId('regProjectBlock'));
  });
  byId('presetHarborEsoBtn').addEventListener('click', function () {
    byId('regSecretName').value = 'harbor-oci-charts';
    byId('regNamespace').value = 'argocd';
    byId('regEncoding').value = 'stringdata';
    byId('regKind').value = 'repo-creds';
    byId('regType').value = 'oci';
    byId('regUrl').value = 'harbor.example.com/my-project';
    byId('regName').value = 'harbor-oci-charts';
    byId('regInsecure').checked = false;
    byId('regAuthMethod').value = 'userpass';
    byId('regCredSource').value = 'eso';
    byId('regEsoStoreKind').value = 'ClusterSecretStore';
    byId('regEsoStoreName').value = 'vault-backend';
    byId('regEsoRefreshInterval').value = '1h';
    byId('regEsoSeparatePaths').checked = false;
    byId('regEsoRemoteKey').value = 'secret/data/harbor/robot-account';
    byId('regEsoPropUser').value = 'username';
    byId('regEsoPropPass').value = 'password';
    applyRegistryProjectPreset('platform', false);
    byId('regUrlFromVault').checked = false;
    byId('regNameFromVault').checked = false;
    updateRegistryVisibility();
    applyEsoFieldVisibility();
    generateYaml();
    flash(byId('regProjectBlock'));
  });
  byId('presetGitEsoStaticProjectBtn').addEventListener('click', function () {
    byId('regSecretName').value = 'harbor-charts';
    byId('regNamespace').value = 'argocd';
    byId('regEncoding').value = 'stringdata';
    byId('regKind').value = 'repository';
    byId('regType').value = 'git';
    byId('regUrl').value = 'harbor.example.com/my-project';
    byId('regName').value = 'harbor-charts';
    byId('regInsecure').checked = false;
    byId('regAuthMethod').value = 'userpass';
    byId('regCredSource').value = 'eso';
    byId('regEsoStoreKind').value = 'ClusterSecretStore';
    byId('regEsoStoreName').value = 'vault-backend';
    byId('regEsoRefreshInterval').value = '1h';
    byId('regEsoSeparatePaths').checked = false;
    byId('regEsoRemoteKey').value = 'secret/data/harbor/robot-account';
    byId('regEsoPropUser').value = 'username';
    byId('regEsoPropPass').value = 'password';
    applyRegistryProjectPreset('platform', false);
    byId('regUrlFromVault').checked = false;
    byId('regNameFromVault').checked = false;
    updateRegistryVisibility();
    applyEsoFieldVisibility();
    generateYaml();
    flash(byId('regProjectBlock'));
  });

  // ---------------- YAML BUILDERS ----------------
  function generateApplicationYaml() {
    var appName = byId('appName').value.trim() || 'my-app';
    var appNamespace = byId('appNamespace').value.trim() || 'argocd';
    var project = byId('project').value.trim() || 'default';
    var labels = kvLines(byId('labels').value);
    var annotations = kvLines(byId('annotations').value);
    var finalizers = byId('finalizersText').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
    var destMode = byId('destMode').value;
    var destValue = byId('destValue').value.trim();
    var destNamespace = byId('destNamespace').value.trim();
    var syncAutomated = byId('syncAutomated').checked;
    var syncPrune = byId('syncPrune').checked;
    var syncSelfHeal = byId('syncSelfHeal').checked;
    var syncAllowEmpty = byId('syncAllowEmpty').checked;
    var optCreateNs = byId('optCreateNs').checked;
    var optPruneLast = byId('optPruneLast').checked;
    var optApplyOutOfSyncOnly = byId('optApplyOutOfSyncOnly').checked;
    var optServerSideApply = byId('optServerSideApply').checked;
    var optReplace = byId('optReplace').checked;
    var optValidate = byId('optValidate').checked;
    var optRespectIgnoreDiff = byId('optRespectIgnoreDiff').checked;
    var optFailOnSharedResource = byId('optFailOnSharedResource').checked;
    var optPruneForeground = byId('optPruneForeground').checked;
    var optPruneBackground = byId('optPruneBackground').checked;
    var optPruneOrphan = byId('optPruneOrphan').checked;
    var optSkipSchemaValidation = byId('optSkipSchemaValidation').checked;
    var optDryRunOnPreview = byId('optDryRunOnPreview').checked;
    var enableRetry = byId('enableRetry').checked;
    var retryLimit = byId('retryLimit').value;
    var retryDuration = byId('retryDuration').value;
    var retryFactor = byId('retryFactor').value;
    var retryMaxDuration = byId('retryMaxDuration').value;
    var enableSyncWindows = byId('enableSyncWindows').checked;
    var syncWindows = Array.prototype.slice.call(syncWindowsContainer.querySelectorAll('.source-block'));
    var sourceBlocks = Array.prototype.slice.call(sourcesContainer.querySelectorAll('.source-block'));
    var multiSource = sourceBlocks.length > 1;
    var infoRows = Array.prototype.slice.call(infoContainer.querySelectorAll('.source-block'));

    var y = [];
    y.push('apiVersion: argoproj.io/v1alpha1'); y.push('kind: Application');
    y.push('metadata:'); y.push('  name: ' + q(appName)); y.push('  namespace: ' + q(appNamespace));
    if (finalizers.length) { y.push('  finalizers:'); finalizers.forEach(function (f) { y.push('    - ' + q(f)); }); }
    if (labels.length) { y.push('  labels:'); labels.forEach(function (kv) { y.push('    ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    if (annotations.length) { y.push('  annotations:'); annotations.forEach(function (kv) { y.push('    ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    y.push('spec:'); y.push('  project: ' + q(project));

    if (multiSource) {
      y.push('  sources:');
      sourceBlocks.forEach(function (block) {
        var built = buildSourceYaml(block, 6);
        var builtLines = built.split('\n');
        y.push('    - ' + builtLines[0].replace(/^\s+/, ''));
        for (var i = 1; i < builtLines.length; i++) y.push(builtLines[i]);
      });
    } else if (sourceBlocks.length === 1) { y.push('  source:'); y.push(buildSourceYaml(sourceBlocks[0], 4)); }

    y.push('  destination:');
    if (destMode === 'server') y.push('    server: ' + q(destValue)); else y.push('    name: ' + q(destValue));
    y.push('    namespace: ' + q(destNamespace));

    var syncPolicyIndex = y.length;
    y.push('  syncPolicy:');
    if (syncAutomated) { y.push('    automated:'); y.push('      prune: ' + syncPrune); y.push('      selfHeal: ' + syncSelfHeal); if (syncAllowEmpty) y.push('      allowEmpty: true'); }
    var syncOptions = [];
    if (optCreateNs) syncOptions.push('CreateNamespace=true');
    if (optPruneLast) syncOptions.push('PruneLast=true');
    if (optApplyOutOfSyncOnly) syncOptions.push('ApplyOutOfSyncOnly=true');
    if (optServerSideApply) syncOptions.push('ServerSideApply=true');
    if (optReplace) syncOptions.push('Replace=true');
    if (optValidate) syncOptions.push('Validate=true');
    if (optRespectIgnoreDiff) syncOptions.push('RespectIgnoreDifferences=true');
    if (optFailOnSharedResource) syncOptions.push('FailOnSharedResource=true');
    if (optPruneForeground) syncOptions.push('PrunePropagationPolicy=foreground');
    if (optPruneBackground) syncOptions.push('PrunePropagationPolicy=background');
    if (optPruneOrphan) syncOptions.push('PrunePropagationPolicy=orphan');


    byId('appExtraSyncOptions').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean).forEach(function (opt) {
      if (syncOptions.indexOf(opt) === -1) syncOptions.push(opt);
    });
    if (syncOptions.length) { y.push('    syncOptions:'); syncOptions.forEach(function (o) { y.push('      - ' + q(o)); }); }
    if (enableRetry) {
      y.push('    retry:'); y.push('      limit: ' + (retryLimit || 5)); y.push('      backoff:');
      y.push('        duration: ' + q(retryDuration)); y.push('        factor: ' + (retryFactor || 2)); y.push('        maxDuration: ' + q(retryMaxDuration));
    }
    if (y.length === syncPolicyIndex + 1) y.splice(syncPolicyIndex, 1);
    var ignoreRows = Array.prototype.slice.call(ignoreDiffContainer.querySelectorAll('.source-block'));
    if (ignoreRows.length) {
      y.push('  ignoreDifferences:');
      ignoreRows.forEach(function (row) {
        var group = row.querySelector('.idiff-group').value.trim();
        var kind = row.querySelector('.idiff-kind').value.trim();
        var name = row.querySelector('.idiff-name').value.trim();
        var namespace = row.querySelector('.idiff-namespace').value.trim();
        var jsonPointers = row.querySelector('.idiff-jsonpointers').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        var jqPaths = row.querySelector('.idiff-jqpath').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        var managedFieldsManagers = row.querySelector('.idiff-managedFieldsManagers').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        if (!kind && !group && jsonPointers.length === 0 && jqPaths.length === 0 && managedFieldsManagers.length === 0) return;
        y.push('    - group: ' + q(group)); y.push('      kind: ' + q(kind));
        if (name) y.push('      name: ' + q(name));
        if (namespace) y.push('      namespace: ' + q(namespace));
        if (jsonPointers.length) { y.push('      jsonPointers:'); jsonPointers.forEach(function (jp) { y.push('        - ' + q(jp)); }); }
        if (jqPaths.length) { y.push('      jqPathExpressions:'); jqPaths.forEach(function (jp) { y.push('        - ' + q(jp)); }); }
        if (managedFieldsManagers.length) { y.push('      managedFieldsManagers:'); managedFieldsManagers.forEach(function (mfm) { y.push('        - ' + q(mfm)); }); }
      });
    }
    if (infoRows.length) {
      y.push('  info:');
      infoRows.forEach(function (ir) {
        var infoname = ir.querySelector('.info-name').value.trim();
        var infovalue = ir.querySelector('.info-value').value.trim();
        if (!infoname) return;
        y.push('    - name: ' + q(infoname));
        y.push('      value: ' + q(infovalue));
      });
    }
    writeOutput(y.join('\n') + '\n');
  }

  function generateApplicationSetYaml() {
    var asName = byId('asName').value.trim() || 'my-appset';
    var asNamespace = byId('asNamespace').value.trim() || 'argocd';
    var goTemplate = byId('asGoTemplate').checked;
    var preserveOnDelete = byId('asPreserveOnDelete').checked;
    var finalizers = byId('asFinalizers').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
    var asLabels = kvLines(byId('asLabels').value);
    var asAnnotations = kvLines(byId('asAnnotations').value);
    var goTemplateOptsEnable = byId('asGoTemplateOptsEnable').checked;
    var missingKey = byId('asGoTemplateMissingKey').value;
    var combineMode = byId('asCombineMode').value;
    var genBlocks = Array.prototype.slice.call(generatorsContainer.querySelectorAll('.source-block'));
    var tplName = byId('asTplName').value.trim() || '{{.name}}';
    var tplProject = byId('asTplProject').value.trim() || 'default';
    var tplLabels = kvLines(byId('asTplLabels').value);
    var tplAnnotations = kvLines(byId('asTplAnnotations').value);
    var tplSourceBlocks = Array.prototype.slice.call(asTplSourcesContainer.querySelectorAll('.source-block'));
    var tplDestMode = byId('asTplDestMode').value;
    var tplDestValue = byId('asTplDestValue').value.trim();
    var tplDestNamespace = byId('asTplDestNamespace').value.trim();
    var tplSyncAutomated = byId('asTplSyncAutomated').checked;
    var tplPrune = byId('asTplPrune').checked;
    var tplSelfHeal = byId('asTplSelfHeal').checked;
    var tplCreateNs = byId('asTplCreateNs').checked;
    var tplIgnoreDiff = byId('asTplIgnoreDiff').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
    var asPolicy = byId('asPolicy').value;
    var postSelectorEnable = byId('asPostSelectorEnable').checked;
    var postSelectorAction = byId('asPostSelectorAction').value;
    var postSelectorName = byId('asPostSelectorName').value.trim();
    var postSelectorNamespace = byId('asPostSelectorNamespace').value.trim();

    var y = [];
    y.push('apiVersion: argoproj.io/v1alpha1'); y.push('kind: ApplicationSet');
    y.push('metadata:'); y.push('  name: ' + q(asName)); y.push('  namespace: ' + q(asNamespace));
    if (finalizers.length) { y.push('  finalizers:'); finalizers.forEach(function (f) { y.push('    - ' + q(f)); }); }
    if (asLabels.length) { y.push('  labels:'); asLabels.forEach(function (kv) { y.push('    ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    if (asAnnotations.length) { y.push('  annotations:'); asAnnotations.forEach(function (kv) { y.push('    ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    y.push('spec:');
    if (goTemplate) y.push('  goTemplate: true');
    if (goTemplate && goTemplateOptsEnable) { y.push('  goTemplateOptions:'); y.push('    - "missingkey=' + missingKey + '"'); }
    var gens=genBlocks.map(buildGeneratorObject);
    if(combineMode==='matrix')gens=[{matrix:{generators:gens}}];
    else if(combineMode==='merge')gens=[{merge:{mergeKeys:linesOf(byId('asMergeKeys').value),generators:gens}}];
    if(postSelectorEnable){var filter=yamlBlock(byId('asGeneratorSelector').value,'object','Generator selector');gens.forEach(function(g){g.selector=filter;});}
    y.push('  generators:');y.push(objectToYaml(gens,4));
    y.push('  template:'); y.push('    metadata:'); y.push('      name: ' + q(tplName)); y.push('      namespace: ' + q(asNamespace));
    if (tplLabels.length) { y.push('      labels:'); tplLabels.forEach(function (kv) { y.push('        ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    if (tplAnnotations.length) { y.push('      annotations:'); tplAnnotations.forEach(function (kv) { y.push('        ' + q(kv[0]) + ': ' + q(kv[1])); }); }
    y.push('    spec:'); y.push('      project: ' + q(tplProject));
    if (tplSourceBlocks.length > 1) {
      y.push('      sources:');
      tplSourceBlocks.forEach(function (block) {
        var builtLines = buildSourceYaml(block, 10).split('\n');
        y.push('        - ' + builtLines[0].replace(/^\s+/, ''));
        for (var i = 1; i < builtLines.length; i++) y.push(builtLines[i]);
      });
    } else if (tplSourceBlocks.length === 1) {
      y.push('      source:');
      y.push(buildSourceYaml(tplSourceBlocks[0], 8));
    }
    y.push('      destination:');
    if (tplDestMode === 'server') y.push('        server: ' + q(tplDestValue)); else y.push('        name: ' + q(tplDestValue));
    y.push('        namespace: ' + q(tplDestNamespace));
    var tplSyncOptions = [];
    if (tplCreateNs) tplSyncOptions.push('CreateNamespace=true');
    [
      ['asTplPruneLast', 'PruneLast=true'],
      ['asTplApplyOutOfSyncOnly', 'ApplyOutOfSyncOnly=true'],
      ['asTplServerSideApply', 'ServerSideApply=true'],
      ['asTplReplace', 'Replace=true'],
      ['asTplSkipDryRun', 'SkipDryRunOnMissingResource=true'],
      ['asTplRespectIgnoreDiff', 'RespectIgnoreDifferences=true'],
      ['asTplFailOnSharedResource', 'FailOnSharedResource=true']
    ].forEach(function (entry) { if (byId(entry[0]).checked) tplSyncOptions.push(entry[1]); });
    if (!byId('asTplValidate').checked) tplSyncOptions.push('Validate=false');
    var propagation = byId('asTplPrunePropagation').value;
    if (propagation) tplSyncOptions.push('PrunePropagationPolicy=' + propagation);
    byId('asTplExtraSyncOptions').value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).forEach(function (option) {
      if (tplSyncOptions.indexOf(option) === -1) tplSyncOptions.push(option);
    });
    var tplRetry = byId('asTplRetryEnable').checked;
    if (tplSyncAutomated || tplSyncOptions.length || tplRetry) y.push('      syncPolicy:');
    if (tplSyncAutomated) {
      y.push('        automated:'); y.push('          prune: ' + tplPrune); y.push('          selfHeal: ' + tplSelfHeal);
      if (byId('asTplAllowEmpty').checked) y.push('          allowEmpty: true');
    }
    if (tplSyncOptions.length) {
      y.push('        syncOptions:');
      tplSyncOptions.forEach(function (option) { y.push('          - ' + q(option)); });
    }
    if (tplRetry) {
      y.push('        retry:');
      y.push('          limit: ' + (byId('asTplRetryLimit').value.trim() || '5'));
      y.push('          backoff:');
      y.push('            duration: ' + q(byId('asTplRetryDuration').value.trim() || '5s'));
      y.push('            factor: ' + (byId('asTplRetryFactor').value.trim() || '2'));
      y.push('            maxDuration: ' + q(byId('asTplRetryMaxDuration').value.trim() || '3m'));
    }
    if (tplIgnoreDiff.length) {
      y.push('      ignoreDifferences:');
      y.push('        - group: apps');
      y.push('          kind: Deployment');
      y.push('          jsonPointers:');
      tplIgnoreDiff.forEach(function (jp) { y.push('            - ' + q(jp)); });
    }
    if (asPolicy) { y.push('  syncPolicy:'); y.push('    applicationsSync: ' + asPolicy); }
    if (preserveOnDelete) { if (!asPolicy) y.push('  syncPolicy:'); y.push('    preserveResourcesOnDeletion: true'); }
    writeOutput(y.join('\n') + '\n');
  }

  function generateProjectYaml() {
    var name = byId('prjName').value.trim() || 'my-project';
    var namespace = byId('prjNamespace').value.trim() || 'argocd';
    var description = byId('prjDescription').value.trim();
    var sourceRepos = byId('prjSourceRepos').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
    var clusterMode = byId('prjClusterMode').value;
    var nsMode = byId('prjNsMode').value;
    var orphanEnable = byId('prjOrphanEnable').checked;
    var orphanWarn = byId('prjOrphanWarn').checked;
    var signatureKeys = byId('prjSignatureKeys').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);

    var y = [];
    y.push('apiVersion: argoproj.io/v1alpha1'); y.push('kind: AppProject');
    y.push('metadata:'); y.push('  name: ' + q(name)); y.push('  namespace: ' + q(namespace));
    y.push('spec:');
    if (description) y.push('  description: ' + q(description));
    y.push(sourceRepos.length ? '  sourceRepos:' : '  sourceRepos: []');
    sourceRepos.forEach(function (r) { y.push('    - ' + q(r)); });

    var destRows = Array.prototype.slice.call(prjDestContainer.querySelectorAll('.source-block'));
    y.push(destRows.length ? '  destinations:' : '  destinations: []');
    destRows.forEach(function (row) {
      var mode = row.querySelector('.prjdest-mode').value;
      var value = row.querySelector('.prjdest-value').value.trim();
      var ns = row.querySelector('.prjdest-namespace').value.trim();
      y.push(mode === 'server' ? '    - server: ' + q(value) : '    - name: ' + q(value));
      var clusterName = row.querySelector('.prjdest-name').value.trim();
      if (mode === 'server' && clusterName) y.push('      name: ' + q(clusterName));
      y.push('      namespace: ' + q(ns));
    });

    var clusterRows = Array.prototype.slice.call(prjClusterResContainer.querySelectorAll('.source-block'));
    if (clusterRows.length) {
      var key1 = clusterMode === 'whitelist' ? 'clusterResourceWhitelist' : 'clusterResourceBlacklist';
      y.push('  ' + key1 + ':');
      clusterRows.forEach(function (row) { y.push('    - group: ' + q(row.querySelector('.res-group').value.trim())); y.push('      kind: ' + q(row.querySelector('.res-kind').value.trim())); });
    }
    var nsRows = Array.prototype.slice.call(prjNsResContainer.querySelectorAll('.source-block'));
    if (nsRows.length) {
      var key2 = nsMode === 'whitelist' ? 'namespaceResourceWhitelist' : 'namespaceResourceBlacklist';
      y.push('  ' + key2 + ':');
      nsRows.forEach(function (row) { y.push('    - group: ' + q(row.querySelector('.res-group').value.trim())); y.push('      kind: ' + q(row.querySelector('.res-kind').value.trim())); });
    }
    if (orphanEnable) { y.push('  orphanedResources:'); y.push('    warn: ' + orphanWarn); }
    if (signatureKeys.length) { y.push('  signatureKeys:'); signatureKeys.forEach(function (k) { y.push('    - keyID: ' + q(k)); }); }

    var roleBlocks = Array.prototype.slice.call(prjRolesContainer.querySelectorAll('.source-block'));
    if (roleBlocks.length) {
      y.push('  roles:');
      roleBlocks.forEach(function (rb) {
        var rName = rb.querySelector('.role-name').value.trim() || 'role';
        var rDesc = rb.querySelector('.role-description').value.trim();
        var rPolicies = rb.querySelector('.role-policies').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        var rGroups = rb.querySelector('.role-groups').value.split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        y.push('    - name: ' + q(rName));
        if (rDesc) y.push('      description: ' + q(rDesc));
        if (rPolicies.length) { y.push('      policies:'); rPolicies.forEach(function (p) { y.push('        - ' + q(/^p,\s*/.test(p) ? p : 'p, ' + p)); }); }
        if (rGroups.length) { y.push('      groups:'); rGroups.forEach(function (g) { y.push('        - ' + q(g)); }); }
      });
    }
    if(byId('enableSyncWindows').checked){
      var windows=Array.from(syncWindowsContainer.querySelectorAll('.source-block')).map(function(row){
        var w={kind:row.querySelector('.sw-kind').value,schedule:row.querySelector('.sw-schedule').value.trim(),duration:row.querySelector('.sw-duration').value.trim()};
        var tz=row.querySelector('.sw-timezone').value.trim();if(tz)w.timeZone=tz;
        ['applications','namespaces','clusters'].forEach(function(k){var vals=row.querySelector('.sw-'+k).value.split(',').map(function(v){return v.trim();}).filter(Boolean);if(vals.length)w[k]=vals;});
        if(row.querySelector('.sw-manualSync').checked)w.manualSync=true;return w;
      });if(windows.length){y.push('  syncWindows:');y.push(objectToYaml(windows,4));}
    }
    writeOutput(y.join('\n') + '\n');
  }

  function buildRepositorySecretYaml(args) {
    var useBase64 = args.encoding === 'data';
    function val(v) { return useBase64 ? q(toBase64(v)) : q(v); }
    var y = ['apiVersion: v1', 'kind: Secret', 'metadata:',
      '  name: ' + q(args.secretName), '  namespace: ' + q(args.namespace),
      '  labels:', '    argocd.argoproj.io/secret-type: ' + args.kindLabel];
    (args.labels || []).forEach(function (pair) { if (pair[0] !== 'argocd.argoproj.io/secret-type') y.push('    ' + q(pair[0]) + ': ' + q(pair[1])); });
    if (args.annotations && args.annotations.length) {
      y.push('  annotations:');
      args.annotations.forEach(function (pair) { y.push('    ' + q(pair[0]) + ': ' + q(pair[1])); });
    }
    y.push('type: ' + q(args.secretType || 'Opaque'));
    y.push(useBase64 ? 'data:' : 'stringData:');
    y.push('  type: ' + val(args.type === 'oci' ? 'helm' : args.type));
    y.push('  url: ' + val(args.url));
    var forceName = (args.type === 'helm' || args.type === 'oci');
    var hasNameValue = args.displayName && args.displayName.trim();
    if (forceName || hasNameValue) {
      y.push('  name: ' + val(hasNameValue ? args.displayName : args.secretName));
    }
    if (args.type === 'oci') y.push('  enableOCI: ' + val('true'));
    if (args.project) y.push('  project: ' + val(args.project));
    if (args.insecure) y.push('  insecure: ' + val('true'));
    if (args.includeCreds && args.authMethod === 'userpass') {
      y.push('  username: ' + val(args.username));
      y.push('  password: ' + val(args.password));
    } else if (args.includeCreds && args.authMethod === 'ssh' && args.type === 'git') {
      if (useBase64) { y.push('  sshPrivateKey: ' + val(args.sshKey)); }
      else { y.push('  sshPrivateKey: |'); y.push(indentBlock(args.sshKey || '-----BEGIN OPENSSH PRIVATE KEY-----', 4)); }
    } else if (args.includeCreds && args.authMethod === 'tls') {
      if (useBase64) { y.push('  tlsClientCertData: ' + val(args.tlsCert)); y.push('  tlsClientCertKey: ' + val(args.tlsKey)); }
      else {
        y.push('  tlsClientCertData: |'); y.push(indentBlock(args.tlsCert || '-----BEGIN CERTIFICATE-----', 4));
        y.push('  tlsClientCertKey: |'); y.push(indentBlock(args.tlsKey || '-----BEGIN PRIVATE KEY-----', 4));
      }
    }
    return y.join('\n');
  }

  // Authentication-specific ESO bindings; never read inactive inline credential fields.
  function repositoryEsoBindings(auth) {
    function val(id){return byId(id).value.trim();}
    var bindings=[];
    function add(secretKey,key,property){
      if(!key)throw new Error('Remote Key / Vault-Pfad für '+secretKey+' fehlt.');
      var remoteRef={key:key};if(property)remoteRef.property=property;
      bindings.push({secretKey:secretKey,remoteRef:remoteRef});
    }
    if(auth==='userpass'){
      var separate=byId('regEsoSeparatePaths').checked;
      add('username',val(separate?'regEsoRemoteKeyUser':'regEsoRemoteKey'),val('regEsoPropUser'));
      add('password',val(separate?'regEsoRemoteKeyPass':'regEsoRemoteKey'),val('regEsoPropPass'));
    }else if(auth==='ssh'){
      add('sshPrivateKey',val('regEsoSshRemoteKey'),val('regEsoSshProp'));
    }else if(auth==='tls'){
      var tlsSeparate=byId('regEsoTlsSeparatePaths').checked;
      add('tlsClientCertData',val(tlsSeparate?'regEsoTlsRemoteKeyCert':'regEsoTlsRemoteKey'),val('regEsoTlsPropCert'));
      add('tlsClientCertKey',val(tlsSeparate?'regEsoTlsRemoteKeyKey':'regEsoTlsRemoteKey'),val('regEsoTlsPropKey'));
    }else throw new Error('ESO benötigt Benutzer/Passwort, SSH oder TLS als Authentifizierung.');
    return bindings;
  }

  function buildRepositoryExternalSecret(args) {
    var bindings=repositoryEsoBindings(args.auth), primaryKey=bindings[0].remoteRef.key;
    var labels=Object.fromEntries(args.labels), annotations=Object.fromEntries(args.annotations);
    var metadata={name:args.secretName,namespace:args.namespace};
    if(args.labels.length)metadata.labels=labels;
    if(args.annotations.length)metadata.annotations=annotations;
    var targetMetadata={labels:Object.assign({'argocd.argoproj.io/secret-type':args.kind},labels)};
    if(args.annotations.length)targetMetadata.annotations=annotations;
    var data={type:args.type==='oci'?'helm':args.type};
    function repositoryField(field,value,include){
      var prefix=field==='url'?'regUrl':field==='name'?'regName':'regProject';
      var remote=byId(prefix+'FromVault').checked&&(field!=='project'||args.projectEnabled);
      if(remote){
        var key=byId(prefix+'VaultKey').value.trim()||primaryKey;
        var property=byId(prefix+'VaultProp').value.trim();
        var ref={key:key};if(property)ref.property=property;
        bindings.push({secretKey:field,remoteRef:ref});data[field]='{{ .'+field+' }}';
      }else if(include)data[field]=value;
    }
    repositoryField('url',args.url,true);
    repositoryField('name',args.name||args.secretName,args.type==='helm'||args.type==='oci'||!!args.name);
    repositoryField('project',args.project,args.projectEnabled&&!!args.project);
    if(args.type==='oci')data.enableOCI='true';
    if(args.insecure)data.insecure='true';
    bindings.forEach(function(binding){data[binding.secretKey]='{{ .'+binding.secretKey+' }}';});
    return {apiVersion:byId('regEsoApiVersion').value||'external-secrets.io/v1',kind:'ExternalSecret',metadata:metadata,spec:{
      refreshInterval:byId('regEsoRefreshInterval').value.trim()||'1h',
      secretStoreRef:{name:byId('regEsoStoreName').value.trim()||'vault-backend',kind:byId('regEsoStoreKind').value},
      target:{name:args.secretName,creationPolicy:byId('regEsoCreationPolicy').value||'Owner',template:{engineVersion:'v2',type:args.secretType||'Opaque',metadata:targetMetadata,data:data}},
      data:bindings
    }};
  }

  function generateRegistryYaml() {
    var secretName = byId('regSecretName').value.trim() || 'my-repo';
    var namespace = byId('regNamespace').value.trim() || 'argocd';
    var encoding = byId('regEncoding').value;
    var labels = kvLines(byId('regLabels').value).filter(function (pair) { return pair[0] !== 'argocd.argoproj.io/secret-type'; });
    var annotations = kvLines(byId('regAnnotations').value);
    var secretType = byId('regSecretType').value === 'custom' ? byId('regSecretTypeCustom').value.trim() : byId('regSecretType').value;
    var kind = byId('regKind').value;
    var type = byId('regType').value;
    var url = byId('regUrl').value.trim();
    var name = byId('regName').value.trim();
    var insecure = byId('regInsecure').checked;
    var authMethod = byId('regAuthMethod').value;
    var credSource = byId('regCredSource').value;
    var username = byId('regUsername').value.trim();
    var password = byId('regPassword').value;
    var sshKey = byId('regSshKey').value.replace(/\n+$/, '');
    var tlsCert = byId('regTlsCert').value.replace(/\n+$/, '');
    var tlsKey = byId('regTlsKey').value.replace(/\n+$/, '');

    var projectEnabled = byId('regProjectEnabled').checked;
    var project = projectEnabled ? byId('regProject').value.trim() : '';
    var isEso = (['userpass','ssh','tls'].includes(authMethod) && credSource === 'eso');
    var forceName = (type === 'helm' || type === 'oci');

    var projectFromVault = projectEnabled && isEso && byId('regProjectFromVault').checked;
    var urlFromVault = isEso && byId('regUrlFromVault').checked;
    var nameFromVault = isEso && byId('regNameFromVault').checked;

    var projectVaultKey = byId('regProjectVaultKey').value.trim();
    var projectVaultProp = byId('regProjectVaultProp').value.trim() || 'project';
    var urlVaultKey = byId('regUrlVaultKey').value.trim();
    var urlVaultProp = byId('regUrlVaultProp').value.trim() || 'url';
    var nameVaultKey = byId('regNameVaultKey').value.trim();
    var nameVaultProp = byId('regNameVaultProp').value.trim() || 'name';

    if (authMethod === 'ssh' && type !== 'git') throw new Error('SSH-Authentifizierung ist nur für Git-Repositories erlaubt.');
    if (isEso) {
      writeOutput(objectToYaml(buildRepositoryExternalSecret({secretName:secretName,namespace:namespace,labels:labels,annotations:annotations,secretType:secretType,kind:kind,type:type,url:url,name:name,insecure:insecure,auth:authMethod,project:project,projectEnabled:projectEnabled}))+'\n');
      return;
    }
    var finalArgs = { secretName: secretName, namespace: namespace, labels: labels, annotations: annotations, secretType: secretType, encoding: encoding, type: type, url: url, displayName: name, insecure: insecure, kindLabel: kind, includeCreds: true, project: project, authMethod: authMethod, username: username, password: password, sshKey: sshKey, tlsCert: tlsCert, tlsKey: tlsKey };
    writeOutput(buildRepositorySecretYaml(finalArgs) + '\n');
  }

  var generationDepth=0, renderError=null;
  function mergeOverlay(base, extra) {
    assertSafeTree(extra);
    Object.keys(extra).forEach(function(k){
      var v=extra[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))base[k]=mergeOverlay(base[k],v);
      else base[k]=v;
    });return base;
  }
  function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){var obj={};Object.keys(value).sort().forEach(function(k){obj[k]=stable(value[k]);});return obj;}return value;}
  function missingFields(wanted,actual){
    var extra={};Object.keys(wanted||{}).forEach(function(k){
      var v=wanted[k],a=actual&&actual[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)&&a&&typeof a==='object'&&!Array.isArray(a)){var nested=missingFields(v,a);if(Object.keys(nested).length)extra[k]=nested;}
      else if(JSON.stringify(stable(v))!==JSON.stringify(stable(a)))extra[k]=v;
    });return extra;
  }
  function sensitiveName(name){return /(?:password|passwd|secret|token|private.?key|authorization|credential|client.?key|tlsClientCert(?:Key|Data))/i.test(String(name));}
  function maskTree(obj,parentKind) {
    if (Array.isArray(obj)) return obj.map(function (v) {return maskTree(v,parentKind);});
    if (!obj || typeof obj !== 'object') return obj;
    var copy = {}, named = sensitiveName(obj.name || '');
    Object.keys(obj).forEach(function (k) {
      var value = obj[k];
      if ((parentKind === 'Secret' && (k === 'data' || k === 'stringData')) || (sensitiveName(k) && !['secretName','secretKey','argocd.argoproj.io/secret-type','secretStoreRef','secretKeyRef','tokenRef'].includes(k)) ||
          (named && ['value','string','array','map'].includes(k))) copy[k] = '(masked)';
      else if (k === 'helm' && value && typeof value === 'object' && typeof value.values === 'string' && value.values.trim()) {
        copy[k] = maskTree(value,parentKind);
        try {copy[k].values = objectToYaml(maskTree(parseSimpleYAML(value.values)));}
        catch (error) {copy[k].values = '(masked: Inline-Values nicht sicher parsebar)';}
      } else if ((k === 'repoURL' || k === 'url' || k === 'server') && typeof value === 'string' && /^(?:https?:\/\/)[^/\s]*@/i.test(value))
        copy[k] = value.replace(/^(https?:\/\/)[^/\s]*@/i,'$1(masked)@');
      else copy[k] = maskTree(value,obj.kind || parentKind);
    }); return copy;
  }
  function hasSensitiveValue(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.kind === 'Secret') return true;
    function present(v) {return v !== undefined && v !== null && v !== '' && (typeof v !== 'object' || Object.keys(v).length > 0);}
    function templated(v) {return typeof v === 'string' && /^\s*\{\{[\s\S]*\}\}\s*$/.test(v);}
    if (sensitiveName(obj.name || '') && ['value','string','array','map'].some(function(k){return present(obj[k]) && !templated(obj[k]);})) return true;
    var refFields=['secretName','secretKey','argocd.argoproj.io/secret-type'];
    return Object.keys(obj).some(function(k) {
      var value=obj[k];
      if (sensitiveName(k) && present(value) && !refFields.includes(k) && !templated(value)) {
        if (!(value && typeof value==='object' && !Array.isArray(value) && ['secretStoreRef','secretKeyRef','tokenRef'].includes(k))) return true;
      }
      if (k==='helm' && value && typeof value.values==='string' && value.values.trim()) {
        try {if(hasSensitiveValue(parseSimpleYAML(value.values)))return true;}catch(error){return true;}
      }
      if (['repoURL','url','server'].includes(k) && typeof value==='string' && /^(?:https?:\/\/)[^/\s]*@/i.test(value))return true;
      return hasSensitiveValue(value);
    });
  }

  function safeClipboard(text) {
    return Promise.resolve().then(function () {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext)
        return navigator.clipboard.writeText(String(text)).catch(function () { return fallbackCopy(text); });
      return fallbackCopy(text);
    }).catch(function (error) {
      showStatus('Kopieren fehlgeschlagen. YAML herunterladen oder manuell kopieren.', true);
      throw error;
    });
  }
  function fallbackCopy(text) {
    var previous = document.activeElement, input = document.createElement('textarea'), ok = false;
    input.value = String(text); input.style.cssText = 'position:fixed;opacity:0;left:0;top:0;';
    try {
      document.body.appendChild(input); input.focus(); input.select();
      ok = document.execCommand('copy');
    } catch (error) { ok = false; }
    finally {
      input.remove();
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({preventScroll:true});
    }
    return ok ? Promise.resolve() : Promise.reject(new Error('Zwischenablage nicht verfügbar.'));
  }
  function renderMode(){
    if(currentMode==='applicationset')generateApplicationSetYaml();else if(currentMode==='project')generateProjectYaml();else if(currentMode==='registry')generateRegistryYaml();else generateApplicationYaml();
  }
  function resetRaw(mode){byId('rawEnabled_'+mode).checked=false;byId('rawManifest_'+mode).value='';byId('rawHint_'+mode).textContent='';}
  function generateYaml() {
    if (generationDepth) return;
    if (pendingRenderFrame) {cancelAnimationFrame(pendingRenderFrame); pendingRenderFrame=0;}
    try {
      renderError = null;
      var text = getExportText();
      if (byId('securityModeToggle').checked) text = maskSensitiveYaml(text);
      writeOutput(text);
      byId('copyBtn').disabled=false; byId('downloadBtn').disabled=false; byId('gitPushBtn').disabled=false;
      if (byId('statusMsg').dataset.renderError) {byId('statusMsg').textContent=''; delete byId('statusMsg').dataset.renderError;}
    } catch (error) {
      renderError=error.message; writeOutput('');
      byId('copyBtn').disabled=true; byId('downloadBtn').disabled=true; byId('gitPushBtn').disabled=true;
      showStatus('Eingabefehler: '+error.message,true); byId('statusMsg').dataset.renderError='1';
    }
  }

  createSourceBlock(sourceCount++, true);
  createGeneratorBlock(generatorCount++, { type: 'list' }, true);
  createPrjDestRow();
  updateRegistryVisibility();

  document.querySelector('.form-pane').addEventListener('input',scheduleYaml);
  document.querySelector('.form-pane').addEventListener('change',scheduleYaml);

  byId('asCombineMode').addEventListener('change', function (e) {
    if (byId('asMergeOptionsBlock')) {
      byId('asMergeOptionsBlock').style.display = e.target.value === 'merge' ? 'block' : 'none';
    }
    generateYaml();
  });

  byId('asGoTemplateOptsEnable').addEventListener('change', function (e) {
    byId('asGoTemplateOptsBlock').style.display = e.target.checked ? 'block' : 'none';
    generateYaml();
  });
  byId('asPostSelectorEnable').addEventListener('change', function (e) {
    byId('asPostSelectorBlock').style.display = e.target.checked ? 'block' : 'none';
    generateYaml();
  });
  byId('asTplDestMode').addEventListener('change', function (e) {
    var label = byId('asTplDestValueLabel'); var input = byId('asTplDestValue');
    label.textContent=e.target.value==='server'?'Server':'Cluster Name';
    generateYaml();
  });

    byId('copyBtn').addEventListener('click', function () {
    generateYaml(); if (renderError) return;
    var text = byId('yamlOutput').textContent;
    safeClipboard(text).then(function () {
      var btn = byId('copyBtn'); var original = btn.textContent;
      btn.textContent = 'Kopiert!'; btn.classList.add('btn-copy-ok');
      setTimeout(function () { btn.textContent = original; btn.classList.remove('btn-copy-ok'); }, 1500);
    }).catch(function () {});
  });
  byId('downloadBtn').addEventListener('click', function () {
    generateYaml(); if (renderError) return;
    var text = byId('yamlOutput').textContent;
    var baseName = 'application';
    if (currentMode === 'applicationset') baseName = byId('asName').value.trim() || 'applicationset';
    else if (currentMode === 'project') baseName = byId('prjName').value.trim() || 'appproject';
    else if (currentMode === 'registry') baseName = byId('regSecretName').value.trim() || 'repository-secret';
    else baseName = byId('appName').value.trim() || 'application';
    var blob = new Blob([text], { type: 'text/yaml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = baseName.replace(/[^a-zA-Z0-9._-]/g,'-').replace(/^\.+/,'') + '.yaml';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  
  // ---------------- CENTRAL / AUTOMATIC VERSION MANAGEMENT ----------------
  var DEFAULT_APP_VERSION = 'v2.3.7';

  function resolveAndApplyAppVersion() {
    var detected = null;
    try {
      var path = window.location.pathname || '';
      var m = path.match(/[-_]v([0-9]+(?:\.[0-9]+)*)\.html/i);
      if (m && m[1]) detected = 'v' + m[1];
    } catch (e) {}

    var activeVersion = detected || DEFAULT_APP_VERSION;

    var pageTitle = byId('appPageTitle');
    if (pageTitle) pageTitle.textContent = 'ArgoCD Builder ' + activeVersion;
    else document.title = 'ArgoCD Builder ' + activeVersion;

    var badge = byId('appVersionBadge');
    if (badge) badge.textContent = activeVersion;

    return activeVersion;
  }
  var CURRENT_APP_VERSION = resolveAndApplyAppVersion();

  // ---------------- CUSTOM PRESETS SYSTEM ----------------
  var PRESET_STORAGE_KEY = 'argocd_generator_user_presets_v1';

  function sanitizePresets(presets){
    assertSafeTree(presets);var result={application:{},applicationset:{},project:{},registry:{}};
    if(!presets||typeof presets!=='object'||Array.isArray(presets))throw new Error('Preset-Datei erwartet ein JSON-Objekt.');
    Object.keys(result).forEach(function(mode){
      var section=presets[mode];if(!section)return;
      if(typeof section!=='object'||Array.isArray(section))throw new Error('Ungültiger Preset-Bereich: '+mode);
      Object.keys(section).forEach(function(name){
        var item=section[name];if(!item||typeof item!=='object'||!item.staticFields||typeof item.staticFields!=='object'||Array.isArray(item.staticFields))throw new Error('Ungültiges Preset: '+name);
        var copy=JSON.parse(JSON.stringify(item));
        ['sources','templateSources','generators','ignoreDiff','info','syncWindows','roles','destinations','clusterRes','nsRes'].forEach(function(k){if(copy[k]!==undefined&&!Array.isArray(copy[k]))throw new Error('Preset '+name+': '+k+' muss eine Liste sein.');});
        if(mode==='registry')['regPassword','regSshKey','regTlsKey','rawManifest_registry','rawEnabled_registry'].forEach(function(k){delete copy.staticFields[k];});
        result[mode][name]=copy;
      });
    });return result;
  }
  function getStoredPresets(){
    try{var raw=localStorage.getItem(PRESET_STORAGE_KEY);var clean=sanitizePresets(raw?JSON.parse(raw):{});if(raw&&JSON.stringify(clean)!==raw)localStorage.setItem(PRESET_STORAGE_KEY,JSON.stringify(clean));return clean;}
    catch(e){byId('statusMsg').textContent='Presets konnten nicht geladen werden: '+e.message;return {application:{},applicationset:{},project:{},registry:{}};}
  }

  function saveStoredPresets(presets) {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(sanitizePresets(presets)));
    } catch (e) {
      alert('Fehler beim Speichern in localStorage: ' + e.message);
    }
  }

  function serializeRowElements(row) {
    var data = {};
    row.querySelectorAll('input, select, textarea').forEach(function (el) {
      var key = el.className.split(' ')[0] || el.id || el.name;
      if (!key) return;
      data[key] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    return data;
  }

  function restoreRowElements(row, data) {
    row.querySelectorAll('input, select, textarea').forEach(function (el) {
      var key = el.className.split(' ')[0] || el.id || el.name;
      if (!data || !key || !Object.prototype.hasOwnProperty.call(data,key)) return;
      if (el.type === 'checkbox') el.checked = !!data[key];
      else if (el.classList.contains('gen-type') && (data[key] === 'matrix' || data[key] === 'merge')) el.value = 'list';
      else el.value = data[key];
      el.dispatchEvent(new Event('change'));
      el.dispatchEvent(new Event('input'));
    });
  }

  function serializeCurrentMode(mode) {
    var pane = byId({
      application: 'appModePane',
      applicationset: 'appSetModePane',
      project: 'projectModePane',
      registry: 'registryModePane'
    }[mode]);

    var staticFields = {};
    pane.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
      if (el.closest('.source-block') || el.closest('.preset-actions') || el.id.indexOf('presetSelect_') === 0) return;
      if(['regPassword','regSshKey','regTlsKey','rawManifest_registry','rawEnabled_registry'].includes(el.id))return;
      staticFields[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
    });

    var presetData = { staticFields: staticFields };

    if (mode === 'application') {
      presetData.sources = Array.prototype.slice.call(sourcesContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.ignoreDiff = Array.prototype.slice.call(ignoreDiffContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.info = Array.prototype.slice.call(infoContainer.querySelectorAll('.source-block')).map(serializeRowElements);

    } else if (mode === 'applicationset') {
      presetData.generators = Array.prototype.slice.call(generatorsContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.templateSources = Array.prototype.slice.call(asTplSourcesContainer.querySelectorAll('.source-block')).map(serializeRowElements);
    } else if (mode === 'project') {
      presetData.destinations = Array.prototype.slice.call(prjDestContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.clusterRes = Array.prototype.slice.call(prjClusterResContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.nsRes = Array.prototype.slice.call(prjNsResContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.syncWindows = Array.prototype.slice.call(syncWindowsContainer.querySelectorAll('.source-block')).map(serializeRowElements);
      presetData.roles = Array.prototype.slice.call(prjRolesContainer.querySelectorAll('.source-block')).map(serializeRowElements);
    }

    return presetData;
  }

  function restoreModeFromPreset(mode, presetData) {
    if (!presetData || !presetData.staticFields) return;
    var cleanPreset = sanitizePresets({[mode]:{selected:presetData}})[mode].selected;
    presetData = cleanPreset;
    var resetters={application:clearAppMode,applicationset:clearAppSetMode,project:clearProjectMode,registry:clearRegistryMode};
    if (!resetters[mode]) throw new Error('Unbekannter Preset-Reiter.');
    resetters[mode]();

    // 1. Static fields
    Object.keys(presetData.staticFields).forEach(function (id) {
      if (id.indexOf('presetSelect_') === 0) return;
      var el = byId(id);
      if (!el || !el.closest('#'+{application:'appModePane',applicationset:'appSetModePane',project:'projectModePane',registry:'registryModePane'}[mode]) || el.closest('.preset-actions')) return;
      if (el.type === 'checkbox') el.checked = !!presetData.staticFields[id];
      else el.value = presetData.staticFields[id];
      el.dispatchEvent(new Event('change'));
      el.dispatchEvent(new Event('input'));
    });

    // 2. Dynamic containers
    if (mode === 'application') {
      sourcesContainer.innerHTML = ''; sourceCount = 0;
      (presetData.sources || []).forEach(function (item, idx) {
        var row = createSourceBlock(sourceCount++, idx === 0);
        restoreRowElements(row, item);
      });
      ignoreDiffContainer.innerHTML = '';
      (presetData.ignoreDiff || []).forEach(function (item) {
        var row = createIgnoreDiffRow();
        restoreRowElements(row, item);
      });
      infoContainer.innerHTML = '';
      (presetData.info || []).forEach(function (item) {
        var row = createInfoRow();
        restoreRowElements(row, item);
      });
      if (byId('syncAutomated') && byId('automatedOptions')) {
        byId('automatedOptions').style.opacity = byId('syncAutomated').checked ? '1' : '0.4';
      }
      if (byId('enableRetry') && byId('retryOptions')) {
        var rVis = byId('enableRetry').checked ? 'grid' : 'none';
        byId('retryOptions').style.display = rVis;
        byId('retryOptions2').style.display = rVis;
      }
    } else if (mode === 'applicationset') {
      generatorsContainer.innerHTML = ''; generatorCount = 0;
      (presetData.generators || []).forEach(function (item, idx) {
        var row = createGeneratorBlock(generatorCount++, {}, idx === 0);
        restoreRowElements(row, item);
      });
      asTplSourcesContainer.innerHTML = ''; asTplSourceCount = 0;
      if (Array.isArray(presetData.templateSources) && presetData.templateSources.length) {
        presetData.templateSources.forEach(function (item, idx) {
          var row = createSourceBlock(asTplSourceCount++, idx === 0, {}, asTplSourcesContainer);
          restoreRowElements(row, item);
        });
      } else {
        // Migrate previously saved v9 single-source presets.
        var old = presetData.staticFields || {};
        var row = createSourceBlock(asTplSourceCount++, true, {}, asTplSourcesContainer);
        row.querySelector('.src-repoUrl').value = old.asTplRepoUrl || '{{.repoURL}}';
        row.querySelector('.src-targetRevision').value = old.asTplRevision || '{{.branch}}';
        row.querySelector('.src-path').value = old.asTplPath || '{{.path}}';
        if (old.asTplHelm) {
          row.querySelector('.src-type').value = 'helm';
          row.querySelector('.src-chart').value = old.asTplChart || '';
          row.querySelector('.src-valueFiles').value = old.asTplValueFiles || '';
          row.querySelector('.src-helmParams').value = old.asTplHelmParams || '';
          row.querySelector('.src-type').dispatchEvent(new Event('change'));
        }
      }
      if (byId('asMergeOptionsBlock') && byId('asCombineMode')) {
        byId('asMergeOptionsBlock').style.display = byId('asCombineMode').value === 'merge' ? 'block' : 'none';
      }
      if (byId('asGoTemplateOptsBlock') && byId('asGoTemplateOptsEnable')) {
        byId('asGoTemplateOptsBlock').style.display = byId('asGoTemplateOptsEnable').checked ? 'block' : 'none';
      }
      if (byId('asPostSelectorBlock') && byId('asPostSelectorEnable')) {
        byId('asPostSelectorBlock').style.display = byId('asPostSelectorEnable').checked ? 'block' : 'none';
      }
    } else if (mode === 'project') {
      prjDestContainer.innerHTML = '';
      (presetData.destinations || []).forEach(function (item, idx) {
        var row = createPrjDestRow(idx === 0);
        restoreRowElements(row, item);
      });
      prjClusterResContainer.innerHTML = '';
      (presetData.clusterRes || []).forEach(function (item) {
        var row = createPrjResRow(prjClusterResContainer);
        restoreRowElements(row, item);
      });
      prjNsResContainer.innerHTML = '';
      (presetData.nsRes || []).forEach(function (item) {
        var row = createPrjResRow(prjNsResContainer);
        restoreRowElements(row, item);
      });
      prjRolesContainer.innerHTML = '';
      (presetData.roles || []).forEach(function (item) {
        var row = createPrjRoleBlock();
        restoreRowElements(row, item);
      });
      syncWindowsContainer.innerHTML = '';
      (presetData.syncWindows || []).forEach(function (item) {
        var row = createSyncWindowRow();
        restoreRowElements(row, item);
      });
      if (byId('enableSyncWindows')) {
        syncWindowsContainer.style.display = byId('enableSyncWindows').checked ? 'block' : 'none';
        byId('addSyncWindowBtn').style.display = byId('enableSyncWindows').checked ? 'inline-block' : 'none';
      }
    } else if (mode === 'registry') {
      updateRegistryVisibility();
      applyEsoFieldVisibility();
    }

    generateYaml();
    var paneEl = byId({
      application: 'appModePane',
      applicationset: 'appSetModePane',
      project: 'projectModePane',
      registry: 'registryModePane'
    }[mode]);
    flash(paneEl);
  }

  function updatePresetDropdowns() {
    var allPresets = getStoredPresets();
    ['application', 'applicationset', 'project', 'registry'].forEach(function (m) {
      var sel = byId('presetSelect_' + m);
      if (!sel) return;
      var curVal = sel.value;
      sel.innerHTML = '<option value="">-- Eigenes Preset laden --</option>';
      var mPresets = allPresets[m] || {};
      Object.keys(mPresets).sort().forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === curVal) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  // Preset Save Buttons
  document.querySelectorAll('.btn-preset-save').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode') || currentMode;
      var defaultName = (mode === 'application' ? byId('appName').value.trim() :
                          mode === 'applicationset' ? byId('asName').value.trim() :
                          mode === 'project' ? byId('prjName').value.trim() :
                          byId('regSecretName').value.trim()) || 'mein-preset';
      var name = prompt('Name für das Preset eingeben:', defaultName);
      if (!name) return;
      name = name.trim();
      if (!name) return;
      if(['__proto__','prototype','constructor'].includes(name)){alert('Unzulässiger Preset-Name.');return;}
      if(mode!=='registry'&&hasSensitiveValue(parseSimpleYAML(byId('yamlOutput').textContent))){alert('Mögliche Zugangsdaten erkannt: Preset-Speicherung blockiert. Bitte Secret-Referenzen verwenden.');return;}

      var allPresets = getStoredPresets();
      if (!allPresets[mode]) allPresets[mode] = {};
      allPresets[mode][name] = serializeCurrentMode(mode);
      saveStoredPresets(allPresets);
      updatePresetDropdowns();

      var sel = byId('presetSelect_' + mode);
      if (sel) sel.value = name;

      var status = byId('statusMsg');
      if (status) {
        status.textContent = '✓ Preset "' + name + '" gespeichert';
        status.style.color = 'var(--ok)';
        setTimeout(function () { status.textContent = ''; }, 2500);
      }
    });
  });

  // Preset Select Dropdowns
  ['application', 'applicationset', 'project', 'registry'].forEach(function (m) {
    var sel = byId('presetSelect_' + m);
    if (!sel) return;
    sel.addEventListener('change', function () {
      var name = sel.value;
      if (!name) return;
      var allPresets = getStoredPresets();
      if (allPresets[m] && allPresets[m][name]) {
        restoreModeFromPreset(m, allPresets[m][name]);
        sel.value = name;
        var status = byId('statusMsg');
        if (status) {
          status.textContent = '✓ Preset "' + name + '" geladen';
          status.style.color = 'var(--ok)';
          setTimeout(function () { status.textContent = ''; }, 2500);
        }
      }
    });
  });

  // Preset Delete Buttons
  document.querySelectorAll('.btn-preset-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode') || currentMode;
      var sel = byId('presetSelect_' + mode);
      if (!sel || !sel.value) {
        alert('Bitte wähle zuerst ein zu löschendes Preset aus dem Dropdown aus.');
        return;
      }
      var name = sel.value;
      if (!confirm('Soll das Preset "' + name + '" wirklich gelöscht werden?')) return;
      var allPresets = getStoredPresets();
      if (allPresets[mode] && allPresets[mode][name]) {
        delete allPresets[mode][name];
        saveStoredPresets(allPresets);
        updatePresetDropdowns();
        sel.value = '';
        var status = byId('statusMsg');
        if (status) {
          status.textContent = 'Preset "' + name + '" gelöscht';
          status.style.color = 'var(--dim)';
          setTimeout(function () { status.textContent = ''; }, 2500);
        }
      }
    });
  });

  // Export Presets JSON
  byId('exportPresetsBtn').addEventListener('click', function () {
    var allPresets = getStoredPresets();
    var jsonStr = JSON.stringify(allPresets, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'argocd-presets-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Import Presets JSON
  byId('importPresetsBtn').addEventListener('click', function () {
    byId('importPresetsFile').click();
  });

  byId('importPresetsFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      try {
        var imported = JSON.parse(evt.target.result);
        if (!imported || typeof imported !== 'object') throw new Error('Ungültiges Format');
        openPresetConflictModal(imported);
      } catch (err) {
        alert('Fehler beim Einlesen der Presets-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---------------- PRESET-DIFF MIT KONFLIKTPRÜFUNG ----------------
  var pendingPresetImport = null;

  function openPresetConflictModal(imported) {
    imported=sanitizePresets(imported);
    var cur = getStoredPresets();
    var conflicts = [];
    var newOnly = [];
    var identical = [];
    ['application', 'applicationset', 'project', 'registry'].forEach(function (mode) {
      if (!imported[mode]) return;
      Object.keys(imported[mode]).forEach(function (name) {
        var incoming = imported[mode][name];
        if (cur[mode] && Object.prototype.hasOwnProperty.call(cur[mode], name)) {
          var existingStr = JSON.stringify(cur[mode][name]);
          var incomingStr = JSON.stringify(incoming);
          if (existingStr === incomingStr) {
            identical.push({ mode: mode, name: name });
          } else {
            var diffFields = diffPresetFields(cur[mode][name], incoming);
            conflicts.push({ mode: mode, name: name, diffFields: diffFields });
          }
        } else {
          newOnly.push({ mode: mode, name: name });
        }
      });
    });
    pendingPresetImport = { imported: imported, conflicts: conflicts, newOnly: newOnly, identical: identical };

    var list = byId('presetConflictList');
    var modeLabels = { application: 'Application', applicationset: 'ApplicationSet', project: 'Projekt', registry: 'Repository' };
    var html = '';
    if (!conflicts.length && !newOnly.length) {
      html += '<div class="callout-box ok">Keine neuen oder abweichenden Presets in dieser Datei gefunden.</div>';
    }
    if (newOnly.length) {
      html += '<div class="callout-box ok"><h4>Neu (' + newOnly.length + ')</h4><ul>' + newOnly.map(function (n) {
        return '<li>' + modeLabels[n.mode] + ': "' + escapeHtml(n.name) + '" wird hinzugefügt</li>';
      }).join('') + '</ul></div>';
    }
    if (identical.length) {
      html += '<div class="callout-box ok"><h4>Unverändert (' + identical.length + ')</h4><ul>' + identical.map(function (n) {
        return '<li>' + modeLabels[n.mode] + ': "' + escapeHtml(n.name) + '"</li>';
      }).join('') + '</ul></div>';
    }
    if (conflicts.length) {
      html += '<h4 style="margin-bottom:8px;">Konflikte (' + conflicts.length + ')</h4>';
      conflicts.forEach(function (c, idx) {
        html += '<div class="conflict-row">' +
          '<div><strong>' + modeLabels[c.mode] + ': ' + escapeHtml(c.name) + '</strong>' +
          '<div class="diff-summary">Abweichende Felder: ' + (c.diffFields.length ? escapeHtml(c.diffFields.join(', ')) : 'Struktur unterschiedlich') + '</div></div>' +
          '<label class="checkbox-row" style="margin:0; white-space:nowrap;"><input type="checkbox" class="conflict-overwrite" data-idx="' + idx + '" checked> überschreiben</label>' +
          '</div>';
      });
    }
    list.innerHTML = html;
    byId('presetConflictModal').style.display = 'flex';
  }

  function diffPresetFields(a, b) {
    var fields = [];
    var keys = {};
    Object.keys(a || {}).forEach(function (k) { keys[k] = true; });
    Object.keys(b || {}).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (k) {
      if (JSON.stringify(a ? a[k] : undefined) !== JSON.stringify(b ? b[k] : undefined)) fields.push(k);
    });
    return fields;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  byId('presetConflictCancelBtn').addEventListener('click', function () {
    byId('presetConflictModal').style.display = 'none';
    pendingPresetImport = null;
  });

  byId('presetConflictApplyBtn').addEventListener('click', function () {
    if (!pendingPresetImport) { byId('presetConflictModal').style.display = 'none'; return; }
    var cur = getStoredPresets();
    var overwriteFlags = {};
    document.querySelectorAll('.conflict-overwrite').forEach(function (cb) {
      overwriteFlags[cb.getAttribute('data-idx')] = cb.checked;
    });
    pendingPresetImport.newOnly.forEach(function (n) {
      if (!cur[n.mode]) cur[n.mode] = {};
      cur[n.mode][n.name] = pendingPresetImport.imported[n.mode][n.name];
    });
    pendingPresetImport.conflicts.forEach(function (c, idx) {
      if (overwriteFlags[idx]) {
        if (!cur[c.mode]) cur[c.mode] = {};
        cur[c.mode][c.name] = pendingPresetImport.imported[c.mode][c.name];
      }
    });
    saveStoredPresets(cur);
    updatePresetDropdowns();
    byId('presetConflictModal').style.display = 'none';
    var status = byId('statusMsg');
    if (status) {
      status.textContent = 'Presets importiert (Konflikte gemäß Auswahl behandelt).';
      status.style.color = 'var(--ok)';
      setTimeout(function () { status.textContent = ''; }, 3000);
    }
    pendingPresetImport = null;
  });


  // =========================================================================
  // ARGOCD BUILDER: ERWEITERTE FEATURES
  // =========================================================================

  // ---------------- 1) LEICHTGEWICHTIGER YAML-PARSER ----------------
  // YAML 1.2, local library; one document per import, bounded aliases and input.
  function parseSimpleYAML(text) {
    text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.length > 2 * 1024 * 1024) throw new Error('YAML überschreitet das Limit von 2.097.152 Textzeichen.');
    text = text.replace(/^\s*```(?:yaml|yml)?[^\S\n]*\n/i, '').replace(/\n```\s*$/, '');
    text = text.replace(/^\s*yaml:\s*(?=apiVersion:)/i, '');
    text = text.replace(/^(\s*(?:repoURL|server|url):\s*)\[([^\]\n]+)\]\(([^)\n]+)\)(\s*(?:#.*)?)$/gm,
      function (_, prefix, label, url, tail) { return prefix + JSON.stringify(url) + tail; });
    var docs = window.BuilderYAML.parseAllDocuments(text, {version:'1.2', uniqueKeys:true, prettyErrors:true, strict:true});
    if (docs.length !== 1) throw new Error('Bitte genau ein YAML-Dokument importieren.');
    var doc = docs[0];
    if (doc.errors.length) throw doc.errors[0];
    if (doc.warnings.length) throw new Error(doc.warnings.map(function (w) { return w.message; }).join('\n'));
    var obj = doc.toJS({maxAliasCount:50});
    assertSafeTree(obj);
    return obj === null ? {} : obj;
  }
  function assertSafeTree(obj, stack, depth) {
    stack = stack || new Set(); depth = depth || 0;
    if (depth > 100) throw new Error('Maximale YAML-Verschachtelung: 100.');
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'number' && !Number.isFinite(obj)) throw new Error('Nicht-endliche Zahlen sind nicht erlaubt.');
      return;
    }
    if (stack.has(obj)) throw new Error('Zyklische YAML-Aliase sind nicht erlaubt.');
    stack.add(obj);
    Object.keys(obj).forEach(function (k) {
      if (['__proto__','constructor','prototype'].indexOf(k) !== -1) throw new Error('Unzulässiger Schlüssel: ' + k);
      assertSafeTree(obj[k],stack,depth+1);
    });
    stack.delete(obj);
  }
  function objectToYaml(obj, indent) {
    var text = window.BuilderYAML.stringify(obj, {version:'1.2',indent:2,lineWidth:0,aliasDuplicateObjects:false}).replace(/\n$/, '');
    return indent ? indentBlock(text,indent) : text;
  }
  function yamlBlock(text, kind, label) {
    var value = parseSimpleYAML(text);
    if (kind === 'array' ? !Array.isArray(value) : (!value || typeof value !== 'object' || Array.isArray(value)))
      throw new Error(label + ': ' + (kind === 'array' ? 'YAML-Liste' : 'YAML-Mapping') + ' erwartet.');
    return value;
  }
  function linesOf(text) { return String(text || '').split('\n').map(function (v) {return v.trim();}).filter(Boolean); }
  function integerValue(raw, fallback, minimum, label) {
    if (String(raw).trim() === '') return fallback;
    if (!/^-?\d+$/.test(String(raw).trim()) || !Number.isSafeInteger(Number(raw)) || Number(raw) < minimum)
      throw new Error(label + ': ganze Zahl ab ' + minimum + ' erwartet.');
    return Number(raw);
  }
  function kvObject(text) {
    var result = {};
    kvLines(text).forEach(function (p) {
      safeFieldKey(p[0]);
      if (Object.prototype.hasOwnProperty.call(result,p[0])) throw new Error('Doppelter Schlüssel: ' + p[0]);
      result[p[0]] = p[1];
    }); return result;
  }
  function splitComma(text) {
    var out=[], buf='', quote=null;
    for(var i=0;i<text.length;i++) {
      var c=text[i];
      if(quote && c==='\\' && quote==='"') {buf+=c+(text[++i]||'');continue;}
      if(c===quote) quote=null; else if(!quote && (c==='"'||c==="'")) quote=c;
      if(c===','&&!quote){out.push(buf);buf='';}else buf+=c;
    }
    if(quote) throw new Error('Nicht geschlossenes Anführungszeichen in List-Element.');
    out.push(buf);return out;
  }
  function parseListElements(text) {
    text=String(text||'').trim(); if(!text) return [];
    if(/^[-\[]/.test(text)) return yamlBlock(text,'array','List-Generator');
    return linesOf(text).map(function (line) {
      var obj={}; splitComma(line).forEach(function (field) {
        var i=field.indexOf('='); if(i<=0) throw new Error('List-Element: key=value erwartet.');
        var k=field.slice(0,i).trim(), v=field.slice(i+1).trim(); safeFieldKey(k);
        if(Object.prototype.hasOwnProperty.call(obj,k)) throw new Error('Doppelter List-Schlüssel: '+k);
        if(/^"/.test(v)) v=JSON.parse(v); else if(/^'.*'$/.test(v)) v=v.slice(1,-1).replace(/''/g,"'");
        obj[k]=v;
      });assertSafeTree(obj);return obj;
    });
  }

  function normalizeImportedManifest(obj, warnings) {
    warnings = warnings || [];
    function normalizeSpec(spec) {
      if (!spec) return;
      var sources = Array.isArray(spec.sources) ? spec.sources : (spec.source ? [spec.source] : []);
      if (spec.syncPolicy && Array.isArray(spec.syncPolicy.syncOptions) && spec.syncPolicy.syncOptions.indexOf('Retry=true') !== -1)
        warnings.push('Retry=true wird unverändert erhalten. Eine Retry-Strategie wird über syncPolicy.retry konfiguriert.');
      sources.forEach(function (source) {
        var helm = source.helm || {}, candidates = [];
        if (helm.valuesObject !== undefined) candidates.push(['helm.valuesObject', helm.valuesObject]);
        if (helm.valuesObjects !== undefined) candidates.push(['helm.valuesObjects', helm.valuesObjects]);
        if (source.valuesObject !== undefined) candidates.push(['valuesObject', source.valuesObject]);
        if (source.valuesObjects !== undefined) candidates.push(['valuesObjects', source.valuesObjects]);
        if (!candidates.length) return;
        if (candidates.length > 1) throw new Error('Mehrere valuesObject-Felder in derselben Source: bitte eindeutig angeben.');
        var candidate = candidates[0];
        if (!candidate[1] || typeof candidate[1] !== 'object' || Array.isArray(candidate[1]))
          throw new Error('valuesObject muss ein YAML-Mapping sein.');
        helm.valuesObject = candidate[1];
        source.helm = helm;
        delete helm.valuesObjects; delete source.valuesObject; delete source.valuesObjects;
        if (candidate[0] !== 'helm.valuesObject') warnings.push(candidate[0] + ' wurde nach helm.valuesObject übernommen.');
      });
    }
    normalizeSpec(obj && obj.spec);
    normalizeSpec(obj && obj.spec && obj.spec.template && obj.spec.template.spec);
    return obj;
  }

  function detectResourceKind(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var kind = obj.kind;
    if (kind === 'Application') return 'application';
    if (kind === 'ApplicationSet') return 'applicationset';
    if (kind === 'AppProject') return 'project';
    if (kind === 'Secret') return 'registry-secret';
    if (kind === 'ExternalSecret') return 'registry-eso';
    return null;
  }

  function objToKVLines(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.keys(obj).map(function (k) { return k + '=' + obj[k]; }).join('\n');
  }

  function asLines(v) {
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join('\n');
    return String(v);
  }

  function decodeMaybeBase64(v, isB64) {
    if (v === undefined || v === null) return '';
    if (!isB64) return String(v);
    try { return decodeURIComponent(escape(atob(String(v)))); } catch (e) { try { return atob(String(v)); } catch (e2) { return String(v); } }
  }

  // ---------------- 2) IMPORT-MAPPING JE RESSOURCENTYP ----------------
  function applyImportToApplication(obj, report) {
    normalizeImportedManifest(obj, report.warnings);
    setMode('application');
    clearAppMode();
    var md = obj.metadata || {};
    var spec = obj.spec || {};
    byId('appName').value = md.name || 'my-app';
    byId('appNamespace').value = md.namespace || 'argocd';
    byId('project').value = spec.project || 'default';
    byId('labels').value = objToKVLines(md.labels);
    byId('annotations').value = objToKVLines(md.annotations);
    byId('finalizersText').value = Array.isArray(md.finalizers) ? md.finalizers.join('\n') : '';

    var dest = spec.destination || {};
    byId('destMode').value = dest.server ? 'server' : 'name';
    byId('destValue').value = dest.server || dest.name || 'https://kubernetes.default.svc';
    byId('destNamespace').value = dest.namespace || 'default';

    var srcs = Array.isArray(spec.sources) ? spec.sources : (spec.source ? [spec.source] : []);
    sourcesContainer.innerHTML = '';
    sourceCount = 0;
    if (!srcs.length) {
      createSourceBlock(sourceCount++, true);
      report.warnings.push('Keine spec.source(s) gefunden - Standardwerte gesetzt.');
    }
    srcs.forEach(function(s,idx){populateSource(createSourceBlock(sourceCount++,idx===0,{}),s);});

    var sp = spec.syncPolicy || {};
    var automated = sp.automated || null;
    byId('syncAutomated').checked = !!automated;
    if (automated) {
      byId('syncPrune').checked = !!automated.prune;
      byId('syncSelfHeal').checked = !!automated.selfHeal;
      byId('syncAllowEmpty').checked = !!automated.allowEmpty;
    }
    var optMap = { 'CreateNamespace=true': 'optCreateNs', 'ServerSideApply=true': 'optServerSideApply', 'PruneLast=true': 'optPruneLast', 'ApplyOutOfSyncOnly=true': 'optApplyOutOfSyncOnly', 'Replace=true': 'optReplace', 'Validate=true': 'optValidate', 'RespectIgnoreDifferences=true': 'optRespectIgnoreDiff', 'FailOnSharedResource=true': 'optFailOnSharedResource', 'PrunePropagationPolicy=foreground': 'optPruneForeground', 'PrunePropagationPolicy=background': 'optPruneBackground', 'PrunePropagationPolicy=orphan': 'optPruneOrphan', 'SkipSchemaValidation=true': 'optSkipSchemaValidation', 'DryRunOnPreview=true': 'optDryRunOnPreview' };
    Object.keys(optMap).forEach(function (opt) { byId(optMap[opt]).checked = false; });
    var extraOptions = [];
    (Array.isArray(sp.syncOptions) ? sp.syncOptions : []).forEach(function (opt) {
      if (optMap[opt]) byId(optMap[opt]).checked = true;
      else extraOptions.push(String(opt));
      if (opt === 'Retry=true') report.warnings.push('Retry=true bleibt erhalten, konfiguriert aber keine Retry-Strategie. Bitte syncPolicy.retry verwenden.');
    });
    byId('appExtraSyncOptions').value = extraOptions.join('\n');

    if (sp.retry && byId('enableRetry')) {
      byId('enableRetry').checked = true;
      byId('enableRetry').dispatchEvent(new Event('change'));
      if (sp.retry.limit !== undefined && byId('retryLimit')) byId('retryLimit').value = sp.retry.limit;
      var bo = sp.retry.backoff || {};
      if (bo.duration && byId('retryDuration')) byId('retryDuration').value = bo.duration;
      if (bo.factor !== undefined && byId('retryFactor')) byId('retryFactor').value = bo.factor;
      if (bo.maxDuration && byId('retryMaxDuration')) byId('retryMaxDuration').value = bo.maxDuration;
    }

    if (Array.isArray(spec.ignoreDifferences) && typeof createIgnoreDiffRow === 'function') {
      ignoreDiffContainer.innerHTML = '';
      spec.ignoreDifferences.forEach(function (d) {
        createIgnoreDiffRow();
        var row = ignoreDiffContainer.lastElementChild;
        if (!row) return;
        if (row.querySelector('.idiff-group')) row.querySelector('.idiff-group').value = d.group || '';
        if (row.querySelector('.idiff-kind')) row.querySelector('.idiff-kind').value = d.kind || '';
        if (row.querySelector('.idiff-name')) row.querySelector('.idiff-name').value = d.name || '';
        if (row.querySelector('.idiff-namespace')) row.querySelector('.idiff-namespace').value = d.namespace || '';
        if (row.querySelector('.idiff-jsonpointers')) row.querySelector('.idiff-jsonpointers').value = asLines(d.jsonPointers);
        if (row.querySelector('.idiff-jqpath')) row.querySelector('.idiff-jqpath').value = asLines(d.jqPathExpressions);
        if (row.querySelector('.idiff-managedFieldsManagers')) row.querySelector('.idiff-managedFieldsManagers').value = asLines(d.managedFieldsManagers);
      });
      report.applied.push(spec.ignoreDifferences.length + ' ignoreDifferences-Regel(n)');
    }

    if (Array.isArray(spec.info) && typeof createInfoRow === 'function') {
      infoContainer.innerHTML = '';
      spec.info.forEach(function (it) {
        var row = createInfoRow();
        if (!row) return;
        if (row.querySelector('.info-name')) row.querySelector('.info-name').value = it.name || '';
        if (row.querySelector('.info-value')) row.querySelector('.info-value').value = it.value || '';
      });
      report.applied.push(spec.info.length + ' Info-Eintrag(e)');
    }

    report.applied.push('Metadata, Destination, ' + srcs.length + ' Source(n), SyncPolicy inkl. Retry/Optionen');
  }

  function applyImportToApplicationSet(obj, report) {
    normalizeImportedManifest(obj, report.warnings);
    setMode('applicationset');
    clearAppSetMode();
    var md = obj.metadata || {};
    var spec = obj.spec || {};
    byId('asName').value = md.name || 'my-appset';
    byId('asNamespace').value = md.namespace || 'argocd';
    if (byId('asLabels')) byId('asLabels').value = objToKVLines(md.labels);
    if (byId('asAnnotations')) byId('asAnnotations').value = objToKVLines(md.annotations);
    byId('asFinalizers').value=asLines(md.finalizers);
    byId('asGoTemplateOptsEnable').checked=Array.isArray(spec.goTemplateOptions)&&spec.goTemplateOptions.length>0;
    if(spec.goTemplateOptions){var missing=spec.goTemplateOptions.find(function(v){return /^missingkey=/.test(v);});if(missing)byId('asGoTemplateMissingKey').value=missing.split('=')[1];}
    byId('asGoTemplateOptsEnable').dispatchEvent(new Event('change'));
    if (byId('asGoTemplate')) byId('asGoTemplate').checked = !!spec.goTemplate;

    var gens = Array.isArray(spec.generators) ? spec.generators.slice() : [];
    var combineMode = 'list';
    if (gens.length === 1 && gens[0] && gens[0].merge) {
      combineMode = 'merge';
      if (Array.isArray(gens[0].merge.mergeKeys) && byId('asMergeKeys')) byId('asMergeKeys').value = gens[0].merge.mergeKeys.join('\n');
      gens = Array.isArray(gens[0].merge.generators) ? gens[0].merge.generators : [];
    } else if (gens.length === 1 && gens[0] && gens[0].matrix) {
      combineMode = 'matrix';
      gens = Array.isArray(gens[0].matrix.generators) ? gens[0].matrix.generators : [];
    }
    if (byId('asCombineMode')) { byId('asCombineMode').value = combineMode; byId('asCombineMode').dispatchEvent(new Event('change')); }

    generatorsContainer.innerHTML = '';
    generatorCount = 0;
    if (!gens.length) createGeneratorBlock(generatorCount++, { type: 'list' }, true);
    gens.forEach(function(g,idx){populateGenerator(createGeneratorBlock(generatorCount++,{},idx===0),g);});

    var tpl = spec.template || {};
    var tmd = tpl.metadata || {};
    var tspec = tpl.spec || {};
    byId('asTplLabels').value=objToKVLines(tmd.labels);
    byId('asTplAnnotations').value=objToKVLines(tmd.annotations);
    if (byId('asTplName')) byId('asTplName').value = tmd.name || '{{name}}';
    if (byId('asTplProject')) byId('asTplProject').value = tspec.project || 'default';
    var tdest = tspec.destination || {};
    if (byId('asTplDestMode')) { byId('asTplDestMode').value = tdest.server ? 'server' : 'name'; byId('asTplDestMode').dispatchEvent(new Event('change')); }
    if (byId('asTplDestValue')) byId('asTplDestValue').value = tdest.server || tdest.name || '{{.server}}';
    if (byId('asTplDestNamespace')) byId('asTplDestNamespace').value = tdest.namespace || '{{.namespace}}';

    var tsrcs = Array.isArray(tspec.sources) ? tspec.sources : (tspec.source ? [tspec.source] : []);
    asTplSourcesContainer.innerHTML = '';
    asTplSourceCount = 0;
    if (!tsrcs.length) {
      createSourceBlock(asTplSourceCount++, true, { repoUrl: '{{.repoURL}}', targetRevision: '{{.branch}}', path: '{{.path}}' }, asTplSourcesContainer);
    }
    tsrcs.forEach(function(s,idx){populateSource(createSourceBlock(asTplSourceCount++,idx===0,{},asTplSourcesContainer),s);});
    var tsp = tspec.syncPolicy || {};
    byId('asTplSyncAutomated').checked = !!tsp.automated && tsp.automated.enabled !== false;
    if (tsp.automated) {
      byId('asTplPrune').checked = !!tsp.automated.prune;
      byId('asTplSelfHeal').checked = !!tsp.automated.selfHeal;
      byId('asTplAllowEmpty').checked = !!tsp.automated.allowEmpty;
      if (tsp.automated.enabled === false) report.skipped.push('automated.enabled=false: beim Import als deaktiviertes Automated Sync dargestellt.');
    }
    var knownSyncOptions = {
      'CreateNamespace=true': 'asTplCreateNs', 'PruneLast=true': 'asTplPruneLast',
      'ApplyOutOfSyncOnly=true': 'asTplApplyOutOfSyncOnly', 'ServerSideApply=true': 'asTplServerSideApply',
      'Replace=true': 'asTplReplace', 'SkipDryRunOnMissingResource=true': 'asTplSkipDryRun',
      'RespectIgnoreDifferences=true': 'asTplRespectIgnoreDiff', 'FailOnSharedResource=true': 'asTplFailOnSharedResource'
    };
    byId('asTplCreateNs').checked = false;
    byId('asTplValidate').checked = true;
    var extraSyncOptions = [];
    (Array.isArray(tsp.syncOptions) ? tsp.syncOptions : []).forEach(function (option) {
      if (knownSyncOptions[option]) byId(knownSyncOptions[option]).checked = true;
      else if (option === 'Validate=false') byId('asTplValidate').checked = false;
      else if (/^PrunePropagationPolicy=(foreground|background|orphan)$/.test(option)) byId('asTplPrunePropagation').value = option.split('=')[1];
      else extraSyncOptions.push(option);
    });
    byId('asTplExtraSyncOptions').value = extraSyncOptions.join('\n');
    if (tsp.retry) {
      byId('asTplRetryEnable').checked = true;
      if (tsp.retry.limit !== undefined) byId('asTplRetryLimit').value = tsp.retry.limit;
      var backoff = tsp.retry.backoff || {};
      if (backoff.duration) byId('asTplRetryDuration').value = backoff.duration;
      if (backoff.factor !== undefined) byId('asTplRetryFactor').value = backoff.factor;
      if (backoff.maxDuration) byId('asTplRetryMaxDuration').value = backoff.maxDuration;
    }
    byId('asTplIgnoreDiff').value = (tspec.ignoreDifferences || []).reduce(function (all, item) {
      return all.concat(Array.isArray(item.jsonPointers) ? item.jsonPointers : []);
    }, []).join('\n');
    if (spec.syncPolicy) {
      if (spec.syncPolicy.applicationsSync) byId('asPolicy').value = spec.syncPolicy.applicationsSync;
      byId('asPreserveOnDelete').checked = !!spec.syncPolicy.preserveResourcesOnDeletion;
    }
    report.applied.push('Metadata, ' + gens.length + ' Generator(en) (' + combineMode + '), Template und SyncPolicy');
  }

  function applyImportToProject(obj, report) {
    setMode('project');
    clearProjectMode();
    var md = obj.metadata || {};
    var spec = obj.spec || {};
    byId('prjName').value = md.name || 'my-project';
    if (byId('prjNamespace')) byId('prjNamespace').value = md.namespace || 'argocd';
    byId('prjSourceRepos').value = Array.isArray(spec.sourceRepos) ? spec.sourceRepos.join('\n') : '*';

    prjDestContainer.innerHTML = '';
    var dests = Array.isArray(spec.destinations) ? spec.destinations : [];
    if (!dests.length) { createPrjDestRow(true); }
    dests.forEach(function (d, idx) {
      var row = createPrjDestRow(idx === 0);
      row.querySelector('.prjdest-mode').value = d.server ? 'server' : 'name';
      row.querySelector('.prjdest-value').value = d.server || d.name || '';
      row.querySelector('.prjdest-name').value = d.server ? (d.name || '') : '';
      row.querySelector('.prjdest-namespace').value = d.namespace || '*';
    });

    prjClusterResContainer.innerHTML = '';
    var clusterList = spec.clusterResourceWhitelist || spec.clusterResourceBlacklist || [];
    if (byId('prjClusterMode')) byId('prjClusterMode').value = spec.clusterResourceBlacklist ? 'blacklist' : 'whitelist';
    if (Array.isArray(clusterList) && clusterList.length) {
      clusterList.forEach(function (r) { createPrjResRow(prjClusterResContainer, { group: r.group, kind: r.kind }); });
    }
    prjNsResContainer.innerHTML = '';
    var nsList = spec.namespaceResourceWhitelist || spec.namespaceResourceBlacklist || [];
    if (byId('prjNsMode')) byId('prjNsMode').value = spec.namespaceResourceBlacklist ? 'blacklist' : 'whitelist';
    if (Array.isArray(nsList) && nsList.length) {
      nsList.forEach(function (r) { createPrjResRow(prjNsResContainer, { group: r.group, kind: r.kind }); });
    }

    prjRolesContainer.innerHTML = '';
    var roles = Array.isArray(spec.roles) ? spec.roles : [];
    roles.forEach(function (r) {
      var policies = Array.isArray(r.policies) ? r.policies.map(function (p) { return String(p).replace(/^p,\s*/, ''); }).join('\n') : '';
      createPrjRoleBlock({ name: r.name || '', description: r.description || '', policies: policies, groups: Array.isArray(r.groups) ? r.groups.join('\n') : '' });
    });
    report.applied.push('Metadata, sourceRepos, ' + dests.length + ' Destination(en), ' + roles.length + ' Rolle(n)');
    if(spec.description)byId('prjDescription').value=spec.description;
    if(spec.orphanedResources){byId('prjOrphanEnable').checked=true;byId('prjOrphanWarn').checked=!!spec.orphanedResources.warn;}
    if(spec.signatureKeys)byId('prjSignatureKeys').value=spec.signatureKeys.map(function(k){return k.keyID;}).join('\n');
    if(spec.syncWindows){byId('enableSyncWindows').checked=true;spec.syncWindows.forEach(function(w){var r=createSyncWindowRow();['kind','schedule','duration'].forEach(function(k){r.querySelector('.sw-'+k).value=w[k]||'';});r.querySelector('.sw-timezone').value=w.timeZone||'';['applications','namespaces','clusters'].forEach(function(k){r.querySelector('.sw-'+k).value=(w[k]||[]).join(',');});r.querySelector('.sw-manualSync').checked=!!w.manualSync;});byId('enableSyncWindows').dispatchEvent(new Event('change'));}

  }

  function applyImportToRegistry(obj, kindHint, report) {
    setMode('registry');
    clearRegistryMode();
    var md = obj.metadata || {};
    byId('regSecretName').value = md.name || 'my-repo';
    byId('regNamespace').value = md.namespace || 'argocd';
    var registryLabels = Object.assign({}, md.labels || {});
    if (kindHint === 'registry-eso') {
      var targetMeta = (((obj.spec || {}).target || {}).template || {}).metadata || {};
      registryLabels = Object.assign(registryLabels, targetMeta.labels || {});
      byId('regAnnotations').value = objToKVLines(targetMeta.annotations || md.annotations);
    } else {
      byId('regAnnotations').value = objToKVLines(md.annotations);
    }
    delete registryLabels['argocd.argoproj.io/secret-type'];
    byId('regLabels').value = objToKVLines(registryLabels);
    var importedSecretType = kindHint === 'registry-secret' ? obj.type : ((((obj.spec || {}).target || {}).template || {}).type);
    importedSecretType = importedSecretType || 'Opaque';
    if (Array.prototype.some.call(byId('regSecretType').options, function (opt) { return opt.value === importedSecretType; })) {
      byId('regSecretType').value = importedSecretType;
    } else {
      byId('regSecretType').value = 'custom';
      byId('regSecretTypeCustom').value = importedSecretType;
    }
    byId('regSecretType').dispatchEvent(new Event('change'));

    if (kindHint === 'registry-secret') {
      var isB64 = !!obj.data && !obj.stringData;
      var data = {};
      Object.keys(obj.data || {}).forEach(function(k){data[k]=decodeMaybeBase64(obj.data[k],true);});
      Object.assign(data,obj.stringData||{});
      byId('regEncoding').value = isB64 ? 'data' : 'stringdata';
      isB64=false;
      var secretTypeLabel = (md.labels && md.labels['argocd.argoproj.io/secret-type']) || 'repository';
      byId('regKind').value = secretTypeLabel === 'repo-creds' ? 'repo-creds' : 'repository';
      var typeVal = decodeMaybeBase64(data.type, isB64);
      var enableOci = decodeMaybeBase64(data.enableOCI, isB64);
      byId('regType').value = (enableOci === 'true') ? 'oci' : (typeVal || 'git');
      byId('regUrl').value = decodeMaybeBase64(data.url, isB64);
      byId('regName').value = decodeMaybeBase64(data.name, isB64);
      byId('regInsecure').checked = decodeMaybeBase64(data.insecure, isB64) === 'true';
      var proj = decodeMaybeBase64(data.project, isB64);
      if (proj && byId('regProjectEnabled')) { byId('regProjectEnabled').checked = true; byId('regProjectEnabled').dispatchEvent(new Event('change')); if (byId('regProject')) byId('regProject').value = proj; }
      if (data.username !== undefined || data.password !== undefined) {
        byId('regAuthMethod').value = 'userpass';
        byId('regAuthMethod').dispatchEvent(new Event('change'));
        if (byId('regCredSource')) byId('regCredSource').value = 'inline';
        byId('regUsername').value = decodeMaybeBase64(data.username, isB64);
        byId('regPassword').value = decodeMaybeBase64(data.password, isB64);
      } else if (data.sshPrivateKey !== undefined) {
        byId('regAuthMethod').value = 'ssh';
        byId('regAuthMethod').dispatchEvent(new Event('change'));
        byId('regSshKey').value = decodeMaybeBase64(data.sshPrivateKey, isB64);
      } else if (data.tlsClientCertData !== undefined) {
        byId('regAuthMethod').value = 'tls';
        byId('regAuthMethod').dispatchEvent(new Event('change'));
        byId('regTlsCert').value = decodeMaybeBase64(data.tlsClientCertData, isB64);
        byId('regTlsKey').value = decodeMaybeBase64(data.tlsClientCertKey, isB64);
      }
      byId('regType').dispatchEvent(new Event('change'));
      byId('regKind').dispatchEvent(new Event('change'));
      report.applied.push('Registry-Secret: Grundfelder, URL, Auth-Methode, Secret-Typ, Labels und Annotations');
    } else {
      populateExternalSecret(obj, report);
    }
  }

  // ---------------- YAML-IMPORT MODAL WIRING ----------------
  var pendingImportParsed = null;
  var pendingImportKind = null;

  byId('yamlImportBtn').addEventListener('click', function () {
    importReadRevision++;byId('yamlImportDocument').value='0';byId('yamlImportDocumentRow').hidden=true;
    byId('yamlImportText').value = '';
    byId('yamlImportFileName').textContent = '';
    byId('yamlImportReport').style.display = 'none';
    byId('yamlImportApplyBtn').disabled = true;
    pendingImportParsed = null;
    pendingImportKind = null;
    byId('yamlImportModal').style.display = 'flex';
  });
  byId('yamlImportCancelBtn').addEventListener('click', function () { importReadRevision++;invalidateImport();byId('yamlImportModal').style.display = 'none'; });
  byId('yamlImportPickFileBtn').addEventListener('click', function () { byId('yamlImportFilePicker').click(); });
  var importReadRevision=0;
  byId('yamlImportFilePicker').addEventListener('change',function(event) {
    var file=event.target.files&&event.target.files[0]; if(!file)return;
    var revision=++importReadRevision; invalidateImport();byId('yamlImportText').value='';byId('yamlImportDocument').value='0';
    byId('yamlImportFileName').textContent=file.name;
    if(file.size>4*1024*1024){showImportError('Datei zu groß (maximal 4 MiB Dateigröße, 2.097.152 Textzeichen).');event.target.value='';return;}
    var reader=new FileReader();
    reader.onload=function(){if(revision!==importReadRevision)return;byId('yamlImportText').value=String(reader.result||'');invalidateImport();};
    reader.onerror=function(){if(revision===importReadRevision)showImportError('Lokale Datei konnte nicht gelesen werden.');};
    reader.readAsText(file);event.target.value='';
  });

  byId('yamlImportText').addEventListener('input',function(){importReadRevision++;byId('yamlImportDocument').value='0';invalidateImport();});
  byId('yamlImportParseBtn').addEventListener('click', function () {
    var text = byId('yamlImportText').value;
    var reportBox = byId('yamlImportReport');
    reportBox.style.display = 'block';
    try {
      var importWarnings = [];
      var documents=parseImportDocuments(text),documentSelect=byId('yamlImportDocument'),selected=Number(documentSelect.value)||0;
      if(selected>=documents.length)selected=0;
      documentSelect.replaceChildren();
      documents.forEach(function(obj,index){var option=document.createElement('option');option.value=String(index);option.textContent=(index+1)+': '+(obj&&obj.kind||'unbekannter Typ')+' / '+(obj&&obj.metadata&&obj.metadata.name||'ohne Name');documentSelect.appendChild(option);});
      documentSelect.value=String(selected);byId('yamlImportDocumentRow').hidden=documents.length<2;
      var parsed = normalizeImportedManifest(documents[selected], importWarnings);
      var kind = detectResourceKind(parsed);
      if (!kind) {
        reportBox.className = 'callout-box';
        reportBox.innerHTML = '<h4>Ressourcentyp nicht erkannt</h4><p>Erwartet wird kind: Application, ApplicationSet, AppProject, Secret oder ExternalSecret.</p>';
        byId('yamlImportApplyBtn').disabled = true;
        pendingImportParsed = null; pendingImportKind = null;
        return;
      }
      var schemaResult = validateAgainstSchema(kind === 'registry-secret' || kind === 'registry-eso' ? 'registry' : kind, parsed);
      schemaResult.warnings = schemaResult.warnings.concat(importWarnings);
      var kindLabels = { application: 'Application', applicationset: 'ApplicationSet', project: 'AppProject', 'registry-secret': 'Repository-Secret', 'registry-eso': 'ExternalSecret (Repository)' };
      var html = '<h4>Erkannt als: ' + kindLabels[kind] + '</h4>';
      if (schemaResult.errors.length) html += '<p><strong>Schema-Fehler:</strong></p><ul>' + schemaResult.errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>';
      if (schemaResult.warnings.length) html += '<p><strong>Hinweise:</strong></p><ul>' + schemaResult.warnings.map(function (w) { return '<li>' + escapeHtml(w) + '</li>'; }).join('') + '</ul>';
      html += '<p class="hint">Klicke "In Formular uebernehmen", um die erkannten Felder in den passenden Reiter zu laden. Nicht abgedeckte Felder werden danach erneut aufgelistet.</p>';
      reportBox.className = schemaResult.errors.length ? 'callout-box' : 'callout-box ok';
      reportBox.innerHTML = html;
      pendingImportParsed = parsed;
      pendingImportKind = kind;
      byId('yamlImportApplyBtn').disabled = schemaResult.errors.length > 0;
    } catch (err) {
      reportBox.className = 'callout-box';
      reportBox.innerHTML = '<h4>Parser-Fehler</h4><p>' + escapeHtml(err.message) + '</p>';
      byId('yamlImportApplyBtn').disabled = true;
      pendingImportParsed = null; pendingImportKind = null;
    }
  });

  byId('yamlImportApplyBtn').addEventListener('click', function () {
    if (!pendingImportParsed || !pendingImportKind) return;
    var report = { applied: [], skipped: [], warnings: [] };
    try {
      if (pendingImportKind === 'application') applyImportToApplication(pendingImportParsed, report);
      else if (pendingImportKind === 'applicationset') applyImportToApplicationSet(pendingImportParsed, report);
      else if (pendingImportKind === 'project') applyImportToProject(pendingImportParsed, report);
      else if (pendingImportKind === 'registry-secret' || pendingImportKind === 'registry-eso') applyImportToRegistry(pendingImportParsed, pendingImportKind, report);
      generateYaml();
      var reportBox = byId('yamlImportReport');
      var html = '<h4>Uebernommen</h4><ul>' + report.applied.map(function (a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('') + '</ul>';
      if (report.warnings.length) html += '<p><strong>Hinweise:</strong></p><ul>' + report.warnings.map(function (w) { return '<li>' + escapeHtml(w) + '</li>'; }).join('') + '</ul>';
      if (report.skipped.length) html += '<p><strong>Nicht automatisch uebernommen (bitte manuell pruefen):</strong></p><ul>' + report.skipped.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ul>';
      reportBox.className = 'callout-box ok';
      reportBox.innerHTML = html + '<div style="margin-top:12px;"><button type="button" class="btn-secondary" id="yamlImportCloseBtn">Schließen</button></div>';
      var status = byId('statusMsg');
      if (status) { status.textContent = 'YAML importiert und uebernommen'; status.style.color = 'var(--ok)'; setTimeout(function () { status.textContent = ''; }, 3000); }
      // Modal bleibt offen, User schliesst manuell ueber Schaltfläche
    } catch (err) {
      alert('Fehler beim Uebernehmen: ' + err.message);
    }
  
  var closeButton=byId('yamlImportCloseBtn');if(closeButton)closeButton.onclick=function(){byId('yamlImportModal').style.display='none';};
});

  // ---------------- 3) SCHEMA-VALIDIERUNG FUER ALLE RESSOURCENTYPEN ----------------
  // Local structure/plausibility checks; not validation against the cluster's installed CRDs.
  function validateAgainstSchemaCore(kind,obj){
    var errors=[],warnings=[];obj=obj||{};
    function error(s){errors.push(s);}function warn(s){warnings.push(s);}
    function map(v,path){if(!v||typeof v!=='object'||Array.isArray(v)){error(path+': Mapping erwartet.');return false;}return true;}
    function list(v,path){if(!Array.isArray(v)){error(path+': Liste erwartet.');return false;}return true;}
    function string(v,path,required){if(typeof v!=='string'||(required&&!v.trim()))error(path+': '+(required?'nicht-leerer ':'')+'String erwartet.');}
    function duration(v,path){if(typeof v!=='string'||! /^(?:0|(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+)$/.test(v))error(path+': Dauer wie 5s, 2m oder 1h erwartet.');}
    function selector(v,path){if(!map(v,path))return;if(v.matchLabels&&!map(v.matchLabels,path+'.matchLabels'))return;if(v.matchExpressions&&list(v.matchExpressions,path+'.matchExpressions'))v.matchExpressions.forEach(function(e){if(!map(e,path+'.matchExpressions[]'))return;string(e.key,path+'.key',true);if(!['In','NotIn','Exists','DoesNotExist'].includes(e.operator))error(path+': ungültiger Selector-Operator.');if(['In','NotIn'].includes(e.operator)&&(!Array.isArray(e.values)||!e.values.length))error(path+': In/NotIn benötigt values.');});}
    function sync(sp,path){
      if(!sp)return;if(!map(sp,path))return;
      if(sp.automated&&map(sp.automated,path+'.automated'))['enabled','prune','selfHeal','allowEmpty'].forEach(function(k){if(sp.automated[k]!==undefined&&typeof sp.automated[k]!=='boolean')error(path+'.automated.'+k+': Boolean erwartet.');});
      if(sp.syncWindows)error(path+'.syncWindows ist ungültig; Sync Windows gehören in AppProject.spec.syncWindows.');
      if(sp.syncOptions&&list(sp.syncOptions,path+'.syncOptions')){
        var seen=new Set(),optionValues={};
        sp.syncOptions.forEach(function(o){
          if(typeof o!=='string'||!/^\w+=[^\s]+$/.test(o)){error(path+': ungültige Sync-Option '+String(o));return;}
          if(seen.has(o))warn(path+': doppelte Sync-Option '+o);seen.add(o);
          var parts=o.split('='),k=parts[0];if(optionValues[k]!==undefined&&optionValues[k]!==parts[1])error(path+': widersprüchliche Werte für '+k);optionValues[k]=parts[1];
          if(['Retry','SkipSchemaValidation','DryRunOnPreview'].includes(k))warn(o+' ist keine hier unterstützte Argo-CD-Sync-Option. Retry über syncPolicy.retry, Helm-Schema über source.helm.skipSchemaValidation konfigurieren.');
          if(k==='PrunePropagationPolicy'&&!['foreground','background','orphan'].includes(parts[1]))error('Ungültige PrunePropagationPolicy.');
        });
        if(optionValues.Replace==='true'&&optionValues.ServerSideApply==='true')warn('Replace=true hat Vorrang vor ServerSideApply=true.');
      }
      if(sp.retry&&map(sp.retry,path+'.retry')){
        if(sp.retry.limit!==undefined&&(!Number.isSafeInteger(sp.retry.limit)||sp.retry.limit < -1))error(path+'.retry.limit: ganze Zahl erwartet.');
        var bo=sp.retry.backoff||{};if(bo.factor!==undefined&&(!Number.isSafeInteger(bo.factor)||bo.factor<1))error(path+'.retry.backoff.factor: positive ganze Zahl erwartet.');
        ['duration','maxDuration'].forEach(function(k){if(bo[k]!==undefined)duration(bo[k],path+'.retry.backoff.'+k);});
      }
    }
    function source(s,path){
      if(!map(s,path))return;string(s.repoURL,path+'.repoURL',true);if(s.targetRevision!==undefined)string(s.targetRevision,path+'.targetRevision',true);else warn(path+': targetRevision fehlt.');
      if(s.chart&&s.path)error(path+': chart und path dürfen nicht gleichzeitig gesetzt sein.');
      if(!s.chart&&!s.path&&!s.ref)error(path+': chart, path oder ref fehlt.');
      if(s.ref&&s.chart)error(path+': chart und ref dürfen nicht kombiniert werden.');
      var methods=['helm','kustomize','directory','plugin'].filter(function(k){return s[k]!==undefined;});if(methods.length>1)error(path+': mehrere Manifest-Generatoren gesetzt.');
      if(s.helm&&map(s.helm,path+'.helm')){
        var h=s.helm;if(h.valuesObjects!==undefined||h.releaseNamespace!==undefined)error(path+': nicht unterstützte Helm-Felder valuesObjects/releaseNamespace.');
        if(h.valuesObject!==undefined)map(h.valuesObject,path+'.helm.valuesObject');
        ['skipCrds','skipSchemaValidation','ignoreMissingValueFiles','passCredentials'].forEach(function(k){if(h[k]!==undefined&&typeof h[k]!=='boolean')error(path+'.helm.'+k+': Boolean erwartet.');});
        ['parameters','fileParameters','valueFiles','apiVersions'].forEach(function(k){if(h[k]!==undefined)list(h[k],path+'.helm.'+k);});
        if(h.kubeVersion!==undefined&&!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(h.kubeVersion))error(path+': Helm kubeVersion erwartet Semver ohne v-Präfix.');
      }
      if(s.kustomize&&map(s.kustomize,path+'.kustomize')){
        var k=s.kustomize;if(k.patches&&list(k.patches,path+'.kustomize.patches'))k.patches.forEach(function(p){if(!p||typeof p!=='object'||typeof p.patch!=='string')error(path+': Kustomize patch benötigt einen patch-String.');});
        if(k.replicas&&list(k.replicas,path+'.kustomize.replicas'))k.replicas.forEach(function(r){if(!map(r,path+'.replicas[]'))return;if(!Number.isSafeInteger(r.count)||r.count<0)error(path+': replica count muss ganzzahlig und >=0 sein.');string(r.name,path+'.kustomize.replicas.name',true);});
        if(k.patchesJson6902||k.patchesStrategicMerge)error(path+': Legacy-Patches in patches überführen.');
      }
      if(s.plugin&&map(s.plugin,path+'.plugin')){
        if(s.plugin.configMapRef)error(path+': Application-Plugin unterstützt kein configMapRef.');
        if(s.plugin.parameters&&list(s.plugin.parameters,path+'.plugin.parameters'))s.plugin.parameters.forEach(function(p){if(!map(p,path+'.parameters[]'))return;string(p.name,path+'.name',true);if(['string','array','map'].filter(function(k){return p[k]!==undefined;}).length!==1)error(path+': Plugin-Parameter benötigt genau einen Typ string/array/map.');});
      }
      if(s.directory&&map(s.directory,path+'.directory'))['include','exclude'].forEach(function(k){if(s.directory[k]!==undefined)string(s.directory[k],path+'.directory.'+k,false);});
    }
    function appSpec(spec,path){
      if(!map(spec,path))return;if(spec.source&&spec.sources)error(path+': source und sources sind gleichzeitig gesetzt.');
      var ss=spec.sources!==undefined?spec.sources:spec.source?[spec.source]:[];if(!list(ss,path+'.sources'))return;if(!ss.length)error(path+': keine Sources.');
      ss.forEach(function(s,i){source(s,path+'.source['+i+']');});
      var refs=Object.create(null);ss.forEach(function(s){if(s&&s.ref){if(refs[s.ref])error('Doppelter Source-Ref: '+s.ref);refs[s.ref]=true;}});
      ss.forEach(function(s){if(s&&s.helm&&Array.isArray(s.helm.valueFiles))s.helm.valueFiles.forEach(function(v){var m=String(v).match(/^\$([^/]+)\//);if(m&&!refs[m[1]])error('valueFiles verweist auf fehlenden Ref: '+m[1]);});});
      if(map(spec.destination,path+'.destination')){var dest=spec.destination;if(!!dest.server===!!dest.name)error(path+': genau eines von destination.server/name setzen.');if(dest.server!==undefined)string(dest.server,path+'.destination.server',true);if(dest.name!==undefined)string(dest.name,path+'.destination.name',true);if(dest.namespace!==undefined)string(dest.namespace,path+'.destination.namespace',false);}
      sync(spec.syncPolicy,path+'.syncPolicy');
    }
    function generator(g,path){
      if(!map(g,path))return;var types=['list','clusters','git','scmProvider','pullRequest','clusterDecisionResource','matrix','merge','plugin'].filter(function(k){return g[k]!==undefined;});if(types.length!==1){error(path+': genau ein Generator-Typ erforderlich.');return;}
      var t=types[0],v=g[t];if(!map(v,path+'.'+t))return;if(g.selector)selector(g.selector,path+'.selector');
      if(t==='list'){if(v.elements===undefined&&v.elementsYaml===undefined)error(path+': list.elements oder elementsYaml fehlt.');if(v.elements!==undefined&&list(v.elements,path+'.elements')){v.elements.forEach(function(el){map(el,path+'.element');});if(!v.elements.length)warn('List-Generator enthält keine Elemente.');}}
      if(t==='git'){string(v.repoURL,path+'.git.repoURL',true);string(v.revision,path+'.git.revision',true);if(!v.directories&&!v.files)error(path+': Git-Generator braucht directories oder files.');if(v.directories&&v.files)error(path+': directories und files bitte in getrennten Git-Generatoren konfigurieren.');}
      if(t==='matrix'||t==='merge'){
        if(!list(v.generators,path+'.generators'))return;if(t==='matrix'&&v.generators.length!==2)error('Matrix benötigt genau zwei Sub-Generatoren.');if(t==='merge'&&v.generators.length<2)error('Merge benötigt mindestens zwei Sub-Generatoren.');
        if(t==='merge'&&(!Array.isArray(v.mergeKeys)||!v.mergeKeys.length))error('Merge benötigt mergeKeys.');v.generators.forEach(function(child,i){generator(child,path+'.generators['+i+']');});
      }
      if(t==='scmProvider'){
        if(v.github){string(v.github.organization,path+'.organization',true);if(v.github.tokenRef&&map(v.github.tokenRef,path+'.tokenRef')){string(v.github.tokenRef.secretName,path+'.secretName',true);string(v.github.tokenRef.key,path+'.key',true);}if(v.github.filters||v.github.team)error(path+': github.filters/team sind ungültig.');}
        if(v.filters&&list(v.filters,path+'.filters'))v.filters.forEach(function(f){['repositoryMatch','labelMatch','branchMatch'].forEach(function(k){if(f[k]!==undefined){try{new RegExp(f[k]);}catch(e){error(path+': ungültiger Filter-Regex '+k);}}});});
      }
      if(t==='pullRequest'&&v.github){string(v.github.owner,path+'.owner',true);string(v.github.repo,path+'.repo',true);if(v.github.repository)error(path+': repo statt repository verwenden.');}
      if(t==='clusterDecisionResource'){string(v.configMapRef,path+'.configMapRef',true);if(!v.name&&!v.labelSelector)warn(path+': name oder labelSelector zur Ressourcenauswahl prüfen.');}
    }
    if(!map(obj,'Manifest'))return {errors:errors,warnings:warnings};
    var md=obj.metadata||{},spec=obj.spec||{};
    if(!map(md,'metadata'))return {errors:errors,warnings:warnings};string(md.name,'metadata.name',true);
    if(md.name&&md.name.indexOf('{{')===-1&&!/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/.test(md.name))error('metadata.name ist kein DNS-konformer Ressourcenname.');
    ['labels','annotations'].forEach(function(k){if(md[k]&&map(md[k],'metadata.'+k))Object.keys(md[k]).forEach(function(key){if(typeof md[k][key]!=='string')error('metadata.'+k+'.'+key+': String erwartet.');});});
    if(md.finalizers&&list(md.finalizers,'metadata.finalizers'))md.finalizers.forEach(function(f){if(/custom-cascade$/.test(f))warn('Custom-Finalizer benötigt einen Controller; sonst kann Löschen dauerhaft blockieren.');});
    if(['application','applicationset','project'].includes(kind)&&obj.apiVersion!=='argoproj.io/v1alpha1')warn('Argo-CD-Ressourcen erwarten apiVersion argoproj.io/v1alpha1.');
    if(kind==='application'){if(obj.kind!=='Application')error('kind muss Application sein.');appSpec(spec,'spec');}
    else if(kind==='applicationset'){
      if(obj.kind!=='ApplicationSet')error('kind muss ApplicationSet sein.');if(list(spec.generators,'spec.generators')){if(!spec.generators.length)error('Keine Generatoren.');spec.generators.forEach(function(g,i){generator(g,'spec.generators['+i+']');});}
      if(spec.postSelector)error('spec.postSelector ist ungültig; generator.selector verwenden.');
      if(spec.goTemplate!==undefined&&typeof spec.goTemplate!=='boolean')error('goTemplate muss Boolean sein.');if(spec.goTemplateOptions&&!spec.goTemplate)warn('goTemplateOptions wird ohne goTemplate ignoriert.');
      if(!spec.template||!spec.template.metadata||!spec.template.metadata.name)error('template.metadata.name fehlt.');appSpec(spec.template&&spec.template.spec,'spec.template.spec');
      var tmpl=JSON.stringify(spec.template||{});if(spec.goTemplate&&/\{\{\s*(?:path\[|cluster\.|repoURL|branch|namespace)/.test(tmpl))warn('Template enthält Fasttemplate-Syntax bei aktiviertem GoTemplate. Variablen benötigen meist einen führenden Punkt.');
    }else if(kind==='project'){
      if(obj.kind!=='AppProject')error('kind muss AppProject sein.');if(spec.sourceRepos!==undefined)list(spec.sourceRepos,'spec.sourceRepos');if(spec.destinations!==undefined)list(spec.destinations,'spec.destinations');
      if(spec.syncWindows&&list(spec.syncWindows,'spec.syncWindows'))spec.syncWindows.forEach(function(w){if(!['allow','deny'].includes(w.kind))error('Sync Window: allow/deny erwartet.');if(typeof w.schedule!=='string'||w.schedule.trim().split(/\s+/).length!==5)error('Sync Window benötigt fünf Cron-Felder.');duration(w.duration,'Sync Window duration');if(!['applications','namespaces','clusters'].some(function(k){return Array.isArray(w[k])&&w[k].length;}))warn('Sync Window ohne Selektionsfelder.');if(w.timeZone){try{new Intl.DateTimeFormat('en',{timeZone:w.timeZone});}catch(e){error('Ungültige Zeitzone: '+w.timeZone);}}});
      if(spec.roles&&list(spec.roles,'spec.roles'))spec.roles.forEach(function(r){if(r.policies&&list(r.policies,'role.policies'))r.policies.forEach(function(p){if(typeof p!=='string'||!/^p,\s*proj:/.test(p))warn('RBAC-Policy muss mit p, proj:<Projekt>:<Rolle> beginnen.');});});
    }else if(kind==='registry'){
      if(obj.kind==='Secret'){
        var d=Object.assign({},obj.data||{},obj.stringData||{});if(!d.url)error('Repository-Secret benötigt url.');if(!md.labels||!['repository','repo-creds'].includes(md.labels['argocd.argoproj.io/secret-type']))error('Argo-CD-Repository-Label fehlt/ungültig.');
        if(obj.stringData)Object.keys(obj.stringData).forEach(function(k){if(typeof obj.stringData[k]!=='string')error('stringData.'+k+': String erwartet.');});
        if(obj.data)Object.keys(obj.data).forEach(function(k){if(typeof obj.data[k]!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(obj.data[k]))error('data.'+k+': gültiges Base64 erwartet.');});
        if(obj.type&&obj.type!=='Opaque')warn('Repository-Secret sollte Opaque sein; andere Typen benötigen zusätzliche Pflichtfelder.');
      }else if(obj.kind==='ExternalSecret'){
        if(!spec.data&&!spec.dataFrom)error('ExternalSecret benötigt data oder dataFrom.');
        if(spec.refreshInterval!==undefined)duration(spec.refreshInterval,'refreshInterval');
        if(spec.data&&list(spec.data,'spec.data'))spec.data.forEach(function(d){if(d.remoteRef&&!d.remoteRef.key)error('ExternalSecret remoteRef.key fehlt.');if(!spec.secretStoreRef&&!d.sourceRef)error('ExternalSecret benötigt secretStoreRef oder sourceRef.');});
        if(spec.target&&spec.target.creationPolicy==='None')warn('creationPolicy=None erzeugt/aktualisiert kein Ziel-Secret.');
      }else error('Repository-Reiter erwartet Secret oder ExternalSecret.');
    }else error('Nicht unterstützter Ressourcentyp.');
    return {errors:errors,warnings:warnings};
  }

  byId('validateBtn').addEventListener('click',function () {
    generateYaml(); var result;
    try {result=renderError?{errors:[renderError],warnings:[]}:validateAgainstSchema(currentMode,parseSimpleYAML(getExportText()));}
    catch(error){result={errors:[error.message],warnings:[]};}
    displayValidation(result);
    if(currentMode==='project')updateRbacWarningsPanel();
  });

  // ---------------- 4) SICHERHEITSMODUS: SECRET-MASKIERUNG + RBAC-WARNUNGEN ----------------
  var SECURITY_MODE = false;
  var SENSITIVE_KEY_RE = /^(\s*)(password|token|apitoken|accesstoken|clientsecret|secret|privatekey|sshprivatekey|tlsclientcertdata|tlsclientcertkey|client-cert|client-key|ssh-privatekey|tls\.crt|tls\.key)\s*:\s*(.*)$/i;

  function maskSensitiveYaml(text){
    try{return objectToYaml(maskTree(parseSimpleYAML(text)))+'\n';}catch(e){return '# Sicherheitsmodus: ungültige YAML wird nicht angezeigt.\n';}
  }

  byId('securityModeToggle').addEventListener('change', function (e) {
    SECURITY_MODE = e.target.checked;
    document.body.classList.toggle('security-on', SECURITY_MODE);
    generateYaml();
  });

  function computeRbacWarnings() {
    var warnings = [];
    var sourceRepos = (byId('prjSourceRepos').value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (sourceRepos.indexOf('*') !== -1) warnings.push('sourceRepos enthaelt "*" - jedes beliebige Repository ist als Quelle zulaessig.');
    Array.prototype.forEach.call(prjDestContainer.querySelectorAll('.source-block'), function (row) {
      var val = row.querySelector('.prjdest-value').value.trim();
      var ns = row.querySelector('.prjdest-namespace').value.trim();
      if (val === '*') warnings.push('Destination erlaubt alle Cluster ("*").');
      if (ns === '*') warnings.push('Destination erlaubt alle Namespaces ("*") auf Ziel "' + val + '".');
    });
    Array.prototype.forEach.call(prjRolesContainer.querySelectorAll('.source-block'), function (row) {
      var name = row.querySelector('.role-name').value.trim() || '(ohne Namen)';
      var policies = row.querySelector('.role-policies').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var groups = row.querySelector('.role-groups').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!groups.length) warnings.push('Rolle "' + name + '": keine Gruppen zugewiesen.');
      policies.forEach(function (p) {
        var parts = p.split(',').map(function (x) { return x.trim(); });
        var resource = parts[1], action = parts[2], object = parts[3], effect = parts[4];
        if (resource === 'applications' && action === 'action/*') warnings.push('Rolle "' + name + '": breite Freigabe "action/*" erlaubt alle UI-Aktionen.');
        if (resource === 'exec' && action === 'create') warnings.push('Rolle "' + name + '": "exec, create" erlaubt Terminal-Zugriff in Pods - sehr weitreichend.');
        if (action === '*' || resource === '*' || object === '*') {
          warnings.push('Rolle "' + name + '": Policy "' + p + '" verwendet "*" bei Ressource/Aktion/Objekt.');
        }
        if (effect && effect.toLowerCase() === 'deny') warnings.push('Rolle "' + name + '": "deny"-Regel vorhanden - ersetzt keine fehlende globale Rechtepruefung in argocd-rbac-cm.');
      });
    });
    return warnings;
  }

  function updateRbacWarningsPanel() {
    var panel = byId('rbacWarningsPanel');
    if (!panel) return;
    var warnings = computeRbacWarnings();
    if (!warnings.length) {
      panel.style.display = 'block';
      panel.className = 'callout-box ok';
      panel.innerHTML = '<h4>RBAC-Basispruefung: OK</h4><p>Keine offensichtlich zu breiten Freigaben gefunden. Ersetzt keine vollstaendige Sicherheitspruefung.</p>';
      return;
    }
    panel.style.display = 'block';
    panel.className = 'callout-box warn';
    panel.innerHTML = '<h4>RBAC-Warnungen (' + warnings.length + ')</h4><ul>' + warnings.map(function (w) { return '<li>' + escapeHtml(w) + '</li>'; }).join('') + '</ul>';
  }

  // ---------------- 5) APPLICATIONSET GENERATOR-VORSCHAU ----------------
  function parseGenListElementsLegacy(text) {
    return (text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      var obj = {};
      line.split(',').forEach(function (tok) {
        var idx = tok.indexOf('=');
        if (idx === -1) return;
        obj[tok.slice(0, idx).trim()] = tok.slice(idx + 1).trim();
      });
      return obj;
    });
  }

  function cartesianMerge(a, b) {
    if(a.length*b.length>1000)throw new Error('Vorschau auf 1000 Kombinationen begrenzt.');
    var out = [];
    a.forEach(function (x) { b.forEach(function (y) { out.push(Object.assign({}, x, y)); }); });
    return out;
  }

  function computeGeneratorPreview() {
    var manifest=parseSimpleYAML(getExportText());
    if(manifest.kind!=='ApplicationSet')throw new Error('ApplicationSet-Reiter erforderlich.');
    var validated=validateAgainstSchema('applicationset',manifest);
    if(validated.errors.length)throw new Error(validated.errors.join(' | '));
    var generators=manifest.spec.generators, warnings=[], maxRows=1000;
    function bounded(rows){if(rows.length>maxRows)throw new Error('Lokale Vorschau auf 1000 Parametersätze begrenzt.');return rows;}
    function selected(rows,selector){return selector?rows.filter(function(params){return matchesSelector(params,selector);}):rows;}
    function compute(g){
      var type=['list','matrix','merge','clusters','git','scmProvider','pullRequest','clusterDecisionResource','plugin'].find(function(k){return g[k]!==undefined;});
      var rows=[];
      if(type==='list'){
        if(g.list.elementsYaml!==undefined)throw new Error('Dynamisches elementsYaml benötigt Controller-Auswertung; keine lokale Simulation.');
        rows=g.list.elements||[];
      } else if(type==='matrix') {
        var left=compute(g.matrix.generators[0]),right=compute(g.matrix.generators[1]);
        if(left.length*right.length>maxRows)throw new Error('Matrix-Vorschau auf 1000 Kombinationen begrenzt.');
        left.forEach(function(a){right.forEach(function(b){
          Object.keys(b).forEach(function(k){if(Object.prototype.hasOwnProperty.call(a,k)&&JSON.stringify(stable(a[k]))!==JSON.stringify(stable(b[k])))throw new Error('Matrix: widersprüchlicher Parameter '+k);});
          rows.push(Object.assign({},a,b));
        });});
      } else if(type==='merge') {
        var merge=g.merge,keys=merge.mergeKeys; rows=compute(merge.generators[0]).map(function(p){return Object.assign({},p);});
        function signature(p){var values=keys.map(function(k){var v=parameterAt(p,k);if(v===undefined)throw new Error('Merge-Schlüssel fehlt: '+k);return v;});return JSON.stringify(values);}
        var index=new Map();rows.forEach(function(p,i){var sig=signature(p);if(index.has(sig))throw new Error('Merge: doppelter Schlüssel in Basisgenerator.');index.set(sig,i);});
        merge.generators.slice(1).forEach(function(child){var seen=new Set();compute(child).forEach(function(p){var sig=signature(p);if(seen.has(sig))throw new Error('Merge: doppelter Override-Schlüssel.');seen.add(sig);if(index.has(sig)){var i=index.get(sig);rows[i]=Object.assign({},rows[i],p);}});});
      } else throw new Error('Generator '+type+' benötigt Live-Daten; keine vollständige lokale Vorschau möglich.');
      return bounded(selected(rows,g.selector));
    }
    var combined=[];generators.forEach(function(g){combined=bounded(combined.concat(compute(g)));});
    var template=manifest.spec.template.metadata.name;
    var rows=combined.map(function(params){
      var name=template.replace(/\{\{\s*\.?([a-zA-Z0-9_.-]+)\s*\}\}/g,function(whole,key){var value=parameterAt(params,key);return value===undefined?whole:typeof value==='object'?JSON.stringify(value):String(value);});
      if(name.includes('{{')&&!warnings.includes('Komplexe oder fehlende Go-Template-Ausdrücke bleiben unverändert.'))warnings.push('Komplexe oder fehlende Go-Template-Ausdrücke bleiben unverändert.');
      return {params:params,name:name};
    });
    var duplicate=new Set();rows.forEach(function(row){if(duplicate.has(row.name))warnings.push('Doppelter Application-Name: '+row.name);duplicate.add(row.name);});
    return {combineMode:byId('asCombineMode').value,rows:rows,warnings:warnings};
  }

  byId('genPreviewBtn').addEventListener('click', function () {
    var panel = byId('generatorPreviewPanel');
    var out = byId('generatorPreviewOutput');
    var result;try{result=computeGeneratorPreview();}catch(e){out.textContent=e.message;panel.style.display='block';return;}
    if (!result.rows.length) {
      out.innerHTML = '<div class="hint">Keine Generatoren/Elemente zum Simulieren gefunden.</div>';
    } else {
      var allKeys = {};
      result.rows.forEach(function (r) { Object.keys(r.params).forEach(function (k) { allKeys[k] = true; }); });
      var keyList = Object.keys(allKeys);
      var html = '<table><thead><tr><th>#</th>' + keyList.map(function (k) { return '<th>' + escapeHtml(k) + '</th>'; }).join('') + '<th>Application-Name (gerendert)</th></tr></thead><tbody>';
      result.rows.forEach(function (r, idx) {
        html += '<tr><td>' + (idx + 1) + '</td>' + keyList.map(function (k) { return '<td>' + escapeHtml(r.params[k] === undefined ? '' : typeof r.params[k] === 'object' ? JSON.stringify(r.params[k]) : r.params[k]) + '</td>'; }).join('') + '<td>' + escapeHtml(r.name) + '</td></tr>';
      });
      html += '</tbody></table><div class="hint" style="margin-top:8px;">Kombinationsmodus: ' + escapeHtml(result.combineMode) + '. Live-Daten-Generatoren sind nicht lokal simulierbar; die Vorschau meldet das ausdrücklich.</div>';
      if(result.warnings.length)html+='<p class="hint">'+result.warnings.map(escapeHtml).join(' | ')+'</p>';
      out.innerHTML = html;
    }
    panel.style.display = 'block';
  });

  // ---------------- 6) KOLLABIERBARE SEKTIONEN ----------------
  function makeFieldsetsCollapsible() {
    document.querySelectorAll('.form-pane fieldset').forEach(function (fs,index) {
      var legend=fs.querySelector('legend'); if(!legend||legend.classList.contains('fs-legend'))return;
      legend.classList.add('fs-legend'); legend.tabIndex=0; legend.setAttribute('role','button'); legend.setAttribute('aria-expanded','true');
      var icon=document.createElement('span');icon.className='fs-toggle-icon';icon.setAttribute('aria-hidden','true');icon.textContent='▾';legend.insertBefore(icon,legend.firstChild);
      var body=document.createElement('div');body.className='fs-body';body.id='fieldset-body-'+index;legend.setAttribute('aria-controls',body.id);
      var node=legend.nextSibling;while(node){var next=node.nextSibling;body.appendChild(node);node=next;}fs.appendChild(body);
      function toggle(){fs.classList.toggle('fs-collapsed');legend.setAttribute('aria-expanded',String(!fs.classList.contains('fs-collapsed')));}
      legend.addEventListener('click',toggle);legend.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
    });
  }

  // ---------------- 7) TOOLTIPS MIT ERKLAERUNGEN ----------------
  var TOOLTIP_TEXT = {
    "appName": "metadata.name der Application. Innerhalb des Argo-CD-Namespace eindeutig; nicht der Helm-Release-Name.",
    "appNamespace": "metadata.namespace der Application, üblicherweise argocd. Der Ziel-Namespace wird unter Destination eingetragen.",
    "project": "AppProject für diese Application: begrenzt erlaubte Quellen, Ziele und Ressourcen. Das Projekt muss in Argo CD existieren.",
    "labels": "Kubernetes-Labels als key=value, eine Zeile pro Eintrag.",
    "annotations": "Kubernetes-Annotationen als key=value, eine Zeile pro Eintrag.",
    "finalizersText": "Setzt z.B. den ArgoCD-Resource-Finalizer; bei kaskadierendem Loeschen werden verwaltete Ressourcen mitgeloescht.",
    "destMode": "Ziel-Cluster ueber Server-URL oder registrierten Cluster-Namen ansprechen.",
    "destValue": "Server-URL (z.B. https://kubernetes.default.svc) oder Cluster-Name je nach gewaehltem Modus.",
    "destNamespace": "Ziel-Namespace, in den die Ressourcen deployt werden.",
    "syncAutomated": "Aktiviert automatische Synchronisation statt manueller Freigabe.",
    "syncPrune": "Automatisches Pruning: entfernt verwaltete Ressourcen, die nicht mehr im gewünschten Manifest enthalten sind. Vor Aktivierung Löschfolgen prüfen.",
    "syncSelfHeal": "Automatische Korrektur von Abweichungen zwischen gewünschtem Zustand und Cluster. Manuelle Änderungen können überschrieben werden.",
    "syncAllowEmpty": "Erlaubt bei automatischem Sync auch einen leeren gewünschten Ressourcensatz. Zusammen mit Prune kann das alle verwalteten Ressourcen entfernen.",
    "optCreateNs": "Legt den Ziel-Namespace automatisch an, falls er fehlt.",
    "optServerSideApply": "Nutzt Server-Side Apply statt klassischem kubectl apply.",
    "optPruneLast": "Fuehrt das Pruning nach dem restlichen Sync statt davor aus.",
    "optReplace": "Replace=true verwendet replace/create statt apply. Kann Ressourcen neu erstellen und Ausfälle verursachen; hat Vorrang vor ServerSideApply.",
    "enableRetry": "Aktiviert automatische Wiederholungsversuche bei fehlgeschlagenem Sync.",
    "enableSyncWindows": "Aktiviert Sync-Fenster im AppProject unter spec.syncWindows, nicht in der Application. Regeln können automatische und manuelle Syncs begrenzen.",
    "asName": "Name des ApplicationSets; erzeugt daraus mehrere Applications.",
    "asCombineMode": "Additiv: unabhängige Generatoren. Matrix: Kreuzprodukt von genau zwei Generatoren. Merge: erster Generator als Basis, passende Datensätze werden über mergeKeys überschrieben.",
    "asMergeKeys": "Merge-Schlüssel, eine Zeile je Parameter, z. B. cluster. Die Parameter müssen in Basis- und Override-Datensätzen vorhanden sein. Nicht passende Overrides werden nicht ergänzt.",
    "asGoTemplate": "Aktiviert Go-Template-Syntax ({{.param}}) statt der einfachen Platzhalter.",
    "asTplName": "metadata.name der erzeugten Applications. Bei Go-Templates z. B. {{.name}} oder {{.cluster}}-app. Verwendete Parameter müssen vom Generator geliefert werden.",
    "prjName": "Name des AppProject; wird in Applications als spec.project referenziert.",
    "prjSourceRepos": "Zulaessige Git/Helm/OCI-Repository-URLs fuer dieses Projekt (eine pro Zeile, \"*\" = alle).",
    "prjClusterMode": "Whitelist erlaubt nur gelistete Cluster-Ressourcen, Blacklist verbietet sie.",
    "prjNsMode": "Whitelist erlaubt nur gelistete Namespace-Ressourcen, Blacklist verbietet sie.",
    "regKind": "Repository = konkrete URL; repo-creds = Credential-Vorlage fuer passende URL-Praefixe.",
    "regType": "Git-Repository, klassisches Helm-Repository oder Helm-Repository via OCI-Registry.",
    "regAuthMethod": "Authentifizierungsart fuer den Repository-Zugriff.",
    "regEncoding": "stringData = Klartext im Manifest, data = Base64 (keine Verschluesselung!).",
    "regEsoApiVersion": "Muss zur im Cluster installierten External-Secrets-Operator-CRD-Version passen.",
    "securityModeToggle": "Maskiert erkannte sensible Werte in YAML-Vorschau, YAML-Kopie und YAML-Download. Formularfelder und einzelne Feldkopien bleiben unverändert; keine Verschlüsselung oder vollständige Geheimniserkennung.",
    "asNamespace": "Namespace, in dem das ApplicationSet-Objekt selbst liegt (meist 'argocd').",
    "asLabels": "Labels des ApplicationSet-Objekts selbst (metadata.labels), nicht der erzeugten Applications.",
    "asAnnotations": "Annotationen des ApplicationSet-Objekts selbst (metadata.annotations), nicht der erzeugten Applications.",
    "asFinalizers": "Finalizer des ApplicationSet-Objekts. Nur bewusst setzen, wenn ein Controller ihn unterstützt und wieder entfernt; sonst kann das Löschen blockieren.",
    "asGoTemplateOptsEnable": "Setzt zusaetzliche Go-Template-Optionen wie das Verhalten bei fehlenden Schluesseln.",
    "asGoTemplateMissingKey": "error bricht bei fehlendem Template-Parameter ab, invalid/default liefern Platzhalter statt Fehler.",
    "asPostSelectorEnable": "Aktiviert einen LabelSelector auf die Parameter-Ausgabe der obersten Generatoren, auch Matrix/Merge. Filtert nicht die Labels bereits erzeugter Application-Objekte.",
    "asPostSelectorName": "Veraltetes, ausgeblendetes Feld; für die aktuelle Filterung das YAML-Feld Generator-Selector verwenden.",
    "asPostSelectorNamespace": "Veraltetes, ausgeblendetes Feld; kein Namespace-Filter für Application-Objekte.",
    "asPostSelectorAction": "Veraltetes, ausgeblendetes Feld. Die aktuelle Filterung verwendet das YAML-Feld Generator-Selector.",
    "asPreserveOnDelete": "preserveResourcesOnDeletion verhindert das automatische Setzen des Resource-Finalizers auf erzeugten Applications. Es schützt nicht vor normalem Pruning; bestehende Finalizer separat prüfen.",
    "asPolicy": "spec.syncPolicy.applicationsSync steuert Erstellen, Aktualisieren und Löschen der Application-Objekte durch den ApplicationSet-Controller. Nicht mit dem Sync ihrer Workloads verwechseln; Controller-Einstellungen beachten.",
    "asTplProject": "AppProject, dem die generierten Applications zugeordnet werden.",
    "asTplDestMode": "Ziel-Cluster der generierten Applications ueber Server-URL oder Cluster-Namen ansprechen.",
    "asTplDestNamespace": "Ziel-Namespace der generierten Applications; oft ein Template-Platzhalter wie {{.namespace}}.",
    "asTplSyncAutomated": "Aktiviert automatische Synchronisation fuer die generierten Applications.",
    "asTplPrune": "Entfernt bei den generierten Applications nicht mehr vorhandene Ressourcen automatisch.",
    "asTplSelfHeal": "Gleicht bei den generierten Applications manuelle Cluster-Abweichungen automatisch an.",
    "asTplCreateNs": "Legt den Ziel-Namespace der generierten Applications automatisch an, falls er fehlt.",
    "asTplIgnoreDiff": "Ein JSON Pointer pro Zeile, z. B. /spec/replicas. Dieses vereinfachte Template-Feld gilt für apps/Deployment; andere Regeln über den Rohmanifest-Editor konfigurieren.",
    "asTplLabels": "Labels, die auf die aus dem Template generierten Applications angewendet werden (nicht auf das ApplicationSet selbst).",
    "asTplAnnotations": "Annotationen, die auf die aus dem Template generierten Applications angewendet werden (nicht auf das ApplicationSet selbst).",
    "optValidate": "Deaktiviert clientseitige Schema-Validierung beim Apply, falls ausgeschaltet (Validate=false).",
    "optApplyOutOfSyncOnly": "Wendet Sync-Operationen nur auf tatsaechlich abweichende Ressourcen an, nicht auf den gesamten Satz.",
    "optRespectIgnoreDiff": "Beruecksichtigt ignoreDifferences bereits waehrend der Sync-Berechnung, nicht nur in der Diff-Anzeige.",
    "optFailOnSharedResource": "Bricht den Sync ab, wenn eine Ressource bereits von einer anderen Application verwaltet wird.",
    "optPruneForeground": "Loescht Ressourcen mit Foreground-Policy: Owner bleibt bestehen, bis alle abhaengigen Objekte entfernt sind.",
    "optPruneBackground": "Loescht Ressourcen mit Background-Policy: Owner wird sofort entfernt, Abhaengige asynchron im Hintergrund.",
    "optPruneOrphan": "PrunePropagationPolicy=orphan entfernt das Owner-Objekt ohne kaskadierendes Löschen seiner abhängigen Objekte.",
    "optSkipSchemaValidation": "Legacy-Option SkipSchemaValidation=true: im Builder deaktiviert. Für Apply-Validierung Validate=false, für Helm-Values das separate Helm skipSchemaValidation verwenden.",
    "optDryRunOnPreview": "Legacy-Option DryRunOnPreview=true: im Builder deaktiviert; erzeugt hier keinen Cluster-Dry-Run. Für einen echten Test separat kubectl apply --dry-run=server verwenden.",
    "retryLimit": "Anzahl Wiederholungsversuche. 0 bedeutet keine Wiederholungen; -1 bedeutet unbegrenzt. Der Builder erhält diese Werte.",
    "retryDuration": "Wartezeit vor dem ersten Wiederholungsversuch, z.B. '5s'.",
    "retryFactor": "Multiplikator, um den die Wartezeit zwischen den Wiederholungsversuchen exponentiell waechst.",
    "retryMaxDuration": "Obergrenze der Wartezeit zwischen Wiederholungsversuchen, z.B. '3m'.",
    "prjNamespace": "Namespace, in dem das AppProject-Objekt liegt (meist 'argocd').",
    "prjDescription": "Freitext-Beschreibung des Projekts, nur zur Dokumentation ohne Funktionswirkung.",
    "prjOrphanEnable": "Warnt im Argo-CD-UI, wenn im Zielnamespace Ressourcen existieren, die zu keiner Application gehoeren.",
    "prjOrphanWarn": "Zeigt die Warnung fuer verwaiste Ressourcen aktiv an (warn: true), statt sie nur stillzulegen.",
    "regSecretName": "Name des erzeugten Kubernetes-Secret-Objekts (metadata.name).",
    "regNamespace": "Namespace, in dem das Repository-Secret abgelegt wird (meist 'argocd').",
    "regUrl": "Repository- bzw. Registry-URL. Bei OCI ohne URL-Schema (kein https://) angeben.",
    "regName": "Repository-Anzeigename. Bei Helm/OCI setzt der Builder ohne Eingabe den Secret-Namen ein; kein Name des Ziel-Namespaces.",
    "regInsecure": "Deaktiviert die Prüfung des Server-Zertifikats für die Repository-Verbindung. Nur bewusst für Testumgebungen verwenden; schützt nicht vor Man-in-the-Middle-Angriffen.",
    "regCredSource": "Zugangsdaten direkt eintragen oder aus einem External-Secrets-Operator-Backend beziehen.",
    "regUsername": "Benutzername bzw. Robot-Account fuer die Registry-/Repository-Authentifizierung.",
    "regPassword": "Repository-Passwort oder Access Token. Dieses Feld wird in neuen Repository-Presets nicht gespeichert. Ohne Sicherheitsmodus steht der Wert im Secret-Export.",
    "regSshKey": "Privater SSH-Schlüssel für Git. Wird in neuen Repository-Presets nicht gespeichert; ohne Sicherheitsmodus im Secret-Export enthalten.",
    "regTlsCert": "Öffentliches TLS-Client-Zertifikat im PEM-Format. Kann weiterhin in Presets enthalten sein; der zugehörige private Schlüssel gehört in das separate Feld.",
    "regTlsKey": "Privater Schlüssel zum TLS-Client-Zertifikat. Wird in neuen Repository-Presets nicht gespeichert; exportierte Secrets schützen.",
    "regProjectEnabled": "Beschraenkt dieses Repository auf ein bestimmtes AppProject, statt global verfuegbar zu sein.",
    "regProject": "Name des AppProject, dem dieses Repository exklusiv zugeordnet wird.",
    "regProjectFromVault": "Bezieht den project-Wert aus dem External-Secrets-Operator-Backend statt aus Klartext.",
    "regProjectVaultKey": "Pfad des Secrets im Vault/Backend, aus dem der project-Wert gelesen wird.",
    "regProjectVaultProp": "Property-Name innerhalb des Vault-Secrets fuer den project-Wert.",
    "regNameFromVault": "Bezieht den Anzeigenamen aus dem External-Secrets-Operator-Backend statt aus Klartext.",
    "regNameVaultKey": "Pfad des Secrets im Vault/Backend, aus dem der Anzeigename gelesen wird.",
    "regNameVaultProp": "Property-Name innerhalb des Vault-Secrets fuer den Anzeigenamen.",
    "regUrlFromVault": "Bezieht die Repository-URL aus dem External-Secrets-Operator-Backend statt aus Klartext.",
    "regUrlVaultKey": "Pfad des Secrets im Vault/Backend, aus dem die URL gelesen wird.",
    "regUrlVaultProp": "Property-Name innerhalb des Vault-Secrets fuer die URL.",
    "regEsoCreationPolicy": "Owner: Ziel-Secret mit OwnerReference. Orphan: ohne OwnerReference. Merge: vorhandenes Secret ergänzen, nicht anlegen. None: weder anlegen noch aktualisieren. Passende Operator-Version und Lifecycle prüfen.",
    "regEsoStoreKind": "ClusterSecretStore gilt clusterweit, SecretStore ist an einen Namespace gebunden.",
    "regEsoStoreName": "Name des im Cluster registrierten SecretStore/ClusterSecretStore.",
    "regEsoRefreshInterval": "Intervall, in dem der External Secrets Operator die Werte aus dem Backend neu abruft, z.B. '1h'.",
    "regEsoSeparatePaths": "Nutzt fuer Benutzername und Passwort getrennte Remote-Pfade statt eines gemeinsamen Secrets mit zwei Properties.",
    "regEsoRemoteKey": "Pfad des Secrets im Vault/Backend (gemeinsam fuer Benutzername und Passwort).",
    "regEsoPropUser": "Property-Name innerhalb des Vault-Secrets fuer den Benutzernamen.",
    "regEsoPropPass": "Property-Name innerhalb des Vault-Secrets fuer das Passwort.",
    "regEsoRemoteKeyUser": "Eigener Vault-Pfad ausschliesslich fuer den Benutzernamen (bei getrennten Pfaden).",
    "regEsoRemoteKeyPass": "Eigener Vault-Pfad ausschliesslich fuer das Passwort (bei getrennten Pfaden).",
    "prjSignatureKeys": "GPG-Key-IDs zur Verifizierung signierter Git-Commits (Argo-CD-GnuPG-Verifizierung). Kein Bezug zu Container-Image-Signaturen/Cosign.",
    "appExtraSyncOptions": "Zusätzliche Sync-Optionen, eine KEY=VALUE-Zeile je Eintrag. Nicht automatisch in Checkboxen gemappte Optionen bleiben erhalten. Retry wird über den Retry-Block konfiguriert, nicht über Retry=true.",
    "asGeneratorSelector": "YAML-LabelSelector mit matchLabels oder matchExpressions. Wird auf die Parameter-Ausgabe jedes obersten Generators angewendet, nicht auf Application-Metadaten.",
    "asTplDestValue": "Zielserver oder registrierter Cluster-Name der erzeugten Applications. Bei Go-Template z. B. {{.server}}; der Generator muss diesen Parameter liefern.",
    "asTplAllowEmpty": "Erlaubt einen leeren Ressourcensatz bei automatischem Sync der erzeugten Applications. Zusammen mit Prune besteht Löschrisiko.",
    "asTplPruneLast": "PruneLast=true für erzeugte Applications: Pruning als letzten Schritt ausführen.",
    "asTplApplyOutOfSyncOnly": "ApplyOutOfSyncOnly=true für erzeugte Applications: nur abweichende Ressourcen anwenden.",
    "asTplServerSideApply": "ServerSideApply=true für erzeugte Applications: serverseitiges Apply verwenden; Field-Ownership und Migration beachten.",
    "asTplReplace": "Replace=true für erzeugte Applications: replace/create statt apply; kann Ressourcen neu erstellen und Ausfälle verursachen.",
    "asTplSkipDryRun": "SkipDryRunOnMissingResource=true überspringt den Dry-Run für noch nicht bekannte Ressourcentypen. Kein allgemeines Abschalten aller Dry-Runs.",
    "asTplValidate": "Eingeschaltet: Standard-Validierung beim Apply. Ausgeschaltet: exportiert Validate=false. Kein Ersatz für CRD-Prüfung am Cluster.",
    "asTplRespectIgnoreDiff": "RespectIgnoreDifferences=true berücksichtigt Ignore-Differences auch beim Synchronisieren vorhandener Ressourcen.",
    "asTplFailOnSharedResource": "FailOnSharedResource=true bricht ab, wenn eine Ressource bereits einer anderen Application zugeordnet ist.",
    "asTplPrunePropagation": "Löschstrategie beim Pruning: foreground wartet auf abhängige Objekte, background löscht sie asynchron, orphan lässt sie bestehen.",
    "asTplExtraSyncOptions": "Zusätzliche KEY=VALUE-Sync-Optionen für die erzeugten Applications, eine pro Zeile. Installierte Argo-CD-Version und widersprüchliche Optionen prüfen.",
    "asTplRetryEnable": "Aktiviert spec.template.spec.syncPolicy.retry für die erzeugten Applications, nicht für den ApplicationSet-Controller.",
    "asTplRetryLimit": "Anzahl Wiederholungsversuche. 0 bedeutet keine Wiederholungen; -1 bedeutet unbegrenzt. Endlose Retries bewusst verwenden.",
    "asTplRetryDuration": "Initiale Backoff-Dauer, z. B. 5s. Das ist die Wartezeit zwischen Sync-Versuchen, keine maximale Sync-Laufzeit.",
    "asTplRetryFactor": "Ganzzahliger Multiplikator des Backoffs, z. B. 2. Steuert die Zunahme der Wartezeiten.",
    "asTplRetryMaxDuration": "Maximaler Backoff zwischen Versuchen, z. B. 3m. Keine Gesamtlaufzeitbegrenzung der Retry-Strategie.",
    "regLabels": "Zusätzliche Labels als key=value, eine pro Zeile. Bei ESO auch auf dem Ziel-Secret. Das Argo-CD-Pflichtlabel wird automatisch gesetzt.",
    "regAnnotations": "Annotationen als key=value, eine pro Zeile. Bei ESO zusätzlich im Ziel-Secret-Template. Sensible Inhalte können in Presets verbleiben.",
    "regSecretType": "Kubernetes-Secret-Typ, unabhängig vom Repository-Typ git/helm. Opaque ist der Standard; andere Typen können zusätzliche Pflichtfelder benötigen.",
    "regSecretTypeCustom": "Eigener Kubernetes-Secret-Typ. Der Builder ergänzt keine typspezifischen Pflichtdaten; am Cluster prüfen.",
    "prjRolesFilter": "Filtert Rollen-Karten anhand Beschriftungen und Feldwerten. Blendet nur Karten aus; verändert weder Regeln noch Export.",
    "sourcesFilter": "Filtert Source-Karten nach Beschriftungen und aktuellen Feldwerten. Ausgeblendete Karten bleiben Bestandteil des YAML-Exports.",
    "generatorsFilter": "Filtert Generator-Karten nach Beschriftungen und Feldwerten. Ändert weder Generatoren noch deren Export.",
    "yamlImportText": "Genau ein YAML-Dokument: Application, ApplicationSet, AppProject, Secret oder ExternalSecret. YAML 1.2 inkl. Flow-Style und begrenzten nicht zyklischen Aliasen; nach jeder Textänderung erneut parsen.",
    "yamlImportFilePicker": "Lokale YAML-Datei auswählen. Der Inhalt wird im Browser gelesen; es gibt keinen Upload an einen Server.",
    "importPresetsFile": "Lokale Preset-JSON-Datei auswählen. Vor dem Übernehmen werden neue Einträge und Konflikte angezeigt; sensible Inhalte vorher prüfen.",
    "base64PlainText": "Klartext für das lokale Base64-Werkzeug. UTF-8-Zeichen werden unterstützt. Base64 verschlüsselt keine Daten.",
    "base64EncodedText": "Base64-Text zum Dekodieren oder Kopieren. Nicht als verschlüsseltes Secret behandeln.",
    "gitProvider": "API-Anbieter für den Commit: GitHub, GitLab oder Gitea. Der Builder nutzt HTTPS-APIs, keinen lokalen Git-Client.",
    "gitApiBase": "Vertrauenswürdige HTTPS-API-Adresse. An diesen Host wird der Access Token gesendet. GitHub: https://api.github.com; GitLab/Gitea können selbst betrieben sein.",
    "gitRepository": "GitHub/Gitea: owner/repo. GitLab: gruppe/untergruppe/projekt. Kein vollständiger Git-URL und keine Zugangsdaten.",
    "gitBranch": "Bereits vorhandener Zielbranch, z. B. main oder feature/gitops. Der Builder erstellt hier keinen neuen Branch; Branch-Schutz beachten.",
    "gitPath": "Relativer Dateipfad im Repository, z. B. argocd/meine-app.yaml. Nur .yaml/.yml; keine absoluten Pfade oder ../-Segmente.",
    "gitMessage": "Einzeilige Commit-Nachricht. Zusammen mit Zielrepository, Branch und Dateipfad vor dem Schreiben bestätigen.",
    "gitToken": "Access Token mit ausreichenden Schreibrechten. Wird an die konfigurierte HTTPS-API gesendet, nicht in Presets/LocalStorage gespeichert. Beim Schließen bzw. erfolgreichen Commit wird das Feld geleert.",
    "gitOverwrite": "Erlaubt das Überschreiben einer vorhandenen Datei nach Prüfung und Bestätigung. Nicht aktivieren, wenn nur neue Dateien angelegt werden sollen.",
    "presetSelect_application": "Gespeichertes Preset dieses Reiters laden. Überschreibt die aktuelle Formular-Konfiguration; gespeicherte Einträge bleiben bis zum expliziten Löschen erhalten.",
    "rawEnabled_application": "Aktiviert das vollständige Rohmanifest als alleinige Exportquelle dieses Reiters. Formularänderungen wirken erst nach Deaktivierung des Rohmodus; der Rohtext wird dabei nicht automatisch in das Formular zurückübertragen.",
    "rawManifest_application": "Vollständiges YAML-Manifest dieses Reiters. Nur bei aktivem Rohmodus maßgeblich. Beim Import können unbekannte Felder hier erhalten bleiben; status und einige serververwaltete Metadaten werden entfernt.",
    "presetSelect_applicationset": "Gespeichertes Preset dieses Reiters laden. Überschreibt die aktuelle Formular-Konfiguration; gespeicherte Einträge bleiben bis zum expliziten Löschen erhalten.",
    "rawEnabled_applicationset": "Aktiviert das vollständige Rohmanifest als alleinige Exportquelle dieses Reiters. Formularänderungen wirken erst nach Deaktivierung des Rohmodus; der Rohtext wird dabei nicht automatisch in das Formular zurückübertragen.",
    "rawManifest_applicationset": "Vollständiges YAML-Manifest dieses Reiters. Nur bei aktivem Rohmodus maßgeblich. Beim Import können unbekannte Felder hier erhalten bleiben; status und einige serververwaltete Metadaten werden entfernt.",
    "presetSelect_project": "Gespeichertes Preset dieses Reiters laden. Überschreibt die aktuelle Formular-Konfiguration; gespeicherte Einträge bleiben bis zum expliziten Löschen erhalten.",
    "rawEnabled_project": "Aktiviert das vollständige Rohmanifest als alleinige Exportquelle dieses Reiters. Formularänderungen wirken erst nach Deaktivierung des Rohmodus; der Rohtext wird dabei nicht automatisch in das Formular zurückübertragen.",
    "rawManifest_project": "Vollständiges YAML-Manifest dieses Reiters. Nur bei aktivem Rohmodus maßgeblich. Beim Import können unbekannte Felder hier erhalten bleiben; status und einige serververwaltete Metadaten werden entfernt.",
    "presetSelect_registry": "Gespeichertes Preset dieses Reiters laden. Überschreibt die aktuelle Formular-Konfiguration; gespeicherte Einträge bleiben bis zum expliziten Löschen erhalten.",
    "rawEnabled_registry": "Aktiviert das vollständige Rohmanifest als alleinige Exportquelle dieses Reiters. Formularänderungen wirken erst nach Deaktivierung des Rohmodus; der Rohtext wird dabei nicht automatisch in das Formular zurückübertragen.",
    "rawManifest_registry": "Vollständiges YAML-Manifest dieses Reiters. Nur bei aktivem Rohmodus maßgeblich. Beim Import können unbekannte Felder hier erhalten bleiben; status und einige serververwaltete Metadaten werden entfernt."
};
  Object.assign(TOOLTIP_TEXT, {
    "regCredSource": "Wahlweise direkte Eingabe oder Vault über External Secrets (ESO) – für Benutzer/Passwort, SSH und TLS. Der Browser fragt Vault nicht ab; ESO erstellt das Ziel-Secret im Cluster.",
    "regAuthMethod": "Repository-Authentifizierung: keine, Benutzer/Passwort, SSH (nur Git) oder TLS-Client-Zertifikat. Zugangsdaten können für die letzten drei Methoden direkt oder über ESO bezogen werden.",
    "regEsoSshRemoteKey": "Remote-Key für den privaten SSH-Schlüssel. Pfad passend zum Vault-KV-Mount des SecretStore wählen, z. B. git/ssh. Keine Schlüsselbytes hier eintragen.",
    "regEsoSshProp": "Property mit dem mehrzeiligen PEM-/OpenSSH-Privatschlüssel, standardmäßig sshPrivateKey. Als Text in Vault speichern, nicht zusätzlich Base64-kodieren. Leer lässt property im remoteRef weg.",
    "regEsoTlsRemoteKey": "Gemeinsamer Remote-Key für TLS-Zertifikat und privaten Schlüssel. Getrennte Properties im selben Vault-KV-Secret; z. B. git/tls.",
    "regEsoTlsPropCert": "Property mit dem PEM-Client-Zertifikat, standardmäßig tlsClientCertData. Keine Base64-Konvertierung im Template; Wert muss als PEM-Text vorliegen.",
    "regEsoTlsPropKey": "Property mit dem PEM-Privatschlüssel, standardmäßig tlsClientCertKey. Muss zum Zertifikat passen; nicht direkt in dieses Referenzfeld eintragen.",
    "regEsoTlsSeparatePaths": "Liest TLS-Client-Zertifikat und privaten Schlüssel aus unterschiedlichen Remote-Keys. Properties sind weiterhin separat konfigurierbar.",
    "regEsoTlsRemoteKeyCert": "Eigener Remote-Key für das TLS-Client-Zertifikat bei getrennten Pfaden. Property im Zertifikat-Property-Feld wählen.",
    "regEsoTlsRemoteKeyKey": "Eigener Remote-Key für den TLS-Privatschlüssel bei getrennten Pfaden. Property im Schlüssel-Property-Feld wählen.",
    "regEncoding": "Direkte Secrets: stringData (Text) oder data (Base64, keine Verschlüsselung). Bei ESO deaktiviert: template.data verwendet Text/Platzhalter; ESO erstellt das Ziel-Secret.",
    "regEsoSeparatePaths": "Benutzername und Passwort aus unterschiedlichen Remote-Keys lesen. Die Property-Felder bleiben auch bei getrennten Pfaden sichtbar.",
    "regUrlVaultKey": "Remote-Key für URL. Ohne Eingabe wird der primäre Auth-Remote-Key genutzt: Username-Pfad, SSH-Pfad oder TLS-Zertifikat-Pfad.",
    "regNameVaultKey": "Remote-Key für Anzeigename. Ohne Eingabe wird der primäre Auth-Remote-Key genutzt: Username-Pfad, SSH-Pfad oder TLS-Zertifikat-Pfad.",
    "regProjectVaultKey": "Remote-Key für AppProject. Ohne Eingabe wird der primäre Auth-Remote-Key genutzt: Username-Pfad, SSH-Pfad oder TLS-Zertifikat-Pfad."
});

  var DYNAMIC_TOOLTIP_TEXT = {
    "src-repoUrl": "repoURL dieser Source. Git/Helm: Repository-Adresse; Helm-OCI: Registry-Pfad entsprechend deiner Argo-CD-Konfiguration. Keine Zugangsdaten in der URL einbetten.",
    "src-targetRevision": "Git-Branch, Tag oder Commit; bei Helm die Chart-Version. Bei einer Referenz-Quelle gilt die Revision des Values-Repositories.",
    "src-path": "Verzeichnis innerhalb eines Git-Repositories. Bei einem Helm-Repository-Chart wird chart statt path ausgegeben; Nur-Referenz-Quellen exportieren hier keinen path.",
    "src-ref": "Referenzname für Multi-Source-Values, z. B. values. Helm-Dateien referenzieren diese Quelle als $values/pfad/values.yaml. Referenznamen eindeutig halten.",
    "src-type": "Wählt Source-Rendering und sichtbare Optionen: Plain, Directory, Helm, Kustomize, Nur Referenz oder Plugin. Weitere Source-Felder können den Export übersteuern.",
    "src-chart": "Chart-Name im Helm-/OCI-Repository. Bei einem Helm-Chart aus Git den Chart-Namen leer lassen und den Git-Pfad verwenden.",
    "src-releaseName": "Helm-Release-Name beim Rendern. Ein abweichender Name kann Chart-Selektoren und Argo-CD-Tracking beeinflussen; Chart prüfen.",
    "src-valueFiles": "Eine Values-Datei je Zeile. Relativ zum Chart bzw. Git-Pfad; externe Git-Values beginnen mit $ref/. Die referenzierte Source muss vorhanden sein.",
    "src-helmValues": "Inline-Helm-Values als YAML-Text; wird unter helm.values geschrieben. valuesObject und Parameter können diese Values übersteuern.",
    "src-helmValuesObjects": "YAML-Mapping für helm.valuesObject. Verschachtelte Objekte, Listen, Zahlen und boolesche Werte sind erlaubt; keine vollständige Application hier einfügen.",
    "src-helmParams": "Helm-Parameter, je eine name=value-Zeile, z. B. image.tag=1.4.2. Export als parameters[]. Für forceString Weitere Source-Felder verwenden.",
    "src-helmFileParams": "Je eine name=path-Zeile; setzt einen Helm-Parameter aus dem Inhalt der angegebenen Datei (fileParameters). Datei muss in der Quelle verfügbar sein.",
    "src-helm-skipCrds": "helm.skipCrds=true überspringt von Helm mitgelieferte CRDs beim Rendern. Bereits vorhandene CRDs separat verwalten.",
    "src-helm-ignoreMissingValueFiles": "Ignoriert fehlende valueFiles statt den Render-Vorgang abzubrechen. Nur bewusst verwenden, damit fehlende Konfiguration nicht unbemerkt bleibt.",
    "src-helm-passCredentials": "Gibt Helm-Repository-Zugangsdaten auch für weitere angefragte Domains weiter. Erhöht das Risiko einer Weitergabe von Credentials.",
    "src-helm-releaseNamespace": "Deaktiviertes Legacy-Feld: releaseNamespace ist kein unterstütztes Application-Helm-Feld und wird nicht exportiert. Destination bzw. Helm namespace verwenden.",
    "src-helm-skipSchemaValidation": "helm.skipSchemaValidation=true überspringt die Validierung der Helm-Values gegen values.schema.json. Unabhängig von Validate=false beim Kubernetes-Apply.",
    "src-helm-namespace": "Namespace für das Helm-Rendering, insbesondere .Release.Namespace. Nicht mit metadata.namespace der Application verwechseln.",
    "src-helm-kubeVersion": "Kubernetes-Version für Helm-Capabilities beim Rendern, z. B. 1.30.0. Ändert nicht die tatsächliche Cluster-Version.",
    "src-helm-apiVersions": "Zusätzliche API-Versionen für Helm-Capabilities, eine je Zeile, z. B. policy/v1. Installiert keine CRDs oder APIs.",
    "src-kustomizeImages": "Image-Overrides, eine je Zeile, z. B. myapp=registry.example.org/team/myapp:1.4.2. Name muss zur Kustomize-Konfiguration passen.",
    "src-kustomizeNamespace": "Kustomize-Namespace-Override beim Rendern. Destination ist weiterhin separat zu konfigurieren.",
    "src-kustomizeVersion": "Kustomize-Version, die in der Argo-CD-Instanz verfügbar und konfiguriert sein muss. Das Feld installiert keine Version.",
    "src-kustomizeNamePrefix": "Präfix für Kustomize-Ressourcennamen, z. B. prod-. Auswirkungen auf Referenzen und bestehende Ressourcen prüfen.",
    "src-kustomizeNameSuffix": "Suffix für Kustomize-Ressourcennamen, z. B. -blue. Kann zu neuen Ressourcen statt Updates führen.",
    "src-kustomizeCommonLabels": "Gemeinsame Kustomize-Labels als key=value, je Zeile ein Eintrag. Chart-/Workload-Selektoren beachten.",
    "src-kustomizeCommonAnnotations": "Gemeinsame Kustomize-Annotationen als key=value, eine pro Zeile.",
    "src-kustomizeReplicas": "name=count je Zeile, z. B. myapp=0. Nicht-negative ganze Zahlen; 0 wird erhalten. Export unter kustomize.replicas[].",
    "src-kustomizePatches": "YAML-Liste von Patch-Objekten, z. B. - target: ... mit patch: |-. Nicht nur einzelne JSON-Patch-Operationen ohne Target-Liste einfügen.",
    "src-kustomizePatchesJson6902": "Legacy-Feld. Inhalt in die moderne YAML-Liste kustomize.patches übertragen; eine nicht leere Eingabe blockiert die Generierung.",
    "src-kustomizePatchesStrategicMerge": "Legacy-Feld. Strategischen Patch als patches-Listenobjekt mit patch: |- eintragen; eine nicht leere Eingabe blockiert die Generierung.",
    "src-pluginName": "Name eines in Argo CD eingerichteten Config Management Plugins. Das Formular installiert oder konfiguriert das Plugin nicht.",
    "src-pluginEnv": "Plugin-Umgebungsvariablen als name=value, eine je Zeile. Argo-CD-Version und ENV-Präfixierung beachten; sensible Werte nicht als Klartext hinterlegen.",
    "src-pluginParams": "Einfache Plugin-Stringparameter als name=value. Arrays/Maps über Weitere Source-Felder mit parameters[].array/map konfigurieren.",
    "src-pluginConfigMapRef": "Legacy-Feld, kein gültiges Application-Plugin-Feld. Eine nicht leere Eingabe blockiert den Export; Plugin-Konfiguration separat in Argo CD verwalten.",
    "src-recurse": "Directory-Quelle rekursiv nach Manifesten durchsuchen. Nur für den ausgewählten Directory-Typ relevant.",
    "src-directoryInclude": "Include-Glob je Zeile. Mehrere Einträge werden als {muster1,muster2} zusammengefasst. Begrenzt eingelesene Dateien, nicht Kubernetes-Ressourcenarten.",
    "src-directoryExclude": "Exclude-Glob je Zeile; passende Dateien vom Directory-Rendering ausschließen. Mehrere Einträge werden als Glob-Gruppe ausgegeben.",
    "src-extraFields": "YAML-Mapping zusätzlicher Source-Felder. Wird rekursiv über die Formularwerte gelegt; Arrays werden ersetzt. Hier eingetragene Werte haben beim Export Vorrang.",
    "gen-type": "Generator-Typ für die ApplicationSet-Parameter. Jeder Typ liefert andere Variablen; Template daran anpassen.",
    "gen-list-elements": "Ein Parametersatz je Zeile, key=value-Paare kommagetrennt; alternativ eine YAML-Liste. Werte mit Komma im YAML-Format eintragen.",
    "gen-clusters-labels": "matchLabels für registrierte Cluster-Secrets als key=value, eine Zeile pro Label. Keine Labels von Workloads.",
    "gen-clusters-values-enable": "Aktiviert zusätzliche values-Parameter des Clusters-Generators. Im Template unter values verfügbar.",
    "gen-clusters-values": "Zusätzliche Cluster-Parameter als key=Template, eine Zeile pro Eintrag. Bei Go-Templates passende {{.metadata...}}-Syntax verwenden.",
    "gen-git-repoUrl": "Git-Repository, dessen Verzeichnisse oder Parameterdateien der Generator auswertet. Nicht automatisch identisch mit der Source der erzeugten Applications.",
    "gen-git-revision": "Git-Revision des Generators, z. B. main, Tag oder Commit. Die Application-Source hat ihre eigene targetRevision.",
    "gen-git-dirs": "Verzeichnis-Globs, eine Zeile pro Pfad. Der Generator liefert daraus Pfadparameter; genaue Go-Template-Pfadstruktur prüfen.",
    "gen-git-files": "Globs für Parameterdateien, eine Zeile pro Pfad. Inhalt und Template-Variablen müssen zusammenpassen.",
    "gen-merge-priority": "Veraltetes, nicht verwendetes Feld. Merge-Overrides richten sich nach der Reihenfolge der Generatoren und mergeKeys, nicht nach dieser Zahl.",
    "gen-scm-provider": "SCM-Provider GitHub oder GitLab. Provider-spezifische Felder und API-Adresse passend wählen.",
    "gen-scm-api": "Optionale GitHub-API-Adresse, etwa für Enterprise. Der ApplicationSet-Controller benötigt Zugriff und passende Credentials.",
    "gen-scm-org": "GitHub-Organisation, deren Repositories der SCM-Generator untersucht.",
    "gen-scm-team": "Deaktiviertes Legacy-Feld. Team wird nicht als GitHub-SCM-Generator-Feld exportiert.",
    "gen-scm-tokenRef": "Secret-Referenz als secretName/key, z. B. github-token/token. Ohne /key wird token verwendet. Kein Tokenwert in dieses Feld eintragen.",
    "gen-scm-filters": "Ein repositoryMatch-Regulärausdruck je Zeile, z. B. ^payments-.*$. Kein Shell-Glob wie *.prod.*.",
    "gen-scm-gitlab-api": "GitLab-API-Basis des SCM-Generators. Zusätzliche Authentifizierungsfelder ggf. in Weitere Generator-Felder konfigurieren.",
    "gen-scm-gitlab-group": "GitLab-Gruppe für den SCM-Generator. Untergruppen und weitere Provider-Optionen ggf. über Weitere Generator-Felder ergänzen.",
    "gen-pr-provider": "Provider für Pull-Request-Parameter. Dieses Formular bietet GitHub; andere Typen über erweiterte Generator-Felder konfigurieren.",
    "gen-pr-owner": "GitHub-Owner bzw. Organisation des Pull-Request-Repositories.",
    "gen-pr-repo": "GitHub-Repository-Name ohne Owner-Präfix. Wird im Generator als github.repo ausgegeben.",
    "gen-pr-api": "Optionale GitHub-API-Adresse für Pull Requests. Authentifizierung ggf. über Weitere Generator-Felder ergänzen.",
    "gen-pr-labels": "Pull-Request-Labels, eines je Zeile. Begrenzt ausgewählte Pull Requests; nicht die Labels erzeugter Applications.",
    "gen-cdr-configmap": "ConfigMap-Name mit der Konfiguration für den ClusterDecisionResource-Generator; Export als configMapRef.",
    "gen-cdr-key": "Name der auszuwertenden Decision-Ressource; Export als name, nicht als ConfigMap-Key. Alternativ labelSelector über Weitere Generator-Felder konfigurieren.",
    "gen-extraFields": "YAML-Mapping zusätzlicher Generator-Felder. Überschreibt Formularwerte; ein neuer Generator-Typ ersetzt den bisherigen Typ. Arrays werden ersetzt.",
    "info-name": "Name eines Informationsfelds unter spec.info[]. Nur zur Darstellung in Argo CD, keine Umgebungsvariable.",
    "info-value": "Textwert des Informationsfelds. Wird in der Application gespeichert; keine vertraulichen Daten hinterlegen.",
    "idiff-group": "API-Gruppe der zu ignorierenden Ressourcen, z. B. apps. Für Core-Ressourcen leer lassen.",
    "idiff-kind": "Ressourcenart für die Ignore-Differences-Regel, z. B. Deployment. Zusammen mit group den Geltungsbereich begrenzen.",
    "idiff-name": "Optionaler Ressourcenname, um die Ignore-Differences-Regel einzuschränken.",
    "idiff-namespace": "Optionaler Ressourcen-Namespace zur Einschränkung dieser Ignore-Differences-Regel.",
    "idiff-jsonpointers": "Ein JSON Pointer je Zeile, z. B. /spec/replicas. Maskiert den Diff für diese Pfade; Sync-Behandlung separat über RespectIgnoreDifferences steuern.",
    "idiff-jqpath": "Eine JQ-Pfadexpression je Zeile. Ausgewählte Felder oder Listenelemente werden beim Diff ignoriert; komplexe Ausdrücke separat testen.",
    "idiff-managedFieldsManagers": "Ein Field-Manager je Zeile, dessen verwaltete Felder im Diff ignoriert werden. Geltungsbereich bewusst begrenzen.",
    "prjdest-mode": "Projekt-Zielregel über Server-URL oder registrierten Cluster-Namen konfigurieren. Bestimmt nur zulässige Ziele, deployt selbst keine Ressourcen.",
    "prjdest-value": "Erlaubter Server bzw. Cluster-Name. * erlaubt alle passenden Cluster; für Least Privilege konkrete Ziele verwenden.",
    "prjdest-name": "Optionaler zusätzlicher Cluster-Name bei einer Server-Regel. Die tatsächlichen Projekt-Zielregeln gegen deine Argo-CD-Version prüfen.",
    "prjdest-namespace": "Erlaubter Ziel-Namespace. * erlaubt alle passenden Namespaces; konkrete Werte bevorzugen.",
    "res-group": "API-Gruppe der Ressourcenregel. Leer steht für die Core-API (z. B. Service); * steht für alle Gruppen.",
    "res-kind": "Kind der Ressourcenregel, z. B. Deployment oder Service. * gilt für alle Arten innerhalb der angegebenen Gruppe.",
    "role-name": "Projektrollenname, z. B. deployer. Policy-Subjekt üblicherweise proj:<projekt>:<rolle>.",
    "role-description": "Beschreibung der Projektrolle; vergibt selbst keine Rechte.",
    "role-policies": "Eine RBAC-Policy je Zeile. Ohne p,-Präfix oder als vollständige p,-Zeile möglich; der Builder ergänzt es nur falls nötig. Beispiel: proj:payments:deployer, applications, sync, payments/*, allow.",
    "role-groups": "SSO-/OIDC-Gruppen dieser Projektrolle, eine je Zeile. Werte müssen den tatsächlich ausgewerteten Claims entsprechen.",
    "sw-kind": "allow lässt Syncs im Fenster zu, deny blockiert sie. Mehrere passende Fenster können sich überlagern; Regeln gemeinsam prüfen.",
    "sw-schedule": "Cron-Zeitplan mit fünf Feldern, z. B. 0 22 * * *. Startzeit des Fensters; nicht die Dauer.",
    "sw-duration": "Dauer jedes Sync-Fensters, z. B. 1h oder 30m. Zusammen mit schedule und timeZone auswerten.",
    "sw-timezone": "Zeitzone des Cron-Zeitplans, z. B. Europe/Berlin. Sommerzeit und Controller-Konfiguration berücksichtigen.",
    "sw-applications": "Application-Namensmuster, kommagetrennt, z. B. payments-*,shop-*. Selektiert betroffene Applications des Projekts.",
    "sw-namespaces": "Ziel-Namespace-Muster, kommagetrennt. Bezieht sich auf die Deployment-Ziele der Applications.",
    "sw-clusters": "Cluster-Namen oder Server-Muster, kommagetrennt. Bezieht sich auf die Destination der Applications.",
    "sw-manualSync": "Erlaubt manuelles Synchronisieren trotz blockierender Fensterregel. Nur bewusst als Ausnahme aktivieren.",
    "conflict-overwrite": "Aktiviert das Überschreiben dieses einzelnen namensgleichen Presets beim bestätigten Import. Deaktiviert bleibt der vorhandene Eintrag erhalten."
};
  var BUTTON_TOOLTIP_TEXT = {
    "base64ToolBtn": "Öffnet das lokale Base64-Werkzeug; unabhängig vom aktuellen Reiter. Base64 ist keine Verschlüsselung.",
    "yamlImportBtn": "Öffnet YAML-Import per Text oder lokaler Datei. Erst parsen und prüfen, dann nach Sichtung des Berichts übernehmen.",
    "exportPresetsBtn": "Exportiert gespeicherte Presets als JSON. Weitere Freitext-/YAML-Felder können sensible Inhalte enthalten; Datei vor Weitergabe prüfen.",
    "importPresetsBtn": "Importiert Preset-JSON nach Konfliktprüfung. Gleichnamige Einträge werden nur gemäß deiner Auswahl überschrieben.",
    "copyBtn": "Kopiert genau die YAML-Vorschau. Im Sicherheitsmodus enthält die Kopie maskierte Werte und ist kein einsatzfähiges Secret-Manifest.",
    "downloadBtn": "Lädt genau die Vorschau als YAML-Datei herunter. Rohmodus und Sicherheitsmodus bestimmen den Inhalt; sensible Dateien schützen.",
    "validateBtn": "Prüft YAML und lokale Struktur-/Plausibilitätsregeln. Kontaktiert keinen Cluster und validiert nicht gegen dessen installierte CRDs.",
    "gitPushBtn": "Öffnet den HTTPS-API-Commit. Token, Ziel, Berechtigungen und YAML prüfen; erkannte Zugangsdaten sowie Secrets werden blockiert.",
    "genPreviewBtn": "Simuliert lokale List-Parameter und additive/Matrix/Merge-Kombinationen. Keine Live-Abfrage von Cluster/Git/SCM; kein vollständiger Go-Template-Interpreter.",
    "addSyncWindowBtn": "Fügt dem AppProject eine neue Sync-Fensterregel hinzu. Schedule, Dauer und Zielmuster anschließend prüfen.",
    "presetHarborBtn": "Ersetzt Application-Sources durch ein Multi-Source-Beispiel: Git-Values mit ref und Helm-Chart. URLs, Chart-Version und Dateipfade anpassen.",
    "presetAsTplHarborBtn": "Ersetzt Template-Sources durch ein Multi-Source-Beispiel aus Git-Values und Helm-Chart. Template-Parameter und URLs prüfen.",
    "presetClusterAllowAllBtn": "Ersetzt Cluster-Ressourcenregeln durch eine breite Whitelist mit */*. Sicherheitsgrenzen werden stark erweitert; nicht ungeprüft produktiv verwenden.",
    "presetClusterBlacklistBtn": "Ersetzt Cluster-Ressourcenregeln durch eine Beispiel-Blacklist. Das ist keine vollständige Sicherheitsrichtlinie.",
    "presetNsWhitelistBtn": "Ersetzt Namespace-Ressourcenregeln durch eine Beispiel-Whitelist für übliche Workloads. Benötigte CRDs ggf. explizit ergänzen.",
    "presetNsBlacklistBtn": "Ersetzt Namespace-Ressourcenregeln durch Beispiel-Verbote. Auswirkungen auf Quotas, PDBs und weitere Schutzressourcen prüfen.",
    "presetRbacRolesBtn": "Ersetzt Rollen durch admin/dev/viewer-Beispiele. Projektname, Policy-Objekte und tatsächliche IdP-Gruppen unbedingt anpassen.",
    "yamlImportPickFileBtn": "Liest eine lokale YAML-Datei in das Import-Textfeld. Der Import verändert keine Cluster-Ressourcen.",
    "yamlImportParseBtn": "Erkennt Ressourcentyp und prüft YAML/Struktur. Nach jeder Textänderung erneut ausführen; Syntaxfehler blockieren das Übernehmen.",
    "yamlImportApplyBtn": "Übernimmt den geprüften Import. Kann zum Erhalt erweiterter Felder den Rohmanifest-Modus aktivieren; anschließend die Exportquelle prüfen.",
    "yamlImportCancelBtn": "Schließt den Importdialog ohne Übernahme. Bereits zuvor übernommene Daten werden dadurch nicht zurückgesetzt.",
    "yamlImportCloseBtn": "Schließt den Importbericht; die übernommenen Felder und gegebenenfalls der Rohmodus bleiben aktiv.",
    "presetConflictApplyBtn": "Wendet neue Presets und ausgewählte Überschreibungen an. Prüfe die Konflikt-Checkboxen vor dem Import.",
    "presetConflictCancelBtn": "Verwirft diesen Preset-Import und schließt den Vergleichsdialog.",
    "base64EncodeBtn": "Kodiert Klartext lokal als UTF-8-Base64. Der Inhalt bleibt entschlüsselungsfrei lesbar.",
    "base64DecodeBtn": "Dekodiert Base64 lokal zu Text. Ungültige Eingaben werden im Dialog gemeldet.",
    "base64CopyPlainBtn": "Kopiert das Klartextfeld; Sicherheitsmodus maskiert diesen Werkzeuginhalt nicht.",
    "base64CopyEncodedBtn": "Kopiert das Base64-Feld; Base64 schützt keine Zugangsdaten.",
    "base64ClearBtn": "Leert nur beide Base64-Werkzeugfelder; andere Reiter bleiben unverändert.",
    "base64CloseBtn": "Schließt das Base64-Werkzeug; zum Entfernen seines Inhalts vorher Beide Felder leeren verwenden.",
    "gitSubmit": "Prüft bestehenden Branch und Zieldatei, fragt vor dem Schreiben nach Bestätigung und erstellt dann einen Commit. Externe Aktion mit Netzwerkzugriff.",
    "gitClose": "Schließt den Git-Dialog und leert das Tokenfeld. Während eines laufenden API-Vorgangs ist Schließen gesperrt.",
    "modeAppBtn": "Application-Formular anzeigen. Ein Reiterwechsel setzt die anderen Reiter nicht zurück.",
    "modeAppSetBtn": "ApplicationSet-Formular mit Generatoren und Application-Template anzeigen.",
    "modeProjectBtn": "AppProject mit Repository-/Zielgrenzen, Ressourcenregeln, Rollen und Sync-Fenstern anzeigen.",
    "modeRegistryBtn": "Repository-Secret oder ExternalSecret konfigurieren. Secret-Export kann Zugangsdaten enthalten.",
    "modeGuideBtn": "Öffnet die integrierte Offline-Anleitung mit Eingabeformaten, Import-/Rohmodus und Sicherheitsgrenzen.",
    "themeToggleBtn": "Wechselt Hell/Dunkel; speichert nur die Designwahl lokal im Browser.",
    "clearAppBtn": "Setzt nur diesen Reiter einschließlich Rohmanifest-Modus auf Vorgaben zurück. Gespeicherte Presets und andere Reiter bleiben erhalten.",
    "clearAppSetBtn": "Setzt nur diesen Reiter einschließlich Rohmanifest-Modus auf Vorgaben zurück. Gespeicherte Presets und andere Reiter bleiben erhalten.",
    "clearProjectBtn": "Setzt nur diesen Reiter einschließlich Rohmanifest-Modus auf Vorgaben zurück. Gespeicherte Presets und andere Reiter bleiben erhalten.",
    "clearRegistryBtn": "Setzt nur diesen Reiter einschließlich Rohmanifest-Modus auf Vorgaben zurück. Gespeicherte Presets und andere Reiter bleiben erhalten.",
    "addInfoBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addSourceBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addAsTplSourceBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addIgnoreDiffBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addGeneratorBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addPrjDestBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addPrjClusterResBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addPrjNsResBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "addPrjRoleBtn": "Fügt eine zusätzliche Karte in diesem Abschnitt hinzu. Neue Felder ausfüllen; zusätzliche Karten lassen sich wieder entfernen.",
    "presetListGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetClusterGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetGitGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetMatrixGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetMergeGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetScmGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetPullRequestGenBtn": "Ersetzt die Generator-Konfiguration durch das gewählte Beispiel. Template-Variablen, Quellen, Ziele und gegebenenfalls Authentifizierung danach anpassen.",
    "presetHarborRegistryBtn": "Befüllt Repository-/ESO-Felder mit Beispieldaten. Ersetzt betroffene Eingaben; URL, Projekt, Store und Remote-Pfade vor Verwendung anpassen.",
    "presetHarborEsoBtn": "Befüllt Repository-/ESO-Felder mit Beispieldaten. Ersetzt betroffene Eingaben; URL, Projekt, Store und Remote-Pfade vor Verwendung anpassen.",
    "presetGitEsoStaticProjectBtn": "Befüllt Repository-/ESO-Felder mit Beispieldaten. Ersetzt betroffene Eingaben; URL, Projekt, Store und Remote-Pfade vor Verwendung anpassen.",
    "presetFinalizerDefaultBtn": "Setzt das angebotene Resource-Finalizer-Beispiel. Bei Applications können beim Löschen verwaltete Ressourcen entfernt werden; Controller-Unterstützung prüfen.",
    "presetFinalizerDefaultBtn2": "Setzt das angebotene Resource-Finalizer-Beispiel. Bei Applications können beim Löschen verwaltete Ressourcen entfernt werden; Controller-Unterstützung prüfen.",
    "presetFinalizerNoCascadeBtn": "Leert das Finalizer-Feld. Das ist keine Garantie gegen andere Löschmechanismen, Pruning oder bestehende OwnerReferences.",
    "presetFinalizerNoCascadeBtn2": "Leert das Finalizer-Feld. Das ist keine Garantie gegen andere Löschmechanismen, Pruning oder bestehende OwnerReferences.",
    "presetFinalizerCustomBtn": "Trägt ein Custom-Finalizer-Beispiel ein. Ohne passenden Controller können unbekannte Finalizer ein Löschen blockieren; Beispiel nicht ungeprüft übernehmen.",
    "presetFinalizerCustomBtn2": "Trägt ein Custom-Finalizer-Beispiel ein. Ohne passenden Controller können unbekannte Finalizer ein Löschen blockieren; Beispiel nicht ungeprüft übernehmen."
};
  var tooltipSerial = 0, tooltipPanel = null, activeTooltip = null, pinnedTooltip = false, tooltipFrame = 0;

  function tooltipText(field) {
    if (TOOLTIP_TEXT[field.id]) return TOOLTIP_TEXT[field.id];
    for (var i = 0; i < field.classList.length; i++) {
      if (DYNAMIC_TOOLTIP_TEXT[field.classList[i]]) return DYNAMIC_TOOLTIP_TEXT[field.classList[i]];
    }
    return null;
  }

  function tooltipLabel(field) {
    if (field.labels && field.labels.length) return field.labels[0];
    var box = field.closest('.checkbox-row');
    if (box) return box.querySelector('label');
    var anchor = field.closest('.copy-field-wrapper') || field;
    var previous = anchor.previousElementSibling;
    if (previous && previous.tagName === 'LABEL') return previous;
    return null;
  }

  function attachFieldTooltip(field, explanation) {
    var label = tooltipLabel(field);
    if (!field.id) field.id = 'builder-field-' + (++tooltipSerial);
    if (!label) {
      label = document.createElement('label');
      label.className = 'tooltip-field-label';
      label.textContent = field.id.indexOf('rawManifest_') === 0 ? 'Vollständiges Rohmanifest (YAML)' :
        field.classList.contains('src-extraFields') ? 'Weitere Source-Felder (YAML)' :
        field.classList.contains('gen-extraFields') ? 'Weitere Generator-Felder (YAML)' :
        field.id === 'yamlImportText' ? 'YAML zum Importieren' :
        field.id === 'sourcesFilter' || field.id === 'generatorsFilter' || field.id === 'prjRolesFilter' ? 'Karten filtern' : 'Eingabe';
      field.parentNode.insertBefore(label, field.closest('.copy-field-wrapper') || field);
    }
    label.htmlFor = field.id;
    var readableLabel=Array.from(label.childNodes).filter(function(n){return n.nodeType===3;}).map(function(n){return n.textContent;}).join(' ').trim();
    if(readableLabel&&(!field.hasAttribute('aria-label')||field.dataset.builderAutoLabel===field.getAttribute('aria-label'))){field.setAttribute('aria-label',readableLabel);field.dataset.builderAutoLabel=readableLabel;}
    var tipId = 'builder-tip-' + field.id, descriptionId = 'builder-help-' + field.id;
    var existing = document.getElementById(tipId);
    if (existing && existing.parentNode === label) return;
    if (existing) existing.remove();
    var description = document.getElementById(descriptionId);
    if (description) description.remove();
    description = document.createElement('span');
    description.id = descriptionId; description.className = 'tooltip-sr-only'; description.textContent = explanation;
    var tip = document.createElement('span');
    tip.id = tipId; tip.className = 'tip'; tip.tabIndex = 0;
    tip.setAttribute('role', 'button'); tip.setAttribute('aria-expanded', 'false');
    tip.setAttribute('aria-label', 'Hilfe zu ' + label.textContent.trim());
    tip.setAttribute('aria-describedby', descriptionId); tip.dataset.tip = explanation; tip.textContent = 'i';
    label.appendChild(tip); label.appendChild(description);
    var ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (ids.indexOf(descriptionId) === -1) ids.push(descriptionId);
    field.setAttribute('aria-describedby', ids.join(' '));
    if (!field.hasAttribute('title')) field.title = explanation;
  }

  function applyTooltips(root) {
    root = root || document;
    root.querySelectorAll('input,select,textarea').forEach(function (field) {
      if (field.type === 'file' || field.type === 'hidden') return;
      var explanation = tooltipText(field);
      if (explanation) attachFieldTooltip(field, explanation);
    });
    root.querySelectorAll('button:not(.copy-field-btn)').forEach(function (button) {
      var explanation = BUTTON_TOOLTIP_TEXT[button.id];
      if (!explanation && button.classList.contains('btn-preset-save')) explanation = 'Speichert diesen Reiter lokal als Preset. Bestimmte Repository-Geheimnisfelder werden ausgelassen; Freitext- und YAML-Felder trotzdem auf sensible Inhalte prüfen.';
      if (!explanation && button.classList.contains('btn-preset-del')) explanation = 'Löscht nach Rückfrage nur das ausgewählte gespeicherte Preset. Das aktuelle Formular wird nicht gelöscht.';
      if (!explanation && /^remove-/.test(button.className.split(' ').find(function (c) { return /^remove-/.test(c); }) || '')) explanation = 'Entfernt diese Karte aus dem Formular und dem nächsten formularbasierten Export. Bei aktivem Rohmodus bleibt der Rohtext maßgeblich.';
      if (explanation) {button.title = explanation; button.dataset.help = explanation;}
    });
  }

  function closeTooltip() {
    if (activeTooltip) activeTooltip.setAttribute('aria-expanded', 'false');
    activeTooltip = null; pinnedTooltip = false;
    if (tooltipPanel) tooltipPanel.hidden = true;
  }

  function showTooltip(tip) {
    if (!tip || !tip.isConnected) return;
    if (!tooltipPanel) {
      tooltipPanel = document.createElement('div'); tooltipPanel.id = 'builder-tooltip-popup';
      tooltipPanel.className = 'builder-tooltip-popup'; tooltipPanel.setAttribute('role', 'tooltip');
      tooltipPanel.hidden = true; document.body.appendChild(tooltipPanel);
    }
    if (activeTooltip && activeTooltip !== tip) activeTooltip.setAttribute('aria-expanded', 'false');
    activeTooltip = tip; tip.setAttribute('aria-expanded', 'true');
    tooltipPanel.textContent = tip.dataset.tip; tooltipPanel.hidden = false;
    var rect = tip.getBoundingClientRect(), margin = 10, panel = tooltipPanel.getBoundingClientRect();
    var left = Math.max(margin, Math.min(rect.left + rect.width / 2 - panel.width / 2, window.innerWidth - panel.width - margin));
    var top = rect.top - panel.height - margin;
    if (top < margin) top = rect.bottom + margin;
    top = Math.max(margin, Math.min(top, window.innerHeight - panel.height - margin));
    tooltipPanel.style.left = left + 'px'; tooltipPanel.style.top = top + 'px';
  }

  function initTooltipInteraction() {
    document.addEventListener('pointerover', function (event) {
      var tip = event.target.closest && event.target.closest('.tip[data-tip]');
      if (tip && !pinnedTooltip) showTooltip(tip);
    });
    document.addEventListener('pointerout', function (event) {
      var tip = event.target.closest && event.target.closest('.tip[data-tip]');
      if (tip && tip === activeTooltip && !pinnedTooltip && document.activeElement !== tip &&
          !(event.relatedTarget && (tip.contains(event.relatedTarget) || (tooltipPanel && tooltipPanel.contains(event.relatedTarget))))) closeTooltip();
      if (tooltipPanel && tooltipPanel.contains(event.target) && !pinnedTooltip &&
          !(event.relatedTarget && (tooltipPanel.contains(event.relatedTarget) || (activeTooltip && activeTooltip.contains(event.relatedTarget))))) closeTooltip();
    });
    document.addEventListener('focusin', function (event) {
      if (event.target.matches('.tip[data-tip]')) {pinnedTooltip = false; showTooltip(event.target);}
    });
    document.addEventListener('focusout', function (event) {
      if (event.target === activeTooltip && !pinnedTooltip) closeTooltip();
    });
    document.addEventListener('click', function (event) {
      var tip = event.target.closest && event.target.closest('.tip[data-tip]');
      if (!tip) {if (!tooltipPanel || !tooltipPanel.contains(event.target)) closeTooltip(); return;}
      event.preventDefault(); event.stopPropagation();
      if (activeTooltip === tip && pinnedTooltip) closeTooltip();
      else {showTooltip(tip); pinnedTooltip = true;}
    }, true);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {closeTooltip(); return;}
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.tip[data-tip]')) {
        event.preventDefault(); event.target.click();
      }
    });
    window.addEventListener('resize', closeTooltip);
    document.addEventListener('scroll', function (event) {
      if (!activeTooltip || (tooltipPanel && tooltipPanel.contains(event.target))) return;
      var rect = activeTooltip.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) closeTooltip();
      else showTooltip(activeTooltip);
    }, true);
    var observer = new MutationObserver(function (records) {
      var relevant = records.some(function (record) {
        return record.target.nodeType === 1 && !record.target.closest('#yamlOutput,#builder-tooltip-popup,.tip,.tooltip-sr-only,#guidePane') &&
          (record.target.tagName === 'LABEL' || Array.from(record.addedNodes).some(function (node) {return node.nodeType === 1 && !node.matches('.tip,.tooltip-sr-only,#builder-tooltip-popup');}));
      });
      if (!relevant || tooltipFrame) return;
      tooltipFrame = requestAnimationFrame(function () {tooltipFrame = 0; applyTooltips();});
    });
    observer.observe(document.body, {childList:true,subtree:true});
  }

  // ---------------- 8) BASE64-WERKZEUG (KODIEREN / DEKODIEREN) ----------------
  // toBase64(str) ist bereits weiter oben im Original-Skript definiert
  // (UTF-8-sicher via unescape(encodeURIComponent(...))). Hier ergaenzen wir
  // nur die Gegenrichtung sowie die UI-Verdrahtung.
  function fromBase64(text) {
    var clean=String(text||'').replace(/\s/g,'');if(!clean)return '';
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)||clean.length%4===1)throw new Error('Ungültiger Base64-Text.');
    var binary=atob(clean), bytes=Uint8Array.from(binary,function(c){return c.charCodeAt(0);});
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){throw new Error('Base64 enthält keinen gültigen UTF-8-Text.');}
  }

  byId('base64ToolBtn').addEventListener('click', function () {
    byId('base64Error').style.display = 'none';
    byId('base64Modal').style.display = 'flex';
  });
  byId('base64CloseBtn').addEventListener('click', function () {
    byId('base64Modal').style.display = 'none';
  });
  byId('base64ClearBtn').addEventListener('click', function () {
    byId('base64PlainText').value = '';
    byId('base64EncodedText').value = '';
    byId('base64Error').style.display = 'none';
  });
  byId('base64EncodeBtn').addEventListener('click', function () {
    byId('base64Error').style.display = 'none';
    byId('base64EncodedText').value = toBase64(byId('base64PlainText').value);
  });
  byId('base64DecodeBtn').addEventListener('click', function () {
    try {
      byId('base64PlainText').value = fromBase64(byId('base64EncodedText').value);
      byId('base64Error').style.display = 'none';
    } catch (err) {
      var box = byId('base64Error');
      box.style.display = 'block';
      box.className = 'callout-box';
      box.innerHTML = '<h4>Fehler beim Dekodieren</h4><p>' + escapeHtml(err.message) + '</p>';
    }
  });
  byId('base64CopyPlainBtn').addEventListener('click', function () {
    safeClipboard(byId('base64PlainText').value).catch(function () {});
  });
  byId('base64CopyEncodedBtn').addEventListener('click', function () {
    safeClipboard(byId('base64EncodedText').value).catch(function () {});
  });

  // ---------------- INITIALISIERUNG DER FEATURES ----------------
  makeFieldsetsCollapsible();
  applyTooltips();
  initTooltipInteraction();

  // =========================================================================
  // v1.3: KLEINIGKEITEN MIT GROSSEM NUTZEN
  // =========================================================================

  // ---------------- A) DARK/LIGHT THEME TOGGLE ----------------
  var THEME_STORAGE_KEY = 'argocd_builder_theme';
  function applyTheme(theme) {
    var isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    var btn = byId('themeToggleBtn');
    if (btn) btn.textContent = isLight ? '☀️ Hell' : '🌙 Dunkel';
  }
  (function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) {}
    applyTheme(stored === 'light' ? 'light' : 'dark');
  })();
  byId('themeToggleBtn').addEventListener('click', function () {
    var nowLight = !document.body.classList.contains('light-theme');
    applyTheme(nowLight ? 'light' : 'dark');
    try { localStorage.setItem(THEME_STORAGE_KEY, nowLight ? 'light' : 'dark'); } catch (e) {}
  });

  // ---------------- B) "WERT KOPIEREN"-ICON AN TEXTFELDERN ----------------
  function addCopyIconToInput(input) {
    if (!input || input.dataset.copyAttached) return;
    if (input.closest('.modal-overlay')) return;
    input.dataset.copyAttached = '1';
    var wrapper = document.createElement('span');
    wrapper.className = 'copy-field-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-field-btn';
    btn.title = 'Wert kopieren';
    btn.textContent = '📋';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!input.value) return;
      safeClipboard(input.value).then(function () {
        btn.textContent = '✓';
        setTimeout(function () { btn.textContent = '📋'; }, 1200);
      }).catch(function () {});
    });
    wrapper.appendChild(btn);
  }
  function attachCopyIcons(root) {
    (root || document).querySelectorAll('input[type="text"]').forEach(addCopyIconToInput);
  }
  attachCopyIcons(document.querySelector('.form-pane'));
  var formPaneEl = document.querySelector('.form-pane');
  if (formPaneEl && window.MutationObserver) {
    var copyIconObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('input[type="text"]')) addCopyIconToInput(node);
          if (node.querySelectorAll) attachCopyIcons(node);
        });
      });
    });
    copyIconObserver.observe(formPaneEl, { childList: true, subtree: true });
  }

  // ---------------- C) SUCHFELD FUER LANGE LISTEN ----------------
  function wireListFilter(filterId, container) {
    var filterEl = byId(filterId);
    if (!filterEl || !container) return;
    filterEl.addEventListener('input', function () {
      var q = filterEl.value.trim().toLowerCase();
      Array.prototype.forEach.call(container.querySelectorAll('.source-block'), function (block) {
        if (!q) { block.style.display = ''; return; }
        var labelText=Array.from(block.querySelectorAll('h4,label,summary')).map(function(el){
          var copy=el.cloneNode(true);copy.querySelectorAll('.tip,.tooltip-sr-only').forEach(function(t){t.remove();});return copy.textContent;
        }).join(' ').toLowerCase();
        var valueMatch = Array.prototype.some.call(block.querySelectorAll('input,textarea,select'), function (el) {
          return (el.value || '').toLowerCase().indexOf(q) !== -1;
        });
        block.style.display = (labelText.indexOf(q) !== -1 || valueMatch) ? '' : 'none';
      });
    });
  }
  wireListFilter('sourcesFilter', sourcesContainer);
  wireListFilter('generatorsFilter', generatorsContainer);
  wireListFilter('prjRolesFilter', prjRolesContainer);

  // Initialize dropdowns on page load
  updatePresetDropdowns();

  function wrapImport(fn,mode){return function(obj,kindOrReport,maybeReport){
    var report=maybeReport||kindOrReport;
    generationDepth++;
    try{fn(obj,kindOrReport,maybeReport);}finally{generationDepth--;}
    var wanted=JSON.parse(JSON.stringify(obj));
    delete wanted.status;
    if(wanted.metadata)['uid','resourceVersion','generation','creationTimestamp','managedFields','selfLink'].forEach(function(k){delete wanted.metadata[k];});
    var normal;
    try{normal=parseSimpleYAML(renderFormText());}catch(e){normal={};}
    if(JSON.stringify(stable(normal))!==JSON.stringify(stable(wanted))){
      byId('rawManifest_'+mode).value=objectToYaml(wanted);byId('rawEnabled_'+mode).checked=true;
      byId('rawHint_'+mode).textContent='Rohmanifest aktiv: Es ist die maßgebliche Exportquelle. Änderungen im Formular wirken erst nach Deaktivieren des Rohmodus. Unbekannte/erweiterte Felder bleiben erhalten.';
      report.warnings.push('Verlustfreier Rohmanifest-Modus aktiviert; bitte die maßgebliche Exportquelle im erweiterten Editor beachten.');
      report.skipped=[];
    }generateYaml();
  };}
  applyImportToApplication=wrapImport(applyImportToApplication,'application');
  applyImportToApplicationSet=wrapImport(applyImportToApplicationSet,'applicationset');
  applyImportToProject=wrapImport(applyImportToProject,'project');
  applyImportToRegistry=wrapImport(applyImportToRegistry,'registry');
  var restoreOriginal=restoreModeFromPreset;
  restoreModeFromPreset=function(mode,data){generationDepth++;try{restoreOriginal(mode,data);}finally{generationDepth--;generateYaml();}};
function parseImportDocuments(text) {
    text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.length > 2 * 1024 * 1024) throw new Error('YAML ist größer als 2 MiB.');
    text = text.replace(/^\s*```(?:yaml|yml)?[^\S\n]*\n/i, '').replace(/\n```\s*$/, '');
    text = text.replace(/^\s*yaml:\s*(?=apiVersion:)/i, '');
    text = text.replace(/^(\s*(?:repoURL|server|url):\s*)\[([^\]\n]+)\]\(([^)\n]+)\)(\s*(?:#.*)?)$/gm,
      function (_, prefix, label, url, tail) { return prefix + JSON.stringify(url) + tail; });
    var docs = window.BuilderYAML.parseAllDocuments(text, {version:'1.2', uniqueKeys:true, prettyErrors:true, strict:true});
    if (!docs.length || docs.length>100) throw new Error('Import erwartet 1 bis 100 YAML-Dokumente.');
    return docs.map(function(doc,index){
      if(doc.errors.length)throw new Error('Dokument '+(index+1)+': '+doc.errors[0].message);
      if(doc.warnings.length)throw new Error('Dokument '+(index+1)+': '+doc.warnings.map(function(w){return w.message;}).join(' | '));
      var obj=doc.toJS({maxAliasCount:50});assertSafeTree(obj);return obj===null?{}:obj;
    });
  }

  // v2.3.4: transactional render, editor tools and safe import/validation.
  function showStatus(message,bad) {
    var status=byId('statusMsg');status.textContent=message;status.style.color=bad?'var(--err)':'var(--ok)';
  }
  function safeFieldKey(key) {
    if(!key||['__proto__','constructor','prototype'].includes(key))throw new Error('Unzulässiger oder leerer Schlüssel: '+key);
  }
  function writeOutput(text) {
    text=String(text);
    if(captureOutput){capturedOutput=text;return;}
    var element=byId('yamlOutput');
    if(element.textContent!==text){element.textContent=text;outputWrites++;}
  }
  function renderFormText() {
    var previous=captureOutput,old=capturedOutput;captureOutput=true;capturedOutput='';
    try{renderMode();return capturedOutput;}finally{captureOutput=previous;capturedOutput=old;}
  }
  function getExportText() {
    var mode=currentMode;
    if(!byId('rawEnabled_'+mode).checked)return renderFormText();
    var raw=yamlBlock(byId('rawManifest_'+mode).value,'object','Rohmanifest'),kind=detectResourceKind(raw);
    if(!kind||kind.replace(/^registry-.*/,'registry')!==mode)throw new Error('Rohmanifest passt nicht zum gewählten Reiter.');
    return objectToYaml(raw)+'\n';
  }
  function scheduleYaml() {
    if(generationDepth||pendingRenderFrame)return;
    if(byId('validationPanel'))byId('validationPanel').hidden=true;
    pendingRenderFrame=requestAnimationFrame(function(){pendingRenderFrame=0;generateYaml();});
  }
  function validateAgainstSchema(kind,obj) {
    try{
      assertSafeTree(obj);
      if(!['application','applicationset','project','registry'].includes(kind))return {errors:['Nicht unterstützter Ressourcentyp.'],warnings:[]};
      return extendValidation(kind,obj,validateAgainstSchemaCore(kind,obj));
    }catch(error){return {errors:['Ungültige Manifest-Struktur: '+error.message],warnings:[]};}
  }
  function displayValidation(result) {
    var panel=byId('validationPanel');panel.hidden=false;panel.className='callout-box '+(result.errors.length?'warn':result.warnings.length?'warn':'ok');panel.replaceChildren();
    var heading=document.createElement('h4');heading.textContent='Lokale Prüfung: '+result.errors.length+' Fehler, '+result.warnings.length+' Hinweise';panel.appendChild(heading);
    [['Fehler',result.errors],['Hinweise',result.warnings]].forEach(function(section){
      if(!section[1].length)return;var title=document.createElement('p');title.textContent=section[0];panel.appendChild(title);
      var list=document.createElement('ul');section[1].forEach(function(message){var item=document.createElement('li');item.textContent=message;list.appendChild(item);});panel.appendChild(list);
    });
    var disclaimer=document.createElement('p');disclaimer.className='hint';disclaimer.textContent='Prüft die unmaskierte Exportquelle lokal. Keine Anfrage an Cluster oder Repository; keine vollständige CRD-Validierung.';panel.appendChild(disclaimer);
    showStatus(result.errors.length?'Lokale Prüfung fehlgeschlagen. Details im Prüfbericht.':result.warnings.length?'Lokale Prüfung mit Hinweisen. Details im Prüfbericht.':'Lokale Prüfung ohne Auffälligkeiten.',result.errors.length>0);
  }
  function parameterAt(parameters,key) {
    if(parameters&&Object.prototype.hasOwnProperty.call(parameters,key))return parameters[key];
    return key.split('.').reduce(function(value,part){return value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,part)?value[part]:undefined;},parameters);
  }
  function matchesSelector(parameters,selector) {
    var labels=selector.matchLabels||{};
    if(!Object.keys(labels).every(function(key){var value=parameterAt(parameters,key);return value!==undefined&&String(value)===String(labels[key]);}))return false;
    return (selector.matchExpressions||[]).every(function(expression){
      var value=parameterAt(parameters,expression.key),exists=value!==undefined,values=(expression.values||[]).map(String);
      if(expression.operator==='Exists')return exists;
      if(expression.operator==='DoesNotExist')return !exists;
      if(expression.operator==='In')return exists&&values.includes(String(value));
      if(expression.operator==='NotIn')return !exists||!values.includes(String(value));
      return false;
    });
  }
  function invalidateImport() {
    pendingImportParsed=null;pendingImportKind=null;byId('yamlImportApplyBtn').disabled=true;
  }
  function showImportError(message) {
    invalidateImport();var report=byId('yamlImportReport');report.style.display='block';report.className='callout-box';report.textContent=message;
  }
  function dispatchImport(obj,kind,report) {
    if(kind==='application')applyImportToApplication(obj,report);
    else if(kind==='applicationset')applyImportToApplicationSet(obj,report);
    else if(kind==='project')applyImportToProject(obj,report);
    else if(kind==='registry-secret'||kind==='registry-eso')applyImportToRegistry(obj,kind,report);
    else throw new Error('Nicht unterstützter Ressourcentyp.');
  }
  function formToRaw(mode) {
    if(mode!==currentMode)throw new Error('Zuerst den passenden Reiter öffnen.');
    var text=renderFormText();parseSimpleYAML(text);
    var field=byId('rawManifest_'+mode);
    if(field.value.trim()&&field.value!==text&&!confirm('Bestehenden Rohtext durch den aktuellen Formularentwurf ersetzen?\nDer vorhandene Rohtext wird überschrieben.'))return;
    field.value=text;byId('rawEnabled_'+mode).checked=true;
    byId('rawHint_'+mode).textContent='Rohmanifest aktiv. Formularentwurf wurde in den Editor übernommen.';
    generateYaml();showStatus('Formularentwurf in den Rohmanifest-Editor übernommen.',false);
  }
  function rawToForm(mode) {
    if(mode!==currentMode)throw new Error('Zuerst den passenden Reiter öffnen.');
    var report={applied:[],warnings:[],skipped:[]},obj=normalizeImportedManifest(parseSimpleYAML(byId('rawManifest_'+mode).value),report.warnings),kind=detectResourceKind(obj);
    if(!kind||kind.replace(/^registry-.*/,'registry')!==mode)throw new Error('Rohmanifest passt nicht zum gewählten Reiter.');
    var checked=validateAgainstSchema(mode,obj);if(checked.errors.length){displayValidation(checked);return;}
    if(!confirm('Rohmanifest in das Formular übernehmen?\nDie aktuelle Formular-Konfiguration dieses Reiters wird ersetzt. Bei nicht abbildbaren Feldern bleibt der Rohmodus aktiv, um Datenverlust zu vermeiden.'))return;
    dispatchImport(obj,kind,report);
    showStatus(byId('rawEnabled_'+mode).checked?'Formular aktualisiert; Rohmodus bleibt zum Erhalt zusätzlicher Felder aktiv.':'Rohmanifest vollständig in das Formular übernommen; Formular ist wieder Exportquelle.',false);
    if(report.warnings.length)displayValidation({errors:[],warnings:report.warnings});
  }
  function formatRaw(mode) {
    var obj=yamlBlock(byId('rawManifest_'+mode).value,'object','Rohmanifest');
    byId('rawManifest_'+mode).value=objectToYaml(obj)+'\n';generateYaml();showStatus('Rohmanifest formatiert. Kommentare und ursprüngliche Formatierung werden nicht erhalten.',false);
  }
  function initEditorTools() {
    ['application','applicationset','project','registry'].forEach(function(mode){
      [['rawFromForm_',formToRaw],['rawToForm_',rawToForm],['rawFormat_',formatRaw]].forEach(function(entry){
        var button=byId(entry[0]+mode);button.addEventListener('click',function(){try{entry[1](mode);}catch(error){showStatus(error.message,true);}});
      });
      BUTTON_TOOLTIP_TEXT['rawFromForm_'+mode]='Kopiert den unmaskierten Formularentwurf in den Roheditor und aktiviert Rohmodus. Vor dem Überschreiben vorhandenen Rohtexts wird gefragt.';
      BUTTON_TOOLTIP_TEXT['rawToForm_'+mode]='Übernimmt den validierten Rohtext nach Rückfrage in das Formular. Bei nicht abbildbaren Feldern bleibt Rohmodus aktiv; keine stillen Datenverluste.';
      BUTTON_TOOLTIP_TEXT['rawFormat_'+mode]='Formatiert den Rohtext als YAML. Erhält Werte und Struktur, nicht Kommentare oder ursprüngliche Formatierung.';
    });
    TOOLTIP_TEXT.yamlImportDocument='Bei mehreren YAML-Dokumenten das zu übernehmende Objekt auswählen. Alle Dokumente werden auf Syntax geprüft; es wird nur das ausgewählte Objekt übernommen.';
    byId('yamlImportDocument').addEventListener('change',function(){invalidateImport();byId('yamlImportParseBtn').click();});
    byId('validationCloseBtn').addEventListener('click',function(){byId('validationPanel').hidden=true;});
    ['yamlImportModal','base64Modal','presetConflictModal'].forEach(function(id){
      var modal=byId(id);
      document.addEventListener('keydown',function(event){if(event.key==='Escape'&&modal.style.display==='flex'){modal.style.display='none';if(id==='yamlImportModal'){importReadRevision++;invalidateImport();}}});
    });
    applyTooltips();
  }


  // v2.3.5: credential-safe preset restores, ESO mapping, card operations and dialog focus.
  function populateExternalSecret(obj, report) {
    var spec=obj.spec||{},target=spec.target||{},tpl=target.template||{},data=tpl.data||{};
    var store=spec.secretStoreRef||{},labels=(tpl.metadata||{}).labels||{};
    var kind=labels['argocd.argoproj.io/secret-type'];
    byId('regKind').value=kind==='repo-creds'?'repo-creds':'repository';
    byId('regType').value=String(data.enableOCI)==='true'?'oci':data.type==='helm'?'helm':'git';
    var auth=data.sshPrivateKey!==undefined?'ssh':data.tlsClientCertData!==undefined||data.tlsClientCertKey!==undefined?'tls':data.username!==undefined||data.password!==undefined?'userpass':'none';
    byId('regAuthMethod').value=auth;byId('regCredSource').value='eso';
    if(Array.from(byId('regEsoApiVersion').options).some(function(o){return o.value===obj.apiVersion;}))byId('regEsoApiVersion').value=obj.apiVersion;
    if(store.kind)byId('regEsoStoreKind').value=store.kind;
    if(store.name)byId('regEsoStoreName').value=store.name;
    if(spec.refreshInterval!==undefined)byId('regEsoRefreshInterval').value=String(spec.refreshInterval);
    if(target.creationPolicy)byId('regEsoCreationPolicy').value=target.creationPolicy;
    var refs={};(Array.isArray(spec.data)?spec.data:[]).forEach(function(entry){if(entry&&entry.remoteRef)refs[entry.secretKey]=entry.remoteRef;});
    function reference(field){
      var value=data[field];if(typeof value!=='string')return null;
      var match=value.match(/^\s*\{\{\s*\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}\s*$/);
      return match?refs[match[1]]||null:null;
    }
    var user=reference('username'),pass=reference('password'),ssh=reference('sshPrivateKey'),cert=reference('tlsClientCertData'),key=reference('tlsClientCertKey');
    if(auth==='userpass'&&user&&pass){
      byId('regEsoSeparatePaths').checked=user.key!==pass.key;
      byId('regEsoRemoteKey').value=user.key||'';
      byId('regEsoRemoteKeyUser').value=user.key||'';byId('regEsoRemoteKeyPass').value=pass.key||'';
      byId('regEsoPropUser').value=user.property||'';byId('regEsoPropPass').value=pass.property||'';
    }else if(auth==='ssh'&&ssh){
      byId('regEsoSshRemoteKey').value=ssh.key||'';byId('regEsoSshProp').value=ssh.property||'';
    }else if(auth==='tls'&&cert&&key){
      byId('regEsoTlsSeparatePaths').checked=cert.key!==key.key;
      byId('regEsoTlsRemoteKey').value=cert.key||'';
      byId('regEsoTlsRemoteKeyCert').value=cert.key||'';byId('regEsoTlsRemoteKeyKey').value=key.key||'';
      byId('regEsoTlsPropCert').value=cert.property||'';byId('regEsoTlsPropKey').value=key.property||'';
    }else report.warnings.push('ESO-Zugangsdaten sind nicht vollständig als einfache Remote-Referenzen abbildbar; der Rohmodus erhält die Originalstruktur.');
    ['url','name','project'].forEach(function(k){
      var prefix=k==='url'?'regUrl':k==='name'?'regName':'regProject',value=data[k],ref=reference(k);
      byId(prefix+'FromVault').checked=!!ref;
      byId(prefix).value=ref?'':typeof value==='string'?value:'';
      if(k==='project')byId('regProjectEnabled').checked=value!==undefined;
      if(ref){byId(prefix+'VaultKey').value=ref.key||'';byId(prefix+'VaultProp').value=ref.property||'';}
    });
    byId('regInsecure').checked=String(data.insecure)==='true';
    updateRegistryVisibility();applyEsoFieldVisibility();
    report.applied.push('ExternalSecret: Authentifizierung '+auth+', Vault-/ESO-Pfade und Properties sowie Store, Lifecycle und Repository-Daten übernommen.');
  }

  function extendValidation(kind,obj,result) {
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return result;
    function err(s){result.errors.push(s);}function warn(s){result.warnings.push(s);}
    function isMap(o){return o&&typeof o==='object'&&!Array.isArray(o);}
    function strings(values,path){if(Array.isArray(values))values.forEach(function(v,i){if(typeof v!=='string')err(path+'['+i+']: String erwartet.');});}
    var spec=obj.spec||{};
    var appSpecs=kind==='application'?[spec]:kind==='applicationset'?[spec.template&&spec.template.spec]:[];
    appSpecs.forEach(function(app){
      if(!isMap(app))return;
      var sources=Array.isArray(app.sources)?app.sources:app.source?[app.source]:[];
      sources.forEach(function(s,i){
        if(!isMap(s))return;var path='Source #'+(i+1),h=s.helm;
        if(isMap(h)){
          strings(h.valueFiles,path+'.helm.valueFiles');strings(h.apiVersions,path+'.helm.apiVersions');
          if(h.values!==undefined&&typeof h.values!=='string')err(path+'.helm.values: String erwartet.');
          ['parameters','fileParameters'].forEach(function(k){if(!Array.isArray(h[k]))return;h[k].forEach(function(p){
            if(!isMap(p))return;
            if(typeof p.name!=='string'||!p.name.trim())err(path+'.helm.'+k+': name fehlt.');
            var field=k==='parameters'?'value':'path';if(typeof p[field]!=='string')err(path+'.helm.'+k+'.'+field+': String erwartet.');
            if(p.forceString!==undefined&&typeof p.forceString!=='boolean')err(path+'.helm.parameters.forceString: Boolean erwartet.');
          });});
        }
        var plugin=s.plugin;
        if(isMap(plugin)&&Array.isArray(plugin.parameters))plugin.parameters.forEach(function(p){
          if(!isMap(p))return;
          if(p.string!==undefined&&typeof p.string!=='string')err(path+'.plugin.string: String erwartet.');
          if(p.array!==undefined){if(!Array.isArray(p.array))err(path+'.plugin.array: Liste erwartet.');else strings(p.array,path+'.plugin.array');}
          if(p.map!==undefined){if(!isMap(p.map))err(path+'.plugin.map: Mapping erwartet.');else Object.keys(p.map).forEach(function(k){if(typeof p.map[k]!=='string')err(path+'.plugin.map.'+k+': String erwartet.');});}
        });
      });
    });
    if(kind==='project'){
      strings(spec.sourceRepos,'spec.sourceRepos');
      if(Array.isArray(spec.sourceRepos)&&!spec.sourceRepos.some(function(v){return typeof v==='string'&&v&&!v.startsWith('!');}))warn('Projekt hat keine erlaubende Repository-Regel; keine Quellen zugelassen.');
      if(Array.isArray(spec.destinations)){
        if(!spec.destinations.length)warn('Projekt hat keine erlaubten Deployment-Ziele.');
        spec.destinations.forEach(function(d,i){
          if(!isMap(d)){err('destinations['+i+']: Mapping erwartet.');return;}
          if(!(typeof d.server==='string'&&d.server.trim())&&!(typeof d.name==='string'&&d.name.trim()))err('destinations['+i+']: server oder name fehlt.');
          if(typeof d.namespace!=='string'||!d.namespace.trim())err('destinations['+i+']: namespace fehlt; * nur bewusst eintragen.');
        });
      }
      ['clusterResourceWhitelist','clusterResourceBlacklist','namespaceResourceWhitelist','namespaceResourceBlacklist'].forEach(function(k){
        if(!Array.isArray(spec[k]))return;spec[k].forEach(function(r){if(!isMap(r))return;if(typeof r.group!=='string')err(k+'.group: String erwartet; leer für Core-API.');if(typeof r.kind!=='string'||!r.kind.trim())err(k+'.kind fehlt; * nur bewusst eintragen.');});
      });
    }
    return result;
  }

  var cardSpecs={
    sourcesContainer:{create:function(){return createSourceBlock(sourceCount++,false);},minimum:1},
    asTplSourcesContainer:{create:function(){return createSourceBlock(asTplSourceCount++,false,{},asTplSourcesContainer);},minimum:1},
    generatorsContainer:{create:function(){return createGeneratorBlock(generatorCount++,{},false);},minimum:1},
    prjDestContainer:{create:function(){return createPrjDestRow(false);},minimum:1},
    prjClusterResContainer:{create:function(){return createPrjResRow(prjClusterResContainer);},minimum:0},
    prjNsResContainer:{create:function(){return createPrjResRow(prjNsResContainer);},minimum:0},
    prjRolesContainer:{create: function(){return createPrjRoleBlock();},minimum:0},
    infoContainer:{create:function(){return createInfoRow();},minimum:0},
    ignoreDiffContainer:{create:function(){return createIgnoreDiffRow();},minimum:0},
    syncWindowsContainer:{create:function(){return createSyncWindowRow();},minimum:0}
  };
  function updateCardTools() {
    Object.keys(cardSpecs).forEach(function(id){
      var container=byId(id);if(!container)return;
      var rows=Array.from(container.children).filter(function(n){return n.classList.contains('source-block');});
      rows.forEach(function(row,index){
        var tools=row.querySelector('.card-operations');
        if(!tools){
          tools=document.createElement('div');tools.className='card-operations';
          [['up','↑','Karte nach oben verschieben'],['down','↓','Karte nach unten verschieben'],['duplicate','Duplizieren','Karte mit ihren Feldwerten duplizieren']].forEach(function(entry){
            var button=document.createElement('button');button.type='button';button.className='btn-secondary';button.dataset.cardAction=entry[0];button.textContent=entry[1];button.title=entry[2];button.setAttribute('aria-label',entry[2]);tools.appendChild(button);
          });row.appendChild(tools);
        }
        tools.querySelector('[data-card-action="up"]').disabled=index===0;
        tools.querySelector('[data-card-action="down"]').disabled=index===rows.length-1;
        var title=row.querySelector('h4');if(title){var node=Array.from(title.childNodes).find(function(n){return n.nodeType===3&&/Source #|Generator #/.test(n.textContent);});if(node)node.textContent=(id==='generatorsContainer'?'Generator #':'Source #')+(index+1)+' ';}
      });
    });
  }
  function cardAction(button) {
    var row=button.closest('.source-block'),container=row&&row.parentElement,spec=container&&cardSpecs[container.id];
    if(!spec)return;
    if(byId('rawEnabled_'+currentMode).checked){showStatus('Rohmodus ist aktiv: Kartenänderungen betreffen nur den Formularentwurf, nicht den Export.',true);}
    generationDepth++;
    try{
      if(button.dataset.cardAction==='duplicate'){
        var copy=spec.create();restoreRowElements(copy,serializeRowElements(row));container.insertBefore(copy,row.nextElementSibling);
      }else if(button.dataset.cardAction==='up'&&row.previousElementSibling)container.insertBefore(row,row.previousElementSibling);
      else if(button.dataset.cardAction==='down'&&row.nextElementSibling)container.insertBefore(row.nextElementSibling,row);
    }finally{generationDepth--;updateCardTools();generateYaml();applyTooltips();}
    if(byId('generatorPreviewPanel'))byId('generatorPreviewPanel').style.display='none';
  }

  function clearKnownSecrets() {
    if(!confirm('Bekannte Secret-Felder leeren?\nRepository-Passwort, SSH-/TLS-Privatschlüssel, Git-Token und Repository-Rohmanifest werden entfernt. Eingebettete Geheimnisse in anderen YAML-/Freitextfeldern werden nicht automatisch gelöscht.'))return;
    ['regPassword','regSshKey','regTlsKey','gitToken','rawManifest_registry'].forEach(function(id){byId(id).value='';});
    byId('rawEnabled_registry').checked=false;byId('rawHint_registry').textContent='Bekannte Secret-Felder geleert. Andere Freitextfelder selbst prüfen.';
    generateYaml();showStatus('Bekannte Secret-Felder geleert; eingebettete Werte in anderen Feldern selbst prüfen.',false);
  }

  function initDialogAccessibility() {
    var modals=Array.from(document.querySelectorAll('.modal-overlay')),priorFocus=new WeakMap(),top=null;
    function visible(modal){return getComputedStyle(modal).display!=='none'&&!modal.hidden;}
    function focusable(modal){return Array.from(modal.querySelectorAll('button,input,select,textarea,[tabindex]')).filter(function(e){return !e.disabled&&e.tabIndex>=0&&e.getClientRects().length>0;});}
    modals.forEach(function(modal){
      modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
      var heading=modal.querySelector('h2,h3,h4');if(heading){if(!heading.id)heading.id=modal.id+'-title';modal.setAttribute('aria-labelledby',heading.id);}
      new MutationObserver(function(){
        if(visible(modal)){
          if(!priorFocus.has(modal))priorFocus.set(modal,document.activeElement);
          top=modal;
          if(!modal.contains(document.activeElement)){var elements=focusable(modal);(elements[0]||modal).focus();}
        }else{
          var previous=priorFocus.get(modal);priorFocus.delete(modal);
          if(top===modal){top=modals.filter(visible).at(-1)||null;if(previous&&previous.isConnected)previous.focus();}
        }
      }).observe(modal,{attributes:true,attributeFilter:['style','hidden']});
    });
    document.addEventListener('keydown',function(event){
      if(event.key!=='Tab'||!top||!visible(top))return;
      var elements=focusable(top),first=elements[0],last=elements.at(-1);
      if(!first){event.preventDefault();top.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!top.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!top.contains(document.activeElement))){event.preventDefault();first.focus();}
    });
  }

  function initAdditionalFeatures() {
    var queued=0;
    document.querySelector('.form-pane').addEventListener('click',function(event){
      var button=event.target.closest('[data-card-action]');if(button){event.preventDefault();cardAction(button);return;}
      var remove=event.target.closest('button');if(!remove||!Array.from(remove.classList).some(function(k){return k.startsWith('remove-');}))return;
      var row=remove.closest('.source-block'),parent=row&&row.parentElement,spec=parent&&cardSpecs[parent.id];
      if(spec&&parent.children.length<=spec.minimum){event.preventDefault();event.stopImmediatePropagation();showStatus('Mindestens eine Karte muss bestehen bleiben.',true);}
    },true);
    new MutationObserver(function(records){
      if(queued||!records.some(function(record){return Object.keys(cardSpecs).some(function(id){return record.target===byId(id);});}))return;
      queued=requestAnimationFrame(function(){queued=0;updateCardTools();});
    }).observe(document.querySelector('.form-pane'),{childList:true,subtree:true});
    byId('clearKnownSecretsBtn').addEventListener('click',clearKnownSecrets);
    BUTTON_TOOLTIP_TEXT.clearKnownSecretsBtn='Leert nach Rückfrage bekannte Secret-Felder und das Repository-Rohmanifest. Kein vollständiges Löschen eingebetteter Geheimnisse in anderen Reitern oder bereits exportierten Dateien.';
    updateCardTools();initDialogAccessibility();applyTooltips();
  }


  initEditorTools();
  initAdditionalFeatures();
  window.BuilderTools=Object.freeze({parseYAML:parseSimpleYAML,validate:validateAgainstSchema,version:'v2.3.7',preview:computeGeneratorPreview,inspectSecrets:hasSensitiveValue,renderStats:function(){return {outputWrites:outputWrites,renderScheduled:!!pendingRenderFrame};},
    prepareGitPush:function(){generateYaml();if(renderError)throw new Error(renderError);if(byId('securityModeToggle').checked)throw new Error('Sicherheitsmodus aktiv.');var text=byId('yamlOutput').textContent,obj=parseSimpleYAML(text),kind=detectResourceKind(obj),checked=validateAgainstSchema(kind&&kind.indexOf('registry')===0?'registry':kind,obj);if(checked.errors.length)throw new Error(checked.errors.join(' | '));if(hasSensitiveValue(obj))throw new Error('Mögliche Zugangsdaten erkannt; Git-Push blockiert.');return text;}
  });
  var rbObserver=new MutationObserver(function(){if(currentMode==='project')updateRbacWarningsPanel();else byId('rbacWarningsPanel').style.display='none';});rbObserver.observe(byId('yamlOutput'),{childList:true});
  generateYaml();
})();
