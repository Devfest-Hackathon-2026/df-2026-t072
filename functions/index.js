const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.generateMessage = require("./src/generateMessage").generateMessage;
exports.generateAiCover = require("./src/aiCover").generateAiCover;
exports.suggestNextAction = require("./src/nextAction").suggestNextAction;
exports.suggestContentForPerson = require("./src/personaSuggest").suggestContentForPerson;
exports.suggestFromYoutube = require("./src/youtubeSuggest").suggestFromYoutube;
exports.calculateScore = require("./src/scoreCalculator").calculateScore;
exports.ogp = require("./src/ogp").ogp;
