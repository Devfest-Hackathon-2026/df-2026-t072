const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.generateMessage = require("./src/generateMessage").generateMessage;
exports.generateAiCover = require("./src/aiCover").generateAiCover;
exports.suggestNextAction = require("./src/nextAction").suggestNextAction;
exports.calculateScore = require("./src/scoreCalculator").calculateScore;
exports.ogp = require("./src/ogp").ogp;
