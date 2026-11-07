const test = require("node:test");
const assert = require("node:assert/strict");
const { pickDiverseByGenre } = require("../src/youtubeSuggest");

test("picks at most one item per genre before repeating", () => {
  const items = [
    { contentType: "youtube", contentTitle: "a" },
    { contentType: "youtube", contentTitle: "b" },
    { contentType: "music", contentTitle: "c" },
    { contentType: "movie", contentTitle: "d" },
    { contentType: "music", contentTitle: "e" }
  ];

  const result = pickDiverseByGenre(items, 3);

  assert.equal(result.length, 3);
  const genres = result.map((r) => r.contentType);
  assert.deepEqual(new Set(genres).size, new Set(genres.slice(0, 3)).size);
  assert.ok(genres.includes("youtube"));
  assert.ok(genres.includes("music"));
  assert.ok(genres.includes("movie"));
});

test("respects the limit even with fewer distinct genres than limit", () => {
  const items = [
    { contentType: "music", contentTitle: "a" },
    { contentType: "music", contentTitle: "b" }
  ];
  const result = pickDiverseByGenre(items, 5);
  assert.equal(result.length, 2);
});
