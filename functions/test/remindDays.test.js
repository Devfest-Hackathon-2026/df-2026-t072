const test = require("node:test");
const assert = require("node:assert/strict");
const { getSweetSpotDays } = require("../src/remindDays");

test("known genre returns its own sweet-spot window", () => {
  assert.deepEqual(getSweetSpotDays("music"), [1, 2]);
  assert.deepEqual(getSweetSpotDays("movie"), [3, 4]);
});

test("unknown genre falls back to [2, 3]", () => {
  assert.deepEqual(getSweetSpotDays("unknown-genre"), [2, 3]);
  assert.deepEqual(getSweetSpotDays(undefined), [2, 3]);
});
