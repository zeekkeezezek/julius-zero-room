(function(){
'use strict';
const Z=window.ZeroRoom,$=id=>document.getElementById(id),esc=Z.escapeHtml;
const DAY=86400000;
let selectedPurchaseId=null,feedbackUntil=0,lastHome='',homeUntil=0,displayMonth=null;
const GENERAL=[
 '返した枠は、使える枠ではない。','売った金は、次の買い物の予算ではない。',
 '我慢した日数は、今日使っていい金額ではない。','買わなかった日は、買っていい日を貯めているのではない。',
 '欲しいままでいい。決済しなければ、今日の趣味・衝動支出はゼロだ。','ポイントは収入ではない。',
 '後払い可能額は、君の資産ではない。','未来の可能性を、物で先に買うな。',
 '買わない日を作っても、次の日にまとめて使えばZEROにはならない。','見送った一件は終了だ。次の購入権に変えるな。'
];
function shift(key,n){const [y,m,d]=key.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+n));return date.toISOString().slice(0,10)}
function daysBetween(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY)}
function noBuyStreakBefore(key){
 let streak=0,day=shift(key,-1);const data=Z.getData(),purchased=new Set(data.purchases.filter(p=>p.purpose==='impulse').map(p=>p.date));
 while(data.days[day]?.status==='no-buy'&&!purchased.has(day)){streak++;day=shift(day,-1)}return streak;
}
function monthComparison(month=Z.dateKey().slice(0,7)){
 const current=Z.monthRecords(month),[year,m]=month.split('-').map(Number),previousDate=new Date(Date.UTC(year,m-2,1)),previous=previousDate.toISOString().slice(0,7),prior=Z.monthRecords(previous),isCurrent=month===Z.dateKey().slice(0,7);
 const hasPrevious=prior.purchases.length>0||Object.keys(Z.getData().days).some(key=>key.startsWith(previous));
 const day=Number(Z.dateKey().slice(8)),lastPreviousDay=new Date(Date.UTC(year,m-1,0)).getUTCDate(),cutoff=Math.min(day,lastPreviousDay);
 const through=(items,limit)=>items.filter(p=>Number(p.date.slice(8))<=limit&&['merpay','paidy','legacy'].includes(p.payment)).reduce((n,p)=>n+p.amount,0);
 return{month,previous,current:current.afterpay,prior:prior.afterpay,hasPrevious,isCurrent,cutoff,over:hasPrevious&&current.afterpay>prior.afterpay,pace:isCurrent&&hasPrevious&&through(current.purchases,cutoff)>through(prior.purchases,cutoff),currentPace:through(current.purchases,cutoff),priorPace:through(prior.purchases,cutoff)};
}
function purchaseModel(entry){
 const day=Z.daySpend(entry.date),month=entry.date.slice(0,7),monthly=Z.monthRecords(month),streak=entry.purpose==='impulse'?noBuyStreakBefore(entry.date):0;
 const data=Z.getData(),recentStops=data.stoppedUrges.filter(u=>Z.isStoppedUrge(u)&&String(u.resolvedDate||u.date)>=shift(entry.date,-7)&&String(u.resolvedDate||u.date)<=entry.date&&Number(u.resolvedAt||u.createdAt)<=entry.createdAt).length;
 const balance=Z.balanceModel('merpay'),paidy=Z.balanceModel('paidy'),knownBalance=balance.current&&paidy.current?balance.estimated+paidy.estimated:null;
 const fund=window.ZeroFund?.summary().currentAmount??null,afterpay=['merpay','paidy','legacy'].includes(entry.payment),lines=[];
 if(entry.purpose==='impulse'){
  if(day.impulse>=50000)lines.push('これは明確な高額支出だ。今月の数字から目を逸らすな。');
  else if(day.impulse>=20000)lines.push(afterpay?'君は今、未来へ大きな請求を送った。「欲しかった」だけで終わらせるな。':'これは手元の金を大きく減らす支出だ。「欲しかった」だけで終わらせるな。');
  else if(day.impulse>=10000)lines.push('……ダメだ。気軽に追加していい額ではない。ここで区切れ。');
  else if(day.impulse>=5000)lines.push('これは軽く扱う額ではない。今月の支出を見ろ。');
  else lines.push('少額でも、積み重なれば月の支出になる。ここから重ねるな。');
  if(streak>=5)lines.push(`直前にNO BUYが${streak}日続いている。反動買いではないか。NO BUY DAYSは買い物許可券ではない。`);
  else if(streak>=3)lines.push(`直前にNO BUYが${streak}日続いている。反動買いではないか。数日我慢したから、今日は買っていいと思っていないか。`);
  if(recentStops&&day.impulse>=10000)lines.push('直近7日に見送りの記録がある。止まれた回数を、まとめ買いの権利に変えるな。');
 }
 if(monthly.afterpay>100000)lines.splice(Math.min(1,lines.length),0,'今月は既に新しい後払いが10万円を超えている。「これくらい」を重ねるな。');
 if(afterpay){
  const snapshots=[...data.recoverySnapshots].filter(s=>s.date<=entry.date).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt),latest=snapshots.at(-1),previous=snapshots.at(-2);
  if(['merpay','paidy'].includes(entry.payment)&&latest&&previous&&daysBetween(latest.date,entry.date)<=3&&latest.createdAt<=entry.createdAt&&latest[entry.payment]<previous[entry.payment])lines.push('残高の減少を記録したばかりだ。返した枠は、使える枠ではない。');
  if(knownBalance>0)lines.push(`確認済み残高からの推定は${Z.money(knownBalance)}。今回の後払いも、消えずに残る。`);
 }
 const sale=data.goalFundTransactions.some(t=>t.fundId==='ai-pc'&&t.transactionType==='deposit'&&t.source==='sale'&&t.date<=entry.date&&daysBetween(t.date,entry.date)<=7&&t.createdAt<=entry.createdAt);
 if(entry.purpose==='impulse'&&entry.amount>=5000&&sale)lines.push('直近7日に売却分の積立記録がある。売った金は、次の買い物の予算ではない。');
 const comparisonAmount=entry.amount>=5000?entry.amount:day.impulse>=10000?day.impulse:0,comparisonLabel=entry.amount>=5000?'今回の購入額':'この日の趣味・衝動合計';
 let fundCopy='';if(entry.purpose==='impulse'&&comparisonAmount&&fund>0){const ratio=comparisonAmount/fund;fundCopy=ratio>=.9&&ratio<=1.1?`${comparisonLabel}は、現在の積立額とほぼ同額だ。`:ratio>1?`${comparisonLabel}は、現在の積立額を上回っている。`:`${comparisonLabel}は、現在の積立額の約${Math.round(ratio*100)}％だ。`;}
 return{date:entry.date,day,month,afterpay:monthly.afterpay,streak,recentStops,knownBalance,fund,fundCopy,comparisonAmount,comparisonLabel,lines,level:Z.spendLevel(day.impulse)};
}
function latestImpulse(){return Z.getData().purchases.filter(p=>p.purpose==='impulse'&&p.date===Z.dateKey()).sort((a,b)=>b.createdAt-a.createdAt||b.updatedAt-a.updatedAt)[0]}
function selectedEntry(){return Z.getData().purchases.find(p=>p.id===selectedPurchaseId&&p.purpose==='impulse')||latestImpulse()}
function renderFeedback(){
 const box=$('purchaseFeedback'),entry=selectedEntry();box.hidden=!entry;if(!entry){box.innerHTML='';return}
 const f=purchaseModel(entry),today=f.date===Z.dateKey(),title=f.day.impulse>=10000?'HIGH SPEND DAY':'JULIUS FEEDBACK';
 box.className=`purchase-feedback feedback-${f.level}`;
 box.innerHTML=`<summary class="feedback-head"><div><span>${title}</span><small>${esc(f.date)} · 趣味・衝動支出</small></div><strong>${Z.money(f.day.impulse)}</strong></summary><div class="feedback-body"><p class="feedback-ack">記録した。隠さなかった。それは正しい。だが、この支出は消えない。</p><div class="feedback-numbers"><div><span>${today?'今日':'この日'}の趣味・衝動支出</span><strong>${Z.money(f.day.impulse)}</strong><small>うち後払い ${Z.money(f.day.impulseAfterpay)} · ${f.day.impulseCount}件</small></div><div><span>${esc(f.month)} NEW AFTERPAY</span><strong>${Z.money(f.afterpay)}</strong><small>必要品・固定・注意支出の後払いも含む</small></div></div><div class="feedback-lines">${f.lines.slice(0,3).map(line=>`<p>${esc(line)}</p>`).join('')}${f.lines.length>3?`<details><summary>記録に応じた指摘 · ほか${f.lines.length-3}件</summary>${f.lines.slice(3).map(line=>`<p>${esc(line)}</p>`).join('')}</details>`:''}</div>${f.fundCopy?`<p class="feedback-fund">${esc(f.comparisonLabel)} ${Z.money(f.comparisonAmount)} / GOAL FUND ${Z.money(f.fund)}<br>${esc(f.fundCopy)} 積立の記録は変えていない。</p>`:''}<p class="feedback-next">今回の支出で、この月のすべてが決まるわけではない。ここから止めろ。</p></div>`;
}
function renderMonthly(month=Z.dateKey().slice(0,7)){
 displayMonth=month;
 const records=Z.monthRecords(month),totals=new Map();records.purchases.filter(p=>p.purpose==='impulse').forEach(p=>totals.set(p.date,(totals.get(p.date)||0)+p.amount));
 const count=[...totals.values()].filter(amount=>amount>=10000).length;
 $('bigSpendDays').textContent=`${Number(month.slice(5))}月 · ${count}日`;
 $('afterpayStopLine').hidden=records.afterpay<=0;
 const f=monthComparison(month),box=$('monthlyAlerts'),parts=[];
 if(f.isCurrent&&f.over)parts.push(`<div class="monthly-alert"><span>MONTHLY ALERT</span><p>${Number(month.slice(5))}月の新規後払いが、${Number(f.previous.slice(5))}月の記録額を超えた。</p><div><span>${esc(f.previous)} ${Z.money(f.prior)}</span><strong>${esc(month)} 現在 ${Z.money(f.current)}</strong></div><small>まだ月は終わっていない。ここから増やすな。</small></div>`);
 if(f.pace)parts.push(`<details class="spending-pace"><summary>SPENDING PACE · 前月より速い</summary><p>両月の${f.cutoff}日までの新規後払いを比較。</p><p>${esc(f.previous)} ${Z.money(f.priorPace)} / ${esc(month)} ${Z.money(f.currentPace)}</p><small>記録済みの実績のみ。未記録分や将来額は推測しない。</small></details>`);
 box.innerHTML=parts.join('');box.hidden=!parts.length;
}
function prePurchaseHtml(){const spend=Z.daySpend(Z.dateKey());return spend.impulse>=10000?`<section class="today-spend-alert"><span>TODAY SPEND</span><strong>${Z.money(spend.impulse)}</strong><p>今日は既に大きく使っている。追加購入は明日まで待て。日が変わっても購入許可にはならない。</p></section>`:''}
function renderHomeLine(force=false){
 const entry=selectedEntry();if(entry&&Date.now()<feedbackUntil){const f=purchaseModel(entry);Z.setJulius(`記録したことは正しい。だが、趣味・衝動支出は${Z.money(f.day.impulse)}だ。${f.lines[0]} ここから止めろ。`);return}
 if(!force&&Date.now()<homeUntil&&lastHome){Z.setJulius(lastHome);return}
 const choices=GENERAL.filter(message=>message!==lastHome);lastHome=choices[Math.floor(Math.random()*choices.length)];homeUntil=Date.now()+300000;Z.setJulius(lastHome);
}
function refresh(month=displayMonth||Z.dateKey().slice(0,7)){renderFeedback();renderMonthly(month);renderHomeLine()}
function recorded(entry,editing){
 if(editing){refresh();return}
 if(entry.purpose==='impulse'){selectedPurchaseId=entry.id;feedbackUntil=Date.now()+900000;refresh();$('purchaseFeedback').open=true;Z.setView('home');}
 else Z.setJulius(entry.purpose==='essential'?'必要なものは、必要だ。事実だけ残しておけばいい。':entry.purpose==='fixed'?'予定していた固定分を記録した。ここから先の追加支出の許可ではない。':'注意支出を記録した。少額でも月の積み重ねを見ろ。');
}
window.ZeroFeedback={refresh,renderMonthly,renderHomeLine,recorded,purchaseModel,noBuyStreakBefore,monthComparison,prePurchaseHtml,GENERAL};
refresh();
})();
