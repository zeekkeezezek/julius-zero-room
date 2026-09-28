(function(){
'use strict';
const Z=window.ZeroRoom,$=id=>document.getElementById(id),esc=Z.escapeHtml;
const GROUPS=[['価格・希少性',[
 ['cheap','相場より安い'],['sale','セール・値下げ中'],['limited','限定商品'],['deadline','期間限定'],['restock','再販商品'],['few','残りわずか'],['rival','誰かに買われそう'],['unknown','次いつ買えるか分からない']
]],['心理状態',[
 ['now','今すぐ欲しい'],['loss','買わないと損した気がする'],['lose','誰かに買われたら負けた気がする'],['avoid','相談したら止められそうなので相談したくない'],['stress','ストレス・怒り・落ち込み中'],['mood','気分転換として買いたい'],['already','今日はすでに別の物を買っている']
]],['在庫・創作関連',[
 ['similar','似た物をすでに持っている'],['stock','家にまだ使っていない在庫がある'],['someday','「いつか使う」が理由'],['future','未来のやる気を前提にしている'],['discontinued','廃盤・品切れが怖い'],['spare','予備として欲しい'],['complete','全色・全部入り・コンプリート欲がある'],['space','置き場所が決まっていない']
]],['支払い関連',[
 ['afterpay','現金ではなく後払いを使う予定'],['credit','後払いなら今すぐ買えると思っている'],['points','ポイント還元を理由にしている'],['proceeds','売上金が入ったので使いたくなっている'],['restored','返済で利用可能額が戻ったので使いたくなっている']
]]];
const LABELS=Object.fromEntries(GROUPS.flatMap(([,items])=>items));
const STRONG=new Set(['rival','avoid','stress','credit','restored','already']);
const SCARCE=new Set(['rival','limited','deadline','restock','few','unknown','discontinued']);
const EMERGENCY=[['rival','誰かに買われそう'],['cheap','相場より安い'],['limited','限定・復刻'],['credit','後払いなら買える'],['stress','ストレス・怒り中'],['avoid','相談したら止められると思って避けた'],['similar','似た物をすでに持っている'],['already','今日はすでに買い物をしている']];
const MESSAGES={
 rival:['他人に買われても、君は負けていない。その人が金を出しただけだ。君の財布は助かった。','誰かの決済に、君が付き合う必要はない。'],
 cheap:['安い商品と、今の君に買える商品は同じではない。','お得は、買わないより安くない。'],
 sale:['割引額より、支払う額を見ろ。','値下げは、必要性を増やさない。'],
 limited:['限定でも、今日決済する義務はない。','手に入る期限と、君が買う理由は別だ。'],
 deadline:['期限に判断を渡すな。まず24時間置け。'],
 restock:['再販は、買い逃しの埋め合わせをする命令ではない。'],
 few:['残りの数より、君に必要な数を見ろ。'],
 unknown:['次が分からなくても、今買える理由にはならない。'],
 now:['欲しいままでいい。決済を待つことはできる。'],
 loss:['買わなかった君は損をしていない。金と空間を残した。'],
 lose:['誰かに買われても、君は負けていない。'],
 avoid:['止められると分かって相談を避けたなら、今は危険な状態だ。だから今は買わない。','相談を避けた時点で、一人で決済を急ぐな。'],
 stress:['今欲しいのは、気分が変わる瞬間かもしれない。感情が強い間は決済するな。','画面を閉じて、水を飲め。気分の出口を買い物だけにするな。'],
 mood:['気分を変えるための買い物は、支払いまで消してはくれない。'],
 already:['今日は既に買っている。次の一件の前に、ここで区切れ。','一度買った勢いを、次の決済の理由にするな。'],
 similar:['似た物があるなら、まず持っている物を見てくれ。','新しい一つを探す前に、手元の一つを使え。'],
 stock:['材料は、使って初めて材料だ。積むだけなら床面積の負債だ。'],
 someday:['「いつか」は使用予定日ではない。今は手持ちを一つ使え。'],
 future:['未来の創作力は、在庫量では増えない。'],
 discontinued:['品切れへの不安と、使う予定を分けて考えろ。'],
 spare:['予備を買う前に、今の一つを使い切れるか確認しろ。'],
 complete:['揃っている景色を買いたいだけではないか。使う物と、集めたい物を混同するな。'],
 space:['置き場所が決まっていない物を、今増やすな。'],
 afterpay:['未来へ送る請求も、君が払う金だ。'],
 credit:['後払い可能額は、君の金ではない。未来の給料へ請求を送れる枠だ。','後払い可能額は資産ではない。'],
 points:['ポイントは収入ではない。1％の還元より、100％支出しない方が強い。','ポイントより、後払いゼロ。'],
 proceeds:['不用品が売れた金は、買い物権ではない。返済余力が戻っただけだ。'],
 restored:['返済で戻った枠は、買い物権ではない。借り直せる上限が戻っただけだ。']
};
const GENERAL=['買わなかったら、金と空間が残る。','欲しいままでいい。今は決済を待て。','今日買わなかった物は、君から何も奪っていない。','入口はもう十分ある。今は一つを通れ。'];
let draft=null,lastMessage='',resultVisible=false;
let holdEdit=null,undoState=null,undoTimer=null;
const copy=value=>JSON.parse(JSON.stringify(value));
function selected(root){return Array.from($(root).querySelectorAll('input:checked')).map(input=>input.value)}
function risk(signals){const unique=[...new Set(signals.filter(id=>LABELS[id]))],score=unique.reduce((n,id)=>n+(STRONG.has(id)?2:1),0);return{count:unique.length,score,level:score>=6?'VERY HIGH':score>=4?'HIGH':score>=2?'CAUTION':'LOW'}}
function recommend(signals){return signals.some(id=>SCARCE.has(id))}
function chooseMessages(signals,random=Math.random){
 const ids=[...new Set(signals)].filter(id=>MESSAGES[id]).sort((a,b)=>Number(STRONG.has(b))-Number(STRONG.has(a)));
 const pools=ids.length?ids.slice(0,3).map(id=>MESSAGES[id]):[GENERAL];
 return pools.map(pool=>{const choices=pool.length>1?pool.filter(message=>message!==lastMessage):pool;const message=choices[Math.floor(random()*choices.length)];lastMessage=message;return message});
}
function financial(){
 const now=new Date(),month=Z.dateKey().slice(0,7),next=new Date(now.getFullYear(),now.getMonth()+1,1),nextMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
 const records=Z.monthRecords(month),m=Z.balanceModel('merpay'),p=Z.balanceModel('paidy'),repayment=Z.getData().monthlyReality[nextMonth];
 return{afterpay:records.afterpay,balance:m.current&&p.current?m.estimated+p.estimated:null,balanceDate:m.current?.date||'',repayment:repayment?Number(repayment.merpayDue||0)+Number(repayment.paidyDue||0):null,nextMonth,noBuy:records.noBuy,stopped:records.urges.length,purchaseDays:new Set(records.purchases.map(item=>item.date)).size};
}
function financialHtml(compact=false){const f=financial(),cells=[['今月の NEW AFTERPAY',Z.money(f.afterpay)],['後払い残高 · 推定',f.balance===null?'未登録':Z.money(f.balance)],['来月の返済予定額',f.repayment===null?'未登録':Z.money(f.repayment)]];if(!compact)cells.push(['今月の NO BUY DAYS',`${f.noBuy}日`],['今月の STOPPED URGES',`${f.stopped}回`],['今月の購入日数',`${f.purchaseDays}日`]);return`<div class="brake-financial ${compact?'emergency-financial':''}">${cells.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><p class="brake-hint">残高はMERPAY＋PAIDY${f.balanceDate?`（${esc(f.balanceDate)}確認分＋以後の新規分）`:''}。返済予定は${esc(f.nextMonth)}の登録額。未登録は0円として扱わない。</p>`}
function signalHtml(items){return items.map(([id,label])=>`<label class="signal-option"><input type="checkbox" value="${id}"><span>${esc(label)}</span></label>`).join('')}
function actionsHtml(emergency=false,signals=[]){const preferred=recommend(signals);return`<div class="brake-actions">${preferred?'<p class="hold-recommend">焦りが強まる条件だ。24時間HOLDを推奨。</p>':''}<button type="button" data-brake-action="hold24" class="${preferred?'submit-button':'secondary-button'}">24時間HOLD${preferred?' · 推奨':''}</button><button type="button" data-brake-action="hold10" class="secondary-button">10分${emergency?'待つ':'だけ待つ'}</button><button type="button" data-brake-action="decline" class="submit-button">今回は買わない</button>${emergency?'':'<button type="button" data-brake-action="close" class="text-button">閉じる</button>'}</div>`}
function open(source){
 draft={id:Z.uid('urge'),source,signals:[],name:'',amount:null,consumed:false};resultVisible=false;
 if(source==='emergency'){
  $('emergencySignals').innerHTML=signalHtml(EMERGENCY);$('emergencyName').value='';$('emergencyAmount').value='';
  const optional=document.querySelector('#stopModal details');if(optional)optional.open=false;
  updateEmergency();Z.showModal('stopModal');
 }else{
  $('brakeName').value='';$('brakeAmount').value='';$('brakeForm').hidden=false;$('brakeResult').hidden=true;
  $('brakeSignals').innerHTML=GROUPS.map(([label,items],i)=>`<details class="signal-group"${i===0?' open':''}><summary>${label}<span data-group-count></span></summary><div class="signal-grid">${signalHtml(items)}</div></details>`).join('');
  Z.showModal('urgeModal');
 }
}
function readItem(emergency=false){const name=$(emergency?'emergencyName':'brakeName').value.trim().slice(0,80),input=$(emergency?'emergencyAmount':'brakeAmount'),raw=input.value.trim(),amount=raw?Number(raw):null;if(raw&&(!Number.isSafeInteger(amount)||amount<1)){Z.toast('金額は1円以上の整数で入力してくれ。');input.focus();return false}draft.name=name;draft.amount=amount;return true}
function diagnose(event){event?.preventDefault();if(!draft||!readItem())return;draft.signals=selected('brakeSignals');const r=risk(draft.signals);resultVisible=true;$('brakeForm').hidden=true;const result=$('brakeResult');result.hidden=false;result.innerHTML=`<div class="risk-level risk-${r.level.toLowerCase().replace(' ','-')}"><span>RISK · ${r.count}項目</span><strong>${r.level}</strong></div><p class="brake-hint">購入許可ではない。今の衝動を確認する目安だ。</p><div class="brake-product"><b>${esc(draft.name||'商品名未入力')}</b><strong>${draft.amount===null?'金額未入力':Z.money(draft.amount)}</strong></div><div id="diagnosisReality">${financialHtml()}</div><div class="brake-messages">${chooseMessages(draft.signals).map(line=>`<p>${esc(line)}</p>`).join('')}</div>${actionsHtml(false,draft.signals)}<button class="text-button" type="button" data-brake-action="back">入力へ戻る</button>`;result.scrollIntoView({block:'start'})}
function updateEmergency(){if(!draft)return;draft.signals=selected('emergencySignals');$('emergencyReality').innerHTML=financialHtml(true);$('emergencyMessages').innerHTML=chooseMessages(draft.signals).map(line=>`<p>${esc(line)}</p>`).join('');$('emergencyActions').innerHTML=actionsHtml(true,draft.signals)}
function persist(message){Z.save();Z.renderAll();Z.toast(message)}
function takeAction(action){
 if(action==='close'){Z.hideModal('urgeModal');return}
 if(action==='back'){$('brakeForm').hidden=false;$('brakeResult').hidden=true;resultVisible=false;return}
 if(!draft||draft.consumed||!['hold24','hold10','decline'].includes(action))return;
 if(!readItem(draft.source==='emergency'))return;
 const now=Date.now(),declined=action==='decline',duration=action==='hold24'?86400000:600000;
 const entry={id:draft.id,date:Z.dateKey(),source:draft.source,name:draft.name,amount:draft.amount,signals:[...draft.signals],risk:risk(draft.signals).level,outcome:declined?'declined':'pending',holdActive:!declined,holdStartedAt:declined?null:now,holdUntil:declined?null:now+duration,createdAt:now,updatedAt:now,...(declined?{resolvedAt:now,resolvedDate:Z.dateKey()}:{} )};
 if(Z.getData().stoppedUrges.some(item=>item.id===entry.id))return;
 Z.getData().stoppedUrges.push(entry);if(declined)rememberUndo(null,entry);draft.consumed=true;Z.hideModal(draft.source==='emergency'?'stopModal':'urgeModal');
 persist(declined?'見送りを記録した。STOPPED URGES +1。':'HOLDに入れた。終了後は「HOLDを確認」から結果を残せる。');
 Z.setJulius(declined?'……よく止まった。今回は君の勝ちだ。':'今は決済を待つ。それだけでいい。');
}
function rememberUndo(before,after){
  undoState={id:after.id,before:before?copy(before):null,after:JSON.stringify(after)};
  clearTimeout(undoTimer);$('holdUndo').hidden=false;
  undoTimer=setTimeout(()=>{undoState=null;$('holdUndo').hidden=true},15000);
}
function undoResult(){
  if(!undoState)return;const operation=undoState,item=Z.getData().stoppedUrges.find(value=>value.id===operation.id);
  undoState=null;$('holdUndo').hidden=true;clearTimeout(undoTimer);
  if(!item||JSON.stringify(item)!==operation.after){Z.toast('記録が後から変更されている。HOLDの「訂正」から確認してくれ。');return}
  if(operation.before)Z.getData().stoppedUrges=Z.getData().stoppedUrges.map(value=>value.id===item.id?{...operation.before,updatedAt:Math.max(Date.now(),item.updatedAt+1)}:value);
  else Z.getData().stoppedUrges=Z.getData().stoppedUrges.filter(value=>value.id!==item.id);
  closeEditor();persist('HOLDの結果変更を取り消した。購入履歴は変更していない。');
}
function closeEditor(){holdEdit=null;$('holdEditor').hidden=true;$('holdsList').hidden=false}
function editHold(id){
  const item=Z.getData().stoppedUrges.find(value=>value.id===id);if(!item?.outcome)return;
  holdEdit={id,updatedAt:item.updatedAt};$('holdsList').hidden=true;$('holdEditor').hidden=false;
  const purchases=[...Z.getData().purchases].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),linked=purchases.find(p=>p.id===item.purchaseId);
  $('holdEditor').innerHTML=`<h3>HOLDの結果を訂正</h3><p>${esc(item.name||'商品名未入力')} · ${item.amount==null?'金額未入力':Z.money(item.amount)}</p>
    <label class="field-label" for="holdOutcome">結果</label><select class="text-input" id="holdOutcome"><option value="pending">保留・結果待ちへ戻す</option><option value="declined">買わなかった</option><option value="purchased">買った</option></select>
    <div id="holdPurchaseControls"><label class="field-label" for="holdPurchaseSelect">購入履歴と紐付ける</label><select class="text-input" id="holdPurchaseSelect"><option value="">紐付けなし</option>${purchases.map(p=>`<option value="${esc(p.id)}">${esc(p.date)} · ${esc(p.name||'購入記録')} · ${Z.money(p.amount)}</option>`).join('')}</select>
    <p class="brake-hint">記録済みなら履歴を選んで「結果を保存」。金額を追加せず紐付ける。</p><button type="button" class="secondary-button" data-edit-hold-action="purchase">${linked?'紐付いた購入を訂正':'購入を記録する（名前・金額を引き継ぐ）'}</button></div>
    <p class="brake-hint">結果の訂正や取り消しは、購入履歴を削除しない。購入内容の訂正・削除は購入記録側で行える。</p><div class="brake-actions"><button type="button" class="submit-button" data-edit-hold-action="save">結果を保存</button><button type="button" class="text-button" data-edit-hold-action="cancel">戻る</button></div>`;
  $('holdOutcome').value=item.outcome;$('holdPurchaseSelect').value=linked?.id||'';togglePurchaseControls();
}
function togglePurchaseControls(){$('holdPurchaseControls').hidden=$('holdOutcome').value!=='purchased'}
function saveHoldResult(id,outcome,purchaseId='',expectedUpdatedAt){
  const item=Z.getData().stoppedUrges.find(value=>value.id===id);
  if(!item||item.updatedAt!==expectedUpdatedAt){Z.toast('別の操作でHOLDが変更された。開き直してくれ。');return false}
  if(!['pending','declined','purchased'].includes(outcome))return false;
  if(purchaseId&&outcome==='purchased'&&!Z.getData().purchases.some(p=>p.id===purchaseId)){Z.toast('選んだ購入記録が見つからない。開き直してくれ。');return false}
  const before=copy(item),now=Math.max(Date.now(),item.updatedAt+1);
  item.outcome=outcome;item.holdActive=outcome==='pending';item.updatedAt=now;
  if(outcome==='pending'){item.holdUntil=item.holdUntil||now;item.holdStartedAt=item.holdStartedAt||item.createdAt;delete item.resolvedAt;delete item.resolvedDate}
  else if(before.outcome!==outcome){item.resolvedAt=now;item.resolvedDate=Z.dateKey()}
  if(outcome==='purchased'&&purchaseId)item.purchaseId=purchaseId;else delete item.purchaseId;
  rememberUndo(before,item);closeEditor();persist('HOLDの結果を保存し、止まれた回数を再計算した。');return true;
}
function attachPurchase(id,purchaseId){
  const item=Z.getData().stoppedUrges.find(value=>value.id===id);if(!item)return;
  if(item.outcome!=='purchased'){item.resolvedAt=Date.now();item.resolvedDate=Z.dateKey()}
  item.outcome='purchased';item.holdActive=false;item.purchaseId=purchaseId;item.updatedAt=Math.max(Date.now(),item.updatedAt+1);
  undoState=null;$('holdUndo').hidden=true;closeEditor();
}
function time(value){return new Date(value).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function renderHolds(){
 const all=Z.getData().stoppedUrges.filter(item=>item.outcome),pending=all.filter(item=>item.outcome==='pending').sort((a,b)=>a.holdUntil-b.holdUntil),done=all.filter(item=>item.outcome!=='pending').sort((a,b)=>b.updatedAt-a.updatedAt);
 const historyOpen=document.querySelector('#holdsList .hold-history')?.open;
 const ready=pending.filter(item=>item.holdUntil<=Date.now()).length;$('reviewHolds').textContent=ready?`HOLDを確認 · 結果待ち ${ready}件`:`HOLDを確認${pending.length?` · ${pending.length}件`:''}`;
 $('holdsList').innerHTML=(pending.map(item=>{const ended=item.holdUntil<=Date.now(),remaining=Math.max(1,Math.ceil((item.holdUntil-Date.now())/60000));return`<article class="hold-entry"><div class="hold-entry-heading"><b>${esc(item.name||'商品名未入力')}</b><strong>${item.amount==null?'金額未入力':Z.money(item.amount)}</strong></div><p>${ended?'時間を置いた。結果を記録できる。':`待機中 · あと約${remaining}分`}</p><small>登録 ${time(item.createdAt)}<br>HOLD開始 ${time(item.holdStartedAt||item.createdAt)} · 終了 ${time(item.holdUntil)}</small>${item.signals?.length?`<p class="hold-signals">${item.signals.map(id=>esc(LABELS[id]||id)).join(' / ')}</p>`:''}<div class="brake-actions">${ended?`<button type="button" class="secondary-button" data-hold-id="${esc(item.id)}" data-hold-action="extend">まだ欲しい · 24時間HOLD</button>`:''}<button type="button" class="submit-button" data-hold-id="${esc(item.id)}" data-hold-action="decline">${ended?'もういらない · 買わなかった':'買わなかったと確定'}</button><button type="button" class="text-button" data-hold-id="${esc(item.id)}" data-hold-action="bought">買った</button><button type="button" class="text-button" data-hold-id="${esc(item.id)}" data-hold-action="edit">結果を訂正</button></div></article>`}).join('')||'<p class="brake-hint">結果待ちのHOLDはない。</p>')+(done.length?`<details class="hold-history"${historyOpen?' open':''}><summary>今回の機能で残した履歴 · ${done.length}件</summary>${done.map(item=>`<div class="hold-history-row"><b>${esc(item.name||'商品名未入力')}</b><span>${item.outcome==='declined'?'見送り':'購入済み'} · ${time(item.resolvedAt||item.updatedAt)}</span><button type="button" class="text-button" data-hold-id="${esc(item.id)}" data-hold-action="edit">訂正${item.outcome==='purchased'?'・購入記録':''}</button></div>`).join('')}</details>`:'');
}
function resolveHold(id,action){
 const item=Z.getData().stoppedUrges.find(value=>value.id===id);if(!item||item.outcome!=='pending')return;
 const before=copy(item),now=Math.max(Date.now(),item.updatedAt+1);if(action==='extend'){if(item.holdUntil>now)return;item.holdStartedAt=now;item.holdUntil=now+86400000;item.updatedAt=now;persist('もう24時間置く。見送り回数は増やしていない。');return}
 if(!['decline','bought'].includes(action))return;
 item.outcome=action==='decline'?'declined':'purchased';item.holdActive=false;item.resolvedAt=now;item.resolvedDate=Z.dateKey();item.updatedAt=now;
 rememberUndo(before,item);
 persist(action==='decline'?'買わなかったと確定した。STOPPED URGES +1。':'HOLDを購入済みにした。購入履歴が未入力なら、この後に記録してくれ。');
 if(action==='decline')Z.setJulius('……よく止まった。今回は君の勝ちだ。');
 else editHold(id);
}
function refresh(){
 renderHolds();if(resultVisible&&$('diagnosisReality'))$('diagnosisReality').innerHTML=financialHtml();
 if($('stopModal').classList.contains('show'))$('emergencyReality').innerHTML=financialHtml(true);
}
function onAction(event){const button=event.target.closest('[data-brake-action]');if(button)takeAction(button.dataset.brakeAction)}
$('brakeForm').addEventListener('submit',diagnose);
$('brakeSignals').addEventListener('change',event=>{const group=event.target.closest('details');if(group){const count=group.querySelectorAll('input:checked').length;group.querySelector('[data-group-count]').textContent=count?` ${count}項目`:''}});
$('emergencySignals').addEventListener('change',updateEmergency);
$('brakeResult').addEventListener('click',onAction);$('emergencyActions').addEventListener('click',onAction);
$('reviewHolds').addEventListener('click',()=>{closeEditor();renderHolds();Z.showModal('holdsModal')});
$('holdsList').addEventListener('click',event=>{const button=event.target.closest('[data-hold-action]');if(button){if(button.dataset.holdAction==='edit')editHold(button.dataset.holdId);else resolveHold(button.dataset.holdId,button.dataset.holdAction)}});
$('undoHoldResult').addEventListener('click',undoResult);
$('holdEditor').addEventListener('change',event=>{if(event.target.id==='holdOutcome')togglePurchaseControls()});
$('holdEditor').addEventListener('click',event=>{
 const button=event.target.closest('[data-edit-hold-action]');if(!button||!holdEdit)return;
 if(button.dataset.editHoldAction==='cancel'){closeEditor();return}
 if(button.dataset.editHoldAction==='save')saveHoldResult(holdEdit.id,$('holdOutcome').value,$('holdPurchaseSelect').value,holdEdit.updatedAt);
 if(button.dataset.editHoldAction==='purchase')Z.openPurchaseFromHold(holdEdit.id);
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){Z.renderAll();refresh()}});
window.setInterval?.(()=>{if(!document.hidden){Z.renderAll()}},30000);
window.ZeroBrake={open,refresh,risk,financial,chooseMessages,recommend,takeAction,resolveHold,editHold,saveHoldResult,undoResult,attachPurchase,GROUPS};
refresh();
})();
