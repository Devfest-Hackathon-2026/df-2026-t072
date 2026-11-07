const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { getSweetSpotDays } = require("./remindDays");

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const LONG_TEXT_THRESHOLD = 15;

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
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

    if (share.scoreTriggerType === "cumulative") {
      // ディープ共有は「じっくり受け止めて、ちょうど良いタイミングで反応してくれたか」を重視する
      const [minDay, maxDay] = getSweetSpotDays(share.contentType);
      const elapsedDays = createdAt && reactedAt ? daysBetween(createdAt, reactedAt) : null;
      if (elapsedDays !== null && elapsedDays >= minDay && elapsedDays <= maxDay) {
        score += 3; // ジャンル別の「良いタイミング」窓内での反応: 高
      } else if (elapsedDays === 0) {
        score += 1; // 即日だが、ディープな内容を消化する間もない反応: 弱め
      } else if (elapsedDays !== null && elapsedDays > maxDay) {
        score += 1; // 窓を過ぎてからの反応: 弱め
      }
    } else if (createdAt && reactedAt && isSameDay(createdAt, reactedAt)) {
      score += 3; // ライト共有は即日反応を重視: 返信速度 高
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

exports.isSameDay = isSameDay;
exports.daysBetween = daysBetween;
exports.scoreToFlameLevel = scoreToFlameLevel;
