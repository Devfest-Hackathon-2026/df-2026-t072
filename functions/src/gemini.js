const { VertexAI } = require("@google-cloud/vertexai");

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const LOCATION = "asia-northeast1";
const MODEL_NAME = "gemini-1.5-flash";

const vertexAi = new VertexAI({ project: PROJECT_ID, location: LOCATION });

function getModel() {
  return vertexAi.getGenerativeModel({ model: MODEL_NAME });
}

async function generateText(prompt) {
  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  return result.response.candidates[0].content.parts[0].text.trim();
}

async function generateTextWithImage(prompt, imageBase64, mimeType = "image/jpeg") {
  const model = getModel();
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }]
      }
    ]
  });
  return result.response.candidates[0].content.parts[0].text.trim();
}

async function generateJson(prompt) {
  const raw = await generateText(`${prompt}\n\n出力は必ずJSONのみ。説明文やコードブロックの記号は不要。`);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { generateText, generateTextWithImage, generateJson };
