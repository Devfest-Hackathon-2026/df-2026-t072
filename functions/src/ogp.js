const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage({ shareId, title, description, imageUrl, sourceUrl }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ""}
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#378adb" />
<link rel="icon" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<link rel="stylesheet" href="/css/style.css" />
<script>window.RESONATE_SHARE_ID = ${JSON.stringify(shareId)};</script>
</head>
<body>
<div class="app">
  <header class="app-header">
    <span class="logo">Resonate</span>
  </header>

  <div id="loading-card" class="card">
    <p class="loading">読み込み中...</p>
  </div>

  <div id="about-card" class="card hidden">
    <h2>Resonateとは？</h2>
    <p class="sub">好きなエンタメをさりげなく共有して、仲を深めるためのアプリだよ。気になったら下のボタンでリアクションしてみてね。</p>
  </div>

  <div id="content-card" class="card hidden">
    <p class="sub" id="from-label"></p>
    <img id="content-image" class="content-image hidden" alt="" />
    <h1 id="content-title"></h1>
    <p id="content-type-label" class="sub"></p>
    <p id="message-inner"></p>
    <a id="source-link" class="btn btn-secondary hidden" href="${sourceUrl ? escapeHtml(sourceUrl) : "#"}" target="_blank" rel="noopener" style="text-decoration:none; display:block; text-align:center;">元のコンテンツを見る</a>
  </div>

  <div id="reaction-card" class="card hidden">
    <h2>どう思った？</h2>
    <div class="reaction-grid" id="reaction-grid"></div>
    <div style="margin-top:14px;">
      <textarea id="comment-input" placeholder="ひとこと（任意）"></textarea>
    </div>
    <div class="nav-buttons">
      <button class="btn btn-primary" id="submit-reaction-btn" disabled>送る</button>
    </div>
  </div>

  <div id="thanks-card" class="card hidden">
    <h1>ありがとう！</h1>
    <p class="sub">気持ちが伝わったよ。ゆっくり楽しんでね。</p>
  </div>

  <div id="not-found-card" class="card hidden">
    <h1>見つかりませんでした</h1>
    <p class="sub">リンクが正しいか確認してね</p>
  </div>
</div>

<script type="module" src="/js/share.js"></script>
<script src="/js/register-sw.js"></script>
</body>
</html>`;
}

exports.ogp = onRequest({ region: "asia-northeast1" }, async (req, res) => {
  const match = req.path.match(/\/share\/([^/]+)/);
  const shareId = match ? match[1] : null;

  if (!shareId) {
    res.status(404).send("Not found");
    return;
  }

  const db = getFirestore();
  const shareSnap = await db.collection("shares").doc(shareId).get();

  if (!shareSnap.exists) {
    res.status(404).send(
      renderPage({
        shareId,
        title: "Resonate",
        description: "見つかりませんでした"
      })
    );
    return;
  }

  const share = shareSnap.data();
  const title = `${share.senderName || "だれか"}から「${share.contentTitle}」が届いたよ`;
  const description = share.messageOuter || "Resonateで好きなものが届きました";

  res.set("Cache-Control", "public, max-age=60");
  res.status(200).send(
    renderPage({
      shareId,
      title,
      description,
      imageUrl: share.imageUrl || null,
      sourceUrl: share.sourceUrl || null
    })
  );
});
