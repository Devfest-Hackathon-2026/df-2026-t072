export const CONTENT_TYPES = [
  { value: "movie", label: "映画" },
  { value: "anime", label: "アニメ" },
  { value: "drama", label: "ドラマ" },
  { value: "music", label: "音楽" },
  { value: "live", label: "ライブ・フェス" },
  { value: "book", label: "本・漫画" },
  { value: "game", label: "ゲーム" },
  { value: "youtube", label: "YouTube・動画" },
  { value: "podcast", label: "ポッドキャスト" },
  { value: "other", label: "その他" }
];

const SCREEN_LIKE_TAGS = [
  "世界観",
  "ストーリー",
  "キャラクター",
  "映像・演出",
  "音楽・サントラ",
  "テンポ感",
  "メッセージ性",
  "泣ける",
  "笑える",
  "考えさせられる"
];

export const LIKE_TAGS_BY_GENRE = {
  movie: SCREEN_LIKE_TAGS,
  anime: SCREEN_LIKE_TAGS,
  drama: SCREEN_LIKE_TAGS,
  music: ["歌詞", "メロディ", "声・ボーカル", "PV・MV", "ライブ感", "雰囲気", "テンポ", "歌詞の世界観"],
  live: ["演出", "セットリスト", "会場の雰囲気", "アーティストとの距離感", "音の迫力"],
  book: ["ストーリー", "キャラクター", "文体・画風", "世界観", "メッセージ性", "テンポ感"],
  game: ["世界観", "ストーリー", "グラフィック", "音楽", "操作感", "やり込み要素"],
  youtube: ["テンポ・編集", "話題・内容", "キャラクター・出演者", "笑える", "学べる", "癒される"],
  podcast: ["話題・内容", "話し方・テンポ", "ゲスト", "学べる", "聴きやすい"],
  other: ["世界観", "ストーリー", "雰囲気", "クオリティ", "独創性"]
};

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
