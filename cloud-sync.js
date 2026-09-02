(function(){
'use strict';

const Z=window.ZeroRoom;
const DEVICE_KEY='julius_zero_room_device_id';
const PENDING_PREFIX='julius_zero_room_v3_pending_';
const LAST_SYNC_PREFIX='julius_zero_room_v3_last_sync_';
const SAFETY_KEY='julius_zero_room_cloud_safety_backup';
const SAVE_DELAY=700;
const TYPES={days:'days',purchases:'purchases',stoppedUrges:'urges',recoverySnapshots:'recovery'};
const state={configured:false,auth:null,db:null,user:null,base:null,metaRef:null,legacyRef:null,listeners:[],active:false,initialized:false,paused:false,saving:false,initialChoice:false,pending:{},lastLocal:clean(Z.getData()),timer:null,status:'local',label:'LOCAL',error:'',cache:'準備中',lastSyncAt:0,remoteChoice:null,deviceId:getDeviceId()};

function getDeviceId(){let value=localStorage.getItem(DEVICE_KEY);if(!value){value=`zero_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;localStorage.setItem(DEVICE_KEY,value)}return value}
function clean(value){return JSON.parse(JSON.stringify(value))}
function configured(config){return!!(config&&config.apiKey&&config.authDomain&&config.projectId&&config.appId)}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function formatTime(value){if(!value)return'—';const date=value?.toDate?value.toDate():new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('ja-JP')}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{if(!['updatedAt','updatedAtServer'].includes(key))out[key]=canonical(value[key]);return out},{});return value}
function contentHash(value){const normalized=Z.normalize(clean(value)),text=JSON.stringify(canonical(normalized));let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(`00000000${(h>>>0).toString(16)}`).slice(-8)}
function isEmpty(payload){return!Object.keys(payload.days||{}).length&&!payload.purchases?.length&&!payload.stoppedUrges?.length&&!payload.recoverySnapshots?.length}
function recordMaps(payload){return{days:{...(payload.days||{})},purchases:Object.fromEntries((payload.purchases||[]).map(item=>[item.id,item])),stoppedUrges:Object.fromEntries((payload.stoppedUrges||[]).map(item=>[item.id,item])),recoverySnapshots:Object.fromEntries((payload.recoverySnapshots||[]).map(item=>[item.id,item]))}}
function pendingKey(type,id){return`${type}:${id}`}
function pendingStorageKey(){return PENDING_PREFIX+(state.user?.uid||'signed_out')}
function loadPending(){try{return JSON.parse(localStorage.getItem(pendingStorageKey())||'{}')||{}}catch(_){return{}}}
function savePending(){try{localStorage.setItem(pendingStorageKey(),JSON.stringify(state.pending))}catch(_){}}
function saveLastSync(){if(!state.user)return;localStorage.setItem(LAST_SYNC_PREFIX+state.user.uid,String(state.lastSyncAt||0))}
function loadLastSync(){if(!state.user)return 0;return Number(localStorage.getItem(LAST_SYNC_PREFIX+state.user.uid))||0}
function setStatus(status,label,error=''){state.status=status;state.label=label;state.error=error;Z.setSyncState(status,label);renderPanel()}
function friendly(error){const code=error?.code||'';if(code.includes('popup-closed'))return'ログイン画面が閉じられた。';if(code.includes('popup-blocked'))return'ポップアップが遮断された。ブラウザ設定を確認してくれ。';if(code.includes('unauthorized-domain'))return'この公開先がFirebase Authenticationの承認済みドメインに入っていない。';if(code.includes('permission-denied'))return'Firestoreの権限で拒否された。本人UIDだけを許可するルールを確認してくれ。';if(code.includes('unavailable')||!navigator.onLine)return'通信できない。記録はこの端末に保存し、復旧後に同期する。';return error?.message||'クラウド処理を完了できなかった。'}

function renderPanel(){
  const body=document.getElementById('cloudPanelBody');if(!body)return;
  if(!state.configured){body.innerHTML='<div class="sync-summary"><span>同期状態</span><b>LOCAL</b></div><div class="sync-copy">この端末への保存は動作している。Firebase設定を読み込める公開URLでは、PCとスマホの同期を利用できる。</div>';return}
  if(!state.user){body.innerHTML='<div class="sync-summary"><span>同期状態</span><b>LOCAL</b></div><div class="sync-copy">Googleアカウントでログインすると、PCとスマホで同じZERO ROOMを使える。ログイン前も端末保存は止まらない。</div><div class="sync-actions"><button class="primary" onclick="zeroCloudSignIn()">Googleでログイン</button></div>';return}
  const pendingCount=Object.keys(state.pending).length,retry=state.status==='error'?'<button class="primary" onclick="zeroCloudRetry()">再試行</button>':'',resume=state.paused?'<button class="primary" onclick="zeroCloudResume()">初回同期を再開</button>':'';
  body.innerHTML=`<div class="sync-summary"><span>同期状態</span><b>${escapeHtml(state.label)}</b></div>${state.error?`<div class="sync-copy">${escapeHtml(state.error)}</div>`:''}<div class="sync-copy">${escapeHtml(state.user.email||'Googleアカウント')}<br>最終同期：${escapeHtml(formatTime(state.lastSyncAt))}<br>未送信：${pendingCount}件 · CACHE：${escapeHtml(state.cache)}<br>${escapeHtml(Z.summaryText())}</div><div class="sync-actions">${retry}${resume}<button onclick="zeroCloudSignOut()">ログアウト</button></div>`;
}
function safetyCopy(payload,reason){try{localStorage.setItem(SAFETY_KEY,JSON.stringify({reason,savedAt:Date.now(),payload:clean(payload)}))}catch(_){}}
function choiceStats(payload,updatedAt){const value=Z.normalize(payload),noBuy=Object.values(value.days).filter(day=>day.status==='no-buy').length;return`最終更新 ${formatTime(updatedAt||value.updatedAt)}<br>NO BUY ${noBuy}日 · 購入 ${value.purchases.length}件 · RECOVERY ${value.recoverySnapshots.length}回`}
function showChoice(remote){
  state.remoteChoice=remote;state.initialChoice=true;state.active=false;setStatus('local','LOCAL');
  const local=Z.getData();Z.showCloudChoice(`<div class="sync-copy">ローカルとクラウドの内容が異なる。勝手に上書きせず、残す側を君が選ぶ。</div><div class="cloud-choice-grid"><div class="cloud-choice"><b>THIS DEVICE</b><p>${choiceStats(local,local.updatedAt)}</p><button onclick="zeroCloudChooseLocal()">この端末を採用</button></div><div class="cloud-choice"><b>CLOUD</b><p>${choiceStats(remote.payload,remote.updatedAt)}</p><button onclick="zeroCloudChooseCloud()">クラウドを採用</button></div></div><div class="sync-actions"><button onclick="zeroCloudPause()">今は同期しない</button></div>`);
}

function stripCloudFields(record){const value=clean(record||{});delete value.deleted;delete value.updatedAtServer;delete value.writerId;return value}
function bundlePayload(raw,updatedAt=0){
  const payload={version:3,days:{},purchases:[],stoppedUrges:[],recoverySnapshots:[],syncTests:[],updatedAt:Number(updatedAt)||0};
  for(const[type,map]of Object.entries(raw)){for(const[id,record]of Object.entries(map||{})){if(record.deleted)continue;const value=stripCloudFields(record);if(type==='days')payload.days[id]=value;else payload[type].push(value);payload.updatedAt=Math.max(payload.updatedAt,Number(record.updatedAt)||0)}}return Z.normalize(payload);
}
async function readCollection(type){const snap=await state.base.collection(TYPES[type]).get({source:'server'}),map={};snap.forEach(doc=>{map[doc.id]=doc.data()});return map}
async function readV3(){
  const[days,purchases,stoppedUrges,recoverySnapshots,metaSnap]=await Promise.all([readCollection('days'),readCollection('purchases'),readCollection('stoppedUrges'),readCollection('recoverySnapshots'),state.metaRef.get({source:'server'})]);
  const raw={days,purchases,stoppedUrges,recoverySnapshots},meta=metaSnap.exists?metaSnap.data():null,payload=bundlePayload(raw,meta?.lastSyncAtMs);return{payload,raw,updatedAt:meta?.lastSyncAt||meta?.lastSyncAtMs||payload.updatedAt,source:'v3',hasMeta:!!meta};
}
async function readInitialRemote(){
  const v3=await readV3();if(!isEmpty(v3.payload)||v3.hasMeta)return v3;
  const legacySnap=await state.legacyRef.get({source:'server'});if(legacySnap.exists&&legacySnap.data()?.payload){const legacy=legacySnap.data();return{payload:Z.normalize(legacy.payload),raw:recordMaps(legacy.payload),updatedAt:legacy.updatedAt||legacy.updatedAtMs||legacy.payload.updatedAt,source:'legacy',hasMeta:false}}
  return v3;
}

function queueDiff(){
  const current=clean(Z.getData()),before=recordMaps(state.lastLocal),after=recordMaps(current),now=Date.now();
  for(const type of Object.keys(TYPES)){
    const ids=new Set([...Object.keys(before[type]),...Object.keys(after[type])]);
    for(const id of ids){const oldRecord=before[type][id],newRecord=after[type][id];if(JSON.stringify(oldRecord)===JSON.stringify(newRecord))continue;const key=pendingKey(type,id);if(newRecord){const record={...clean(newRecord),updatedAt:Math.max(Number(newRecord.updatedAt)||0,now)};state.pending[key]={type,id,record,deleted:false,updatedAt:record.updatedAt,queuedAt:now}}else state.pending[key]={type,id,record:null,deleted:true,updatedAt:now,queuedAt:now}}
  }
  state.lastLocal=current;savePending();
}
function localChanged(){
  if(!state.user||!state.active){state.lastLocal=clean(Z.getData());renderPanel();return}
  queueDiff();if(!Object.keys(state.pending).length)return;if(!navigator.onLine){setStatus('offline','OFFLINE');return}setStatus('saving','SYNCING');clearTimeout(state.timer);state.timer=setTimeout(flush,SAVE_DELAY);
}
function docRef(type,id){return state.base.collection(TYPES[type]).doc(id)}
async function commitOps(ops){
  for(let start=0;start<ops.length;start+=400){const batch=state.db.batch(),slice=ops.slice(start,start+400);for(const op of slice){const body=op.deleted?{deleted:true,updatedAt:op.updatedAt,updatedAtServer:firebase.firestore.FieldValue.serverTimestamp(),writerId:state.deviceId}:{...clean(op.record),deleted:false,updatedAt:op.updatedAt,updatedAtServer:firebase.firestore.FieldValue.serverTimestamp(),writerId:state.deviceId};batch.set(docRef(op.type,op.id),body)}await batch.commit()}
}
async function flush(){
  clearTimeout(state.timer);if(!state.user||!state.active||!state.initialized||state.saving)return;if(!navigator.onLine){setStatus('offline','OFFLINE');return}const ops=Object.values(state.pending);if(!ops.length){setStatus('synced','SYNCED');return}
  state.saving=true;setStatus('saving','SYNCING');
  try{await commitOps(ops);const now=Date.now();await state.metaRef.set({schemaVersion:3,appVersion:Z.APP_VERSION,lastSyncAt:firebase.firestore.FieldValue.serverTimestamp(),lastSyncAtMs:now,lastWriterId:state.deviceId},{merge:true});for(const op of ops){const key=pendingKey(op.type,op.id);if(state.pending[key]?.queuedAt===op.queuedAt)delete state.pending[key]}savePending();state.lastSyncAt=now;saveLastSync();setStatus('synced','SYNCED')}
  catch(error){setStatus(navigator.onLine?'error':'offline',navigator.onLine?'ERROR':'OFFLINE',friendly(error))}
  finally{state.saving=false;renderPanel()}
}

function remoteChangesToPayload(type,snapshot){
  const current=clean(Z.getData()),maps=recordMaps(current);let changed=false;
  for(const change of snapshot.docChanges()){if(change.doc.metadata.hasPendingWrites)continue;const id=change.doc.id,remote=change.doc.data(),key=pendingKey(type,id),pending=state.pending[key];if(pending&&Number(pending.updatedAt)>=Number(remote.updatedAt||0))continue;const local=maps[type][id];if(local&&Number(local.updatedAt||0)>Number(remote.updatedAt||0))continue;if(remote.deleted){if(maps[type][id]){delete maps[type][id];changed=true}}else{maps[type][id]=stripCloudFields(remote);changed=true}}
  if(!changed)return null;return Z.normalize({version:3,days:maps.days,purchases:Object.values(maps.purchases),stoppedUrges:Object.values(maps.stoppedUrges),recoverySnapshots:Object.values(maps.recoverySnapshots),syncTests:current.syncTests||[],updatedAt:Date.now()});
}
function listen(){
  stopListeners();
  for(const type of Object.keys(TYPES)){const unsubscribe=state.base.collection(TYPES[type]).onSnapshot({includeMetadataChanges:true},snapshot=>{if(snapshot.metadata.hasPendingWrites)return;const merged=remoteChangesToPayload(type,snapshot);if(merged){Z.replaceData(merged);state.lastLocal=clean(Z.getData());state.lastSyncAt=Date.now();saveLastSync();setStatus(Object.keys(state.pending).length?'saving':'synced',Object.keys(state.pending).length?'SYNCING':'SYNCED')}},error=>setStatus('error','ERROR',friendly(error)));state.listeners.push(unsubscribe)}
}
function stopListeners(){state.listeners.forEach(unsubscribe=>unsubscribe());state.listeners=[]}
function activate(){state.initialChoice=false;state.initialized=true;state.paused=false;state.active=true;state.lastLocal=clean(Z.getData());Z.hideCloudChoice();listen();if(Object.keys(state.pending).length)flush();else setStatus(navigator.onLine?'synced':'offline',navigator.onLine?'SYNCED':'OFFLINE')}

function mirrorOps(local,remotePayload){
  const localMaps=recordMaps(local),remoteMaps=recordMaps(remotePayload),ops=[],now=Date.now();
  for(const type of Object.keys(TYPES)){const ids=new Set([...Object.keys(localMaps[type]),...Object.keys(remoteMaps[type])]);for(const id of ids){const record=localMaps[type][id];if(record)ops.push({type,id,record:{...clean(record),updatedAt:now},deleted:false,updatedAt:now,queuedAt:now});else ops.push({type,id,record:null,deleted:true,updatedAt:now,queuedAt:now})}}return ops;
}
async function mirrorLocalToCloud(local,remotePayload){
  setStatus('saving','SYNCING');const ops=mirrorOps(local,remotePayload);await commitOps(ops);const now=Date.now();await state.metaRef.set({schemaVersion:3,appVersion:Z.APP_VERSION,lastSyncAt:firebase.firestore.FieldValue.serverTimestamp(),lastSyncAtMs:now,lastWriterId:state.deviceId,syncModel:'record-level-v3'},{merge:true});state.pending={};savePending();state.lastSyncAt=now;saveLastSync();activate();
}
async function begin(user){
  stopListeners();state.user=user;state.base=state.db.doc(`users/${user.uid}/zeroroomV3/meta`);state.metaRef=state.base;state.legacyRef=state.db.doc(`users/${user.uid}/zeroroom/state`);state.pending=loadPending();state.lastSyncAt=loadLastSync();state.active=false;state.initialized=false;state.paused=false;state.initialChoice=false;setStatus('saving','SYNCING');
  let remote;try{remote=await readInitialRemote()}catch(error){state.active=true;state.lastLocal=clean(Z.getData());listen();setStatus(navigator.onLine?'error':'offline',navigator.onLine?'ERROR':'OFFLINE',friendly(error));return}
  const local=Z.getData(),localEmpty=isEmpty(local),remoteEmpty=isEmpty(remote.payload);
  try{
    if(remoteEmpty){await mirrorLocalToCloud(local,remote.payload);return}
    if(localEmpty&&!Object.keys(state.pending).length){safetyCopy(local,'empty_local_before_cloud_adopt');Z.replaceData(remote.payload);state.lastLocal=clean(Z.getData());if(remote.source==='legacy')await mirrorLocalToCloud(Z.getData(),emptyPayload());else activate();return}
    if(contentHash(local)===contentHash(remote.payload)){if(remote.source==='legacy')await mirrorLocalToCloud(local,emptyPayload());else activate();return}
    showChoice(remote);
  }catch(error){setStatus(navigator.onLine?'error':'offline',navigator.onLine?'ERROR':'OFFLINE',friendly(error))}
}
function emptyPayload(){return Z.normalize({version:3,days:{},purchases:[],stoppedUrges:[],recoverySnapshots:[],syncTests:[],updatedAt:0})}
async function chooseLocal(){if(!state.remoteChoice)return;try{safetyCopy(state.remoteChoice.payload,'cloud_before_local_adopt');await mirrorLocalToCloud(Z.getData(),state.remoteChoice.payload);Z.toast('この端末の記録をクラウドへ反映した。')}catch(error){setStatus('error','ERROR',friendly(error))}}
async function chooseCloud(){if(!state.remoteChoice)return;try{safetyCopy(Z.getData(),'local_before_cloud_adopt');Z.replaceData(state.remoteChoice.payload);state.lastLocal=clean(Z.getData());if(state.remoteChoice.source==='legacy')await mirrorLocalToCloud(Z.getData(),emptyPayload());else activate();Z.toast('クラウドの記録をこの端末へ反映した。')}catch(error){setStatus('error','ERROR',friendly(error))}}
function pause(){state.active=false;state.paused=true;state.initialChoice=false;Z.hideCloudChoice();setStatus('local','LOCAL')}
async function resume(){if(state.user)await begin(state.user)}
async function retry(){if(!state.user)return;if(!state.initialized||!state.active||state.initialChoice)await begin(state.user);else await flush()}

async function signIn(){if(!state.configured)return;const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});try{await state.auth.signInWithPopup(provider)}catch(error){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error.code)){await state.auth.signInWithRedirect(provider);return}setStatus('error','ERROR',friendly(error))}}
async function signOut(){stopListeners();clearTimeout(state.timer);Z.hideCloudChoice();await state.auth.signOut()}

async function init(){
  renderPanel();const config=window.JULIUS_FIREBASE_CONFIG;if(location.protocol==='file:'){state.cache='HTTPSで有効';setStatus('local','LOCAL');return}if(!configured(config)||!window.firebase){setStatus('local','LOCAL');return}state.configured=true;
  try{if(!firebase.apps.length)firebase.initializeApp(config);state.auth=firebase.auth();state.db=firebase.firestore();try{await state.db.enablePersistence({synchronizeTabs:true});state.cache='有効'}catch(error){state.cache=error.code==='failed-precondition'?'別タブで使用中':'未対応'}await state.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);state.auth.onAuthStateChanged(user=>{if(user)begin(user);else{stopListeners();state.user=null;state.base=null;state.metaRef=null;state.legacyRef=null;state.active=false;state.initialized=false;state.paused=false;state.pending={};state.lastSyncAt=0;setStatus('local','LOCAL')}});window.addEventListener('online',()=>{if(state.user){setStatus('saving','SYNCING');retry()}});window.addEventListener('offline',()=>{if(state.user)setStatus('offline','OFFLINE')})}catch(error){setStatus('error','ERROR',friendly(error))}
}

window.cloudSyncLocalChanged=localChanged;window.cloudSyncRefreshPanel=renderPanel;
window.zeroCloudSignIn=signIn;window.zeroCloudSignOut=signOut;window.zeroCloudRetry=retry;window.zeroCloudResume=resume;window.zeroCloudChooseLocal=chooseLocal;window.zeroCloudChooseCloud=chooseCloud;window.zeroCloudPause=pause;
init();
})();
