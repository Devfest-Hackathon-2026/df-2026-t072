# Resonate

エンタメの好みを共有することで、コミュニティ内の「なんとなく仲良くなりたい人」との関係を自然に深めるWebアプリ。

プロダクト仕様は `resonate_dev_start.md`（元ドキュメント）を参照。本リポジトリはそのMVPの骨格実装。

## 技術スタック

- フロントエンド: HTML / CSS / Vanilla JavaScript（Firebase JS SDK v10, ESM / CDN読み込み）
- バックエンド: Firebase Hosting + Cloud Functions for Firebase (Node.js 22)
- DB・認証: Firestore / Firebase Authentication（匿名認証）
- AI生成: Vertex AI Gemini API（`@google/genai`、マルチモーダル対応）

## ディレクトリ構成

```
public/              Firebase Hosting の配信ルート
  index.html         画面① 送る側
  share.html         画面② 受け取る側（静的フォールバック版）
  status.html        画面③ 送った側（スコア・ネクストアクション）
  mypage.html        送信履歴一覧
  css/style.css
  js/
    firebase-config.js  Firebase設定（要書き換え）
    auth.js             Firebase初期化・匿名認証
    constants.js         選択肢・定数
    send.js / share.js / status.js / mypage.js

functions/           Cloud Functions
  index.js
  src/
    gemini.js            Vertex AI Gemini クライアントのラッパー
    generateMessage.js    メッセージ生成（ライト/スクショトーン解析）
    aiCover.js            スルー時のAIカバーメッセージ
    nextAction.js         ネクストアクション提案
    scoreCalculator.js    reactions書き込みをトリガーに盛り上がりスコアを計算
    ogp.js                /share/:id への動的OGP配信（LINEプレビュー対応）

firebase.json / firestore.rules / firestore.indexes.json / .firebaserc
```

## 最初にやること

### 1. Firebase プロジェクトの初期設定

```bash
npm install -g firebase-tools
firebase login
```

1. [Firebaseコンソール](https://console.firebase.google.com/)で `resonate-app` プロジェクトを作成
2. Authentication → Sign-in method で「匿名」を有効化
3. Firestore Database を作成（本番モード）
4. プロジェクトの設定 → 全般 → ウェブアプリを追加し、設定値を `public/js/firebase-config.js` に反映
5. `.firebaserc` の `default` を実際のプロジェクトIDに変更

### 2. Vertex AI（Gemini API）の接続確認

1. GCPコンソールで対象プロジェクトの Vertex AI API を有効化
2. Cloud Functions の実行サービスアカウントに `roles/aiplatform.user` を付与
3. `functions/src/gemini.js` の `LOCATION` / `MODEL_NAME` を必要に応じて変更
4. ローカル確認は `firebase emulators:start` でのエミュレータ実行、本番確認は一度 `firebase deploy --only functions` してログで疎通確認

### 3. ローカル実行

```bash
cd functions && npm install && cd ..
firebase emulators:start
```

`http://localhost:5000` で `public/` が配信される。`/share/**` は `firebase.json` のrewriteにより `ogp` 関数が応答する。

### 4. デプロイ

```bash
firebase deploy
```

## MVP優先順位（実装状況）

**コア（骨格あり・プロンプト/UIは要調整）**
1. コンテンツ選択＋タグ選択 — `index.html` / `send.js`
2. ライトモードのメッセージ生成（Gemini） — `generateMessage`
3. LINEで共有できるリンク生成 — `send.js`（LINE URLスキーム）
4. 受け取り側の画面＋絵文字リアクション — `share.html` / `share.js`
5. 盛り上がり度スコアの表示 — `status.js` / `scoreCalculator.js`

**できれば（骨格あり）**
6. LINEスクショ解析によるトーンチューニング — `generateMessage.js` 内 `extractToneHint`
7. AIカバーメッセージ — `generateAiCover`
8. ネクストアクション提案 — `suggestNextAction`
9. Google検索連携の画像付き共有カード — `imageSearch.js`（本番デプロイ済み）
10. YouTubeの視聴傾向からのAI提案 — `youtubeSuggest.js` / `send.js` の `setupYoutubeSuggest`（本番デプロイ済み）
11. YouTube由来の候補はサムネイル・元動画リンクをそのまま利用 — `suggestFromYoutube`がthumbnailUrl/sourceUrlを返し、`generateMessage`のGoogle検索をスキップして共有カード・受け取り画面の「元のコンテンツを見る」リンクに反映
12. 送る側の入力画面を1画面に集約 — プレゼン等で素早く生成まで行けるよう、旧Step1〜3（コンテンツ選択・タグ・温度感）を1つの`<section data-step="1">`にまとめ、「メッセージを作る」ボタン1つで生成に進む構成に変更（プレビュー画面=Step2、送信完了=Step3）
13. YouTube×ペルソナの掛け合わせ提案（ベン図） — `suggestFromYoutube`に`personName`/`personDescription`を渡すと、実際にいいねした動画・登録チャンネルの中から、その人物像に合いそうなものだけをGeminiが選んで返す（新規の作品名は生成しない）。「相手に合わせて」欄が空ならジャンル分散選出のまま

**未実装（ピッチで語る未来機能）**
- 累積型スコア判定の精度向上

## YouTube連携のセットアップ（`suggestFromYoutube`）

いいねした動画（取得できない場合はチャンネル登録チャンネル）の傾向から、Geminiが共有コンテンツの候補を提案する。実装はOAuth2のImplicit Flow（Google Identity Services）で、サーバー側にAPIキーやSecretは不要。

1. GCPコンソールで対象プロジェクトの YouTube Data API v3 を有効化
2. APIs と サービス → 認証情報 で OAuth クライアント ID（ウェブ アプリケーション）を作成
   - 承認済みの JavaScript 生成元に Firebase Hosting の URL を追加（例: `https://resonate-app-35.web.app`）
3. 発行されたクライアントIDを `public/js/youtube-config.js` の `YOUTUBE_CLIENT_ID` に反映（公開情報なのでそのままコミットしてよい）
4. `index.html` の「YouTubeと連携する」ボタンから動作確認

## 既知の制約・今後の拡張ポイント

- `reactions/{shareId}` は1件のみを保持するスキーマのため、「往復回数2往復以上」のスコアリング信号は未実装（サブコレクション化などの拡張が必要）
- 送信者の表示名はFirebase Authの匿名ユーザーには存在しないため、`shares.senderName` という追加フィールドを入力式で持たせている
- 画像解析・JSON生成はGeminiの出力ゆらぎに弱いため、本実装時はスキーマ検証とリトライを追加すること
