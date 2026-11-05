const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateJson } = require("./gemini");

const VALID_GENRES = ["movie", "anime", "drama", "music", "live", "book", "game", "youtube", "podcast", "other"];

async function callYoutubeApi(path, accessToken) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (res.status === 401) {
    throw new HttpsError("unauthenticated", "YouTubeの認証が切れています。もう一度連携してね");
  }
  if (res.status === 403) {
    throw new HttpsError(
      "permission-denied",
      "YouTube Data APIが有効化されていないか、権限が不足しています"
    );
  }
  if (!res.ok) {
    console.error("youtube api request failed", path, res.status, await res.text());
    throw new HttpsError("internal", "YouTubeの情報取得に失敗しました");
  }
  return res.json();
}

async function fetchLikedVideoTitles(accessToken) {
  const channelData = await callYoutubeApi("channels?part=contentDetails&mine=true", accessToken);
  const likesPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  if (!likesPlaylistId) return [];

  const itemsData = await callYoutubeApi(
    `playlistItems?part=snippet&maxResults=15&playlistId=${likesPlaylistId}`,
    accessToken
  );
  return (itemsData.items || []).map((i) => i.snippet.title).filter(Boolean);
}

async function fetchSubscriptionChannelTitles(accessToken) {
  const subsData = await callYoutubeApi(
    "subscriptions?part=snippet&mine=true&maxResults=15",
    accessToken
  );
  return (subsData.items || []).map((i) => i.snippet.title).filter(Boolean);
}

function buildPrompt(titles, source) {
  const label = source === "likes" ? "いいねした動画のタイトル" : "チャンネル登録しているチャンネル名";
  return `
あなたは、友達に「好きなエンタメ」をさりげなく共有するのを手伝うアシスタントです。
以下はある人のYouTubeの${label}です。この傾向から、その人が好きそうなエンタメコンテンツを3〜5個提案してください。
YouTube自体の動画タイトルをそのまま提案するのではなく、その興味の傾向から推測される映画・アニメ・音楽・ゲームなどの具体的な作品名を提案してください。

${label}:
${titles.map((t) => `- ${t}`).join("\n")}

各候補について以下を含めてください:
- contentType: 次のいずれか1つ（${VALID_GENRES.join(", ")}）
- contentTitle: 具体的なコンテンツ名（実在するもの）
- reason: なぜこの人に合いそうか、一言（20〜40文字程度）

出力形式: {"candidates": [{"contentType": "...", "contentTitle": "...", "reason": "..."}]}
`.trim();
}

exports.suggestFromYoutube = onCall({ region: "asia-northeast1" }, async (request) => {
  const { accessToken } = request.data;

  if (!accessToken) {
    throw new HttpsError("invalid-argument", "accessToken は必須です");
  }

  let titles = await fetchLikedVideoTitles(accessToken);
  let source = "likes";

  if (titles.length === 0) {
    titles = await fetchSubscriptionChannelTitles(accessToken);
    source = "subscriptions";
  }

  if (titles.length === 0) {
    throw new HttpsError("not-found", "YouTubeの視聴データが見つかりませんでした");
  }

  const prompt = buildPrompt(titles, source);

  try {
    const { candidates } = await generateJson(prompt);
    const filtered = (candidates || [])
      .filter((c) => c && c.contentTitle && VALID_GENRES.includes(c.contentType))
      .slice(0, 5);
    return { candidates: filtered, source };
  } catch (err) {
    console.error("suggestFromYoutube failed", err);
    throw new HttpsError("internal", "提案の生成に失敗しました");
  }
});
