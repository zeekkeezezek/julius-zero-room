(function(){
'use strict';

const APP_VERSION='0.6.0';
const STORAGE_KEY='julius_zero_room_v1';
const REALITY_MIGRATION_KEY='julius_zero_room_v05_reality_notice_seen';
const START_DATE='2026-09-01';
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const JP_MONTH_NAMES=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
let pendingRealityMigration=false;
let realityMigrationOffered=false;
let data=loadStored(STORAGE_KEY,emptyData());
let calendarCursor=startOfMonth(today());
let selectedDay=null;
let editingPurchaseId=null;
let editingSnapshotId=null;
let editingFixedId=null;
let pendingFixedEntry=null;
let toastTimer=null;
let achievementTimer=null;
let urgeAnswers={};

localStorage.removeItem('julius_zero_room_demo_v02');
localStorage.removeItem('julius_zero_room_demo_mode');

function emptyData(){return{version:6,days:{},fixedCommitments:[],purchases:[],stoppedUrges:[],recoverySnapshots:[],monthlyReality:{},syncTests:[],updatedAt:Date.now()}}
function normalize(input){
  const base=emptyData(),value=input&&typeof input==='object'?input:{};
  if(value.monthlyReality&&Object.keys(value.monthlyReality).length&&(whole(value.version)<5||Object.values(value.monthlyReality).some(item=>item&&item.expectedIncomeVerified!==true)))pendingRealityMigration=true;
  base.days=value.days&&typeof value.days==='object'?Object.fromEntries(Object.entries(value.days).filter(([,item])=>item&&['no-buy','purchase'].includes(item.status)).map(([key,item])=>{const createdAt=Number(item.createdAt)||Number(item.confirmedAt)||1;return[key,{...item,id:item.id||key,createdAt,updatedAt:Number(item.updatedAt)||createdAt}]})):{};
  base.purchases=Array.isArray(value.purchases)?value.purchases.filter(p=>p&&p.id&&p.date&&Number(p.amount)>0).map(p=>{const createdAt=Number(p.createdAt)||1;const payment=['cash','merpay','paidy','legacy'].includes(p.payment)?p.payment:p.payment==='afterpay'?'legacy':'cash';return{...p,amount:Math.round(Number(p.amount)),payment,purpose:p.purpose==='essential'?'essential':p.purpose==='fixed'&&p.fixedCommitmentId&&['service','game-pass'].includes(p.fixedCategory)?'fixed':'impulse',medium:p.medium==='digital'?'digital':'physical',name:String(p.name||''),createdAt,updatedAt:Number(p.updatedAt)||createdAt}}):[];
  base.fixedCommitments=Array.isArray(value.fixedCommitments)?value.fixedCommitments.filter(item=>item&&item.id&&/^\d{4}-\d{2}$/.test(item.month)&&String(item.name||'').trim()&&Number.isFinite(Number(item.amount))&&Number(item.amount)>0&&['service','game-pass'].includes(item.category)).map(item=>({...item,id:String(item.id),name:String(item.name).trim().slice(0,80),amount:whole(item.amount),createdAt:Number(item.createdAt)||1,updatedAt:Number(item.updatedAt)||Number(item.createdAt)||1})):[];
  base.stoppedUrges=Array.isArray(value.stoppedUrges)?value.stoppedUrges.filter(item=>item&&item.id).map(item=>{const createdAt=Number(item.createdAt)||1;return{...item,holdActive:item.holdActive!==false,expiresOn:item.expiresOn||nextDateKey(item.date),createdAt,updatedAt:Number(item.updatedAt)||createdAt}}):[];
  base.recoverySnapshots=Array.isArray(value.recoverySnapshots)?value.recoverySnapshots.filter(s=>s&&s.id&&s.date&&Number(s.merpay)>=0&&Number(s.paidy)>=0).map(s=>{const createdAt=Number(s.createdAt)||1;return{...s,merpay:Math.round(Number(s.merpay)),paidy:Math.round(Number(s.paidy)),createdAt,updatedAt:Number(s.updatedAt)||createdAt}}):[];
  const realitySource=value.monthlyReality&&typeof value.monthlyReality==='object'?value.monthlyReality:{};
  base.monthlyReality=Object.fromEntries(Object.entries(realitySource).filter(([key,item])=>/^\d{4}-\d{2}$/.test(key)&&item).map(([key,item])=>{const createdAt=Number(item.createdAt)||1;return[key,{id:item.id||key,month:key,expectedIncomeRemaining:whole(item.expectedIncomeRemaining),expectedIncomeVerified:item.expectedIncomeVerified===true,legacyIncome:whole(item.legacyIncome??item.income),currentCash:whole(item.currentCash),merpayDue:whole(item.merpayDue),paidyDue:whole(item.paidyDue),otherDue:whole(item.otherDue),nextSalary:whole(item.nextSalary),createdAt,updatedAt:Number(item.updatedAt)||createdAt}]}));
  base.syncTests=Array.isArray(value.syncTests)?value.syncTests.slice(-20):[];
  base.updatedAt=Number(value.updatedAt)||Date.now();
  const impulseDates=new Map();
  base.purchases.filter(p=>p.purpose==='impulse').forEach(p=>impulseDates.set(p.date,Math.max(impulseDates.get(p.date)||0,p.updatedAt||p.createdAt)));
  Object.entries(base.days).forEach(([key,item])=>{if(item.status==='purchase'&&!impulseDates.has(key))delete base.days[key]});
  impulseDates.forEach((updatedAt,key)=>{const old=base.days[key];base.days[key]={id:key,status:'purchase',createdAt:old?.createdAt||updatedAt||1,confirmedAt:updatedAt||1,updatedAt:Math.max(old?.updatedAt||0,updatedAt||1)}});
  return base;
}
function whole(value){const number=Math.round(Number(value)||0);return Math.max(0,number)}
function loadStored(key,fallback){try{const raw=localStorage.getItem(key);return raw?normalize(JSON.parse(raw)):normalize(fallback)}catch(_){return normalize(fallback)}}
function save(options={}){
  data.version=6;data.updatedAt=Date.now();localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  if(!options.cloudApply&&typeof window.cloudSyncLocalChanged==='function')window.cloudSyncLocalChanged();
}
function commit(message){save();renderAll();if(message)toast(message)}
function uid(prefix='id'){return`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
function today(){const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate())}
function dateKey(date=today()){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function nextDateKey(key){if(!key)return'';const date=parseDate(key);date.setDate(date.getDate()+1);return dateKey(date)}
function parseDate(key){const[year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day)}
function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1)}
function monthKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function daysInMonth(date){return new Date(date.getFullYear(),date.getMonth()+1,0).getDate()}
function money(value){return`¥${Math.round(Number(value)||0).toLocaleString('ja-JP')}`}
function signedMoney(value){const amount=Math.round(Number(value)||0);return`${amount>0?'+':amount<0?'-':''}¥${Math.abs(amount).toLocaleString('ja-JP')}`}
function formatDate(key){const d=parseDate(key);return`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`}
function formatUpdated(value){return new Date(value).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function isPast(key){return key<dateKey()}
function isToday(key){return key===dateKey()}
function isFuture(key){return key>dateKey()}
function isStarted(key){return key>=START_DATE}
function isAfterpay(payment){return['merpay','paidy','legacy'].includes(payment)}
function paymentLabel(payment){return payment==='merpay'?'MERPAY':payment==='paidy'?'PAIDY':payment==='legacy'?'旧：後払い先未設定':'CASH'}
function activeHolds(key=dateKey()){return data.stoppedUrges.filter(item=>item.holdActive!==false&&item.date<=key&&key<(item.expiresOn||nextDateKey(item.date)))}
function monthRecords(key){
  const noBuy=Object.entries(data.days).filter(([date,state])=>date.startsWith(key)&&state?.status==='no-buy').length;
  const purchases=data.purchases.filter(item=>item.date.startsWith(key));
  const merpay=purchases.filter(item=>item.payment==='merpay').reduce((sum,item)=>sum+item.amount,0);
  const paidy=purchases.filter(item=>item.payment==='paidy').reduce((sum,item)=>sum+item.amount,0);
  const legacy=purchases.filter(item=>item.payment==='legacy').reduce((sum,item)=>sum+item.amount,0);
  const urges=data.stoppedUrges.filter(item=>String(item.date||'').startsWith(key));
  return{noBuy,purchases,merpay,paidy,legacy,afterpay:merpay+paidy+legacy,urges};
}
function summaryText(payload=data){
  const value=normalize(payload),months=new Set([...Object.keys(value.days).map(d=>d.slice(0,7)),...value.purchases.map(p=>p.date.slice(0,7)),...Object.keys(value.monthlyReality),...value.fixedCommitments.map(item=>item.month)]);
  return`記録月 ${months.size} / 購入 ${value.purchases.length}件 / STOP ${value.stoppedUrges.length}回 / 残高 ${value.recoverySnapshots.length}回 / 固定 ${value.fixedCommitments.length}項目`;
}

function reconcileDay(key){
  const impulses=data.purchases.filter(item=>item.date===key&&item.purpose==='impulse'),old=data.days[key],now=Date.now();
  if(impulses.length){data.days[key]={id:key,status:'purchase',createdAt:old?.createdAt||Math.min(...impulses.map(p=>p.createdAt||now)),confirmedAt:now,updatedAt:now}}
  else if(old?.status==='purchase')delete data.days[key];
}
function renderAll(){renderTodayStatus();renderCalendar();renderMetrics();renderHistory();renderRecovery();refreshFixedPicker();if(typeof window.cloudSyncRefreshPanel==='function')window.cloudSyncRefreshPanel()}
function renderTodayStatus(){
  const todayKey=dateKey(),todayPurchases=data.purchases.filter(item=>item.date===todayKey),impulse=todayPurchases.some(item=>item.purpose==='impulse'),todayAfterpay=todayPurchases.filter(item=>isAfterpay(item.payment)).reduce((sum,item)=>sum+item.amount,0),holds=activeHolds().length;
  const box=document.getElementById('todayStatus');box.classList.toggle('purchase-today',impulse);
  document.getElementById('todayStatusTitle').textContent=impulse?'PURCHASE RECORDED':'ZERO INTACT';
  document.getElementById('todayStatusCopy').textContent=impulse?'記録した。隠さなかった。それでいい。':holds?'一度止まれた。そのまま今日は保留だ。':'……まだゼロだ。そのまま守れ。';
  document.getElementById('todayAfterpay').textContent=money(todayAfterpay);document.getElementById('todayHolds').textContent=`${holds}件`;
}
function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();document.getElementById('calendarYear').textContent=year;document.getElementById('calendarTitle').textContent=MONTH_NAMES[month];
  const grid=document.getElementById('calendarGrid');grid.innerHTML='';const mondayOffset=(new Date(year,month,1).getDay()+6)%7;
  for(let i=0;i<mondayOffset;i++)grid.appendChild(dayButton(null,'empty'));
  for(let day=1;day<=daysInMonth(calendarCursor);day++){const current=new Date(year,month,day),key=dateKey(current),record=data.days[key];let state='future';if(!isStarted(key))state='prestart';else if(isToday(key))state=record?.status==='purchase'?'today purchase':record?.status==='no-buy'?'today no-buy':'today';else if(isFuture(key))state='future';else if(record?.status==='no-buy')state='no-buy';else if(record?.status==='purchase')state='purchase';else state='unconfirmed';grid.appendChild(dayButton(day,state,key))}
}
function dayButton(day,state,key){
  const button=document.createElement('button');button.type='button';button.className=`day ${state}`;if(day===null){button.tabIndex=-1;return button}
  const fixed=data.purchases.filter(p=>p.date===key&&p.purpose==='fixed'),service=fixed.some(p=>p.fixedCategory==='service'),pass=fixed.some(p=>p.fixedCategory==='game-pass'),provisional=fixed.length&&!state.includes('purchase')&&!state.includes('no-buy');
  if(fixed.length)button.classList.add('has-fixed');
  const mark=state.includes('purchase')?'¥':state.includes('no-buy')||provisional?'✓':state==='unconfirmed'?'?':'';
  button.innerHTML=`<span class="day-number">${day}</span>${mark?`<span class="day-mark ${provisional?'provisional':''}">${mark}</span>`:''}${fixed.length?`<span class="fixed-day-badges">${service?'<span>S</span>':''}${pass?'<span>P</span>':''}</span>`:''}`;
  if(key&&isStarted(key)&&!isFuture(key)){button.classList.add('actionable');button.setAttribute('aria-label',`${formatDate(key)} ${state}${service?' FIXED SERVICEあり':''}${pass?' FIXED GAME PASSあり':''}${provisional?' 記録上は衝動なし・NO BUY未確定':''}`);button.addEventListener('click',()=>openDayCheck(key))}return button;
}
function renderMetrics(){
  const key=monthKey(calendarCursor),records=monthRecords(key),holds=activeHolds().length;document.getElementById('noBuyCount').textContent=records.noBuy;document.getElementById('monthDays').textContent=`/ ${daysInMonth(calendarCursor)}`;document.getElementById('afterpayTotal').textContent=money(records.afterpay);document.getElementById('newMerpay').textContent=signedMoney(records.merpay);document.getElementById('newPaidy').textContent=signedMoney(records.paidy);document.getElementById('legacyAfterpay').textContent=signedMoney(records.legacy);document.getElementById('legacyAfterpayRow').hidden=!records.legacy;document.getElementById('urgeCount').textContent=data.stoppedUrges.length;document.getElementById('holdCount').textContent=holds;document.getElementById('holdCopy').textContent=holds?`現在進行中の保留が${holds}件。翌日には0へ戻る。`:'現在進行中の保留だけ。翌日には0へ戻る。';document.getElementById('holdMetric').classList.toggle('active',holds>0);
}
function renderHistory(){
  const list=document.getElementById('historyList'),keys=new Set([monthKey(today()),...Object.keys(data.days).map(d=>d.slice(0,7)),...data.purchases.map(p=>p.date.slice(0,7)),...data.stoppedUrges.map(u=>String(u.date).slice(0,7))]),months=[...keys].filter(k=>k>=START_DATE.slice(0,7)).sort().reverse();
  if(!months.length){list.innerHTML='<div class="history-empty">記録はまだない。</div>';return}
  list.innerHTML=months.map(key=>{const[year,month]=key.split('-').map(Number),records=monthRecords(key),rows=[...records.purchases].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(item=>`<div class="purchase-log-row"><time>${item.date.slice(5).replace('-',' / ')}</time><div><b>${escapeHtml(item.name||'購入記録')}</b><small>${purchasePurposeLabel(item)} · ${item.medium==='digital'?'デジタル・課金':'物理物'} · <strong class="payment-tag ${item.payment}">${paymentLabel(item.payment)}</strong></small><small>最終更新 ${escapeHtml(formatUpdated(item.updatedAt))}</small></div><strong>${money(item.amount)}</strong><button class="row-edit" type="button" data-edit-purchase="${escapeHtml(item.id)}">編集</button></div>`).join('');return`<article class="history-month"><div class="history-month-head"><h2>${year} · ${JP_MONTH_NAMES[month-1]}</h2><span>NO BUY ${records.noBuy}</span></div><div class="history-stats"><div><span>NO BUY DAYS</span><b>${records.noBuy}</b></div><div><span>NEW AFTERPAY</span><b>${money(records.afterpay)}</b><small>MERPAY ${signedMoney(records.merpay)} / PAIDY ${signedMoney(records.paidy)}</small></div><div><span>STOPPED URGES</span><b>${records.urges.length}</b></div></div><div class="purchase-log">${rows||'<div class="history-empty">購入記録なし</div>'}</div></article>`}).join('');
}

function sortedSnapshots(){return[...data.recoverySnapshots].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt)}
function purchasesSince(snapshot,payment){return snapshot?data.purchases.filter(p=>p.payment===payment&&Number(p.createdAt)>Number(snapshot.createdAt)).reduce((sum,p)=>sum+p.amount,0):0}
function balanceModel(payment){
  const snapshots=sortedSnapshots(),current=snapshots.at(-1),confirmed=current?whole(current[payment]):0,newSince=purchasesSince(current,payment);
  return{current,confirmed,newSince,estimated:confirmed+newSince};
}
function changeHtml(current,previous,key){if(!previous)return'<span class="balance-change flat">前回 —</span>';const diff=current[key]-previous[key],kind=diff>0?'up':diff===0?'flat':'';return`<span class="balance-change ${kind}">CHANGE ${signedMoney(diff)}</span>`}
function renderRecovery(){
  renderReality();renderFixedCommitments();
  const snapshots=sortedSnapshots(),current=snapshots.at(-1),previous=snapshots.at(-2),merpay=balanceModel('merpay'),paidy=balanceModel('paidy'),overview=document.getElementById('recoveryOverview');
  overview.innerHTML=`<article class="balance-card"><span>MERPAY</span><div class="balance-stack"><small>CONFIRMED BALANCE</small><strong>${money(merpay.confirmed)}</strong><small>NEW SINCE LAST CHECK</small><b>${signedMoney(merpay.newSince)}</b><small>ESTIMATED BALANCE <em>推定・参考値</em></small><strong class="estimated">${money(merpay.estimated)}</strong></div>${current?changeHtml(current,previous,'merpay'):'<span class="balance-change flat">未確認</span>'}</article><article class="balance-card"><span>PAIDY</span><div class="balance-stack"><small>CONFIRMED BALANCE</small><strong>${money(paidy.confirmed)}</strong><small>NEW SINCE LAST CHECK</small><b>${signedMoney(paidy.newSince)}</b><small>ESTIMATED BALANCE <em>推定・参考値</em></small><strong class="estimated">${money(paidy.estimated)}</strong></div>${current?changeHtml(current,previous,'paidy'):'<span class="balance-change flat">未確認</span>'}</article><article class="balance-card total"><span>CONFIRMED TOTAL</span><strong>${money(merpay.confirmed+paidy.confirmed)}</strong><div class="balance-previous">${current?`${formatDate(current.date)} 時点`:'実際の画面で確認した値を入力'}</div><span class="balance-change flat">ESTIMATED ${money(merpay.estimated+paidy.estimated)} · 推定</span></article>`;
  const history=document.getElementById('recoveryHistory');history.innerHTML=snapshots.length?[...snapshots].reverse().map((snapshot,reverseIndex)=>{const index=snapshots.length-1-reverseIndex,prior=index>0?snapshots[index-1]:null,total=snapshot.merpay+snapshot.paidy,diff=prior?total-(prior.merpay+prior.paidy):null;return`<div class="recovery-row"><time>${snapshot.date.replaceAll('-',' / ')}</time><div><span>MERPAY</span><b>${money(snapshot.merpay)}</b></div><div><span>PAIDY</span><b>${money(snapshot.paidy)}</b></div><div class="total-cell"><span>TOTAL / CHANGE</span><b>${money(total)}${diff===null?'':` · ${signedMoney(diff)}`}</b><small>最終更新 ${escapeHtml(formatUpdated(snapshot.updatedAt))}</small></div><button class="row-edit" type="button" data-edit-snapshot="${escapeHtml(snapshot.id)}">編集</button></div>`}).join(''):'<div class="history-empty">残高スナップショットはまだない。</div>';
  const dateInput=document.getElementById('balanceDate');dateInput.min=START_DATE;dateInput.max=dateKey();if(!dateInput.value)dateInput.value=dateKey();
}
function fixedCategoryLabel(category){return category==='game-pass'?'FIXED GAME PASS':'FIXED SERVICE'}
function purchasePurposeLabel(item){return item.purpose==='fixed'?fixedCategoryLabel(item.fixedCategory):item.purpose==='essential'?'必要':'趣味・衝動'}
function fixedMonthItems(month){return data.fixedCommitments.filter(item=>item.month===month).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))}
function fixedItemPurchases(item){return data.purchases.filter(p=>p.purpose==='fixed'&&p.fixedCommitmentId===item.id&&p.date.slice(0,7)===item.month)}
function fixedTotals(month){
  const items=fixedMonthItems(month),purchases=data.purchases.filter(p=>p.purpose==='fixed'&&p.date.slice(0,7)===month),service=items.filter(i=>i.category==='service').reduce((sum,i)=>sum+i.amount,0),gamePass=items.filter(i=>i.category==='game-pass').reduce((sum,i)=>sum+i.amount,0);
  return{registered:service+gamePass,service,gamePass,recorded:purchases.reduce((sum,p)=>sum+p.amount,0)};
}
function renderFixedCommitments(){
  const key=realityMonthValue(),totals=fixedTotals(key),items=fixedMonthItems(key);
  document.getElementById('fixedMonthLabel').textContent=key.replace('-',' / ');
  document.getElementById('plannedFixedSummary').innerHTML=`<span>PLANNED FIXED COMMITMENTS</span><strong>${money(totals.registered)}</strong><small>FIXED SERVICE ${money(totals.service)} · FIXED GAME PASS ${money(totals.gamePass)}</small><p>CURRENT REQUIRED PAYMENTSとは別の数字。今月の不足額へ自動加算しない。</p>`;
  document.getElementById('fixedTotals').innerHTML=`<div><span>REGISTERED</span><strong>${money(totals.registered)}</strong></div><div><span>RECORDED</span><strong>${money(totals.recorded)}</strong></div>`;
  document.getElementById('fixedList').innerHTML=items.length?items.map(item=>{const records=fixedItemPurchases(item),actual=records.reduce((sum,p)=>sum+p.amount,0);return`<div class="fixed-row"><div><b>${escapeHtml(item.name)}</b><small>${fixedCategoryLabel(item.category)}</small><small>${records.length?'記録済み':'未記録'}${records.length?` · 実績 ${money(actual)}`:''}${records.length>1?' · 複数記録あり（HISTORYで確認）':''}</small></div><strong>${money(item.amount)}</strong><button class="row-edit" type="button" data-edit-fixed="${escapeHtml(item.id)}">編集</button></div>`}).join(''):'<p class="fixed-empty">この月の事前登録項目はない。</p>';
  if(!editingFixedId&&!document.getElementById('fixedMonth').value)document.getElementById('fixedMonth').value=key;
}
function resetFixedForm(){editingFixedId=null;document.getElementById('fixedForm').reset();document.getElementById('fixedMonth').value=realityMonthValue();document.getElementById('fixedSubmit').textContent='固定項目を登録';document.getElementById('cancelFixedEdit').hidden=true;document.getElementById('deleteFixed').hidden=true;document.getElementById('fixedError').textContent=''}
function editFixed(id){
  const item=data.fixedCommitments.find(i=>i.id===id);if(!item)return;editingFixedId=id;document.getElementById('fixedName').value=item.name;document.getElementById('fixedAmount').value=item.amount;document.getElementById('fixedCategory').value=item.category;document.getElementById('fixedMonth').value=item.month;document.getElementById('fixedSubmit').textContent='登録内容を訂正';document.getElementById('cancelFixedEdit').hidden=false;document.getElementById('deleteFixed').hidden=false;document.getElementById('fixedError').textContent='';document.getElementById('fixedForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function needsFixedWarning(month){return month<monthKey(today())||(month===monthKey(today())&&today().getDate()>1)}
function saveFixed(event){
  event.preventDefault();const form=new FormData(event.currentTarget),name=String(form.get('fixedName')||'').trim(),month=String(form.get('fixedMonth')||''),category=String(form.get('fixedCategory')||''),amount=Number(form.get('fixedAmount')),now=Date.now(),old=data.fixedCommitments.find(i=>i.id===editingFixedId);
  if(!name||name.length>80||!/^\d{4}-\d{2}$/.test(month)||month<START_DATE.slice(0,7)||!Number.isSafeInteger(amount)||amount<1||!['service','game-pass'].includes(category)){document.getElementById('fixedError').textContent='名称、対象月、分類、1円以上の整数金額を確認してくれ。';return}
  if(editingFixedId&&!old){document.getElementById('fixedError').textContent='この項目は別端末で削除された。編集をやめて一覧を確認してくれ。';return}
  const entry={id:old?.id||uid('fixed'),name,month,category,amount,createdAt:old?.createdAt||now,updatedAt:now};
  const expands=!old||old.month!==month||old.name!==name||old.category!==category||amount>old.amount;
  if(expands&&needsFixedWarning(month)){pendingFixedEntry={entry,editing:!!old,baseUpdatedAt:old?.updatedAt};showModal('fixedConfirmModal');return}
  commitFixed(entry,!!old);
}
function commitFixed(entry,editing){
  if(editing&&!data.fixedCommitments.some(i=>i.id===entry.id)){toast('この項目は既に削除されている。登録一覧を確認してくれ。');return}
  if(editing)data.fixedCommitments=data.fixedCommitments.map(i=>i.id===entry.id?entry:i);else data.fixedCommitments.push(entry);
  document.getElementById('realityMonth').value=entry.month;resetFixedForm();commit('事前に把握している固定支出を記録した。追加購入の許可ではない。');loadRealityForm();
}
function confirmFixedEntry(){
  const draft=pendingFixedEntry;if(!draft)return;const current=data.fixedCommitments.find(i=>i.id===draft.entry.id);pendingFixedEntry=null;hideModal('fixedConfirmModal');
  if(draft.editing&&(!current||current.updatedAt!==draft.baseUpdatedAt)){toast('確認中に別端末で項目が変更された。一覧から編集し直してくれ。');return}
  commitFixed({...draft.entry,updatedAt:Date.now()},draft.editing);
}
function deleteFixed(){
  const item=data.fixedCommitments.find(i=>i.id===editingFixedId);if(!item||!window.confirm('この固定項目を削除する？\n実際の購入履歴と後払い額は残る。実績の訂正はHISTORYから行う。'))return;
  data.fixedCommitments=data.fixedCommitments.filter(i=>i.id!==item.id);resetFixedForm();commit('固定項目を削除した。実際に支払った記録は残している。');
}
function refreshFixedPicker(){
  const form=document.getElementById('purchaseForm'),isFixed=form.elements.purpose.value==='fixed',select=document.getElementById('purchaseFixedId'),oldSelection=select.value,key=(document.getElementById('purchaseDate').value||dateKey()).slice(0,7),editing=data.purchases.find(p=>p.id===editingPurchaseId);
  document.getElementById('fixedPurchaseFields').hidden=!isFixed;select.required=isFixed;select.disabled=!isFixed;
  if(!isFixed)return;
  const items=fixedMonthItems(key),options=items.map(item=>{const used=fixedItemPurchases(item).some(p=>p.id!==editingPurchaseId);return`<option value="${escapeHtml(item.id)}"${used?' disabled':''}>${escapeHtml(item.name)} · ${money(item.amount)}${used?' · 記録済み':''}</option>`});
  const orphan=editing?.purpose==='fixed'&&editing.date.slice(0,7)===key&&!items.some(i=>i.id===editing.fixedCommitmentId);
  if(orphan)options.push(`<option value="${escapeHtml(editing.fixedCommitmentId)}">${escapeHtml(editing.fixedName||editing.name)} · 元の登録は削除／対象月変更済み</option>`);
  select.innerHTML='<option value="">支払った登録項目を選ぶ</option>'+options.join('');
  select.value=oldSelection;
  document.getElementById('fixedPurchaseHelp').textContent=items.length?'登録した項目だけを選ぶ。同じ項目の訂正はHISTORYから。固定でも後払いは加算する。':'この月に登録済みの項目はない。固定項目の登録はRECOVERY側で事前に行う。単発パック・追加課金は趣味・衝動買いだ。';
}
function selectFixedPurchase(){
  const item=data.fixedCommitments.find(i=>i.id===document.getElementById('purchaseFixedId').value);if(!item)return;
  document.getElementById('purchaseAmount').value=item.amount;document.getElementById('purchaseName').value=item.name;document.querySelector('input[name="medium"][value="digital"]').checked=true;
}
function realityMonthValue(){return document.getElementById('realityMonth').value||monthKey(today())}
function realityNumbers(item){const value=item||{},cash=whole(value.currentCash),expected=whole(value.expectedIncomeRemaining),available=cash+expected,required=whole(value.merpayDue)+whole(value.paidyDue)+whole(value.otherDue),difference=available-required,shortage=Math.min(0,difference),covered=Math.max(0,difference);return{cash,expected,available,required,difference,shortage,covered}}
function renderReality(){
  const monthInput=document.getElementById('realityMonth');if(!monthInput.value)monthInput.value=monthKey(today());const key=monthInput.value,item=data.monthlyReality[key],summary=document.getElementById('realitySummary');
  if(!item){summary.innerHTML='<div><span>CURRENT CASH</span><strong>—</strong></div><div><span>EXPECTED INCOME REMAINING</span><strong>—</strong></div><div><span>AVAILABLE THIS MONTH</span><strong>—</strong></div><div><span>CURRENT REQUIRED PAYMENTS</span><strong>—</strong></div><div class="shortage"><span>PROJECTED SHORTAGE</span><strong>未登録</strong></div>';return}
  const totals=realityNumbers(item),needsCheck=!item.expectedIncomeVerified,resultLabel=totals.shortage<0?'PROJECTED SHORTAGE':'COVERED',resultValue=totals.shortage<0?signedMoney(totals.shortage):money(totals.covered);summary.innerHTML=`<div><span>CURRENT CASH</span><strong>${money(totals.cash)}</strong></div><div class="${needsCheck?'needs-check':''}"><span>EXPECTED INCOME REMAINING</span><strong>${needsCheck?'要確認':money(totals.expected)}</strong></div><div><span>AVAILABLE THIS MONTH</span><strong>${money(totals.available)}</strong></div><div><span>CURRENT REQUIRED PAYMENTS</span><strong>${money(totals.required)}</strong></div><div class="shortage ${totals.shortage<0?'danger':'covered'}"><span>${resultLabel}</span><strong>${resultValue}</strong></div><small>${needsCheck?'「今月これから入る予定額」は未確認。旧収入額を除外して計算している。 ':''}来月の給料見込みは今月の計算へ加算しない。最終更新 ${escapeHtml(formatUpdated(item.updatedAt))}</small>`;
}
function loadRealityForm(){
  renderFixedCommitments();
  const key=realityMonthValue(),item=data.monthlyReality[key]||{},form=document.getElementById('realityForm');['expectedIncomeRemaining','currentCash','merpayDue','paidyDue','otherDue','nextSalary'].forEach(name=>{form.elements[name].value=name==='expectedIncomeRemaining'&&item.id&&!item.expectedIncomeVerified?'':item[name]??''});document.getElementById('realityError').textContent='';renderReality();
}
function saveReality(event){
  event.preventDefault();const form=new FormData(event.currentTarget),key=realityMonthValue(),now=Date.now(),old=data.monthlyReality[key];if(!/^\d{4}-\d{2}$/.test(key)||key<START_DATE.slice(0,7)){document.getElementById('realityError').textContent='対象月を確認してくれ。';return}
  const entry={id:key,month:key,expectedIncomeRemaining:whole(form.get('expectedIncomeRemaining')),expectedIncomeVerified:true,legacyIncome:whole(old?.legacyIncome),currentCash:whole(form.get('currentCash')),merpayDue:whole(form.get('merpayDue')),paidyDue:whole(form.get('paidyDue')),otherDue:whole(form.get('otherDue')),nextSalary:whole(form.get('nextSalary')),createdAt:old?.createdAt||now,updatedAt:now};
  data.monthlyReality[key]=entry;document.getElementById('realityError').textContent='';commit('MONTHLY REALITYを更新した。現実の数字は、君を止めるために使う。');
}
function resetBalanceForm(){editingSnapshotId=null;document.getElementById('balanceForm').reset();document.getElementById('balanceDate').value=dateKey();document.getElementById('balanceSubmit').textContent='スナップショットを保存';document.getElementById('cancelBalanceEdit').hidden=true;document.getElementById('deleteSnapshot').hidden=true;document.getElementById('balanceError').textContent=''}
function editSnapshot(id){const item=data.recoverySnapshots.find(s=>s.id===id);if(!item)return;editingSnapshotId=id;document.getElementById('balanceDate').value=item.date;document.getElementById('merpayBalance').value=item.merpay;document.getElementById('paidyBalance').value=item.paidy;document.getElementById('balanceSubmit').textContent='変更を保存';document.getElementById('cancelBalanceEdit').hidden=false;document.getElementById('deleteSnapshot').hidden=false;document.querySelector('.balance-entry').scrollIntoView({behavior:'smooth',block:'start'})}
function saveBalance(event){
  event.preventDefault();const form=new FormData(event.currentTarget),date=String(form.get('date')||''),merpay=Math.round(Number(form.get('merpay'))),paidy=Math.round(Number(form.get('paidy')));
  if(!date||date<START_DATE||date>dateKey()||!Number.isFinite(merpay)||!Number.isFinite(paidy)||merpay<0||paidy<0){document.getElementById('balanceError').textContent='日付と、0円以上の現在残高を入力してくれ。';return}
  const now=Date.now(),old=data.recoverySnapshots.find(s=>s.id===editingSnapshotId),entry={id:old?.id||uid('balance'),date,merpay,paidy,createdAt:old?.createdAt||now,updatedAt:now};if(old)data.recoverySnapshots=data.recoverySnapshots.map(s=>s.id===old.id?entry:s);else data.recoverySnapshots.push(entry);resetBalanceForm();commit(old?'残高スナップショットを訂正した。':'現在残高を記録した。以後の新規後払いだけを推定へ加える。');
}
function deleteSnapshot(id){const item=data.recoverySnapshots.find(s=>s.id===id);if(!item||!window.confirm('この残高スナップショットを削除する？\n現在残高・前回差額・推定値が再計算されます。'))return;data.recoverySnapshots=data.recoverySnapshots.filter(s=>s.id!==id);if(editingSnapshotId===id)resetBalanceForm();commit('残高スナップショットを削除し、表示を再計算した。')}

function showModal(id){document.getElementById(id)?.classList.add('show');document.body.style.overflow='hidden'}
function hideModal(element){const modal=typeof element==='string'?document.getElementById(element):element.closest('.modal');modal?.classList.remove('show');if(modal?.id==='purchaseModal')resetPurchaseForm();if(modal?.id==='fixedConfirmModal')pendingFixedEntry=null;if(!document.querySelector('.modal.show'))document.body.style.overflow=''}
function openDayCheck(key){selectedDay=key;const yesterday=new Date(today());yesterday.setDate(yesterday.getDate()-1);const dailyPurchases=data.purchases.filter(item=>item.date===key),essential=dailyPurchases.filter(item=>item.purpose==='essential').length;document.getElementById('dayModalTitle').textContent=key===dateKey(yesterday)?'昨日、趣味・衝動買いをしましたか？':'この日の状態を訂正する。';document.getElementById('dayModalDate').textContent=`${formatDate(key)} · ${data.days[key]?.status==='no-buy'?'NO BUY記録済み':data.days[key]?.status==='purchase'?'趣味・衝動購入あり':'未確定'}${essential?` · 必要品 ${essential}件`:''}`;document.getElementById('dayModalDate').textContent+=dailyPurchases.some(p=>p.purpose==='fixed')?' · 固定支出あり（衝動買いとは別）':'';document.getElementById('clearDayStatus').hidden=!data.days[key];showModal('dayModal')}
function confirmNoBuy(){
  if(!selectedDay||(!isPast(selectedDay)&&!isToday(selectedDay)))return;const impulse=data.purchases.filter(item=>item.date===selectedDay&&item.purpose==='impulse');if(impulse.length){toast('趣味・衝動の購入記録がある。先にHISTORYから修正または削除してくれ。');return}const now=Date.now();data.days[selectedDay]={id:selectedDay,status:'no-buy',createdAt:data.days[selectedDay]?.createdAt||now,confirmedAt:now,updatedAt:now};hideModal('dayModal');commit();showAchievement();setJulius('不要な買い物を増やさなかった。それで十分だ。');
}
function clearDayStatus(){if(!selectedDay)return;const impulse=data.purchases.some(item=>item.date===selectedDay&&item.purpose==='impulse');if(impulse){toast('購入ログが残っている。この日は未確定へ戻せない。');return}delete data.days[selectedDay];hideModal('dayModal');commit('日付の確定を解除した。もう一度、正しい状態を選べる。')}
function resetPurchaseForm(){editingPurchaseId=null;document.getElementById('purchaseForm').reset();document.getElementById('purchaseTitle').textContent='いくら使った？';document.getElementById('purchaseSubmit').textContent='記録する';document.getElementById('deletePurchase').hidden=true;document.getElementById('purchaseError').textContent='';document.getElementById('fixedPurchaseFields').hidden=true;document.getElementById('purchaseFixedId').required=false;document.getElementById('purchaseFixedId').disabled=true}
function openPurchase(key=dateKey(),id=null){
  hideModal('dayModal');resetPurchaseForm();const item=id?data.purchases.find(p=>p.id===id):null;editingPurchaseId=item?.id||null;const input=document.getElementById('purchaseDate');input.value=item?.date||key;input.min=START_DATE;input.max=dateKey();document.getElementById('purchaseAmount').value=item?.amount||'';document.getElementById('purchaseName').value=item?.name||'';document.querySelector(`input[name="purpose"][value="${item?.purpose||'impulse'}"]`).checked=true;const payment=['cash','merpay','paidy'].includes(item?.payment)?item.payment:'cash';document.querySelector(`input[name="payment"][value="${payment}"]`).checked=true;document.querySelector(`input[name="medium"][value="${item?.medium||'physical'}"]`).checked=true;document.getElementById('purchaseTitle').textContent=item?'購入記録を訂正する。':'いくら使った？';document.getElementById('purchaseSubmit').textContent=item?'変更を保存':'記録する';document.getElementById('deletePurchase').hidden=!item;refreshFixedPicker();if(item?.purpose==='fixed')document.getElementById('purchaseFixedId').value=item.fixedCommitmentId;showModal('purchaseModal');setTimeout(()=>document.getElementById('purchaseAmount').focus(),80)
}
function savePurchase(event){
  event.preventDefault();const form=new FormData(event.currentTarget),amount=Math.round(Number(form.get('amount'))),date=String(form.get('date')||''),payment=String(form.get('payment')||'cash'),purpose=String(form.get('purpose')||'impulse'),medium=String(form.get('medium')||'physical'),name=String(form.get('name')||'').trim();
  if(!Number.isSafeInteger(amount)||amount<1){document.getElementById('purchaseError').textContent='金額を1円以上で入力してくれ。';return}if(!date||date<START_DATE||date>dateKey()){document.getElementById('purchaseError').textContent='記録できる日付を確認してくれ。';return}if(!['cash','merpay','paidy'].includes(payment)){document.getElementById('purchaseError').textContent='支払い方法を選んでくれ。';return}
  const fixedId=String(form.get('fixedCommitmentId')||''),oldFixed=data.purchases.find(p=>p.id===editingPurchaseId),fixed=data.fixedCommitments.find(i=>i.id===fixedId&&i.month===date.slice(0,7));
  const retained=oldFixed?.purpose==='fixed'&&fixedId===oldFixed.fixedCommitmentId&&date.slice(0,7)===oldFixed.date.slice(0,7);
  if(purpose==='fixed'&&(!fixed&&!retained)){document.getElementById('purchaseError').textContent='購入月の事前登録済み固定項目を選んでくれ。未登録の単発購入は趣味・衝動買いだ。';return}
  if(purpose==='fixed'&&data.purchases.some(p=>p.id!==editingPurchaseId&&p.purpose==='fixed'&&p.fixedCommitmentId===fixedId&&p.date.slice(0,7)===date.slice(0,7))){document.getElementById('purchaseError').textContent='この項目は記録済みだ。追加購入へ転用せず、訂正はHISTORYから行ってくれ。';return}
  if(editingPurchaseId&&!oldFixed){document.getElementById('purchaseError').textContent='この記録は別端末で削除された。履歴を確認してくれ。';return}
  const fixedFields=purpose==='fixed'?{fixedCommitmentId:fixedId,fixedCategory:retained?oldFixed.fixedCategory:fixed.category,fixedName:retained?oldFixed.fixedName||oldFixed.name:fixed.name}:{};
  const now=Date.now(),old=data.purchases.find(p=>p.id===editingPurchaseId),oldDate=old?.date,entry={id:old?.id||uid('purchase'),date,amount,payment,purpose:['essential','fixed'].includes(purpose)?purpose:'impulse',...fixedFields,medium:medium==='digital'?'digital':'physical',name,createdAt:old?.createdAt||now,updatedAt:now};if(old)data.purchases=data.purchases.map(p=>p.id===old.id?entry:p);else data.purchases.push(entry);if(oldDate)reconcileDay(oldDate);reconcileDay(date);hideModal('purchaseModal');commit(old?'購入記録を訂正し、関連集計を再計算した。':purpose==='fixed'?'事前登録済みの支出だ。記録した。':purpose==='essential'?'必要な買い物として記録した。NO BUY資格は失わない。':'記録した。隠さなかった。それでいい。');setJulius(purpose==='fixed'?(isAfterpay(payment)?'これは予定していた固定分だ。だが、後払いなら未来の支払いは増えている。':'事前登録済みの支出だ。ここから先の追加課金は許可できない。'):purpose==='essential'?'必要なものは、必要だ。事実だけ残しておけばいい。':'今日は購入日だ。明日はまたNO BUYを取ればいい。');
}
function deletePurchase(){
  const item=data.purchases.find(p=>p.id===editingPurchaseId);if(!item||!window.confirm('この購入記録を削除する？\n関連するNEW AFTERPAYや日別状態も再計算されます。'))return;data.purchases=data.purchases.filter(p=>p.id!==item.id);reconcileDay(item.date);hideModal('purchaseModal');commit('購入記録を削除し、後払い額と日別状態を再計算した。')
}
function showAchievement(){const box=document.getElementById('achievement');clearTimeout(achievementTimer);box.classList.add('show');achievementTimer=setTimeout(()=>box.classList.remove('show'),2100)}
function setJulius(message){document.getElementById('juliusLine').textContent=message}

const urgeQuestions=[{id:'need',text:'それは今日必要なものか？',answers:[['needed','必要'],['want','趣味・欲しいだけ']]},{id:'money',text:'今ある金だけで買えるか？',answers:[['cash','買える'],['afterpay','後払いが必要']]},{id:'space',text:'置く場所は既に空いているか？',answers:[['yes','ある'],['no','ない']]}];
function currentReality(){return data.monthlyReality[monthKey(today())]||null}
function realityCheck(){
  const item=currentReality();if(!item)return{item:null,required:0,cash:0,expected:0,available:0,shortage:0,covered:0};return{item,...realityNumbers(item)};
}
function varied(list){return list[(data.stoppedUrges.length+today().getDate())%list.length]}
function openUrge(){urgeAnswers={};document.getElementById('urgePortrait').src='./assets/julius/think.png';document.getElementById('urgeResult').hidden=true;renderUrgeQuestions();showModal('urgeModal')}
function renderUrgeQuestions(){document.getElementById('urgeQuestions').innerHTML=urgeQuestions.map((question,index)=>`<section class="urge-question"><span>QUESTION 0${index+1}</span><h3>${question.text}</h3><div class="answer-grid">${question.answers.map(([value,label])=>`<button type="button" class="answer-button ${urgeAnswers[question.id]===value?'selected':''}" data-question="${question.id}" data-answer="${value}">${label}</button>`).join('')}</div></section>`).join('');document.querySelectorAll('.answer-button').forEach(button=>button.addEventListener('click',()=>{urgeAnswers[button.dataset.question]=button.dataset.answer;renderUrgeQuestions();if(Object.keys(urgeAnswers).length===3)renderUrgeResult()}))}
function renderUrgeResult(){
  const want=urgeAnswers.need==='want',afterpay=urgeAnswers.money==='afterpay',noSpace=urgeAnswers.space==='no',reality=realityCheck(),veryDangerous=want&&afterpay&&reality.shortage<0,dangerous=afterpay||want||noSpace,result=document.getElementById('urgeResult');result.hidden=false;result.className=`urge-result ${dangerous?'danger':''}`;document.getElementById('urgePortrait').src=dangerous?'./assets/julius/stern.png':'./assets/julius/normal.png';
  let title='今すぐ決める必要はない。',lines=['今日は保留して、明日もう一度考えろ。'];
  if(veryDangerous){title='駄目だ、ジーク。';lines=[`現在の手持ち${money(reality.cash)}と、今月これから入る予定額${money(reality.expected)}を合わせても、必須支払いに${money(Math.abs(reality.shortage))}足りない。`,varied(['今見るべきなのは商品の割引額ではない。今月の不足額だ。','今月は既に、予定収入を含めても必須支払いへ届かない。ここへ新しい買い物を足す余裕はない。']), '商品ページを閉じろ。今日は買うな。']}
  else if(afterpay){title='……許可できない。';lines=['後払いを増やさないためにZERO ROOMを作ったはずだ。','欲しい物が悪いのではない。今買うのが駄目だ。',varied(["『後払いなら払える』は、今の君には『払える』ではない。未来の給料へ支払いを送っているだけだ。",'安い商品と、今の君に買える商品は同じではない。','崩すのは財布ではなく、後払い返済額だ。'])]}
  else if(dangerous){title='今日は保留だ。';lines=[noSpace?'置く場所がない物を、今増やす理由はない。':'欲しいだけなら、今日である必要はない。',varied(['多少高くても、本当に使う物の方が、使わない安物より遥かに安い。','ZERO ROOMを作ったのは、今日その一周を始めないためだ。'])]}
  if(want)lines.push(varied(['固定支出を認めたことは、追加購入の許可ではない。','固定分を使わなかったからといって、その金額を別の商品へ回していいわけではない。','登録した月パス以外の単発課金は、予定外の購入だ。今日は買うな。']));
  const planned=fixedTotals(monthKey(today())).registered;if(reality.shortage<0&&planned>0)lines.push(`今月は既に不足している上、登録済み固定支出は${money(planned)}ある。請求との二重計上を避け、不足額とは別に示している。`);
  if(reality.item&&reality.item.nextSalary>0)lines.push('来月の給料は、今月の欲しい物のための金ではない。');
  result.innerHTML=`<h3>${escapeHtml(title)}</h3>${lines.map(line=>`<p>${escapeHtml(line)}</p>`).join('')}<button type="button" id="holdUrge">${dangerous?'今日は保留にする':'10分、保留にする'}</button>`;document.getElementById('holdUrge').addEventListener('click',()=>recordStoppedUrge('quiz',urgeAnswers));result.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function recordStoppedUrge(source,answers=null){const now=Date.now(),date=dateKey();data.stoppedUrges.push({id:uid('urge'),date,source,answers:answers?{...answers}:null,holdActive:true,expiresOn:nextDateKey(date),createdAt:now,updatedAt:now});hideModal(source==='quiz'?'urgeModal':'stopModal');commit('HOLD +1 · 衝動を翌日まで保留した。');setJulius('一度止まれた。それで十分だ。')}
function emergencyStop(){const now=Date.now(),date=dateKey(),reality=realityCheck();data.stoppedUrges.push({id:uid('urge'),date,source:'emergency',answers:null,holdActive:true,expiresOn:nextDateKey(date),createdAt:now,updatedAt:now});commit();document.getElementById('stopReality').textContent=reality.shortage<0?`今月これから入る予定の金を含めても、必須支払いに${money(Math.abs(reality.shortage))}足りない。今日は買うな。`:'';showModal('stopModal');setJulius('今日は買うな。この衝動は明日に回せ。')}

function setView(view){document.querySelectorAll('.view').forEach(item=>item.classList.toggle('active',item.id===`${view}View`));document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='history')renderHistory();if(view==='recovery'){renderRecovery();loadRealityForm()}}
function toast(message){const box=document.getElementById('toast');clearTimeout(toastTimer);box.textContent=message;box.classList.add('show');toastTimer=setTimeout(()=>box.classList.remove('show'),3200)}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function backup(){const payload={...data,app:'JULIUS ZERO ROOM',appVersion:APP_VERSION,exportedAt:new Date().toISOString()},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`julius_zero_room_${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importBackup(file){if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||(!parsed.days&&!parsed.purchases))throw new Error('invalid');if(!window.confirm('本番データをJSONの内容で置き換える。よいか？'))return;localStorage.setItem(`${STORAGE_KEY}_before_import`,JSON.stringify(data));data=normalize(parsed);commit('JSONバックアップを読み込んだ。')}catch(_){toast('このJSONは読み込めない。内容を確認してくれ。')}finally{document.getElementById('importInput').value=''}}
function applyCloudData(payload){data=normalize(payload);localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll();offerRealityMigration()}
function setSyncState(state,label){const dot=document.getElementById('syncDot'),text=document.getElementById('syncLabel');dot.dataset.state=state;dot.title=label||state;text.textContent=String(label||state).toUpperCase()}

function bindEvents(){
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>hideModal(button)));document.querySelectorAll('.modal:not(.locked-modal)').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)hideModal(modal.id)}));document.addEventListener('keydown',event=>{if(event.key==='Escape'){const modal=document.querySelector('.modal.show:not(.locked-modal)');if(modal)hideModal(modal.id)}});
  document.getElementById('prevMonth').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();renderMetrics()});document.getElementById('nextMonth').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();renderMetrics()});document.getElementById('purchaseButton').addEventListener('click',()=>openPurchase());document.getElementById('confirmPurchase').addEventListener('click',()=>openPurchase(selectedDay));document.getElementById('confirmNoBuy').addEventListener('click',confirmNoBuy);document.getElementById('clearDayStatus').addEventListener('click',clearDayStatus);document.getElementById('purchaseForm').addEventListener('submit',savePurchase);document.getElementById('deletePurchase').addEventListener('click',deletePurchase);document.getElementById('urgeButton').addEventListener('click',openUrge);document.getElementById('stopButton').addEventListener('click',emergencyStop);
  document.getElementById('balanceForm').addEventListener('submit',saveBalance);document.getElementById('cancelBalanceEdit').addEventListener('click',resetBalanceForm);document.getElementById('deleteSnapshot').addEventListener('click',()=>editingSnapshotId&&deleteSnapshot(editingSnapshotId));document.getElementById('realityForm').addEventListener('submit',saveReality);document.getElementById('realityMonth').addEventListener('change',()=>{resetFixedForm();loadRealityForm()});
  document.getElementById('fixedForm').addEventListener('submit',saveFixed);document.getElementById('fixedList').addEventListener('click',event=>{const button=event.target.closest('[data-edit-fixed]');if(button)editFixed(button.dataset.editFixed)});
  document.getElementById('cancelFixedEdit').addEventListener('click',resetFixedForm);document.getElementById('deleteFixed').addEventListener('click',deleteFixed);document.getElementById('confirmFixedEntry').addEventListener('click',confirmFixedEntry);
  document.querySelectorAll('input[name="purpose"]').forEach(input=>input.addEventListener('change',refreshFixedPicker));document.getElementById('purchaseDate').addEventListener('change',()=>{document.getElementById('purchaseFixedId').value='';refreshFixedPicker()});document.getElementById('purchaseFixedId').addEventListener('change',selectFixedPurchase);
  document.getElementById('historyList').addEventListener('click',event=>{const button=event.target.closest('[data-edit-purchase]');if(button)openPurchase(dateKey(),button.dataset.editPurchase)});document.getElementById('recoveryHistory').addEventListener('click',event=>{const button=event.target.closest('[data-edit-snapshot]');if(button)editSnapshot(button.dataset.editSnapshot)});
  document.getElementById('settingsButton').addEventListener('click',()=>{showModal('settingsModal');if(typeof window.cloudSyncRefreshPanel==='function')window.cloudSyncRefreshPanel()});document.getElementById('exportButton').addEventListener('click',backup);document.getElementById('importInput').addEventListener('change',event=>importBackup(event.target.files?.[0]));
  document.getElementById('ackRealityMigration').addEventListener('click',()=>{localStorage.setItem(REALITY_MIGRATION_KEY,'1');hideModal('realityMigrationModal');setView('recovery');document.querySelector('.monthly-reality')?.scrollIntoView({behavior:'smooth',block:'start'})});
}
function offerRealityMigration(){if(pendingRealityMigration&&!realityMigrationOffered&&localStorage.getItem(REALITY_MIGRATION_KEY)!=='1'){realityMigrationOffered=true;setTimeout(()=>showModal('realityMigrationModal'),250)}}
function offerPreviousDay(){if(pendingRealityMigration&&localStorage.getItem(REALITY_MIGRATION_KEY)!=='1')return;const yesterday=new Date(today());yesterday.setDate(yesterday.getDate()-1);const key=dateKey(yesterday);if(isStarted(key)&&!data.days[key])setTimeout(()=>openDayCheck(key),450)}
function registerServiceWorker(){if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}

window.ZeroRoom={APP_VERSION,STORAGE_KEY,getData:()=>data,replaceData:applyCloudData,save,renderAll,summaryText,normalize,realityNumbers,activeHolds,dateKey:()=>dateKey(today()),uid,toast,backup,setSyncState,showCloudChoice:body=>{document.getElementById('cloudChoiceBody').innerHTML=body;showModal('cloudChoiceModal')},hideCloudChoice:()=>hideModal('cloudChoiceModal')};
bindEvents();renderAll();loadRealityForm();offerRealityMigration();offerPreviousDay();registerServiceWorker();
})();
