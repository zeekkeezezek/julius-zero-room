(function(){
'use strict';
// Display-only help: no records, storage writes, save hooks or network calls.
const TOPICS={
 subscriptions:{title:'SUBSCRIPTIONS',lines:['解約・停止しない限り自動継続する契約を管理します。毎回自分で購入する月パス・シーズンパスはFIXED COMMITMENTSで管理します。','登録・編集・更新日の到来だけでは購入履歴・後払い・手持ち額を変更しません。「支払いを記録」から実際の請求額と購入日を確認し、PURCHASE LOGで保存します。支払い方法は購入入力と共通です。','月額換算はACTIVEのみを対象に、月額＋年額÷12＋その他周期の月額相当を計算します。年間概算は月額×12＋年額＋その他周期の年間相当です。その他周期は365日を基準とする概算で、今月の請求合計ではありません。','毎月31日など存在しない更新日は、その月の末日として表示します。年額の2月29日も平年は2月末日になります。元の更新設定は保持します。その他周期は指定更新日を起点に日数間隔で計算します。','次回請求は今日以降の予定です。当日の予定は当日中表示します。実際の請求・支払い成功を自動確認するものではありません。PAUSED／CANCELLEDは予定と合計から除外し、契約情報と過去の購入履歴は保持します。アプリ内のステータス変更は実際の契約の解約・停止を行いません。','固定サービスの「SUBSCRIPTIONSへ移動」は手動操作です。更新日と支払い方法を確認して保存します。元の固定登録は互換性のため保持し、月別計画の集計・選択肢から外します。過去の購入履歴は書き換えません。月パスは移動対象外です。','同じ契約・同じ購入日の重複記録は防止します。今日の記録が既にある場合は、その訂正画面を開きます。過去日や実際の請求金額へ変更できます。RECOVERYの参照額は手持ち・必須支払いへ自動加算しません。']},
 recovery:{title:'BALANCE RECOVERY',lines:['確認済みの現在残高を記録します。購入履歴から残高を自動計算する機能ではありません。','「前回確認後の新規分」は、最新スナップショットを保存した後に記録した後払いです。推定残高は確認済み残高とこの新規分の合計で、参考値です。','スナップショットを編集・削除すると、最新残高・前回差額・推定値を再計算します。購入履歴は削除しません。']},
 reality:{title:'MONTHLY REALITY',lines:['現在の手持ち：今この瞬間に使える現金・残高。受け取り済みの給料を含めます。','これから入る予定額：今月中に入る予定で、まだ受け取っていない金額。現在の手持ちとは重複させません。','来月の給料見込み：参考値のみ。今月の計算には含めません。','今月使える合計は「現在の手持ち＋これから入る予定額」です。ここから現在の必須支払いを引き、不足額を表示します。','登録済み固定支出は、現在の必須支払いとは別管理です。今月の不足額には自動加算しません。']},
 fixed:{title:'FIXED COMMITMENTS',lines:['毎回自分で購入する月パス等の予定を月別管理します。対象月はMONTHLY REALITYの「対象月」で切り替えます。自動継続の契約はSUBSCRIPTIONSで管理します。購入時は購入月の事前登録項目、またはサブスクを選びます。','固定支出は自由予算ではありません。未使用分の転用・翌月への繰り越しはしません。買わずに終了できます。','登録を編集・削除しても、実際の購入記録は残ります。実績の訂正はHISTORYで行います。','限定パック・石購入・追加課金は趣味・衝動として記録します。固定でもMERPAY／PAIDYの後払いは通常どおり加算します。','月別の固定項目は同月の重複購入を防止します。サブスクは同じ契約・同じ購入日の重複を防止します。訂正は購入履歴から行います。']},
 fund:{title:'GOAL FUND',lines:['予定額ではなく、実際に封筒・別口座などへ分けて確保した金額のみ記録します。','「買わなかった金額」は自動積立されません。','現在積立は、積立の合計から取り崩しの合計を引いた金額です。購入・後払い・手持ち額の記録とは別管理です。']},
 'fund-entry':{title:'FUND ENTRY',lines:['積立は実際に分けて確保した金額、取り崩しは実際に保管場所から出した金額を記録します。','ここでの記録だけで購入履歴・後払い・手持ち額は変わりません。','履歴を削除すると積立額を再計算します。実際の現金は移動しません。残高がマイナスになる削除はできません。']},
 'fund-target':{title:'目標額',lines:['目標額は任意です。空欄で保存すると目標額を解除します。','目標額を解除しても、現在積立・今月の積立・過去の履歴は保持されます。']},
 'fund-storage':{title:'保管場所',lines:['主な保管場所は、新しい積立・取り崩し記録の初期選択に使用します。','設定を変更しても、過去の保管場所・積立額・実際の現金は変わりません。']},
 'purchase-category':{title:'購入区分',lines:['必要：食事・飲料・衛生用品などの必需品。','注意支出：お菓子、任意の日用品、便利グッズなど。','固定：サブスク・事前登録済みサービス・月パス。','趣味・衝動：予定外の趣味購入、追加課金など。その日は趣味・衝動購入日になります。','NO BUYは趣味・衝動を基準に判定します。必要・固定・注意支出とは分けて記録します。','どの区分でもMERPAY／PAIDYは後払いとして集計します。商品名は購入履歴・日別明細に保存し、HOMEの集計には表示しません。']},
 payment:{title:'支払い方法',lines:['今ある金から払った：NEW AFTERPAYには加算しません。','MERPAY／PAIDY後払い・分割：各支払い先の新規分、月別NEW AFTERPAY、確認後の推定残高へ加算します。','購入区分が必要・固定・注意支出でも、後払いの集計対象です。']},
 caution:{title:'CAUTION SPEND',lines:['表示月の注意支出の実績を集計します。予算・残り利用可能額ではありません。','お菓子・嗜好品：お菓子・ジュース・間食など。','任意の日用品：必須ではない日用品・収納・予備・便利グッズなど。','その他の注意支出：上記以外の注意支出。予定外の趣味物・追加課金は趣味・衝動に分類します。']},
 calendar:{title:'カレンダー',lines:['✓はNO BUY、¥は趣味・衝動購入、?は未確定、青枠は今日を示します。','Sは固定サービス、Pは固定月パス、Cは注意支出です。薄い✓は固定・注意支出のみの未確定日で、NO BUY集計には含めません。','日付を押してNO BUYを手動記録できます。趣味・衝動購入がある日は、先に購入履歴の訂正が必要です。','趣味・衝動の1日合計で、5千円以上はオレンジ強調、1万円以上は赤い¥!、2万円以上は強い!、5万円以上は!!で表示します。必要・固定・注意支出はこの判定に含めません。']},
 'no-buy':{title:'NO BUY DAYS',lines:['表示月の、趣味・衝動購入がなかったと手動記録した日数です。未確定日は含めません。','必要・固定・注意支出がある日も、趣味・衝動購入がなければNO BUYを記録できます。']},
 afterpay:{title:'NEW AFTERPAY',lines:['表示月に新しく記録した後払い額です。MERPAY／PAIDYを支払い先別に集計します。旧形式で支払い先が不明な記録は別枠で保持します。','必要・固定・注意支出を含む、すべての購入区分の後払いが対象です。支払い残高そのものではありません。','STOP LINEは、ここから新規後払いを増やさないための表示です。この金額まで使える予算ではありません。']},
 'big-spend':{title:'BIG SPEND DAYS',lines:['表示月に、趣味・衝動購入の1日合計が1万円以上になった日数です。同じ日の複数購入は合算します。','必要・固定・注意支出は判定に含めません。']},
 hold:{title:'URGE CONTROL / HOLD',lines:['止まれた回数は見送り確定分の累計です。待機中・期限切れ・現金確保後の再検討・購入済みは加算しません。','HOLDの期限が来ても結果は自動確定しません。HOLD REVIEWから見送り終了・現金確保後の再検討・購入した・24時間延長を選びます。','現金確保後の再検討は、購入許可や現金確保済みを意味しません。積立・購入は自動記録しません。','結果の訂正・取り消しで購入履歴は削除されません。購入の訂正・削除は購入記録側で行います。']},
 impulse:{title:'IMPULSE CHECK',lines:['当てはまるサインを複数選択できます。商品名・金額は任意です。','危険度はサインに基づく目安で、購入許可ではありません。診断を開くだけでは見送り回数は増えません。','HOLD・見送りなどの結果を選んだ時に記録します。']},
 sync:{title:'SETTINGS / SYNC',lines:['記録は先にこの端末へ保存します。クラウドの応答を待たずに使用できます。','PC・スマホは同じGoogleアカウントでログインすると同期できます。ログイン前も端末への保存は使用できます。','起動・再接続時に更新日時を比較し、記録単位で新しい変更を反映します。','オフラインや通信失敗時も端末内で記録できます。送信待ちの変更は接続復旧後に再同期します。','Firebase設定が読み込めないローカルファイルでは端末保存のみになります。クラウド同期には公開URLが必要です。']},
 theme:{title:'APPEARANCE / テーマ',lines:['この端末の表示だけを変更します。PCとスマホで別々に選べます。','選択したテーマはこの端末に保存し、次回起動にも反映します。記録・集計・クラウド同期の内容は変わりません。']},
 'sync-size':{title:'同期データ量',lines:['同期対象の記録をJSON化したUTF-8の推定サイズです。この端末の未送信分を含みます。','画像・端末キャッシュ・バックアップ・削除マーカー・Firestoreの索引などは含みません。','Firestore全体の使用容量・請求対象量・残り容量を表すものではありません。']},
 backup:{title:'JSONバックアップ / 削除',lines:['JSONバックアップは、現在の記録をファイルへ書き出します。テーマ選択は含みません。','JSONの読み込みは現在の記録を置き換えます。読み込み前にバックアップを書き出してください。','購入・固定登録・残高・積立などを削除すると関連する集計を再計算し、削除情報も同期します。','固定登録の削除で実際の購入履歴は消えません。HOLD結果の訂正・取り消しでも購入履歴は消えません。','ブラウザやホーム画面アプリのサイトデータ削除では、未送信の端末記録やテーマ設定が失われる場合があります。版更新のためにサイトデータを削除する必要はありません。']}
};
const dialog=document.getElementById('helpDialog'),body=document.getElementById('helpDialogBody');
let opener=null,contextId='',topicKey='';
function openHelp(key,button){
 const topic=TOPICS[key];if(!topic)return;
 opener=button;contextId=button.closest('.modal,.view')?.id||'';topicKey=key;
 document.getElementById('helpDialogTitle').textContent=topic.title;body.replaceChildren();
 for(const text of topic.lines){const p=document.createElement('p');p.textContent=text;body.appendChild(p)}
 if(!dialog.open)dialog.showModal();document.getElementById('helpDialogClose').focus();
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-help]');if(button){event.preventDefault();openHelp(button.dataset.help,button)}});
document.getElementById('helpDialogClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close()}});
dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close()});
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()});
dialog.addEventListener('close',()=>{const button=opener?.isConnected?opener:document.getElementById(contextId)?.querySelector(`[data-help="${topicKey}"]`);button?.focus();opener=null});
})();
