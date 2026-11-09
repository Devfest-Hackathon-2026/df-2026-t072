# Resonate

🔗 **デプロイURL**: https://resonate-app-35.web.app/

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
22. `reactions`のFirestoreルール修正 — 認証済みなら誰でも任意のreactionsを作成・上書きできた穴を塞ぎ、`reactorId`が自分のuidと一致する場合のみ作成・更新を許可
23. 死んでいたロジックに実際の分岐を追加 — `shares.scoreTriggerType`（instant/cumulative）を`scoreCalculator.js`で実際に参照し、ディープ(cumulative)共有は「ジャンル別の良いタイミング窓」（`functions/src/remindDays.js`、旧`REMIND_DAYS`相当）内での反応を高く評価する計算式に分岐。`generateAiCover`も同じ窓を使い、経過日数を「早すぎ／ちょうど良い／遅め」の3段階でジャンルごとに判定してメッセージの言い回しを変えるように変更（従来は全ジャンル一律で2値判定だった）
24. 全画面の背景デザインを刷新 — ダークネイビー〜ダークブルーのグラデーション（`#0F1923`→`#1A2A3A`、`background-attachment: fixed`）に変更し、映画・音楽・ゲーム等のエンタメアイコンを薄く（opacity 0.045〜0.06、一部ぼかし）散りばめたテクスチャを重ねた。テクスチャはPlaywrightで1枚の透過PNG（`public/img/bg-texture.png`、900x900、約53KB）として書き出し済みの静的画像をタイル状に敷く方式のため、DOM要素やアニメーション無しで軽量。カード・ボタンは引き続き白背景で浮き出るデザインを維持し、ヘッダーのロゴ・ナビリンクなど背景に直接乗る文字だけ明るい色（`--color-on-dark`/`--color-on-dark-sub`）に変更
25. UI仕上げ — `.card`にbox-shadowを追加しダーク背景からの浮き出し感を強化、`.btn`にホバー/押下時のフィードバック（明るさ変化・縮小・色付きの発光シャドウ）を追加、マイページに読み込み中/失敗時の表示を追加
26. プライバシーポリシーページ（`public/privacy.html`）を追加 — OAuthを本番環境に公開する際にGoogleから必須要求されるため作成。取得する情報・YouTube連携データの扱い（Limited Use要件）・外部サービス・問い合わせ先を記載
27. 盛り上がり度を「相手ごとの累積」に変更 — 従来は1回の送信＝1回のリアクションの炎レベルだけで、同じ相手に何度送っても積み上がらなかった。新しく`relationships/{senderId}__{相手の名前}`コレクションを追加し、同じ相手への全シェアのスコアを合算して累積炎レベル（1〜4）を算出するように変更。`status.html`はこの累積値を表示し、ネクストアクション提案も累積レベルで判定する。相手の名前（Step1で必須入力）をキーに使うため、新フローで送った分から有効（`functions/src/scoreCalculator.js`の`cumulativeScoreToFlameLevel`、テスト追加済み）
28. 体感速度の改善（質は変えずに待ち時間だけ短縮） — `generateMessage`では画像検索(Google Custom Search)がメッセージ本文生成の完了を待ってから実行されていたが、互いに依存しないためPromise.allで並列化。`suggestFromYoutube`では「ジャンル分類」と「相手向けの候補選定」が直列(分類結果を選定プロンプトのヒントとして渡していた)だったが、選定側をタイトルのみから判断する形に変えて依存関係を外し、2つを並列実行するように変更（Gemini呼び出し回数は変わらず、待ち時間のみ短縮）

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
- Gemini/YouTube APIを呼ぶ関数（`generateMessage`/`suggestFromYoutube`/`suggestContentForPerson`）にレート制限・App Check等の悪用防止策は未設定
- ネクストアクション提案（Goサイン）は累積スコアの閾値のみで判定しており、「お互いに送り合っている（相互送信）」を検知して即Go判定する機能は未実装。現状は匿名認証＋自由記述の宛先名ベースの設計のため、送信者と受信者を同一アカウントとして紐付けられない（招待リンク等での相互アカウント連携の仕組みが必要）

## 直近の修正（セキュリティ・堅牢性）

- `reactions`のFirestoreルールを修正し、`reactorId`が自分のuidと一致する場合のみ作成・更新できるように（従来は認証済みなら誰でも任意のreactionsを作成・上書き可能だった）
- `shares`/`reactions`のFirestoreルールに最低限のスキーマ検証を追加（型・文字数の上限チェック）し、Cloud Functionsを経由しない直接書き込みでゴミデータが入らないようにした
- スクリーンショットのファイルサイズ（5MBまで）・形式（image/*）をクライアント側で検証し、`generateMessage`側でもbase64の長さ・タイトル/人物像の文字数に防御的な上限チェックを追加
- `gemini.js`がrequireされた瞬間にGoogleGenAIクライアントを生成していた問題を修正し、実際に使う時まで遅延初期化するように変更（環境変数が無い状況で即座に落ちていた）
- `functions/test/`に最小限の自動テストを追加（`npm test`で実行、`node --test`使用、外部APIキー不要の純粋関数のみ対象）：`scoreToFlameLevel`/`isSameDay`/`daysBetween`/`pickSituation`/`getSweetSpotDays`/`pickDiverseByGenre`
