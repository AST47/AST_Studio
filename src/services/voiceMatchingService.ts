import { GoogleGenAI, Type, Schema } from "@google/genai";
import { VoiceName, VoiceCloneMatchResult } from "../types/tts";
import { VOICES_CATALOG } from "../data/voices";
import { getStoredApiKey, getStoredApiKeys, rotateToNextApiKey, isAutoRotateEnabled } from "./clientGeminiService";

const GOOGLE_BASE_VOICES_BRIEF = VOICES_CATALOG.filter(v => v.category === "official").map(v => ({
  id: v.id,
  name: v.name,
  gender: v.gender,
  tone: v.tone,
  description: v.description,
}));

const SYSTEM_ACOUSTIC_PROMPT = `You are a master audio acoustic engineer and vocal casting director for Google Gemini Text-to-Speech (TTS).
Your objective: analyze the reference human speech recording and find the closest matching Google Studio base voice, while reverse-engineering the exact directing style prompt required to recreate that speaker's sound, cadence, and timbre.

Available 30 Google Gemini Studio Voices:
${GOOGLE_BASE_VOICES_BRIEF.map(v => `- "${v.id}": ${v.name} (${v.gender}), tone: ${v.tone}. ${v.description}`).join("\n")}

Respond ONLY with a JSON object adhering to this schema:
{
  "detectedGender": "male" | "female" | "neutral" | "child",
  "detectedPitch": string, // e.g. "Low resonant baritone with deep chest register (approx 95-120 Hz)"
  "detectedTimbre": string, // e.g. "Warm, slightly gravelly with close-mic proximity effect and soft sibilance"
  "detectedPace": "normal" | "slow" | "brisk" | "fast",
  "detectedMood": string, // e.g. "Intimate, thoughtful, slow-paced storytelling with gentle breaths"
  "matchedVoiceId": string, // Must be exactly one of the 30 voice IDs above (e.g. "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Zephyr", etc.)
  "matchScorePercent": number, // 70 to 98 percent match score
  "matchExplanation": string, // Brief 1-2 sentence rationale explaining why this base voice matches the reference audio acoustics
  "recommendedStylePrompt": string, // Highly descriptive TTS prompt directing tone, acting, breathing, and cadence to mirror the reference audio
  "suggestedCustomName": string // Catchy title for this cloned voice profile (e.g. "Deep Cinematic Storyteller", "Warm Podcast Host")
}`;

export async function analyzeAndMatchVoice(
  audioBase64: string,
  mimeType: string,
  customApiKey?: string
): Promise<VoiceCloneMatchResult> {
  // Clean base64 string
  const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");

  // 1. Try server-side proxy route first (when running dev/node server)
  try {
    const activeKey = customApiKey || getStoredApiKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (activeKey) {
      headers["x-gemini-api-key"] = activeKey;
    }

    const response = await fetch("/api/clone-match-voice", {
      method: "POST",
      headers,
      body: JSON.stringify({
        audioBase64: cleanBase64,
        mimeType: mimeType || "audio/wav",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return sanitizeMatchResult(data);
    }
  } catch (err) {
    console.warn("[VoiceMatching] Server proxy failed or not present, attempting client fallback:", err);
  }

  // 2. Direct client-side Gemini fallback (works on static hosting like GitHub Pages)
  return await analyzeVoiceWithGeminiClient(cleanBase64, mimeType, customApiKey);
}

export async function analyzeVoiceWithGeminiClient(
  cleanBase64: string,
  mimeType: string,
  customApiKey?: string
): Promise<VoiceCloneMatchResult> {
  const keysToTry: string[] = [];
  if (customApiKey && customApiKey.trim()) keysToTry.push(customApiKey.trim());
  const storedPool = getStoredApiKeys();
  for (const k of storedPool) {
    if (!keysToTry.includes(k)) keysToTry.push(k);
  }

  if (keysToTry.length === 0) {
    throw new Error("A Gemini API Key is required to analyze and match voice acoustics. Please add your key in the API Key settings.");
  }

  let lastError: any = null;

  for (let i = 0; i < keysToTry.length; i++) {
    const key = keysToTry[i];
    try {
      const ai = new GoogleGenAI({ apiKey: key });

      // Clean mimeType
      let cleanMime = mimeType || "audio/wav";
      if (cleanMime.includes(";")) {
        cleanMime = cleanMime.split(";")[0].trim();
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: cleanBase64,
                },
              },
              {
                text: `${SYSTEM_ACOUSTIC_PROMPT}\n\nPlease analyze the vocal characteristics in this audio clip, match it to the closest Google base voice, and generate the directing style.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText = response.text || "";
      if (!responseText.trim()) {
        throw new Error("No response returned from Gemini audio analysis.");
      }

      const parsed = JSON.parse(responseText);
      return sanitizeMatchResult(parsed);
    } catch (err: any) {
      lastError = err;
      console.warn(`[VoiceMatching] Analysis failed with key index ${i}:`, err);
      if (isAutoRotateEnabled() && i < keysToTry.length - 1) {
        rotateToNextApiKey();
        continue;
      }
    }
  }

  throw lastError || new Error("Voice analysis failed across all available keys.");
}

function sanitizeMatchResult(raw: any): VoiceCloneMatchResult {
  const validVoiceIds: VoiceName[] = VOICES_CATALOG.map(v => v.id as VoiceName);

  let matchedVoiceId: VoiceName = "Puck";
  if (raw.matchedVoiceId && validVoiceIds.includes(raw.matchedVoiceId)) {
    matchedVoiceId = raw.matchedVoiceId;
  } else if (raw.matchedVoiceId) {
    // Attempt case-insensitive lookup
    const found = validVoiceIds.find(v => v.toLowerCase() === String(raw.matchedVoiceId).toLowerCase());
    if (found) matchedVoiceId = found;
  }

  let pace: "normal" | "slow" | "brisk" | "fast" = "normal";
  if (["normal", "slow", "brisk", "fast"].includes(raw.detectedPace)) {
    pace = raw.detectedPace;
  }

  let gender: "male" | "female" | "neutral" | "child" = "neutral";
  if (["male", "female", "neutral", "child"].includes(raw.detectedGender)) {
    gender = raw.detectedGender;
  }

  return {
    detectedGender: gender,
    detectedPitch: String(raw.detectedPitch || "Natural vocal pitch"),
    detectedTimbre: String(raw.detectedTimbre || "Balanced, clear vocal presence"),
    detectedPace: pace,
    detectedMood: String(raw.detectedMood || "Natural conversational delivery"),
    matchedVoiceId,
    matchScorePercent: Math.min(99, Math.max(70, Number(raw.matchScorePercent) || 88)),
    matchExplanation: String(raw.matchExplanation || `Matched with Google Studio voice ${matchedVoiceId} based on fundamental pitch and resonance.`),
    recommendedStylePrompt: String(raw.recommendedStylePrompt || "Natural, clear conversational speech with balanced pacing."),
    suggestedCustomName: String(raw.suggestedCustomName || `Cloned Voice (${matchedVoiceId})`),
  };
}
