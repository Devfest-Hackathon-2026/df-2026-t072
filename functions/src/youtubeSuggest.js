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

function pickThumbnail(thumbnails) {
  return thumbnails?.medium?.url || thumbnails?.default?.url || null;
}

async function fetchLikedVideoItems(accessToken) {
  const channelData = await callYoutubeApi("channels?part=contentDetails&mine=true", accessToken);
  const likesPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  if (!likesPlaylistId) return [];

  const itemsData = await callYoutubeApi(
    `playlistItems?part=snippet&maxResults=50&playlistId=${likesPlaylistId}`,
    accessToken
  );
  return (itemsData.items || [])
    .filter((i) => i.snippet?.title)
    .map((i) => ({
      title: i.snippet.title,
      thumbnailUrl: pickThumbnail(i.snippet.thumbnails),
      sourceUrl: i.snippet.resourceId?.videoId
        ? `https://www.youtube.com/watch?v=${i.snippet.resourceId.videoId}`
        : null
    }));
}

async function fetchSubscriptionChannelItems(accessToken) {
  const subsData = await callYoutubeApi(
    "subscriptions?part=snippet&mine=true&maxResults=50",
    accessToken
  );
  return (subsData.items || [])
    .filter((i) => i.snippet?.title)
    .map((i) => ({
      title: i.snippet.title,
      thumbnailUrl: pickThumbnail(i.snippet.thumbnails),
      sourceUrl: i.snippet.resourceId?.channelId
        ? `https://www.youtube.com/channel/${i.snippet.resourceId.channelId}`
        : null
    }));
}

function pickDiverseByGenre(candidates, limit) {
  const seenGenres = new Set();
  const primary = [];
  const rest = [];

  for (const c of candidates) {
    if (!seenGenres.has(c.contentType)) {
      seenGenres.add(c.contentType);
      primary.push(c);
    } else {
      rest.push(c);
    }
  }

  return [...primary, ...rest].slice(0, limit);
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

async function classifyGenres(items) {
  const prompt = buildClassifyPrompt(items.map((i) => i.title));
  const { results } = await generateJson(prompt);
  const genreByIndex = new Map(
    (results || [])
      .filter((r) => r && Number.isInteger(r.index))
      .map((r) => [r.index, r.contentType])
  );

  return items.map((item, i) => {
    const contentType = genreByIndex.get(i);
    return {
      contentType: VALID_GENRES.includes(contentType) ? contentType : "youtube",
      contentTitle: item.title,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl
    };
  });
}

exports.suggestFromYoutube = onCall({ region: "asia-northeast1" }, async (request) => {
  const { accessToken } = request.data;

  if (!accessToken) {
    throw new HttpsError("invalid-argument", "accessToken は必須です");
  }

  let items = await fetchLikedVideoItems(accessToken);
  let source = "likes";

  if (items.length === 0) {
    items = await fetchSubscriptionChannelItems(accessToken);
    source = "subscriptions";
  }

  if (items.length === 0) {
    throw new HttpsError("not-found", "YouTubeの視聴データが見つかりませんでした");
  }

  try {
    const classified = await classifyGenres(items);
    const candidates = pickDiverseByGenre(classified, 5);
    return { candidates, source };
  } catch (err) {
    console.error("suggestFromYoutube classify failed", err);
    const candidates = items.slice(0, 5).map((item) => ({
      contentType: "youtube",
      contentTitle: item.title,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl
    }));
    return { candidates, source };
  }
});
