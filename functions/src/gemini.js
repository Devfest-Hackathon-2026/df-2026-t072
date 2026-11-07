const { GoogleGenAI } = require("@google/genai");

const LOCATION = "global";
const MODEL_NAME = "gemini-3.5-flash";

let aiClient = null;

function getClient() {
  if (!aiClient) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    aiClient = new GoogleGenAI({ vertexai: true, project: projectId, location: LOCATION });
  }
  return aiClient;
}

async function generateText(prompt) {
  const response = await getClient().models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });
  return response.text.trim();
}

async function generateTextWithImage(prompt, imageBase64, mimeType = "image/jpeg") {
  const response = await getClient().models.generateContent({
    model: MODEL_NAME,
    contents: [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }]
  });
  return response.text.trim();
}

async function generateJson(prompt) {
  const raw = await generateText(`${prompt}\n\n出力は必ずJSONのみ。説明文やコードブロックの記号は不要。`);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { generateText, generateTextWithImage, generateJson };
