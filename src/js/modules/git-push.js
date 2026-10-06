(function () {
 'use strict';
 var $ = function(id){return document.getElementById(id);};
 var modal=$('gitPushModal'), btn=$('gitPushBtn'), submit=$('gitSubmit'), status=$('gitPushStatus'), busy=false;
 var defaults={github:'https://api.github.com',gitlab:'https://gitlab.com',gitea:''};
 function note(message, bad) { status.style.display='block';status.classList.toggle('warn',!!bad);status.classList.toggle('ok',!bad);status.textContent=message; }
 function clearCredentials(){ $('gitToken').value=''; }
 function close(){if(busy)return;clearCredentials();modal.style.display='none';status.style.display='none';}
 $('gitClose').addEventListener('click',close);
 modal.addEventListener('click',function(e){if(e.target===modal)close();});
 document.addEventListener('keydown',function(e){if(e.key==='Escape' && modal.style.display!=='none')close();});
 $('gitProvider').addEventListener('change',function(){ $('gitApiBase').value=defaults[this.value];clearCredentials(); });
 btn.addEventListener('click',function(){
  if(!$('gitApiBase').value) $('gitApiBase').value=defaults[$('gitProvider').value];
  if(!$('gitPath').value){
   var found=($('yamlOutput').textContent.match(/^  name: (.+)$/m)||[])[1]||'manifest';
   var name=found.replace(/^['"]|['"]$/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^[-.]+|[-.]+$/g,'')||'manifest';
   $('gitPath').value='argocd/'+name+'.yaml';
  }
  status.style.display='none';modal.style.display='flex';$('gitProvider').focus();
 });
 function segments(value){return value.split('/').map(encodeURIComponent).join('/');}
 function encode64(text){var bytes=new TextEncoder().encode(text),out='';for(var i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(out);}
 function cfg(){
  var provider=$('gitProvider').value, raw=$('gitApiBase').value.trim().replace(/\/+$/,'');
  var url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.hostname||/\.\./.test(url.pathname))throw Error('Eine vertrauenswürdige HTTPS-API-URL ohne Zugangsdaten angeben.');
  var repo=$('gitRepository').value.trim();
  if(!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(repo)||(provider!=='gitlab'&&repo.split('/').length!==2)||repo.split('/').some(function(x){return x==='.'||x==='..';}))throw Error('Repository: Owner/Repo (GitLab auch Gruppe/Untergruppe/Projekt).');
  var branch=$('gitBranch').value.trim();
  if(!branch||branch==='@'||branch.split('/').some(function(s){return s.startsWith('.')||s.endsWith('.lock');})||branch.startsWith('/')||branch.endsWith('/')||branch.includes('..')||branch.includes('//')||/[\x00-\x20~^:?*\[\\]/.test(branch)||branch.endsWith('.lock')||branch.endsWith('.'))throw Error('Ungültiger Branch-Name.');
  var path=$('gitPath').value.trim();
  if(!path||path.startsWith('/')||path.endsWith('/')||! /\.ya?ml$/i.test(path)||path.split('/').some(function(x){return !x||x==='.'||x==='..'||/[\x00-\x1f\?#]/.test(x);}))throw Error('Relativen Dateipfad mit Endung .yaml oder .yml eingeben.');
  var message=$('gitMessage').value.trim(), token=$('gitToken').value.trim();
  if(!message||/[\r\n]/.test(message))throw Error('Einzeilige Commit-Nachricht eingeben.');
  if(!token)throw Error('Personal Access Token eingeben.');
  if(/[\r\n]/.test(token))throw Error('Ungültiger Access Token.');
  var base=url.toString().replace(/\/$/,'');
  if(provider==='gitlab'&&!/\/api\/v4$/i.test(url.pathname))base+='/api/v4';
  if(provider==='gitea'&&!/\/api\/v1$/i.test(url.pathname))base+='/api/v1';
  var rp=provider==='gitlab'?'/projects/'+encodeURIComponent(repo):'/repos/'+segments(repo);
  return {provider:provider,repo:repo,branch:branch,path:path,message:message,token:token,
   file:base+rp+(provider==='gitlab'?'/repository/files/'+encodeURIComponent(path):'/contents/'+segments(path)),
   branchUrl:base+rp+(provider==='gitlab'?'/repository/branches/':'/branches/')+encodeURIComponent(branch)};
 }
 function request(url,method,c,body){
  var headers={Accept:'application/json'};
  if(c.provider==='github'){headers.Authorization='Bearer '+c.token;headers['X-GitHub-Api-Version']='2022-11-28';}
  else if(c.provider==='gitlab')headers['PRIVATE-TOKEN']=c.token;
  else headers.Authorization='token '+c.token;
  if(body)headers['Content-Type']='application/json';
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},30000);
  return fetch(url,{method:method,headers:headers,body:body?JSON.stringify(body):undefined,signal:controller.signal,mode:'cors',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}).finally(function(){clearTimeout(timer);});
 }
 async function json(response){if(!response.ok)throw Error('HTTP '+response.status+' – API-Zugriff, Branch, Berechtigung und CORS prüfen.');return response.json();}
 submit.addEventListener('click',async function(){
  if(busy)return;
  var writeStarted=false;
  try{
   var c=cfg();
   if($('securityModeToggle').checked)throw Error('Sicherheitsmodus aktiv – keine maskierte YAML nach Git schreiben.');
   var yaml=window.BuilderTools.prepareGitPush();
   if(!yaml.trim()||!/^apiVersion:\s*\S+/m.test(yaml)||!/^kind:\s*\S+/m.test(yaml))throw Error('Generierte YAML ist leer oder unvollständig.');
   if(/^kind:\s*Secret\s*$/m.test(yaml)||/\(masked\)|••••/.test(yaml))throw Error('Secrets und maskierte Werte werden nicht gepusht.');
   var encoded=encode64(yaml);
   busy=true;submit.disabled=true;$('gitClose').disabled=true;note('Prüfe Branch und Datei …',false);
   await json(await request(c.branchUrl,'GET',c));
   var file=await request(c.file+'?ref='+encodeURIComponent(c.branch),'GET',c);
   var old=file.status===404?null:await json(file);
   if(old&&(Array.isArray(old)||!(c.provider==='gitlab'?old.last_commit_id:old.sha)))throw Error('Ziel ist keine reguläre Datei oder Versionskennung fehlt.');
   if(old&&!$('gitOverwrite').checked)throw Error('Datei existiert. Zum Überschreiben die Checkbox aktivieren.');
   if(old&&old.content&&old.content.replace(/\s/g,'')===encoded)throw Error('Datei ist bereits identisch.');
   if(window.BuilderTools.prepareGitPush()!==yaml||$('securityModeToggle').checked)throw Error('YAML hat sich geändert. Bitte erneut prüfen.');
   var target=c.provider+' · '+c.repo+' / '+c.branch+' / '+c.path;
   if(!window.confirm((old?'Vorhandene Datei überschreiben?':'Neue Datei anlegen?')+'\n'+target+'\n'+c.message+'\n\n'+yaml)){note('Abgebrochen; kein Commit erstellt.',false);return;}
   if(window.BuilderTools.prepareGitPush()!==yaml||$('securityModeToggle').checked)throw Error('YAML hat sich geändert. Bitte erneut prüfen.');
   note('Erstelle Commit …',false);writeStarted=true;
   var body, method;
   if(c.provider==='gitlab'){
    method=old?'PUT':'POST';body={branch:c.branch,commit_message:c.message,content:encoded,encoding:'base64'};
    if(old)body.last_commit_id=old.last_commit_id;
   }else{method=c.provider==='gitea'&&!old?'POST':'PUT';body={message:c.message,content:encoded,branch:c.branch};if(old)body.sha=old.sha;}
   var result=await json(await request(c.file,method,c,body));
   note('Commit erstellt: '+target+(result.commit&&result.commit.sha?' ('+result.commit.sha.slice(0,12)+')':''),false);
   clearCredentials();
  }catch(e){note(e.name==='AbortError'?(writeStarted?'Timeout beim Schreiben: Commit-Zustand unklar. Repository vor einem erneuten Versuch prüfen.':'Timeout beim Lesen: API-Erreichbarkeit und CORS prüfen.'):(writeStarted&&(e instanceof TypeError||e instanceof SyntaxError)?'Netzwerkfehler nach Beginn des Schreibens: Commit-Zustand unklar; Repository vor erneutem Versuch prüfen.':e instanceof TypeError?'Netzwerkfehler oder CORS blockiert: API-URL und CORS prüfen.':e.message),true);}
  finally{clearCredentials();busy=false;submit.disabled=false;$('gitClose').disabled=false;}
 });
})();
