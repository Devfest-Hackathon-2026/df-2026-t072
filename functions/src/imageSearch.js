const { defineSecret } = require("firebase-functions/params");

const CUSTOM_SEARCH_API_KEY = defineSecret("CUSTOM_SEARCH_API_KEY");
const CUSTOM_SEARCH_CSE_ID = defineSecret("CUSTOM_SEARCH_CSE_ID");

async function fetchThumbnail(query) {
  const apiKey = CUSTOM_SEARCH_API_KEY.value();
  const cseId = CUSTOM_SEARCH_CSE_ID.value();
  if (!apiKey || !cseId) return null;

  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(apiKey)}` +
    `&cx=${encodeURIComponent(cseId)}` +
    "&searchType=image&num=1&safe=active" +
    `&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("customsearch request failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const item = data.items && data.items[0];
    return item ? item.link : null;
  } catch (err) {
    console.error("fetchThumbnail failed", err);
    return null;
  }
}

module.exports = { fetchThumbnail, CUSTOM_SEARCH_API_KEY, CUSTOM_SEARCH_CSE_ID };
