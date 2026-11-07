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
1. 相手ファーストの5ステップ送信フロー — `index.html` / `send.js`
   - Step1: 相手の名前・人物像の入力（ファーストビュー）
   - Step2: YouTube連携（スキップ可）
   - Step3: 候補から選ぶ／自分でジャンル・タイトルを入力
   - Step4: 好きなポイント・温度感・関係性（よく話す／まだあまり話したことがない）・スクショ
   - Step5: メッセージ生成プレビュー→送信（LINE／他アプリ共有）→完了
2. ライトモードのメッセージ生成（Gemini） — `generateMessage`（相手の人物像・関係性の深さをプロンプトに反映）
3. LINEで共有できるリンク生成 — `send.js`（LINE URLスキーム）／Web Share APIでの他アプリ共有
4. 受け取り側の画面＋絵文字リアクション — `share.html` / `share.js`（関係性が浅い場合は「Resonateとは？」説明を表示）
5. 盛り上がり度スコアの表示 — `status.js` / `scoreCalculator.js`

**できれば（骨格あり）**
6. LINEスクショ解析によるトーンチューニング — `generateMessage.js` 内 `extractToneHint`
7. AIカバーメッセージ — `generateAiCover`
8. ネクストアクション提案 — `suggestNextAction`
9. Google検索連携の画像付き共有カード — `imageSearch.js`（本番デプロイ済み）
10. YouTubeの視聴傾向からのAI提案 — `youtubeSuggest.js` / `send.js` の `setupYoutubeSuggest`（本番デプロイ済み）
11. YouTube由来の候補はサムネイル・元動画リンクをそのまま利用 — `suggestFromYoutube`がthumbnailUrl/sourceUrlを返し、`generateMessage`のGoogle検索をスキップして共有カード・受け取り画面の「元のコンテンツを見る」リンクに反映
12. ~~送る側の入力画面を1画面に集約~~ — Step13の5ステップ刷新により置き換え（履歴として記録のみ）
13. UXフルリニューアル（相手ファースト5ステップ化） — コンテンツ選択を起点にしていた旧フローを破棄し、「誰に送るか」を最初に聞く構成に変更。Step2のYouTube連携でStep1の人物像情報を使ったベン図マッチ（既存の`suggestFromYoutube`のpersona連携をそのまま活用）、スキップ時は`suggestContentForPerson`で人物像のみから提案。Step4で「LINEでよく話す相手か」を選択でき、`relationshipStage`としてDBに保存・`generateMessage`のプロンプトに反映。関係性が浅い場合は受け取り画面に「Resonateとは？」の説明カードを表示し、メッセージ内の理由付けも明確にするよう指示
14. カラーテーマをオレンジ系からブルー系（`#378adb`）に刷新 — CSS変数(`--color-primary`等)を変更するだけで全ページに反映。ベン図の「相手」側の色は、旧プライマリ色だったオレンジ系(`#ff8c5a`)にスライドさせ、青との対比を維持
15. ステップインジケーター — `index.html`の5ステップそれぞれで現在地が分かるドット表示を追加
16. YouTube×ペルソナの掛け合わせ提案（ベン図） — `suggestFromYoutube`に`personName`/`personDescription`を渡すと、実際にいいねした動画・登録チャンネルの中から、その人物像に合いそうなものだけをGeminiが選んで返す（新規の作品名は生成しない）。マッチ時は各候補の「なぜ合いそうか」の理由と、あなた/相手の傾向＋重なるキーワードをSVGのベン図で表示
17. UI改善一式 — 二重送信防止（`onClickOnce`で主要ボタンをクリック中は無効化）、ジャンル未選択時のタグ欄案内、候補一覧の「閉じる」ボタン、スクリーンショットのプレビュー表示、メッセージの文字数カウンター、必須項目バッジ、入力欄への`aria-label`
18. 他アプリ共有（Instagram・TikTokなど） — Web Share API（`navigator.share`）を使った「他のアプリでシェア」ボタンを追加。LINE以外のDMでも送れるように、OS標準の共有シートを呼び出す（対応していないブラウザではボタン自体を非表示）
19. メッセージ生成中のローディングアニメーション — SVGで「家が建っていく」演出（土台→壁→屋根→窓の明かり→ハート/音符が浮かぶ）をブルー系カラーで表現し、サブテキストを5フェーズに分けてフェードイン・アウトで切り替え。生成時間に合わせて表示時間を伸縮（最低3秒）し、完了時は家がパッと明るくなるフラッシュ演出を挟んでからプレビュー画面へ遷移。待機が長引いても止まって見えないよう、建ち終わった後のアイドル状態（窓の明滅・ハート/音符の上下動+回転・家全体の軽いバウンド）も強めに演出（Playwrightのheadless Chromiumでcomputed styleの時系列変化を確認済み）
20. YouTube連携中のローディングアニメーション — Step2の「YouTubeと連携する」待機中にも、あなた(青)と相手(オレンジ)の円が近づいたり離れたりするベン図風アニメーションとキラキラ(✨)の重なり演出、3フェーズのサブテキストを追加
21. PWA化（ホーム画面・アプリ一覧への追加に対応） — `manifest.json`（アイコン・テーマカラー#378adb）、ハウスロゴのアイコン（`public/icons/`、Playwrightでレンダリングして生成）、最小限のService Worker（`service-worker.js`、同一オリジンのGETのみキャッシュ対象。Firebase/Google系の外部リクエストは横取りしない）を追加し、全ページ（`index.html`/`share.html`/`status.html`/`mypage.html`/`ogp.js`）にmanifestリンク・アイコン・SW登録を設定。Chromeの「インストール」やスマホの「ホーム画面に追加」でアプリアイコン付きで保存できる

**未実装（ピッチで語る未来機能）**
- 累積型スコア判定の精度向上
- 送信後のプッシュ通知 — 現状は送った側が`status.html`を開いた時にだけ、リアクション有無に応じたケアメッセージ（`generateAiCover`）が自動表示される仕組み（プル型）。スマホへの能動的な通知（プッシュ通知）には、FCM・Service Worker・通知許可フロー・定期実行（Cloud Scheduler）などの追加インフラが必要なため、別タスクとして今後実装予定

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
- `shares.scoreTriggerType`（instant/cumulative）は保存のみで`scoreCalculator.js`からは未参照。`constants.js`の`REMIND_DAYS`（ジャンル別リマインド日数）もどこからも未使用（将来のプッシュ通知機能と連動させる想定の先行データ）
- Gemini/YouTube APIを呼ぶ関数（`generateMessage`/`suggestFromYoutube`/`suggestContentForPerson`）にレート制限・App Check等の悪用防止策は未設定
- スクリーンショットアップロードにファイルサイズ・形式のバリデーションが無い
- 自動テストなし
