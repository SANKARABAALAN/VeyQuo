import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.AV_API_KEY || "";
const isGroq = apiKey.startsWith("gsk_");

const getAiClient = () => {
  if (!apiKey || isGroq) return null;
  return new GoogleGenAI({ apiKey });
};

const aiClient = getAiClient();

export async function generateText(
  prompt: string, 
  jsonMode: boolean = false,
  useSearch: boolean = false
): Promise<string> {
  if (!apiKey) {
    throw new Error("No AI API Key is configured in environment variables.");
  }

  if (isGroq) {
    // Call Groq API endpoint
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: "You are the Veyquo AI Decision Intelligence assistant. Respond strictly as requested. Return raw JSON without markdown format blocks if JSON is requested." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        response_format: jsonMode ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } else {
    // Call Gemini API
    if (!aiClient) {
      throw new Error("Gemini client not initialized.");
    }
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: jsonMode ? 'application/json' : undefined,
        tools: useSearch ? [{ googleSearch: {} }] : undefined
      }
    });

    return response.text || "";
  }
}

export function hasAI() {
  return !!apiKey;
}

export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-2.5-flash';
export const ai = aiClient;
