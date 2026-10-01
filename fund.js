(function(){
'use strict';
const Z=window.ZeroRoom,$=id=>document.getElementById(id),esc=Z.escapeHtml;
const FUND_ID='ai-pc';
const LOCATIONS={envelope:'封筒',account:'別口座',other:'その他'};
const SOURCES={regular:'通常積立',sale:'不用品売却',secured:'衝動買いを見送った分を実際に確保',income:'臨時収入',other:'その他'};
let editor=null,settingsEditor=null;
function fund(){return Z.getData().goalFunds.find(item=>item.id===FUND_ID)||{id:FUND_ID,fundName:'AI・PC強化基金',targetAmount:null,storageLocation:'envelope',createdAt:0,updatedAt:0}}
function records(){return Z.getData().goalFundTransactions.filter(item=>item.fundId===FUND_ID)}
// The ledger is the sole balance source. HOLD and purchase totals never contribute.
function summary(month=Z.dateKey().slice(0,7),items=records()){
 const currentAmount=items.reduce((total,item)=>total+(item.transactionType==='deposit'?item.amount:-item.amount),0);
 const deposits=items.filter(item=>item.date.startsWith(month)&&item.transactionType==='deposit').reduce((total,item)=>total+item.amount,0);
 const withdrawals=items.filter(item=>item.date.startsWith(month)&&item.transactionType==='withdrawal').reduce((total,item)=>total+item.amount,0);
 return{currentAmount,deposits,withdrawals,net:deposits-withdrawals};
}
function milestone(amount){return[5000,10000,20000,30000,50000,100000,200000,300000,500000].find(value=>value>amount)||((Math.floor(amount/100000)+1)*100000)}
function positive(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>Z.dateKey())return false;const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day);return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day}
function signed(value){return`${value>=0?'+':'−'}${Z.money(Math.abs(value))}`}
function refresh(){
 const config=fund(),s=summary(),next=milestone(s.currentAmount),month=Number(Z.dateKey().slice(5,7));
 $('fundName').textContent=config.fundName;$('fundCurrent').textContent=Z.money(s.currentAmount);
 $('fundMonthLabel').textContent=`${month}月の積立`;$('fundMonthDeposits').textContent=signed(s.deposits);
 $('fundMonthDetail').textContent=`取り崩し ${Z.money(s.withdrawals)} · 差し引き ${signed(s.net)}`;
 $('fundStorageLabel').textContent=`主な保管場所：${LOCATIONS[config.storageLocation]}`;
 $('fundMilestone').textContent=s.currentAmount<0?'履歴の差し引きがマイナスだ。実際の保管額と履歴を確認してくれ。':`あと${Z.money(next-s.currentAmount)}で${Z.money(next)}。`;
 $('fundTargetDisplay').hidden=!config.targetAmount;
 if(config.targetAmount){const percent=s.currentAmount/config.targetAmount*100;$('fundTargetCopy').textContent=`目標 ${Z.money(config.targetAmount)} · 達成率 ${percent.toFixed(1)}%`;$('fundProgress').value=Math.min(100,Math.max(0,percent));$('fundProgress').setAttribute('aria-label',`目標額への達成率 ${percent.toFixed(1)}%`)}
 const items=records().slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt||a.id.localeCompare(b.id));
 $('fundHistoryCount').textContent=`${items.length}件`;
 $('fundHistoryList').innerHTML=items.length?items.map(item=>`<article class="fund-history-row"><div><time>${esc(item.date.replaceAll('-','/'))}</time><b>${item.transactionType==='deposit'?'積立':'取り崩し'}</b><small>${item.transactionType==='deposit'?esc(SOURCES[item.source]||item.source)+' · ':''}保管：${LOCATIONS[item.storageLocation]}</small>${item.memo?`<p>${esc(item.memo)}</p>`:''}</div><strong class="${item.transactionType==='deposit'?'fund-plus':'fund-minus'}">${signed(item.transactionType==='deposit'?item.amount:-item.amount)}</strong><button type="button" class="row-edit" data-fund-edit="${esc(item.id)}">訂正</button></article>`).join(''):'<p class="fund-empty">まだ積立の記録はない。封筒や別口座へ実際に移した金を、ここに残せる。</p>';
}
function open(type='deposit',id=null){
 const old=id?records().find(item=>item.id===id):null;if(id&&!old)return;
 editor={id:old?.id||Z.uid('fundtx'),updatedAt:old?.updatedAt??null,transactionType:old?.transactionType||type};
 $('fundTransactionForm').reset();$('fundTransactionTitle').textContent=old?'積立履歴を訂正する。':type==='deposit'?'実際に残した金を記録する。':'取り崩した金を記録する。';
 $('fundTransactionType').value=editor.transactionType;
 $('fundAmount').value=old?.amount||'';$('fundDate').value=old?.date||Z.dateKey();$('fundDate').max=Z.dateKey();
 $('fundSource').value=old&&Object.hasOwn(SOURCES,old.source)?old.source:'regular';
 $('fundLocation').value=old?.storageLocation||fund().storageLocation;$('fundMemo').value=old?.memo||'';
 $('fundTransactionSubmit').textContent=old?'変更を保存':'記録する';$('fundTransactionError').textContent='';
 $('fundDeleteActions').hidden=!old;$('fundDeleteConfirm').hidden=true;updateType();Z.showModal('fundTransactionModal');
}
function updateType(){const deposit=$('fundTransactionType').value==='deposit';$('fundSourceField').hidden=!deposit;$('fundSource').disabled=!deposit;$('fundTransactionHelp').textContent=deposit?'封筒・別口座などへ、実際に分けて確保した金額を入力する。':'実際に保管場所から出した金額を入力する。取り崩しは必要な出入りの記録だ。';$('fundMemoLabel').textContent=deposit?'メモ（任意）':'理由・メモ（任意）'}
function saveTransaction(event){
 event.preventDefault();if(!editor)return;const form=new FormData(event.currentTarget),amount=positive(form.get('amount')),date=String(form.get('date')||''),transactionType=String(form.get('transactionType')||''),source=String(form.get('source')||'other'),storageLocation=String(form.get('storageLocation')||''),memo=String(form.get('memo')||'').trim().slice(0,500),error=$('fundTransactionError');
 const old=records().find(item=>item.id===editor.id);
 if((editor.updatedAt!==null&&(!old||old.updatedAt!==editor.updatedAt))||(editor.updatedAt===null&&old)){error.textContent='この履歴は別の操作で変更された。履歴を開き直してくれ。';return}
 if(!amount||!validDate(date)||!['deposit','withdrawal'].includes(transactionType)||!Object.hasOwn(LOCATIONS,storageLocation)||(transactionType==='deposit'&&!Object.hasOwn(SOURCES,source))){error.textContent='1円以上の整数、今日までの日付、積立元・保管場所を確認してくれ。';return}
 const now=Math.max(Date.now(),(old?.updatedAt||0)+1),entry={id:editor.id,fundId:FUND_ID,transactionType,amount,date,source:transactionType==='deposit'?source:'withdrawal',storageLocation,memo,createdAt:old?.createdAt||now,updatedAt:now};
 const candidate=records().filter(item=>item.id!==entry.id).concat(entry),balance=summary(undefined,candidate).currentAmount;
 if(!Number.isSafeInteger(balance)){error.textContent='金額が大きすぎる。入力額を確認してくれ。';return}
 if(balance<0){error.textContent='取り崩しが積立残高を超える。金額と履歴を確認してくれ。';return}
 if(old)Z.getData().goalFundTransactions=Z.getData().goalFundTransactions.map(item=>item.id===entry.id?entry:item);else Z.getData().goalFundTransactions.push(entry);
 editor=null;Z.hideModal('fundTransactionModal');persist(old?'積立履歴を訂正した。':transactionType==='deposit'?'実際に確保した金を記録した。':'取り崩しを記録した。現在の額へ反映した。');
}
function deleteTransaction(){
 if(!editor)return;const old=records().find(item=>item.id===editor.id),error=$('fundTransactionError');
 if(!old||old.updatedAt!==editor.updatedAt){error.textContent='この履歴は別の操作で変更された。履歴を開き直してくれ。';return}
 if(summary(undefined,records().filter(item=>item.id!==old.id)).currentAmount<0){error.textContent='この記録だけを削除すると残高がマイナスになる。関連する取り崩しを先に訂正してくれ。';return}
 Z.getData().goalFundTransactions=Z.getData().goalFundTransactions.filter(item=>item.id!==old.id);editor=null;Z.hideModal('fundTransactionModal');persist('積立履歴を削除し、現在の額を再計算した。');
}
function openSettings(){const config=fund();settingsEditor=config.updatedAt;$('fundTargetAmount').value=config.targetAmount??'';$('fundDefaultLocation').value=config.storageLocation;$('fundSettingsError').textContent='';Z.showModal('fundSettingsModal')}
function saveSettings(event){
 event.preventDefault();if(settingsEditor===null)return;const config=fund(),form=new FormData(event.currentTarget),raw=String(form.get('targetAmount')||'').trim(),targetAmount=raw?positive(raw):null,storageLocation=String(form.get('storageLocation')||''),error=$('fundSettingsError');
 if(config.updatedAt!==settingsEditor){error.textContent='基金設定が別の操作で変更された。開き直してくれ。';return}
 if((raw&&!targetAmount)||!Object.hasOwn(LOCATIONS,storageLocation)){error.textContent='目標額は空欄か1円以上の整数にし、保管場所を選んでくれ。';return}
 const now=Math.max(Date.now(),config.updatedAt+1),entry={...config,targetAmount,storageLocation,createdAt:config.createdAt||now,updatedAt:now};
 const data=Z.getData();if(data.goalFunds.some(item=>item.id===FUND_ID))data.goalFunds=data.goalFunds.map(item=>item.id===FUND_ID?entry:item);else data.goalFunds.push(entry);
 settingsEditor=null;Z.hideModal('fundSettingsModal');persist('目標額と保管場所を保存した。');
}
function comparisonHtml(amount){
 const balance=summary().currentAmount,candidate=positive(amount);
 return`<section class="fund-comparison" aria-label="目標積立との比較"><span>GOAL FUND · 現在積立</span><strong>${Z.money(balance)}</strong>${candidate?`<p>今回の${Z.money(candidate)}${balance>0?`は、現在積立額の約${(candidate/balance*100).toFixed(1)}%に相当する。`:'を実際に別に確保すれば、未来へ残す金になる。'}</p>${balance>=0&&Number.isSafeInteger(balance+candidate)?`<p class="fund-comparison-note">実際に${Z.money(candidate)}を積み立てた場合：${Z.money(balance+candidate)}。見送りだけでは増えない。</p>`:''}`:'<p class="fund-comparison-note">実際に分けて確保した現金だけ。見送りだけでは増えない。</p>'}<small>返済を優先する。余剰現金だけを未来へ残す。</small></section>`;
}
function persist(message){Z.save();Z.renderAll();Z.toast(message)}
$('fundDeposit').addEventListener('click',()=>open('deposit'));$('fundWithdrawal').addEventListener('click',()=>open('withdrawal'));
$('fundHistoryButton').addEventListener('click',()=>{$('fundHistory').open=true;$('fundHistory').scrollIntoView({behavior:'smooth',block:'start'})});
$('fundSettingsButton').addEventListener('click',openSettings);$('fundSettingsForm').addEventListener('submit',saveSettings);
$('fundTransactionForm').addEventListener('submit',saveTransaction);$('fundTransactionType').addEventListener('change',updateType);
$('fundHistoryList').addEventListener('click',event=>{const button=event.target.closest('[data-fund-edit]');if(button)open('deposit',button.dataset.fundEdit)});
document.querySelectorAll('[data-fund-quick]').forEach(button=>button.addEventListener('click',()=>{$('fundAmount').value=button.dataset.fundQuick}));
$('fundDelete').addEventListener('click',()=>{$('fundDeleteConfirm').hidden=false});$('fundDeleteCancel').addEventListener('click',()=>{$('fundDeleteConfirm').hidden=true});$('fundDeleteConfirmed').addEventListener('click',deleteTransaction);
window.ZeroFund={refresh,summary,fund,open,openSettings,saveSettings,saveTransaction,deleteTransaction,comparisonHtml,milestone};
refresh();
})();
