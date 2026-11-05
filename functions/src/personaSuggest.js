const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateJson } = require("./gemini");

const VALID_GENRES = ["movie", "anime", "drama", "music", "live", "book", "game", "youtube", "podcast", "other"];

function buildPrompt({ personName, personDescription }) {
  return `
あなたは、友達に「好きなエンタメ」をさりげなく共有するのを手伝うアシスタントです。
以下の人物像に合いそうなエンタメコンテンツを3〜5個提案してください。

相手の名前: ${personName}
相手がどんな人か: ${personDescription}

各候補について以下を含めてください:
- contentType: 次のいずれか1つ（${VALID_GENRES.join(", ")}）
- contentTitle: 具体的なコンテンツ名（実在するもの）
- reason: なぜこの人に合いそうか、一言（20〜40文字程度）

出力形式: {"candidates": [{"contentType": "...", "contentTitle": "...", "reason": "..."}]}
`.trim();
}

exports.suggestContentForPerson = onCall({ region: "asia-northeast1" }, async (request) => {
  const { personName, personDescription } = request.data;

  if (!personName || !personDescription) {
    throw new HttpsError("invalid-argument", "personName, personDescription は必須です");
  }

  const prompt = buildPrompt({ personName, personDescription });

  try {
    const { candidates } = await generateJson(prompt);
    const filtered = (candidates || [])
      .filter((c) => c && c.contentTitle && VALID_GENRES.includes(c.contentType))
      .slice(0, 5);
    return { candidates: filtered };
  } catch (err) {
    console.error("suggestContentForPerson failed", err);
    throw new HttpsError("internal", "提案の生成に失敗しました");
  }
});
