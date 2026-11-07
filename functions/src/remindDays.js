// public/js/constants.js の REMIND_DAYS と対応（フロント/バックエンドで別ランタイムのため複製）
const GENRE_SWEET_SPOT_DAYS = {
  movie: [3, 4],
  anime: [3, 4],
  drama: [3, 4],
  music: [1, 2],
  live: [1, 2],
  book: [2, 3],
  game: [2, 3],
  youtube: [1, 2],
  podcast: [1, 2],
  other: [2, 3]
};

function getSweetSpotDays(contentType) {
  return GENRE_SWEET_SPOT_DAYS[contentType] || [2, 3];
}

module.exports = { GENRE_SWEET_SPOT_DAYS, getSweetSpotDays };
