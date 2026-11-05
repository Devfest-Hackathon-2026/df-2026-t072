const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateJson } = require("./gemini");

exports.suggestNextAction = onCall({ region: "asia-northeast1" }, async (request) => {
  const { contentType, contentTitle, contentTags } = request.data;

  if (!contentType || !contentTitle) {
    throw new HttpsError("invalid-argument", "contentType, contentTitle は必須です");
  }

  const tagText = (contentTags || []).join("、");

  const prompt = `
友達と一緒に楽しめそうな共同体験の候補を2〜3個提案してください。

コンテンツ種別: ${contentType}
タイトル: ${contentTitle}
好きなポイント: ${tagText}

映画・アニメなら似た作品を一緒に観に行く提案、音楽なら関連アーティストのライブ・イベントの提案にしてください。
それぞれ "title"（短い候補名）と "note"（一言説明、30字程度）を含めてください。URLが分からない場合は url を省略してください。

出力形式: {"candidates": [{"title": "...", "note": "...", "url": "..."}]}
`.trim();

  try {
    const { candidates } = await generateJson(prompt);
    return { candidates };
  } catch (err) {
    console.error("suggestNextAction failed", err);
    throw new HttpsError("internal", "ネクストアクションの生成に失敗しました");
  }
});
