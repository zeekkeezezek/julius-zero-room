(function(){
'use strict';

const Z=window.ZeroRoom;
const DEVICE_KEY='julius_zero_room_device_id';
const PENDING_PREFIX='julius_zero_room_v3_pending_';
const LAST_SYNC_PREFIX='julius_zero_room_v3_last_sync_';
const SAFETY_KEY='julius_zero_room_cloud_safety_backup';
const SAVE_DELAY=700;
const TYPES={days:'days',purchases:'purchases',stoppedUrges:'urges',recoverySnapshots:'recovery',monthlyReality:'reality',fixedCommitments:'fixedCommitments',goalFunds:'goalFunds',goalFundTransactions:'goalFundTransactions'};
const state={configured:false,auth:null,db:null,user:null,base:null,metaRef:null,legacyRef:null,listeners:[],active:false,initialized:false,saving:false,starting:false,retryTimer:null,pending:{},lastLocal:clean(Z.getData()),timer:null,status:'local',label:'端末保存',error:'',cache:'準備中',lastSyncAt:0,generation:0,deviceId:getDeviceId()};

function getDeviceId(){let value=localStorage.getItem(DEVICE_KEY);if(!value){value=`zero_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;localStorage.setItem(DEVICE_KEY,value)}return value}
function clean(value){return JSON.parse(JSON.stringify(value))}
function configured(config){return!!(config&&config.apiKey&&config.authDomain&&config.projectId&&config.appId)}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function formatTime(value){if(!value)return'—';const date=value?.toDate?value.toDate():new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('ja-JP')}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{if(!['updatedAt','updatedAtServer'].includes(key))out[key]=canonical(value[key]);return out},{});return value}
function contentHash(value){const normalized=recordMaps(Z.normalize(clean(value))),text=JSON.stringify(canonical(normalized));let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(`00000000${(h>>>0).toString(16)}`).slice(-8)}
function isEmpty(payload){return Object.values(recordMaps(payload)).every(map=>!Object.keys(map).length)}
function recordMaps(payload){return Object.fromEntries(Object.keys(TYPES).map(type=>[type,type==='days'||type==='monthlyReality'?{...(payload[type]||{})}:Object.fromEntries((payload[type]||[]).map(item=>[item.id,item]))]))}
function pendingKey(type,id){return`${type}:${id}`}
function pendingStorageKey(){return PENDING_PREFIX+(state.user?.uid||'signed_out')}
function loadPending(){try{return JSON.parse(localStorage.getItem(pendingStorageKey())||'{}')||{}}catch(_){return{}}}
function savePending(){try{localStorage.setItem(pendingStorageKey(),JSON.stringify(state.pending))}catch(_){}}
function saveLastSync(){if(!state.user)return;localStorage.setItem(LAST_SYNC_PREFIX+state.user.uid,String(state.lastSyncAt||0))}
function loadLastSync(){if(!state.user)return 0;return Number(localStorage.getItem(LAST_SYNC_PREFIX+state.user.uid))||0}
function setStatus(status,label,error=''){state.status=status;state.label=label;state.error=error;Z.setSyncState(status,label);renderPanel()}
function friendly(error){const code=error?.code||'';if(code.includes('popup-closed'))return'ログイン画面が閉じられた。';if(code.includes('popup-blocked'))return'ポップアップが遮断された。ブラウザ設定を確認してくれ。';if(code.includes('unauthorized-domain'))return'この公開先がFirebase Authenticationの承認済みドメインに入っていない。';if(code.includes('permission-denied'))return'Firestoreの権限で拒否された。本人UIDだけを許可するルールを確認してくれ。';if(code.includes('unavailable')||!navigator.onLine)return'通信できない。記録はこの端末に保存し、復旧後に同期する。';return error?.message||'クラウド処理を完了できなかった。'}

// WORK ROOM: JSON serialization + Blob.size (UTF-8), with 1024-based units.
// ZERO ROOM syncs records separately; its estimate excludes tombstones and server metadata.
function getSyncPayloadBytes(payload=Z.getData()){
  try{return new Blob([JSON.stringify(clean(recordMaps(payload)))]).size}catch(_){return null}
}
function formatDataBytes(bytes){
  if(!Number.isFinite(bytes)||bytes<0)return '取得不可';
  if(bytes<1024)return `${Math.round(bytes)} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}
function syncPayloadSizeHtml(){
  return `<section class="cloud-data-size" aria-label="同期データ量"><div><span>同期データ量</span><strong>${formatDataBytes(getSyncPayloadBytes())}</strong></div><span class="estimate-chip">推定</span><p>同期対象データの推定サイズ。未送信分を含む、この端末の記録から計算。Firestore全体の使用容量ではない。</p></section>`;
}
function statusLabel(){return({local:'LOCAL',saving:'SYNCING',synced:'SYNCED',offline:'LOCAL',error:'LOCAL'})[state.status]||state.label}
function renderPanel(){
  const body=document.getElementById('cloudPanelBody');if(!body)return;
  const sizeHtml=syncPayloadSizeHtml();
  if(!state.configured){body.innerHTML='<div class="sync-summary"><span>同期状態</span><b>端末保存</b></div><div class="sync-copy">この端末への保存は動作している。Firebase設定を読み込める公開URLでは、PCとスマホの同期を利用できる。</div>'+sizeHtml;return}
  if(!state.user){body.innerHTML='<div class="sync-summary"><span>同期状態</span><b>端末保存</b></div><div class="sync-copy">Googleアカウントでログインすると、PCとスマホで同じZERO ROOMを使える。ログイン前も端末保存は止まらない。</div><div class="sync-actions"><button class="primary" onclick="zeroCloudSignIn()">Googleでログイン</button></div>'+sizeHtml;return}
  const pendingCount=Object.keys(state.pending).length,retry=state.status==='error'?'<button class="primary" onclick="zeroCloudRetry()">再試行</button>':'';
  body.innerHTML=`<div class="sync-summary"><span>同期状態</span><b>${escapeHtml(statusLabel())}</b></div>${state.error?`<div class="sync-copy">${escapeHtml(state.error)}</div>`:''}<div class="sync-copy">${escapeHtml(state.user.email||'Googleアカウント')}<br>最終同期：${escapeHtml(formatTime(state.lastSyncAt))}<br>未送信：${pendingCount}件 · 端末キャッシュ：${escapeHtml(state.cache)}<br>${escapeHtml(Z.summaryText())}</div>${sizeHtml}<div class="sync-actions">${retry}<button onclick="zeroCloudSignOut()">ログアウト</button></div>`;
}
function safetyCopy(payload,reason){
  const copy={reason,savedAt:Date.now(),payload:clean(payload)};
  // Retain separate local/cloud fallback copies; never alter the live Firebase history.
  localStorage.setItem(SAFETY_KEY+'_'+(reason.startsWith('cloud')?'cloud':'local'),JSON.stringify(copy));
}
function timestamp(value){const number=value?.toMillis?value.toMillis():value?.toDate?value.toDate().getTime():Number(value);return Number.isFinite(number)?number:0}
function payloadTime(payload){return Math.max(timestamp(payload.updatedAt),...Object.values(recordMaps(payload)).flatMap(map=>Object.values(map).map(record=>timestamp(record.updatedAt))))}
function scheduleRetry(){clearTimeout(state.retryTimer);if(state.user)state.retryTimer=setTimeout(()=>retry(),15000)}
function failed(error){setStatus(navigator.onLine?'error':'offline',navigator.onLine?'ERROR':'OFFLINE',friendly(error));scheduleRetry()}

function stripCloudFields(record){const value=clean(record||{});delete value.deleted;delete value.updatedAtServer;delete value.writerId;return value}
function bundlePayload(raw,updatedAt=0){
  const payload={version:7,days:{},purchases:[],stoppedUrges:[],recoverySnapshots:[],monthlyReality:{},fixedCommitments:[],goalFunds:[],goalFundTransactions:[],syncTests:[],updatedAt:Number(updatedAt)||0};
  for(const[type,map]of Object.entries(raw)){for(const[id,record]of Object.entries(map||{})){payload.updatedAt=Math.max(payload.updatedAt,Number(record.updatedAt)||0);if(record.deleted)continue;const value=stripCloudFields(record);if(type==='days'||type==='monthlyReality')payload[type][id]=value;else payload[type].push(value)}}return Z.normalize(payload);
}
async function readCollection(type){const snap=await state.base.collection(TYPES[type]).get({source:'server'}),map={};snap.forEach(doc=>{map[doc.id]=doc.data()});return map}
async function readV3(){
  for(let attempt=0;attempt<3;attempt++){
    const before=await state.metaRef.get({source:'server'});
    const types=Object.keys(TYPES),results=await Promise.all(types.map(readCollection)),after=await state.metaRef.get({source:'server'});
    const meta=after.exists?after.data():null;
    if(JSON.stringify(before.exists?before.data():null)!==JSON.stringify(meta))continue;
    const raw=Object.fromEntries(types.map((type,index)=>[type,results[index]])),payload=bundlePayload(raw,meta?.dataUpdatedAt??meta?.lastSyncAtMs);
    return{payload,raw,updatedAt:payload.updatedAt,source:'v3',hasMeta:!!meta};
  }
  throw new Error('別端末の更新を受信中。記録は端末に保存し、自動で再同期する。');
}
async function readInitialRemote(){
  const v3=await readV3();if(!isEmpty(v3.payload)||v3.hasMeta)return v3;
  const legacySnap=await state.legacyRef.get({source:'server'});if(legacySnap.exists&&legacySnap.data()?.payload){const legacy=legacySnap.data();return{payload:Z.normalize(legacy.payload),raw:recordMaps(legacy.payload),updatedAt:legacy.updatedAt||legacy.updatedAtMs||legacy.payload.updatedAt,source:'legacy',hasMeta:false}}
  return v3;
}

function queueDiff(){
  const current=clean(Z.getData()),before=recordMaps(state.lastLocal),after=recordMaps(current),now=payloadTime(current);
  for(const type of Object.keys(TYPES)){
    const ids=new Set([...Object.keys(before[type]),...Object.keys(after[type])]);
    for(const id of ids){const oldRecord=before[type][id],newRecord=after[type][id];if(JSON.stringify(oldRecord)===JSON.stringify(newRecord))continue;const key=pendingKey(type,id);if(newRecord){const record={...clean(newRecord),updatedAt:Math.max(Number(newRecord.updatedAt)||0,now)};state.pending[key]={type,id,record,deleted:false,updatedAt:record.updatedAt,queuedAt:now}}else state.pending[key]={type,id,record:null,deleted:true,updatedAt:now,queuedAt:now}}
  }
  state.lastLocal=current;savePending();
}
function localChanged(){
  if(!state.user){state.lastLocal=clean(Z.getData());renderPanel();return}
  queueDiff();if(!state.initialized){renderPanel();return}if(!Object.keys(state.pending).length)return;if(!navigator.onLine){setStatus('offline','OFFLINE');return}setStatus('saving','SYNCING');clearTimeout(state.timer);state.timer=setTimeout(flush,SAVE_DELAY);
}
function docRef(type,id){return state.base.collection(TYPES[type]).doc(id)}
async function commitOps(ops){
  // Read before writing so a delayed/offline send cannot overwrite a newer record.
  for(let start=0;start<ops.length;start+=200){
    const slice=ops.slice(start,start+200);
    await state.db.runTransaction(async tx=>{
      const refs=slice.map(op=>docRef(op.type,op.id));
      const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
      const metaSnap=await tx.get(state.metaRef),meta=metaSnap.exists?metaSnap.data():{};
      let latest=timestamp(meta.dataUpdatedAt??meta.lastSyncAtMs);
      slice.forEach((op,index)=>{
        const existing=snapshots[index].exists?snapshots[index].data():null;
        latest=Math.max(latest,op.updatedAt,timestamp(existing?.updatedAt));
        if(existing&&timestamp(existing.updatedAt)>=op.updatedAt)return;
        const body=op.deleted?{deleted:true,updatedAt:op.updatedAt}:{...clean(op.record),deleted:false,updatedAt:op.updatedAt};
        tx.set(refs[index],{...body,updatedAtServer:firebase.firestore.FieldValue.serverTimestamp(),writerId:state.deviceId});
      });
      tx.set(state.metaRef,{schemaVersion:7,appVersion:Z.APP_VERSION,dataUpdatedAt:latest,lastSyncAt:firebase.firestore.FieldValue.serverTimestamp(),lastSyncAtMs:Date.now(),lastWriterId:state.deviceId,syncModel:'record-level-v7'},{merge:true});
    });
  }
}
async function flush(){
  clearTimeout(state.timer);if(!state.user||!state.active||!state.initialized||state.saving)return;if(!navigator.onLine){setStatus('offline','OFFLINE');return}const ops=Object.values(state.pending);if(!ops.length){setStatus('synced','SYNCED');return}
  state.saving=true;setStatus('saving','SYNCING');
  try{await commitOps(ops);const now=Date.now();for(const op of ops){const key=pendingKey(op.type,op.id);if(state.pending[key]===op)delete state.pending[key]}savePending();state.lastSyncAt=now;saveLastSync();setStatus('synced','SYNCED')}
  catch(error){failed(error)}
  finally{state.saving=false;renderPanel();if(state.status==='synced')state.timer=setTimeout(Object.keys(state.pending).length?flush:retry,SAVE_DELAY)}
}

function remoteChangesToPayload(type,snapshot){
  const current=clean(Z.getData()),maps=recordMaps(current);let changed=false,updatedAt=payloadTime(current);
  for(const change of snapshot.docChanges()){if(change.doc.metadata.hasPendingWrites)continue;const id=change.doc.id,remote=change.doc.data(),key=pendingKey(type,id),pending=state.pending[key];if(pending&&Number(pending.updatedAt)>=Number(remote.updatedAt||0))continue;updatedAt=Math.max(updatedAt,timestamp(remote.updatedAt));if(pending){delete state.pending[key];savePending()}const local=maps[type][id];if(local&&Number(local.updatedAt||0)>Number(remote.updatedAt||0))continue;if(remote.deleted){if(maps[type][id]){delete maps[type][id];changed=true}}else{maps[type][id]=stripCloudFields(remote);changed=true}}
  if(!changed)return null;const merged=bundlePayload(maps,updatedAt);merged.syncTests=current.syncTests||[];return merged;
}
function listen(){
  stopListeners();
  for(const type of Object.keys(TYPES)){const unsubscribe=state.base.collection(TYPES[type]).onSnapshot({includeMetadataChanges:true},snapshot=>{if(!state.initialized||snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;const merged=remoteChangesToPayload(type,snapshot);if(merged){Z.replaceData(merged);state.lastLocal=clean(Z.getData());state.lastSyncAt=Date.now();saveLastSync();setStatus(Object.keys(state.pending).length?'saving':'synced',Object.keys(state.pending).length?'SYNCING':'SYNCED')}},error=>{stopListeners();state.initialized=false;failed(error)});state.listeners.push(unsubscribe)}
}
function stopListeners(){state.listeners.forEach(unsubscribe=>unsubscribe());state.listeners=[]}
function activate(){state.initialized=true;state.active=true;state.lastLocal=clean(Z.getData());listen();if(Object.keys(state.pending).length)flush();else setStatus(navigator.onLine?'synced':'offline',navigator.onLine?'SYNCED':'OFFLINE')}

function mirrorOps(local,remotePayload){
  const localMaps=recordMaps(local),remoteMaps=recordMaps(remotePayload),ops=[],now=payloadTime(local);
  for(const type of Object.keys(TYPES)){const ids=new Set([...Object.keys(localMaps[type]),...Object.keys(remoteMaps[type])]);for(const id of ids){const record=localMaps[type][id];if(record)ops.push({type,id,record:{...clean(record),updatedAt:now},deleted:false,updatedAt:now,queuedAt:now});else ops.push({type,id,record:null,deleted:true,updatedAt:now,queuedAt:now})}}return ops;
}
async function mirrorLocalToCloud(local,remotePayload){
  setStatus('saving','SYNCING');const ops=mirrorOps(local,remotePayload);
  // Persist the entire replacement before chunked writes, so interruption is resumable.
  for(const op of ops)state.pending[pendingKey(op.type,op.id)]=op;
  savePending();const pendingAtStart={...state.pending};
  await commitOps(ops);
  for(const [key,op] of Object.entries(pendingAtStart)){if(state.pending[key]===op)delete state.pending[key]}
  savePending();state.lastSyncAt=Date.now();saveLastSync();
}
async function begin(user){
  if(state.starting||state.saving)return;
  clearTimeout(state.timer);clearTimeout(state.retryTimer);stopListeners();
  state.starting=true;const generation=++state.generation;
  state.user=user;state.base=state.db.doc(`users/${user.uid}/zeroroomV3/meta`);state.metaRef=state.base;state.legacyRef=state.db.doc(`users/${user.uid}/zeroroom/state`);
  state.pending=loadPending();state.lastSyncAt=loadLastSync();state.active=false;state.initialized=false;
  state.lastLocal=clean(Z.getData());setStatus('saving','SYNCING');
  try{
    const remote=await readInitialRemote();if(generation!==state.generation)return;
    const local=clean(Z.getData()),localTime=payloadTime(local),remoteTime=payloadTime(remote.payload);
    const same=contentHash(local)===contentHash(remote.payload);
    // Empty, never-saved devices use timestamp 0. A deliberately emptied dataset keeps its edit time.
    if(!same&&(localTime>remoteTime||(localTime===remoteTime&&Object.keys(state.pending).length))){
      safetyCopy(remote.payload,'cloud_before_local_adopt');
      await mirrorLocalToCloud(local,remote.payload);
    }else if(!same){
      // Equal timestamps prefer cloud unless an unfinished send at that timestamp needs resuming.
      safetyCopy(local,'local_before_cloud_adopt');
      Z.replaceData({...remote.payload,syncTests:local.syncTests||[],updatedAt:remoteTime});
      state.pending={};savePending();state.lastLocal=clean(Z.getData());
      if(remote.source==='legacy')await mirrorLocalToCloud(Z.getData(),emptyPayload());
    }else{
      state.pending={};savePending();
      Z.replaceData({...local,updatedAt:Math.max(localTime,remoteTime)});
      if(remote.source==='legacy')await mirrorLocalToCloud(Z.getData(),emptyPayload());
    }
    if(generation===state.generation)activate();
  }catch(error){if(generation===state.generation)failed(error)}
  finally{state.starting=false}
}
function emptyPayload(){return Z.normalize({version:7,days:{},purchases:[],stoppedUrges:[],recoverySnapshots:[],monthlyReality:{},fixedCommitments:[],syncTests:[],updatedAt:0})}
async function retry(){if(!state.user||state.starting||state.saving)return;await begin(state.user)}

async function signIn(){if(!state.configured)return;const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});try{await state.auth.signInWithPopup(provider)}catch(error){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error.code)){await state.auth.signInWithRedirect(provider);return}setStatus('error','ERROR',friendly(error))}}
async function signOut(){stopListeners();clearTimeout(state.timer);clearTimeout(state.retryTimer);state.generation++;await state.auth.signOut()}

async function init(){
  renderPanel();const config=window.JULIUS_FIREBASE_CONFIG;if(location.protocol==='file:'){state.cache='HTTPSで有効';setStatus('local','LOCAL');return}if(!configured(config)||!window.firebase){setStatus('local','LOCAL');return}state.configured=true;
  try{if(!firebase.apps.length)firebase.initializeApp(config);state.auth=firebase.auth();state.db=firebase.firestore();try{await state.db.enablePersistence({synchronizeTabs:true});state.cache='有効'}catch(error){state.cache=error.code==='failed-precondition'?'別タブで使用中':'未対応'}await state.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);state.auth.onAuthStateChanged(user=>{if(user)begin(user);else{stopListeners();state.user=null;state.base=null;state.metaRef=null;state.legacyRef=null;state.active=false;state.initialized=false;state.pending={};state.lastSyncAt=0;setStatus('local','LOCAL')}});window.addEventListener('online',()=>{if(state.user){setStatus('saving','SYNCING');retry()}});window.addEventListener('offline',()=>{if(state.user)setStatus('offline','OFFLINE')})}catch(error){setStatus('error','ERROR',friendly(error))}
}

window.cloudSyncLocalChanged=localChanged;window.cloudSyncRefreshPanel=renderPanel;
window.zeroCloudSignIn=signIn;window.zeroCloudSignOut=signOut;window.zeroCloudRetry=retry;
init();
})();
