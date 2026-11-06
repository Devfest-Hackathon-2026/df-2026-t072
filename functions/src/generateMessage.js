const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateJson, generateTextWithImage } = require("./gemini");
const { fetchThumbnail, CUSTOM_SEARCH_API_KEY, CUSTOM_SEARCH_CSE_ID } = require("./imageSearch");

const CONTENT_TYPE_LABELS = {
  movie: "映画",
  anime: "アニメ",
  drama: "ドラマ",
  music: "音楽",
  live: "ライブ・フェス",
  book: "本・漫画",
  game: "ゲーム",
  youtube: "YouTube・動画",
  podcast: "ポッドキャスト",
  other: "エンタメ"
};

function buildPrompt({
  contentType,
  contentTitle,
  tags,
  disclosureLevel,
  toneHint,
  personName,
  personDescription,
  relationshipStage
}) {
  const typeLabel = CONTENT_TYPE_LABELS[contentType] || contentType;
  const tagText = (tags || []).join("、");
  const depthInstruction =
    disclosureLevel === "deep"
      ? "内側メッセージは、なぜ好きなのかを少し具体的に、熱量が伝わるように書いてください。"
      : "内側メッセージは、さらっと一言添える程度の軽さにしてください。";
  const relationshipInstruction =
    relationshipStage === "new"
      ? "相手とはまだあまり話したことがない関係です。内側メッセージでは「なぜこれを送ったのか」「なぜ相手に合いそうだと思ったのか」の理由を、唐突で不審に見えないようはっきり丁寧に書いてください。"
      : "相手とはよく話す関係です。説明しすぎず、気軽なトーンで大丈夫です。";

  return `
あなたは友人に「好きなエンタメ」をさりげなく共有するのを手伝うアシスタントです。
以下の情報から2種類のメッセージをJSONで生成してください。

コンテンツ種別: ${typeLabel}
タイトル: ${contentTitle}
好きなポイント: ${tagText}
${personName ? `送る相手: ${personName}${personDescription ? `（${personDescription}）` : ""}` : ""}
${toneHint ? `相手とのいつものやり取りのトーン: ${toneHint}` : ""}

- messageOuter: LINEのトーク画面に表示する、さりげない一言（20〜40文字程度、絵文字は控えめに）
- messageInner: リンクを開いたときに見える、なぜこれを選んだかという内容（${disclosureLevel === "deep" ? "80〜150文字程度" : "40〜80文字程度"}）

${depthInstruction}
${relationshipInstruction}

出力形式: {"messageOuter": "...", "messageInner": "..."}
`.trim();
}

async function extractToneHint(screenshotBase64) {
  if (!screenshotBase64) return null;
  const prompt =
    "この画像はLINEのトーク画面のスクリーンショットです。二人のやり取りの文体・絵文字の使い方・距離感を一文で簡潔に説明してください。説明文のみ出力してください。";
  try {
    return await generateTextWithImage(prompt, screenshotBase64);
  } catch (err) {
    console.error("tone extraction failed", err);
    return null;
  }
}

exports.generateMessage = onCall(
  { region: "asia-northeast1", secrets: [CUSTOM_SEARCH_API_KEY, CUSTOM_SEARCH_CSE_ID] },
  async (request) => {
    const {
      contentType,
      contentTitle,
      tags,
      disclosureLevel,
      screenshotBase64,
      knownImageUrl,
      personName,
      personDescription,
      relationshipStage
    } = request.data;

    if (!contentType || !contentTitle || !disclosureLevel) {
      throw new HttpsError("invalid-argument", "contentType, contentTitle, disclosureLevel は必須です");
    }

    const toneHint = await extractToneHint(screenshotBase64);
    const prompt = buildPrompt({
      contentType,
      contentTitle,
      tags,
      disclosureLevel,
      toneHint,
      personName,
      personDescription,
      relationshipStage
    });

    let messageOuter;
    let messageInner;
    try {
      ({ messageOuter, messageInner } = await generateJson(prompt));
    } catch (err) {
      console.error("generateMessage failed", err);
      throw new HttpsError("internal", "メッセージの生成に失敗しました");
    }

    let imageUrl = knownImageUrl || null;
    if (!imageUrl) {
      const typeLabel = CONTENT_TYPE_LABELS[contentType] || contentType;
      imageUrl = await fetchThumbnail(`${contentTitle} ${typeLabel}`);
    }

    return { messageOuter, messageInner, imageUrl };
  }
);
