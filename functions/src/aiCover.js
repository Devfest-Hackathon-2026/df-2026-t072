const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateText } = require("./gemini");
const { getSweetSpotDays } = require("./remindDays");

function pickSituation(daysSinceSent, contentType) {
  const [minDay, maxDay] = getSweetSpotDays(contentType);
  if (daysSinceSent < minDay) return "early";
  if (daysSinceSent <= maxDay) return "within";
  return "late";
}

const SITUATION_INSTRUCTIONS = {
  early: "送ってからまだあまり時間が経っていません。急かさず、『まだゆっくり見ている最中かもね』という、せかさない優しいニュアンスで。",
  within: "このジャンルならそろそろ見終わって反応が来てもおかしくない頃合いです。『そろそろ感想聞けるかな』という軽い期待感のニュアンスで。",
  late: "想定より時間が経っています。『もう一度試してみる価値があるかも』と、そっと背中を押してください。"
};

exports.generateAiCover = onCall({ region: "asia-northeast1" }, async (request) => {
  const { contentTitle, contentType, daysSinceSent } = request.data;

  if (contentTitle === undefined || daysSinceSent === undefined) {
    throw new HttpsError("invalid-argument", "contentTitle, daysSinceSent は必須です");
  }

  const situation = pickSituation(daysSinceSent, contentType);
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
