import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_CHARS = 6_000_000;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing GEMINI_API_KEY. Add it in the environment and redeploy." },
      { status: 500 },
    );
  }

  let image: unknown;
  try {
    ({ image } = await request.json());
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "A base64 image data URL is required." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return Response.json({ error: "Page image is too large to transcribe." }, { status: 413 });
  }

  const match = image.match(/^data:(image\/[a-z.+-]+);base64,(.+)$/);
  if (!match) {
    return Response.json({ error: "Malformed image data URL." }, { status: 400 });
  }
  const mimeType = match[1];
  const data = match[2];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data } },
            {
              text: "Transcribe all text in this document page exactly as written, preserving line breaks and reading order. Return only the transcribed text with no commentary. If the page has no readable text, return an empty response.",
            },
          ],
        },
      ],
      config: { temperature: 0 },
    });
    return Response.json({ text: res.text ?? "" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error calling the AI service.";
    return Response.json({ error: `OCR failed: ${msg}` }, { status: 502 });
  }
}
