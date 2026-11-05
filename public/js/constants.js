export const CONTENT_TYPES = [
  { value: "movie", label: "映画・アニメ" },
  { value: "music", label: "音楽" },
  { value: "other", label: "その他エンタメ" }
];

export const LIKE_TAGS = [
  "ストーリー",
  "世界観",
  "キャラクター",
  "音楽・サウンド",
  "映像・ビジュアル",
  "セリフ・歌詞",
  "雰囲気",
  "演出"
];

export const DISCLOSURE_LEVELS = [
  { value: "light", label: "ライト（さらっと共有）" },
  { value: "deep", label: "ディープ（じっくり共有）" }
];

export const REACTIONS = [
  { emoji: "🔥", label: "めちゃ気になる", value: "fire" },
  { emoji: "👀", label: "観てみたい", value: "interested" },
  { emoji: "😮", label: "知らなかった", value: "surprised" },
  { emoji: "💬", label: "語りたい", value: "talk" }
];

export const FLAME_MESSAGES = {
  1: "ほんのり灯ってる",
  2: "じわじわ温まってる",
  3: "いい感じに盛り上がってる",
  4: "かなり熱量高め！"
};

export const REMIND_DAYS = {
  movie: [3, 4],
  music: [1, 2],
  other: [2, 3]
};
