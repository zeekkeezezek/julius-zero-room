(function(){
'use strict';

const APP_VERSION='0.3.0';
const STORAGE_KEY='julius_zero_room_v1';
const START_DATE='2026-09-01';
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const JP_MONTH_NAMES=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
let data=loadStored(STORAGE_KEY,emptyData());
localStorage.removeItem('julius_zero_room_demo_v02');
localStorage.removeItem('julius_zero_room_demo_mode');
let calendarCursor=startOfMonth(today());
let selectedDay=null;
let toastTimer=null;
let achievementTimer=null;

function emptyData(){return{version:3,days:{},purchases:[],stoppedUrges:[],recoverySnapshots:[],syncTests:[],updatedAt:Date.now()}}
function normalize(input){
  const base=emptyData(),value=input&&typeof input==='object'?input:{};
  base.days=value.days&&typeof value.days==='object'?Object.fromEntries(Object.entries(value.days).map(([key,item])=>{const createdAt=Number(item?.createdAt)||Number(item?.confirmedAt)||1;return[key,{...item,id:item?.id||key,createdAt,updatedAt:Number(item?.updatedAt)||createdAt}]})):{};
  base.purchases=Array.isArray(value.purchases)?value.purchases.filter(p=>p&&p.id&&p.date&&Number(p.amount)>0).map(p=>{const createdAt=Number(p.createdAt)||1;return{...p,amount:Math.round(Number(p.amount)),payment:p.payment==='afterpay'?'afterpay':'cash',purpose:p.purpose==='essential'?'essential':'impulse',medium:p.medium==='digital'?'digital':'physical',createdAt,updatedAt:Number(p.updatedAt)||createdAt}}):[];
  base.stoppedUrges=Array.isArray(value.stoppedUrges)?value.stoppedUrges.filter(Boolean).map(item=>{const createdAt=Number(item.createdAt)||1;return{...item,holdActive:item.holdActive!==false,expiresOn:item.expiresOn||nextDateKey(item.date),createdAt,updatedAt:Number(item.updatedAt)||createdAt}}):[];
  base.recoverySnapshots=Array.isArray(value.recoverySnapshots)?value.recoverySnapshots.filter(s=>s&&s.id&&s.date&&Number(s.merpay)>=0&&Number(s.paidy)>=0).map(s=>{const createdAt=Number(s.createdAt)||1;return{...s,merpay:Math.round(Number(s.merpay)),paidy:Math.round(Number(s.paidy)),createdAt,updatedAt:Number(s.updatedAt)||createdAt}}):[];
  base.syncTests=Array.isArray(value.syncTests)?value.syncTests.slice(-20):[];
  base.updatedAt=Number(value.updatedAt)||Date.now();
  return base;
}
function loadStored(key,fallback){try{const raw=localStorage.getItem(key);return raw?normalize(JSON.parse(raw)):normalize(fallback)}catch(_){return normalize(fallback)}}
function save(options={}){
  data.updatedAt=Date.now();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
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
function isPast(key){return key<dateKey()}
function isToday(key){return key===dateKey()}
function isFuture(key){return key>dateKey()}
function isStarted(key){return key>=START_DATE}
function activeHolds(){const key=dateKey();return data.stoppedUrges.filter(item=>item.holdActive!==false&&item.date<=key&&key<(item.expiresOn||nextDateKey(item.date)))}
function monthRecords(key){
  const noBuy=Object.entries(data.days).filter(([date,state])=>date.startsWith(key)&&state?.status==='no-buy').length;
  const purchases=data.purchases.filter(item=>item.date.startsWith(key));
  const afterpay=purchases.filter(item=>item.payment==='afterpay').reduce((sum,item)=>sum+item.amount,0);
  const urges=data.stoppedUrges.filter(item=>String(item.date||'').startsWith(key));
  return{noBuy,purchases,afterpay,urges};
}
function summaryText(payload=data){
  const value=normalize(payload),months=new Set([...Object.keys(value.days).map(d=>d.slice(0,7)),...value.purchases.map(p=>p.date.slice(0,7))]);
  return`記録月 ${months.size} / 購入 ${value.purchases.length}件 / STOP ${value.stoppedUrges.length}回 / 残高 ${value.recoverySnapshots.length}回`;
}

function renderAll(){renderTodayStatus();renderCalendar();renderMetrics();renderHistory();renderRecovery();if(typeof window.cloudSyncRefreshPanel==='function')window.cloudSyncRefreshPanel()}
function renderTodayStatus(){
  const todayKey=dateKey(),todayPurchases=data.purchases.filter(item=>item.date===todayKey),impulse=todayPurchases.some(item=>item.purpose==='impulse'),todayAfterpay=todayPurchases.filter(item=>item.payment==='afterpay').reduce((sum,item)=>sum+item.amount,0),holds=activeHolds().length;
  const box=document.getElementById('todayStatus');box.classList.toggle('purchase-today',impulse);
  document.getElementById('todayStatusTitle').textContent=impulse?'PURCHASE RECORDED':'ZERO INTACT';
  document.getElementById('todayStatusCopy').textContent=impulse?'記録した。隠さなかった。それでいい。':holds?'一度止まれた。そのまま今日は保留だ。':'……まだゼロだ。そのまま守れ。';
  document.getElementById('todayAfterpay').textContent=money(todayAfterpay);document.getElementById('todayHolds').textContent=`${holds}件`;
}
function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();document.getElementById('calendarYear').textContent=year;document.getElementById('calendarTitle').textContent=MONTH_NAMES[month];
  const grid=document.getElementById('calendarGrid');grid.innerHTML='';const mondayOffset=(new Date(year,month,1).getDay()+6)%7;
  for(let i=0;i<mondayOffset;i++)grid.appendChild(dayButton(null,'empty'));
  for(let day=1;day<=daysInMonth(calendarCursor);day++){
    const current=new Date(year,month,day),key=dateKey(current),record=data.days[key];let state='future';
    if(!isStarted(key))state='prestart';else if(isToday(key))state=record?.status==='purchase'?'today purchase':'today';else if(isFuture(key))state='future';else if(record?.status==='no-buy')state='no-buy';else if(record?.status==='purchase')state='purchase';else state='unconfirmed';
    grid.appendChild(dayButton(day,state,key));
  }
}
function dayButton(day,state,key){
  const button=document.createElement('button');button.type='button';button.className=`day ${state}`;if(day===null){button.tabIndex=-1;return button}
  button.innerHTML=`<span class="day-number">${day}</span>${state.includes('no-buy')?'<span class="day-mark">✓</span>':state.includes('purchase')?'<span class="day-mark">¥</span>':state==='unconfirmed'?'<span class="day-mark">?</span>':''}`;
  if(key&&isStarted(key)&&!isFuture(key)){button.classList.add('actionable');button.setAttribute('aria-label',`${formatDate(key)} ${state}`);button.addEventListener('click',()=>isToday(key)?openPurchase(key):openDayCheck(key))}return button;
}
function renderMetrics(){
  const key=monthKey(calendarCursor),records=monthRecords(key),holds=activeHolds().length;document.getElementById('noBuyCount').textContent=records.noBuy;document.getElementById('monthDays').textContent=`/ ${daysInMonth(calendarCursor)}`;document.getElementById('afterpayTotal').textContent=money(records.afterpay);document.getElementById('urgeCount').textContent=records.urges.length;document.getElementById('holdCount').textContent=holds;document.getElementById('holdCopy').textContent=holds?`購入衝動を${holds}件、翌日まで保留中。`:'現在進行中の保留はない。';document.getElementById('holdMetric').classList.toggle('active',holds>0);
}
function renderHistory(){
  const list=document.getElementById('historyList'),keys=new Set([monthKey(today()),...Object.keys(data.days).map(d=>d.slice(0,7)),...data.purchases.map(p=>p.date.slice(0,7)),...data.stoppedUrges.map(u=>String(u.date).slice(0,7))]),months=[...keys].filter(k=>k>=START_DATE.slice(0,7)).sort().reverse();
  if(!months.length){list.innerHTML='<div class="history-empty">記録はまだない。</div>';return}
  list.innerHTML=months.map(key=>{const[year,month]=key.split('-').map(Number),records=monthRecords(key),rows=[...records.purchases].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(item=>`<div class="purchase-log-row"><time>${item.date.slice(5).replace('-',' / ')}</time><div><b>${escapeHtml(item.name||'購入記録')}</b><small>${item.purpose==='essential'?'必要':'趣味・衝動'} · ${item.medium==='digital'?'デジタル・課金':'物理物'} · ${item.payment==='afterpay'?'後払い・分割':'即時払い'}</small></div><strong>${money(item.amount)}</strong></div>`).join('');return`<article class="history-month"><div class="history-month-head"><h2>${year} · ${JP_MONTH_NAMES[month-1]}</h2><span>NO BUY ${records.noBuy}</span></div><div class="history-stats"><div><span>NO BUY DAYS</span><b>${records.noBuy}</b></div><div><span>NEW AFTERPAY</span><b>${money(records.afterpay)}</b></div><div><span>STOPPED URGES</span><b>${records.urges.length}</b></div></div><div class="purchase-log">${rows||'<div class="history-empty">購入記録なし</div>'}</div></article>`}).join('');
}

function sortedSnapshots(){return[...data.recoverySnapshots].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt)}
function changeHtml(current,previous,key){if(!previous)return'<span class="balance-change flat">前回 —</span>';const diff=current[key]-previous[key],kind=diff>0?'up':diff===0?'flat':'';return`<span class="balance-change ${kind}">CHANGE ${signedMoney(diff)}</span>`}
function renderRecovery(){
  const snapshots=sortedSnapshots(),current=snapshots.at(-1),previous=snapshots.at(-2),overview=document.getElementById('recoveryOverview');
  if(!current){overview.innerHTML='<article class="balance-card"><span>MERPAY</span><strong>¥0</strong><div class="balance-previous">まだスナップショットがない。</div></article><article class="balance-card"><span>PAIDY</span><strong>¥0</strong><div class="balance-previous">現在残高を手入力してくれ。</div></article><article class="balance-card total"><span>TOTAL</span><strong>¥0</strong><div class="balance-previous">自動計算は行わない。</div></article>'}
  else{overview.innerHTML=`<article class="balance-card"><span>MERPAY</span><strong>${money(current.merpay)}</strong><div class="balance-previous">前回 ${previous?money(previous.merpay):'—'}</div>${changeHtml(current,previous,'merpay')}</article><article class="balance-card"><span>PAIDY</span><strong>${money(current.paidy)}</strong><div class="balance-previous">前回 ${previous?money(previous.paidy):'—'}</div>${changeHtml(current,previous,'paidy')}</article><article class="balance-card total"><span>TOTAL</span><strong>${money(current.merpay+current.paidy)}</strong><div class="balance-previous">${formatDate(current.date)} 時点</div>${previous?`<span class="balance-change ${(current.merpay+current.paidy)>(previous.merpay+previous.paidy)?'up':(current.merpay+current.paidy)===(previous.merpay+previous.paidy)?'flat':''}">CHANGE ${signedMoney((current.merpay+current.paidy)-(previous.merpay+previous.paidy))}</span>`:'<span class="balance-change flat">最初の記録</span>'}</article>`}
  const history=document.getElementById('recoveryHistory');history.innerHTML=snapshots.length?[...snapshots].reverse().map((snapshot,reverseIndex)=>{const index=snapshots.length-1-reverseIndex,prior=index>0?snapshots[index-1]:null,total=snapshot.merpay+snapshot.paidy,diff=prior?total-(prior.merpay+prior.paidy):null;return`<div class="recovery-row"><time>${snapshot.date.replaceAll('-',' / ')}</time><div><span>MERPAY</span><b>${money(snapshot.merpay)}</b></div><div><span>PAIDY</span><b>${money(snapshot.paidy)}</b></div><div class="total-cell"><span>TOTAL / CHANGE</span><b>${money(total)}${diff===null?'':` · ${signedMoney(diff)}`}</b></div></div>`}).join(''):'<div class="history-empty">残高スナップショットはまだない。</div>';
  const dateInput=document.getElementById('balanceDate');dateInput.min=START_DATE;dateInput.max=dateKey();if(!dateInput.value)dateInput.value=dateKey();
}
function saveBalance(event){
  event.preventDefault();const form=new FormData(event.currentTarget),date=String(form.get('date')||''),merpay=Math.round(Number(form.get('merpay'))),paidy=Math.round(Number(form.get('paidy')));
  if(!date||date<START_DATE||date>dateKey()||!Number.isFinite(merpay)||!Number.isFinite(paidy)||merpay<0||paidy<0){document.getElementById('balanceError').textContent='日付と、0円以上の現在残高を入力してくれ。';return}
  const now=Date.now();data.recoverySnapshots.push({id:uid('balance'),date,merpay,paidy,createdAt:now,updatedAt:now});document.getElementById('balanceError').textContent='';commit('現在残高を記録した。減った量も、増えた量も事実として残す。');document.getElementById('merpayBalance').value='';document.getElementById('paidyBalance').value='';
}

function showModal(id){document.getElementById(id)?.classList.add('show');document.body.style.overflow='hidden'}
function hideModal(element){const modal=typeof element==='string'?document.getElementById(element):element.closest('.modal');modal?.classList.remove('show');if(!document.querySelector('.modal.show'))document.body.style.overflow=''}
function openDayCheck(key){selectedDay=key;const yesterday=new Date(today());yesterday.setDate(yesterday.getDate()-1);const dailyPurchases=data.purchases.filter(item=>item.date===key),essential=dailyPurchases.filter(item=>item.purpose==='essential').length;document.getElementById('dayModalTitle').textContent=key===dateKey(yesterday)?'昨日、趣味・衝動買いをしましたか？':'この日、趣味・衝動買いをしましたか？';document.getElementById('dayModalDate').textContent=`${formatDate(key)} · ${data.days[key]?.status==='no-buy'?'NO BUY記録済み':data.days[key]?.status==='purchase'?'趣味・衝動購入あり':'未確定'}${essential?` · 必要品 ${essential}件`:''}`;showModal('dayModal')}
function confirmNoBuy(){
  if(!selectedDay||!isPast(selectedDay))return;const impulse=data.purchases.filter(item=>item.date===selectedDay&&item.purpose==='impulse');if(impulse.length&&!window.confirm('この日の趣味・衝動購入記録だけを削除し、NO BUYへ変更する。必要品の記録は残す。よいか？'))return;if(impulse.length)data.purchases=data.purchases.filter(item=>!(item.date===selectedDay&&item.purpose==='impulse'));const now=Date.now();data.days[selectedDay]={id:selectedDay,status:'no-buy',createdAt:data.days[selectedDay]?.createdAt||now,confirmedAt:now,updatedAt:now};hideModal('dayModal');commit();showAchievement();setJulius('不要な買い物を増やさなかった。それで十分だ。');
}
function openPurchase(key=dateKey()){hideModal('dayModal');const input=document.getElementById('purchaseDate');input.value=key;input.min=START_DATE;input.max=dateKey();document.getElementById('purchaseAmount').value='';document.getElementById('purchaseName').value='';document.querySelector('input[name="purpose"][value="impulse"]').checked=true;document.querySelector('input[name="payment"][value="cash"]').checked=true;document.querySelector('input[name="medium"][value="physical"]').checked=true;document.getElementById('purchaseError').textContent='';showModal('purchaseModal');setTimeout(()=>document.getElementById('purchaseAmount').focus(),80)}
function savePurchase(event){
  event.preventDefault();const form=new FormData(event.currentTarget),amount=Math.round(Number(form.get('amount'))),date=String(form.get('date')||''),payment=String(form.get('payment')||'cash'),purpose=String(form.get('purpose')||'impulse'),medium=String(form.get('medium')||'physical'),name=String(form.get('name')||'').trim();
  if(!amount||amount<1){document.getElementById('purchaseError').textContent='金額を1円以上で入力してくれ。';return}if(!date||date<START_DATE||date>dateKey()){document.getElementById('purchaseError').textContent='記録できる日付を確認してくれ。';return}
  const now=Date.now();data.purchases.push({id:uid('purchase'),date,amount,payment:payment==='afterpay'?'afterpay':'cash',purpose:purpose==='essential'?'essential':'impulse',medium:medium==='digital'?'digital':'physical',name:name||'',createdAt:now,updatedAt:now});if(purpose!=='essential')data.days[date]={id:date,status:'purchase',createdAt:data.days[date]?.createdAt||now,confirmedAt:now,updatedAt:now};hideModal('purchaseModal');commit(purpose==='essential'?'必要な買い物として記録した。NO BUY資格は失わない。':'記録した。隠さなかった。それでいい。');setJulius(purpose==='essential'?'必要なものは、必要だ。事実だけ残しておけばいい。':'今日は購入日だ。明日はまたNO BUYを取ればいい。');
}
function showAchievement(){const box=document.getElementById('achievement');clearTimeout(achievementTimer);box.classList.add('show');achievementTimer=setTimeout(()=>box.classList.remove('show'),2100)}
function setJulius(message){document.getElementById('juliusLine').textContent=message}

const urgeQuestions=[{id:'need',text:'それは今日必要なものか？',answers:[['needed','必要'],['want','趣味・欲しいだけ']]},{id:'money',text:'今ある金だけで買えるか？',answers:[['cash','買える'],['afterpay','後払いが必要']]},{id:'space',text:'置く場所は既に空いているか？',answers:[['yes','ある'],['no','ない']]}];
let urgeAnswers={};
function openUrge(){urgeAnswers={};document.getElementById('urgePortrait').src='./assets/julius/think.png';document.getElementById('urgeResult').hidden=true;renderUrgeQuestions();showModal('urgeModal')}
function renderUrgeQuestions(){document.getElementById('urgeQuestions').innerHTML=urgeQuestions.map((question,index)=>`<section class="urge-question"><span>QUESTION 0${index+1}</span><h3>${question.text}</h3><div class="answer-grid">${question.answers.map(([value,label])=>`<button type="button" class="answer-button ${urgeAnswers[question.id]===value?'selected':''}" data-question="${question.id}" data-answer="${value}">${label}</button>`).join('')}</div></section>`).join('');document.querySelectorAll('.answer-button').forEach(button=>button.addEventListener('click',()=>{urgeAnswers[button.dataset.question]=button.dataset.answer;renderUrgeQuestions();if(Object.keys(urgeAnswers).length===3)renderUrgeResult()}))}
function renderUrgeResult(){const risk=urgeAnswers.need==='want'||urgeAnswers.money==='afterpay'||urgeAnswers.space==='no',result=document.getElementById('urgeResult');result.hidden=false;result.className=`urge-result ${risk?'danger':''}`;document.getElementById('urgePortrait').src=risk?'./assets/julius/stern.png':'./assets/julius/normal.png';result.innerHTML=risk?'<h3>……許可できない。</h3><p>今買う条件が揃っていない。今日は保留だ。</p><button type="button" id="holdUrge">今日は保留にする</button>':'<h3>条件は揃っている。</h3><p>だが、今すぐである必要はない。まず10分置け。</p><button type="button" id="holdUrge">10分、保留にする</button>';document.getElementById('holdUrge').addEventListener('click',()=>recordStoppedUrge('quiz',urgeAnswers));result.scrollIntoView({behavior:'smooth',block:'nearest'})}
function recordStoppedUrge(source,answers=null){const now=Date.now(),date=dateKey();data.stoppedUrges.push({id:uid('urge'),date,source,answers:answers?{...answers}:null,holdActive:true,expiresOn:nextDateKey(date),createdAt:now,updatedAt:now});hideModal(source==='quiz'?'urgeModal':'stopModal');commit('HOLD +1 · 衝動を翌日まで保留した。');setJulius('一度止まれた。それで十分だ。')}
function emergencyStop(){const now=Date.now(),date=dateKey();data.stoppedUrges.push({id:uid('urge'),date,source:'emergency',answers:null,holdActive:true,expiresOn:nextDateKey(date),createdAt:now,updatedAt:now});commit();showModal('stopModal');setJulius('今日は買うな。この衝動は明日に回せ。')}

function setView(view){document.querySelectorAll('.view').forEach(item=>item.classList.toggle('active',item.id===`${view}View`));document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='history')renderHistory();if(view==='recovery')renderRecovery()}
function toast(message){const box=document.getElementById('toast');clearTimeout(toastTimer);box.textContent=message;box.classList.add('show');toastTimer=setTimeout(()=>box.classList.remove('show'),2800)}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function backup(){const payload={...data,app:'JULIUS ZERO ROOM',appVersion:APP_VERSION,exportedAt:new Date().toISOString()},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`julius_zero_room_${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importBackup(file){if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||(!parsed.days&&!parsed.purchases))throw new Error('invalid');if(!window.confirm('本番データをJSONの内容で置き換える。よいか？'))return;localStorage.setItem(`${STORAGE_KEY}_before_import`,JSON.stringify(data));data=normalize(parsed);commit('JSONバックアップを読み込んだ。')}catch(_){toast('このJSONは読み込めない。内容を確認してくれ。')}finally{document.getElementById('importInput').value=''}}
function applyCloudData(payload){data=normalize(payload);localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function setSyncState(state,label){const dot=document.getElementById('syncDot'),text=document.getElementById('syncLabel');dot.dataset.state=state;dot.title=label||state;text.textContent=String(label||state).toUpperCase()}

function bindEvents(){
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>hideModal(button)));document.querySelectorAll('.modal:not(.locked-modal)').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)hideModal(modal.id)}));document.addEventListener('keydown',event=>{if(event.key==='Escape'){const modal=document.querySelector('.modal.show:not(.locked-modal)');if(modal)hideModal(modal.id)}});
  document.getElementById('prevMonth').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();renderMetrics()});document.getElementById('nextMonth').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();renderMetrics()});document.getElementById('purchaseButton').addEventListener('click',()=>openPurchase());document.getElementById('confirmPurchase').addEventListener('click',()=>openPurchase(selectedDay));document.getElementById('confirmNoBuy').addEventListener('click',confirmNoBuy);document.getElementById('purchaseForm').addEventListener('submit',savePurchase);document.getElementById('urgeButton').addEventListener('click',openUrge);document.getElementById('stopButton').addEventListener('click',emergencyStop);document.getElementById('balanceForm').addEventListener('submit',saveBalance);
  document.getElementById('settingsButton').addEventListener('click',()=>{showModal('settingsModal');if(typeof window.cloudSyncRefreshPanel==='function')window.cloudSyncRefreshPanel()});document.getElementById('exportButton').addEventListener('click',backup);document.getElementById('importInput').addEventListener('change',event=>importBackup(event.target.files?.[0]));
}
function offerPreviousDay(){const yesterday=new Date(today());yesterday.setDate(yesterday.getDate()-1);const key=dateKey(yesterday);if(isStarted(key)&&!data.days[key])setTimeout(()=>openDayCheck(key),450)}
function registerServiceWorker(){if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}

window.ZeroRoom={APP_VERSION,STORAGE_KEY,getData:()=>data,replaceData:applyCloudData,save,renderAll,summaryText,normalize,dateKey:()=>dateKey(today()),uid,toast,backup,setSyncState,showCloudChoice:body=>{document.getElementById('cloudChoiceBody').innerHTML=body;showModal('cloudChoiceModal')},hideCloudChoice:()=>hideModal('cloudChoiceModal')};
bindEvents();renderAll();offerPreviousDay();registerServiceWorker();
})();
