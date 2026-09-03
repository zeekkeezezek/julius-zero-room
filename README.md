# JULIUS ZERO ROOM v0.6.0 · FIXED COMMITMENTS

新しい物と未来の支払いを増やさないための、個人用NO BUY記録PWA。

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

v0.6も既存の保存先を維持し、固定項目の個別コレクションを追加する。

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
