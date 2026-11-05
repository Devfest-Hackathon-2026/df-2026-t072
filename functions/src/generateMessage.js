const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateJson, generateTextWithImage } = require("./gemini");

const CONTENT_TYPE_LABELS = {
  movie: "映画・アニメ",
  music: "音楽",
  other: "エンタメ"
};

function buildPrompt({ contentType, contentTitle, tags, disclosureLevel, toneHint }) {
  const typeLabel = CONTENT_TYPE_LABELS[contentType] || contentType;
  const tagText = (tags || []).join("、");
  const depthInstruction =
    disclosureLevel === "deep"
      ? "内側メッセージは、なぜ好きなのかを少し具体的に、熱量が伝わるように書いてください。"
      : "内側メッセージは、さらっと一言添える程度の軽さにしてください。";

  return `
あなたは友人に「好きなエンタメ」をさりげなく共有するのを手伝うアシスタントです。
以下の情報から2種類のメッセージをJSONで生成してください。

コンテンツ種別: ${typeLabel}
タイトル: ${contentTitle}
好きなポイント: ${tagText}
${toneHint ? `相手とのいつものやり取りのトーン: ${toneHint}` : ""}

- messageOuter: LINEのトーク画面に表示する、さりげない一言（20〜40文字程度、絵文字は控えめに）
- messageInner: リンクを開いたときに見える、なぜこれを選んだかという内容（${disclosureLevel === "deep" ? "80〜150文字程度" : "40〜80文字程度"}）

${depthInstruction}

出力形式: {"messageOuter": "...", "messageInner": "..."}
`.trim();
}

async function extractToneHint(screenshotBase64) {
  if (!screenshotBase64) return null;
  const prompt =
    "この画像はLINEのトーク画面のスクリーンショットです。二人のやり取りの文体・絵文字の使い方・距離感を一文で簡潔に説明してください。説明文のみ出力してください。";
  try {
    return await generateTextWithImage(prompt, screenshotBase64);
  } catch (err) {
    console.error("tone extraction failed", err);
    return null;
  }
}

exports.generateMessage = onCall({ region: "asia-northeast1" }, async (request) => {
  const { contentType, contentTitle, tags, disclosureLevel, screenshotBase64 } = request.data;

  if (!contentType || !contentTitle || !disclosureLevel) {
    throw new HttpsError("invalid-argument", "contentType, contentTitle, disclosureLevel は必須です");
  }

  const toneHint = await extractToneHint(screenshotBase64);
  const prompt = buildPrompt({ contentType, contentTitle, tags, disclosureLevel, toneHint });

  try {
    const { messageOuter, messageInner } = await generateJson(prompt);
    return { messageOuter, messageInner };
  } catch (err) {
    console.error("generateMessage failed", err);
    throw new HttpsError("internal", "メッセージの生成に失敗しました");
  }
});
