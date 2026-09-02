# JULIUS ZERO ROOM v0.3.0 · CLOUD SYNC

新しい物と未来の支払いを増やさないための、個人用NO BUY記録PWA。

## 起動と保存

- WORK ROOMと同じ静的PWA構成。GitHub Pagesへそのまま配置できる。
- 画面と記録は端末内データから即時に開き、Firebaseの応答を待たない。
- オフライン中の変更は端末内の送信待ちキューへ保存し、再接続後に自動送信する。
- Firebaseが使えない場合も、端末内保存・JSON書き出し・読み込みは動作する。
- v0.2までの本番データは同じ保存キーから自動移行する。

## v0.3機能

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

## Firestore保存先

v0.3は次のレコード単位の保存先を使用する。

```text
users/{uid}/zeroroomV3/meta
  ├─ days/{YYYY-MM-DD}
  ├─ purchases/{purchaseId}
  ├─ urges/{urgeId}
  └─ recovery/{snapshotId}
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

