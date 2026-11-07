const test = require("node:test");
const assert = require("node:assert/strict");
const { isSameDay, daysBetween, scoreToFlameLevel } = require("../src/scoreCalculator");

test("isSameDay compares calendar day, not just 24h distance", () => {
  assert.equal(isSameDay(new Date("2026-01-01T23:00:00"), new Date("2026-01-01T01:00:00")), true);
  assert.equal(isSameDay(new Date("2026-01-01T23:00:00"), new Date("2026-01-02T01:00:00")), false);
});

test("daysBetween floors to whole days", () => {
  assert.equal(daysBetween(new Date("2026-01-01T00:00:00"), new Date("2026-01-03T23:59:00")), 2);
  assert.equal(daysBetween(new Date("2026-01-01T12:00:00"), new Date("2026-01-01T13:00:00")), 0);
});

test("scoreToFlameLevel thresholds", () => {
  assert.equal(scoreToFlameLevel(0), 1);
  assert.equal(scoreToFlameLevel(1), 1);
  assert.equal(scoreToFlameLevel(2), 2);
  assert.equal(scoreToFlameLevel(3), 2);
  assert.equal(scoreToFlameLevel(4), 3);
  assert.equal(scoreToFlameLevel(5), 3);
  assert.equal(scoreToFlameLevel(6), 4);
  assert.equal(scoreToFlameLevel(100), 4);
});
