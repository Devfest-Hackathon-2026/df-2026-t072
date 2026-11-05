const { GoogleGenAI } = require("@google/genai");

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const LOCATION = "global";
const MODEL_NAME = "gemini-3.5-flash";

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: LOCATION });

async function generateText(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });
  return response.text.trim();
}

async function generateTextWithImage(prompt, imageBase64, mimeType = "image/jpeg") {
  const response = await ai.models.generateContent({
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
