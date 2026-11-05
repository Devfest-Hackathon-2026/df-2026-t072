const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateText } = require("./gemini");

function pickSituation(daysSinceSent) {
  if (daysSinceSent <= 2) return "early";
  return "late";
}

const SITUATION_INSTRUCTIONS = {
  early: "まだ数日しか経っていません。『タイミングが合わなかっただけかも』というニュアンスで、軽く慰めてください。",
  late: "数日経っています。『もう一度試してみる価値があるかも』と、そっと背中を押してください。"
};

exports.generateAiCover = onCall({ region: "asia-northeast1" }, async (request) => {
  const { contentTitle, contentType, daysSinceSent } = request.data;

  if (contentTitle === undefined || daysSinceSent === undefined) {
    throw new HttpsError("invalid-argument", "contentTitle, daysSinceSent は必須です");
  }

  const situation = pickSituation(daysSinceSent);
  const instruction = SITUATION_INSTRUCTIONS[situation];

  const prompt = `
あなたは、エンタメを友達に共有したけどまだ反応がない人に寄り添うアシスタントです。
共有したコンテンツ: ${contentTitle}（${contentType}）
経過日数: ${daysSinceSent}日

${instruction}
一文、温かみのある短いメッセージのみを出力してください（30〜60文字程度）。説明や記号は不要です。
`.trim();

  try {
    const message = await generateText(prompt);
    return { message, situation };
  } catch (err) {
    console.error("generateAiCover failed", err);
    throw new HttpsError("internal", "カバーメッセージの生成に失敗しました");
  }
});
