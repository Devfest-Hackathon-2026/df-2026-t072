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

function buildClassifyPrompt(titles) {
  return `
以下はYouTubeの動画またはチャンネルのタイトル一覧です。それぞれ最も近いジャンルに分類してください。
新しいタイトルを考えたり、内容を推測して別の作品名に言い換えたりしないでください。あくまで分類だけを行ってください。

タイトル一覧:
${titles.map((t, i) => `${i}: ${t}`).join("\n")}

ジャンルの選択肢: ${VALID_GENRES.join(", ")}
判断がつかない場合は "youtube" にしてください。

出力形式: {"results": [{"index": 0, "contentType": "..."}, ...]}
`.trim();
}

async function classifyGenres(titles) {
  const prompt = buildClassifyPrompt(titles);
  const { results } = await generateJson(prompt);
  const genreByIndex = new Map(
    (results || [])
      .filter((r) => r && Number.isInteger(r.index))
      .map((r) => [r.index, r.contentType])
  );

  return titles.map((title, i) => {
    const contentType = genreByIndex.get(i);
    return {
      contentType: VALID_GENRES.includes(contentType) ? contentType : "youtube",
      contentTitle: title
    };
  });
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

  const topTitles = titles.slice(0, 5);

  try {
    const candidates = await classifyGenres(topTitles);
    return { candidates, source };
  } catch (err) {
    console.error("suggestFromYoutube classify failed", err);
    const candidates = topTitles.map((title) => ({ contentType: "youtube", contentTitle: title }));
    return { candidates, source };
  }
});
