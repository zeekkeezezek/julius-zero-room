# JULIUS ZERO ROOM v0.8.0 クラウド同期

新しい物と未来の支払いを増やさないための、個人用NO BUY記録PWA。

## v0.8 スマホ表示の整理

- カレンダーの日付を左上へ固定し、状態記号やS／P／Cバッジと重ならない配置へ変更。今日の枠内にあった「TODAY」文字は削除し、青枠だけで示す。
- スマホのカレンダーセルを縦に広げ、記録記号の余白を確保。固定支出バッジがある日も、買わなかった日のチェックと下端を揃える。
- 画面内の英語見出しと状態名を日本語化。ZERO ROOM、Paidy、Firebase、JSONなどの固有名・形式名は維持する。
- 「止まれた回数」と「現在の保留」を「我慢の記録」カードへ統合。累計と当日保留の違いは同じ枠内で確認できる。
- スマホの「欲しい！！」「買った。記録する」を正方形の2列配置へ変更。ジュリアスの一言はHOME上部へ移動。
- 「対象月」と「確認日」の日付入力へiPhone系ブラウザを含む幅制約を追加。購入記録画面も含め、320px／390px幅で横はみ出しがないことを確認した。
- 表示だけの更新で、データ構造はversion 7のまま。v0.7以前の記録、端末内保存、JSON、クラウド同期をそのまま引き継ぐ。

## v0.7 注意支出と小さい後払い

- 「買った。記録する」の購入区分にCAUTION SPEND / 注意支出を追加。選んだ場合だけSNACK / COMFORT FOOD、OPTIONAL DAILY GOODS、OTHER CAUTIONの3分類を表示する。
- 必要な食事・飲料、洗剤や衛生用品などの必需品は「必要な買い物」。お菓子・間食、任意の百均用品や便利グッズは注意支出。予定外の趣味物・追加課金は従来通り趣味・衝動買い。
- HOMEのCAUTION SPENDはカレンダー表示月の実支出合計。3分類の内訳も表示する。予算・残り利用可能額は作らない。
- 注意支出はNO BUYを自動解除しない。カレンダーはCバッジを追加し、固定分のS/Pと併記できる。趣味・衝動買いがあれば¥ + C、なければ✓ + C。薄い✓の段階では未確定で、NO BUY DAYSへの計上はDAILY CHECKで確定後。
- 注意支出／趣味・衝動買いでMERPAY／PAIDYを選ぶとPAYMENT WARNINGを表示。「それでも後払いとして記録する」で実際の後払いを保存できる。「今ある金から払うへ変更」は選択だけを変更し、通常の保存で確定する。既に後払いで支払った場合は、その事実を記録する。
- 必要品・固定分を含め、すべての区分の後払いをNEW AFTERPAY、MERPAY／PAIDY、残高の推定へ従来通り加算する。
- HOMEとREALITY CHECKへ、ポイント・クーポンで購入や後払いを正当化しない短い警句を追加。
- HISTORYから注意支出の金額・分類・日付・支払い方法を訂正／削除でき、月合計とバッジは元記録から再計算する。
- データはversion 7。購入のpurposeにcaution、cautionCategoryにsnack／optional-daily-goods／otherを保存する。v0.6以前の記録を名称から自動再分類しない。JSONと既存の記録単位同期で引き継ぐ。

## CLOUD DATA SIZE

- SETTINGS / SYNC内に表示。WORK ROOMの公開実装（cloud-sync.jsのgetSyncPayloadBytes）を参照し、JSON.stringifyしたデータをBlobにしてUTF-8バイト数を測る方式を再利用した。
- ZERO ROOMでは同期対象の6種の記録をrecordMapsでまとめて計算する。端末内の未送信分も含む。画像・ローカル設定・バックアップ・syncTests・削除マーカー・サーバー付加情報・Firestoreの索引は含まない。
- B／KB／MBを1024単位で切替。「ESTIMATED / 同期対象データの推定サイズ」と明記する。取得失敗はUnavailableと表示する。
- WORK ROOMの900 KB安全上限は単一文書方式専用。ZERO ROOMは記録単位で保存するため、その上限や残容量の表示は移植していない。Firebase全体の使用容量・請求対象量を表すものではない。
- 購入・固定登録・残高・MONTHLY REALITY・NO BUY等の保存、編集、削除、クラウド反映、同期完了、設定画面を開いた時に再計算する。サイズ確認のための追加通信は行わない。

## v0.8への更新

PC・スマホ双方で設定画面のv0.8.0を確認する。旧表示が残る時は、オンラインで一度開いた後に再読み込み、またはアプリを完全に閉じて開き直す。更新のために記録やサイトデータを削除する必要はない。

## 起動と保存

- WORK ROOMと同じ静的PWA構成。GitHub Pagesへそのまま配置できる。
- 画面と記録は端末内データから即時に開き、Firebaseの応答を待たない。
- オフライン中の変更は端末内の送信待ちキューへ保存し、再接続後に自動送信する。
- Firebaseが使えない場合も、端末内保存・JSON書き出し・読み込みは動作する。
- v0.4までの本番データは同じ保存キーから自動移行する。旧「今月の収入 / 給料」は新しい予定収入へ勝手に加算せず、再確認を一度案内する。
- 旧形式の後払いは支払い先を推測せず「旧：後払い先未設定」として残す。

## 維持する機能

- PC・スマホ間のGoogleログイン同期
- `days`、`purchases`、`urges`、`recovery`をID単位で個別同期
- 各記録に `createdAt` / `updatedAt` を保持
- 同時追加を失いにくいレコード単位の同期と削除マーカー
- 初回同期で片側が空なら自動採用、両側に異なる記録があれば件数・最終更新を表示して選択
- `LOCAL` / `SYNCING` / `SYNCED` / `OFFLINE` / `ERROR` の常時表示
- 設定画面に最終同期時刻、未送信件数、キャッシュ状態を表示
- エラー時だけ「再試行」を表示
- DAILY CHECKの質問を趣味・衝動買いに限定
- 必要品はNO BUY資格を失わず、必要品の後払いもNEW AFTERPAYへ加算
- TODAY STATUS、HOLD ACTIVE、RECOVERY、月別履歴、JSONバックアップ
- PWA、オフライン起動、端末内保存
- 月別のMONTHLY REALITYと、不足額を使うREALITY CHECK
- 新規後払いをMERPAY / PAIDYへ分離して集計
- CONFIRMED / NEW SINCE LAST CHECK / ESTIMATED（推定）の残高表示
- 購入記録・日別状態・残高スナップショットの編集と削除
- MONTHLY REALITYを含む編集可能データの `createdAt` / `updatedAt`
- 削除マーカーをクラウドへ残し、別端末で削除済み記録が復活しにくい同期
- ZERO ROOM専用の盾とゼロを組み合わせたPWAアイコン
- `CURRENT CASH + EXPECTED INCOME REMAINING` から今月利用可能額を算出
- 今月利用可能額から必須支払いを引き、予測不足額を「欲しい！！」と緊急停止へ反映
- `NEXT SALARY` は参考値として保持し、今月の計算から除外
- STOPPED URGESは累積、HOLD ACTIVEは翌日までという違いを明記
- スマホの購入記録画面とRECOVERY対象月入力の横幅を補正

## Firestore保存先

v0.8もv0.6以降の保存先を維持する。注意支出は既存purchasesへ保存する。

```text
users/{uid}/zeroroomV3/meta
  ├─ days/{YYYY-MM-DD}
  ├─ purchases/{purchaseId}
  ├─ urges/{urgeId}
  ├─ recovery/{snapshotId}
  ├─ reality/{YYYY-MM}
  └─ fixedCommitments/{fixedId}
```

初回だけ旧 `users/{uid}/zeroroom/state` を読み込み、内容があればv0.3形式へ移行する。旧データを即座に削除はしない。

同梱の `firestore.rules` は、本人のGoogle UID配下だけを読み書き可能にする最小ルールだ。既存プロジェクトの他アプリも同じ `/users/{userId}/{document=**}` 規則を使う場合は、そのまま共存できる。

## 公開時の確認

1. GitHub PagesなどHTTPSの公開先へ全ファイルを配置する。
2. Firebase AuthenticationでGoogleログインを有効にする。
3. 公開ドメインをAuthenticationの承認済みドメインへ追加する。
4. `firestore.rules` と同等の本人限定ルールを反映する。
5. PCでログインして記録し、スマホで同じアカウントへログインして反映を確認する。
6. 片方をオフラインにして記録し、再接続後に両端末へ反映されることを確認する。

ローカルファイルとして直接開いた場合、記録機能は使えるがGoogleログインとPWAは無効。クラウド同期確認にはHTTPSが必要だ。

## v0.6 固定支出のルール

- 購入区分は必要品／事前登録済み固定支出／趣味・衝動買い。既存記録は自動で固定扱いへ変更しない。
- RECOVERYで月別・項目別に名称、金額、FIXED SERVICE／FIXED GAME PASSを登録・編集・削除する。サンプル項目は勝手に登録しない。
- 月途中・過去月の追加、別月への移動、名称・分類の差し替えや増額は、事前の予定だったことを強く確認する。
- REGISTEREDとRECORDEDは事実の集計のみ。残り予算、転用、繰り越し、購入を促す通知は作らない。
- 購入画面では購入月の登録項目から選ぶ。同じ項目の二重記録を避け、金額訂正はHISTORYで行う。
- 固定だけの日は衝動PURCHASEにしない。S／Pバッジを表示し、NO BUYは従来通りDAILY CHECKで確定する。薄い✓は固定のみ記録された未確定日。
- 固定でもMERPAY／PAIDY、NEW AFTERPAY、NEW SINCE LAST CHECK、ESTIMATEDへ通常通り加算する。
- 固定登録額をCURRENT REQUIRED PAYMENTSへ自動加算しない。支払い時期が異なり、二重計上になるため。
- 記録済み状態は関連購入から毎回算出する。別端末での追加・編集・削除にも追従する。
- 登録項目を削除・別月へ移動しても、実際の購入日・支払額・記録時の分類は履歴に保持する。登録総額だけが変わり、過去の支出は消えない。
- 固定項目と購入の関連ID・記録時名称・分類はJSONバックアップ／Firebase同期に含む。
- 旧版で新しい固定購入を編集しないよう、PCとスマホの両方でv0.6への更新を確認してから使う。
