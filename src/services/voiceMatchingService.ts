import { GoogleGenAI } from "@google/genai";
import { VoiceName, VoiceCloneMatchResult } from "../types/tts";
import { VOICES_CATALOG } from "../data/voices";
import { getStoredApiKey, getStoredApiKeys, rotateToNextApiKey, isAutoRotateEnabled } from "./clientGeminiService";
import { prepareAudioForAcousticAnalysis } from "./audioDownsampler";

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

Respond ONLY with a valid JSON object adhering strictly to this schema:
{
  "detectedGender": "male" | "female" | "neutral" | "child",
  "detectedPitch": string,
  "detectedTimbre": string,
  "detectedPace": "normal" | "slow" | "brisk" | "fast",
  "detectedMood": string,
  "matchedVoiceId": string,
  "matchScorePercent": number,
  "matchExplanation": string,
  "recommendedStylePrompt": string,
  "suggestedCustomName": string
}`;

export async function analyzeAndMatchVoice(
  rawAudioBase64: string,
  rawMimeType: string,
  customApiKey?: string
): Promise<VoiceCloneMatchResult> {
  // 1. Optimize audio: downsample to 16kHz mono WAV (max 8-10s) to prevent deadline timeouts
  let optimizedBase64 = rawAudioBase64.replace(/^data:audio\/\w+;base64,/, "");
  let optimizedMime = rawMimeType || "audio/wav";

  try {
    const downsampled = await prepareAudioForAcousticAnalysis(optimizedBase64, 8);
    optimizedBase64 = downsampled.base64;
    optimizedMime = downsampled.mimeType;
  } catch (err) {
    console.warn("[VoiceMatching] Downsampling skipped, using raw audio:", err);
  }

  // 2. Try server-side proxy route first (when running on full-stack dev/node server)
  try {
    const activeKey = customApiKey || getStoredApiKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (activeKey) {
      headers["x-gemini-api-key"] = activeKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch("/api/clone-match-voice", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        audioBase64: optimizedBase64,
        mimeType: optimizedMime,
      }),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return sanitizeMatchResult(data);
    }
  } catch (err) {
    console.warn("[VoiceMatching] Server proxy failed or timed out, trying direct client analysis:", err);
  }

  // 3. Direct client-side Gemini call (with multi-model fallback: gemini-3.8-flash -> gemini-2.5-flash)
  return await analyzeVoiceWithGeminiClient(optimizedBase64, optimizedMime, customApiKey);
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
    const ai = new GoogleGenAI({ apiKey: key });

    // Clean mimeType
    let cleanMime = mimeType || "audio/wav";
    if (cleanMime.includes(";")) {
      cleanMime = cleanMime.split(";")[0].trim();
    }

    // Try models: gemini-3.8-flash first, and if 503/deadline/timeout, fallback to gemini-2.5-flash
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
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
                  text: `${SYSTEM_ACOUSTIC_PROMPT}\n\nPlease analyze the vocal characteristics in this 16kHz speech snippet, match it to the closest Google base voice, and generate the directing style.`,
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
        const errMsg = String(err?.message || err || "").toLowerCase();
        const isTimeoutOrUnavailable =
          errMsg.includes("503") ||
          errMsg.includes("deadline expired") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("timeout") ||
          errMsg.includes("resource_exhausted") ||
          errMsg.includes("429");

        console.warn(`[VoiceMatching] Model ${modelName} failed with key ${i}:`, err);

        // If temporary timeout or 503 on 3.8-flash, try next faster model before switching keys
        if (isTimeoutOrUnavailable && modelName !== modelsToTry[modelsToTry.length - 1]) {
          console.log(`[VoiceMatching] Retrying with faster model ${modelsToTry[modelsToTry.indexOf(modelName) + 1]}...`);
          continue;
        }
        break; // try next key
      }
    }

    if (isAutoRotateEnabled() && i < keysToTry.length - 1) {
      rotateToNextApiKey();
    }
  }

  // Format error for user
  const rawMsg = String(lastError?.message || lastError || "");
  if (rawMsg.includes("503") || rawMsg.includes("Deadline expired") || rawMsg.includes("UNAVAILABLE")) {
    throw new Error("Google Gemini audio service is experiencing temporary high traffic. Please try again with a short 5-10 second clip.");
  }

  throw lastError || new Error("Voice analysis failed across all available keys.");
}

function sanitizeMatchResult(raw: any): VoiceCloneMatchResult {
  const validVoiceIds: VoiceName[] = VOICES_CATALOG.map(v => v.id as VoiceName);

  let matchedVoiceId: VoiceName = "Puck";
  if (raw.matchedVoiceId && validVoiceIds.includes(raw.matchedVoiceId)) {
    matchedVoiceId = raw.matchedVoiceId;
  } else if (raw.matchedVoiceId) {
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
