const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const LONG_TEXT_THRESHOLD = 15;

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function scoreToFlameLevel(score) {
  if (score >= 6) return 4;
  if (score >= 4) return 3;
  if (score >= 2) return 2;
  return 1;
}

exports.calculateScore = onDocumentWritten(
  { document: "reactions/{shareId}", region: "asia-northeast1" },
  async (event) => {
    const shareId = event.params.shareId;
    const reaction = event.data.after.data();
    if (!reaction) return;

    const db = getFirestore();
    const shareSnap = await db.collection("shares").doc(shareId).get();
    if (!shareSnap.exists) return;
    const share = shareSnap.data();

    let score = 0;

    const createdAt = share.createdAt ? share.createdAt.toDate() : null;
    const reactedAt = reaction.reactedAt ? reaction.reactedAt.toDate() : null;
    if (createdAt && reactedAt && isSameDay(createdAt, reactedAt)) {
      score += 3; // 返信速度: 高
    }

    const comment = reaction.comment || "";
    if (EMOJI_REGEX.test(comment)) {
      score += 2; // 絵文字あり: 中
    }
    if (comment.length >= LONG_TEXT_THRESHOLD) {
      score += 2; // テキスト量: 中
    }

    // 往復回数は現状のスキーマ（reactions/{shareId}が1件のみ）では追えないため、
    // 今後やり取りを複数保持する構造に拡張する際にここで加点する。

    await db
      .collection("scores")
      .doc(shareId)
      .set({
        flameLevel: scoreToFlameLevel(score),
        lastUpdated: new Date()
      });
  }
);
