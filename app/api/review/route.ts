import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-2.5-flash";
const MAX_CHARS = 200000;

type Flag = {
  severity: "high" | "medium" | "low";
  issue: string;
  guideline_quote: string;
  offending_text: string;
  suggested_fix: string;
};

const flagSchema = {
  type: Type.OBJECT,
  properties: {
    flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
          issue: { type: Type.STRING, description: "What is wrong, in one plain sentence." },
          guideline_quote: {
            type: Type.STRING,
            description:
              "The exact text of the guideline this breaks, copied verbatim from the GUIDELINES. If no guideline supports the flag, do not raise it.",
          },
          offending_text: {
            type: Type.STRING,
            description: "The exact span of CONTENT that breaks the rule, copied verbatim.",
          },
          suggested_fix: {
            type: Type.STRING,
            description: "A corrected version of the offending text that keeps the writer's voice.",
          },
        },
        required: ["severity", "issue", "guideline_quote", "offending_text", "suggested_fix"],
        propertyOrdering: ["severity", "issue", "guideline_quote", "offending_text", "suggested_fix"],
      },
    },
  },
  required: ["flags"],
};

function norm(s: string): string {
  return s
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing GEMINI_API_KEY. Add it in the environment and redeploy." },
      { status: 500 },
    );
  }

  let guidelines: unknown, content: unknown;
  try {
    ({ guidelines, content } = await request.json());
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof guidelines !== "string" || typeof content !== "string") {
    return Response.json(
      { error: "Both 'guidelines' and 'content' are required text fields." },
      { status: 400 },
    );
  }
  if (!guidelines.trim() || !content.trim()) {
    return Response.json(
      { error: "Please provide both brand guidelines and content to review." },
      { status: 400 },
    );
  }
  if (guidelines.length > MAX_CHARS || content.length > MAX_CHARS) {
    return Response.json(
      { error: `Keep guidelines and content under ${MAX_CHARS} characters each for this demo.` },
      { status: 413 },
    );
  }

  const prompt = `You are Aegis, a brand-governance reviewer. Check the CONTENT against the GUIDELINES.

Rules for your review:
- Raise a flag ONLY when the content breaks a specific rule that is written in the GUIDELINES.
- For every flag, "guideline_quote" MUST be copied word-for-word from the GUIDELINES. Do not paraphrase it. Do not invent a rule that is not written there.
- "offending_text" MUST be copied word-for-word from the CONTENT.
- If the content fully complies, return an empty "flags" array.
- Do not flag matters of taste the guidelines are silent on.

GUIDELINES:
"""
${guidelines}
"""

CONTENT:
"""
${content}
"""`;

  let raw: string;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: flagSchema,
        temperature: 0,
      },
    });
    raw = res.text ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error calling the AI service.";
    return Response.json({ error: `AI review failed: ${msg}` }, { status: 502 });
  }

  let parsed: { flags?: Flag[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "The AI returned an unreadable response. Try again." }, { status: 502 });
  }

  const g = norm(guidelines);
  const all = Array.isArray(parsed.flags) ? parsed.flags : [];

  const kept = all.filter((f) => f?.guideline_quote && g.includes(norm(f.guideline_quote)));
  const droppedUnsupported = all.length - kept.length;

  return Response.json({
    flags: kept,
    meta: {
      model: MODEL,
      total_raised: all.length,
      dropped_unsupported: droppedUnsupported,
    },
  });
}
