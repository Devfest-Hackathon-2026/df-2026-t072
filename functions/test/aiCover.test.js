const test = require("node:test");
const assert = require("node:assert/strict");
const { pickSituation } = require("../src/aiCover");

test("music (sweet spot 1-2 days): day 0 is early, day 1-2 is within, day 3+ is late", () => {
  assert.equal(pickSituation(0, "music"), "early");
  assert.equal(pickSituation(1, "music"), "within");
  assert.equal(pickSituation(2, "music"), "within");
  assert.equal(pickSituation(3, "music"), "late");
});

test("movie (sweet spot 3-4 days): day 1 is early, day 3-4 is within, day 5+ is late", () => {
  assert.equal(pickSituation(1, "movie"), "early");
  assert.equal(pickSituation(3, "movie"), "within");
  assert.equal(pickSituation(4, "movie"), "within");
  assert.equal(pickSituation(5, "movie"), "late");
});

test("unknown content type falls back to the default window", () => {
  assert.equal(pickSituation(0, "mystery-genre"), "early");
  assert.equal(pickSituation(2, "mystery-genre"), "within");
  assert.equal(pickSituation(4, "mystery-genre"), "late");
});
