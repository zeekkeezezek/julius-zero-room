(function(){
'use strict';
const Z=window.ZeroRoom,M=window.ZeroSubscriptionModel,$=id=>document.getElementById(id),esc=Z.escapeHtml;
const STATUS={active:'ACTIVE',paused:'PAUSED',cancelled:'CANCELLED'},PAYMENT={cash:'今ある金',merpay:'MERPAY',paidy:'PAIDY'};
let editor=null;
function records(){return Z.getData().subscriptions}
function get(id){return records().find(item=>item.id===id)}
function fromFixedId(id){return records().find(item=>'subscription:'+item.id===id)}
function matchingPayment(item,purchase){return purchase.purpose==='fixed'&&(purchase.subscriptionId===item.id||purchase.fixedCommitmentId==='subscription:'+item.id||item.sourceFixedIds.includes(purchase.fixedCommitmentId))}
function paymentOn(item,date,exceptId){return Z.getData().purchases.find(p=>p.id!==exceptId&&p.date===date&&matchingPayment(item,p))}
function nextPurchaseId(id,date){const base='purchase_subscription_'+id+'_'+date;let candidate=base,index=0;while(Z.getData().purchases.some(p=>p.id===candidate&&p.date!==date))candidate=base+'_'+(++index);return candidate}
function periodLabel(item){return item.cycle==='monthly'?'MONTH':item.cycle==='yearly'?'YEAR':`${item.intervalDays} DAYS`}
function renewalLabel(item){return item.cycle==='monthly'?`毎月${item.renewalDay}日`:item.cycle==='yearly'?`毎年 ${item.renewalDate.slice(5).replace('-','/')}`:`${item.intervalDays}日ごと`}
function refresh(){
 const items=records(),s=M.totals(items,Z.dateKey());
 $('subscriptionMonthly').textContent=Z.money(s.monthlyEquivalent);$('subscriptionActive').textContent=s.active;$('subscriptionYearly').textContent=Z.money(s.yearlyEstimate);
 $('subscriptionBreakdown').textContent=`月額契約 ${Z.money(s.monthly)} / 年額契約 ${Z.money(s.yearly)}`;
 $('subscriptionNext').textContent=s.next?s.next.date.replaceAll('-','/'):'—';$('subscriptionNextName').textContent=s.next?s.next.item.name:'予定なし';$('subscriptionNextAmount').textContent=s.next?Z.money(s.next.item.amount):'—';
 const sorted=[...s.upcoming.map(row=>row.item),...items.filter(item=>item.status!=='active').sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))];
 $('subscriptionList').innerHTML=sorted.length?sorted.map(item=>{const next=M.nextPayment(item,Z.dateKey()),latest=Z.getData().purchases.filter(p=>matchingPayment(item,p)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)[0];return`<article class="subscription-card"><div class="subscription-card-head"><h2>${esc(item.name)}</h2><span class="subscription-status ${item.status}">${STATUS[item.status]}</span></div><strong class="subscription-amount">${Z.money(item.amount)} <small>/ ${periodLabel(item)}</small></strong><dl class="subscription-details"><div><dt>NEXT</dt><dd>${next?next.replaceAll('-','/'):'—'}</dd></div><div><dt>PAYMENT</dt><dd>${PAYMENT[item.payment]}</dd></div><div><dt>RENEWAL</dt><dd>${renewalLabel(item)}</dd></div>${item.status!=='active'&&item.statusDate?`<div><dt>STATUS DATE</dt><dd>${esc(item.statusDate.replaceAll('-','/'))}</dd></div>`:''}${latest?`<div><dt>LAST RECORDED</dt><dd>${esc(latest.date.replaceAll('-','/'))}</dd></div>`:''}</dl>${item.memo?`<p class="subscription-memo">${esc(item.memo)}</p>`:''}<div class="subscription-actions"><button type="button" class="secondary-button" data-subscription-pay="${esc(item.id)}">支払いを記録</button><button type="button" class="row-edit" data-subscription-edit="${esc(item.id)}">編集</button></div></article>`}).join(''):'<div class="history-empty">サブスク登録なし</div>';
 $('subscriptionRecovery').innerHTML=`<div><span>ACTIVE SUBSCRIPTIONS</span><strong>${Z.money(s.monthlyEquivalent)} <small>/ month · ${s.active}件</small></strong></div><div><span>NEXT</span><b>${s.next?s.next.date.slice(5).replace('-','/')+' · '+esc(s.next.item.name)+' · '+Z.money(s.next.item.amount):'—'}</b></div><button type="button" class="row-edit" data-view-subscriptions>詳細</button>`;
}
function updateCycle(){const cycle=$('subscriptionCycle').value;$('subscriptionDayField').hidden=cycle!=='monthly';$('subscriptionDateField').hidden=cycle==='monthly';$('subscriptionIntervalField').hidden=cycle!=='other';$('subscriptionRenewalDay').disabled=cycle!=='monthly';$('subscriptionRenewalDate').disabled=cycle==='monthly';$('subscriptionIntervalDays').disabled=cycle!=='other';$('subscriptionRenewalDay').required=cycle==='monthly';$('subscriptionRenewalDate').required=cycle!=='monthly';$('subscriptionIntervalDays').required=cycle==='other'}
function open(id=null,sourceFixed=null){
 const old=id?get(id):null;if(id&&!old)return;
 editor={id:old?.id||(sourceFixed?'subscription_fixed_'+sourceFixed.id:Z.uid('subscription')),updatedAt:old?.updatedAt??null,sourceFixedId:sourceFixed?.id||null,sourceUpdatedAt:sourceFixed?.updatedAt};
 $('subscriptionForm').reset();$('subscriptionEditorTitle').textContent=old?'サブスクを編集':sourceFixed?'SUBSCRIPTIONSへ移動':'サブスクを追加';
 $('subscriptionName').value=old?.name||sourceFixed?.name||'';$('subscriptionAmount').value=old?.amount||sourceFixed?.amount||'';$('subscriptionCycle').value=old?.cycle||'monthly';$('subscriptionRenewalDay').value=old?.renewalDay||'';$('subscriptionRenewalDate').value=old?.renewalDate||Z.dateKey();$('subscriptionIntervalDays').value=old?.intervalDays||30;
 $('subscriptionPayment').value=old?.payment||'cash';$('subscriptionStatus').value=old?.status||'active';$('subscriptionMemo').value=old?.memo||'';$('subscriptionError').textContent='';$('subscriptionSubmit').textContent=sourceFixed?'確認して移動':old?'変更を保存':'登録する';updateCycle();Z.showModal('subscriptionModal');
}
function openMigration(id){const source=Z.getData().fixedCommitments.find(item=>item.id===id);if(!source||source.category!=='service')return;if(records().some(item=>item.sourceFixedIds.includes(id))){Z.toast('この固定サービスは移動済みだ。');return}open(null,source)}
function save(event){
 event.preventDefault();if(!editor)return;
 const form=new FormData(event.currentTarget),name=String(form.get('name')||'').trim(),amount=Number(form.get('amount')),cycle=String(form.get('cycle')||''),payment=String(form.get('payment')||''),status=String(form.get('status')||''),renewalDay=Number(form.get('renewalDay')),renewalDate=String(form.get('renewalDate')||''),intervalDays=Number(form.get('intervalDays')),memo=String(form.get('memo')||'').trim(),old=get(editor.id),error=$('subscriptionError');
 if((editor.updatedAt!==null&&(!old||old.updatedAt!==editor.updatedAt))||(editor.updatedAt===null&&old)){error.textContent='この契約は別の操作で変更された。一覧から開き直してくれ。';return}
 const source=editor.sourceFixedId?Z.getData().fixedCommitments.find(item=>item.id===editor.sourceFixedId):null;
 if(editor.sourceFixedId&&(!source||source.updatedAt!==editor.sourceUpdatedAt||source.category!=='service'||records().some(item=>item.sourceFixedIds.includes(source.id)))){error.textContent='移動元が変更された。固定サービス一覧から開き直してくれ。';return}
 const now=Math.max(Date.now(),(old?.updatedAt||0)+1),entry={...(old||{}),id:editor.id,name,amount,cycle,payment,status,renewalDay:cycle==='monthly'?renewalDay:null,renewalDate:cycle==='monthly'?null:renewalDate,intervalDays:cycle==='other'?intervalDays:null,memo,sourceFixedIds:old?.sourceFixedIds||(source?[source.id]:[]),statusDate:old?.status===status?old.statusDate||Z.dateKey():Z.dateKey(),createdAt:old?.createdAt||now,updatedAt:now};
 if(!name||name.length>80||memo.length>500||M.normalize([entry]).length!==1){error.textContent='名称、1円以上の整数金額、更新周期・更新日、支払い方法を確認してくれ。';return}
 // Keep migration source records for old backups/history; the explicit link excludes them from monthly planning.
 if(old)Z.getData().subscriptions=records().map(item=>item.id===entry.id?entry:item);else Z.getData().subscriptions.push(entry);
 editor=null;Z.hideModal('subscriptionModal');Z.save();Z.renderAll();Z.toast(source?'契約を移動した。過去の購入履歴は変更していない。':'契約情報を保存した。');
}
function purchaseOptions(){return records().map(item=>({id:'subscription:'+item.id,name:item.name,amount:item.amount,category:'service',subscriptionId:item.id,status:item.status}))}
function openPayment(id){
 const item=get(id);if(!item)return;const existing=paymentOn(item,Z.dateKey());
 if(existing){Z.openPurchase(existing.date,existing.id);return}
 Z.openPurchase();document.querySelector('input[name="purpose"][value="fixed"]').checked=true;Z.refreshPurchaseFields();$('purchaseFixedId').value='subscription:'+item.id;Z.selectFixedPurchase();
}
$('subscriptionAdd').addEventListener('click',()=>open());$('subscriptionForm').addEventListener('submit',save);$('subscriptionCycle').addEventListener('change',updateCycle);
$('subscriptionList').addEventListener('click',event=>{const edit=event.target.closest('[data-subscription-edit]'),pay=event.target.closest('[data-subscription-pay]');if(edit)open(edit.dataset.subscriptionEdit);else if(pay)openPayment(pay.dataset.subscriptionPay)});
$('subscriptionRecovery').addEventListener('click',event=>{if(event.target.closest('[data-view-subscriptions]'))Z.setView('subscriptions')});
window.ZeroSubscriptions={refresh,records,get,open,openMigration,save,updateCycle,openPayment,purchaseOptions,fromFixedId,paymentOn,nextPurchaseId};
refresh();
})();
