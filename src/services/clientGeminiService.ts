import { GoogleGenAI } from "@google/genai";
import { VoiceName, SupportedLanguage } from "../types/tts";
import {
  LANGUAGE_DIRECTIVES,
  detectLanguage,
  KID_VOICE_PERSONAS,
} from "./clientLangUtils";

const LOCAL_STORAGE_KEY = "ast_studio_gemini_api_key";

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  } catch (e) {
    console.error("Failed to save API key to localStorage", e);
  }
}

export function clearStoredApiKey(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to remove API key from localStorage", e);
  }
}

/**
 * Encodes 16-bit PCM buffer into standard 44-byte WAV header buffer
 */
export function pcmToWavBuffer(pcmBuffer: Uint8Array, sampleRate = 24000, numChannels = 1): ArrayBuffer {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const wavBuffer = new ArrayBuffer(44 + pcmBuffer.length);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBuffer.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, pcmBuffer.length, true);

  const uint8View = new Uint8Array(wavBuffer, 44);
  uint8View.set(pcmBuffer);

  return wavBuffer;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Client-side TTS generation using user's Gemini API key (for static GitHub Pages hosting)
 */
export async function generateClientSpeech(params: {
  mode: "single" | "dialogue";
  text?: string;
  voice?: VoiceName;
  style?: string;
  language?: SupportedLanguage;
  model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
  turns?: { speaker: string; voice: VoiceName; text: string; style?: string }[];
}) {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  if (params.mode === "single") {
    const text = params.text?.trim() || "";
    if (!text) throw new Error("Text content is required.");

    const requestedVoice = params.voice || "Kore";
    const kidPersona = KID_VOICE_PERSONAS[requestedVoice];
    const actualVoice = kidPersona ? kidPersona.baseVoice : requestedVoice;

    const effectiveLang =
      params.language && params.language !== "auto"
        ? params.language
        : detectLanguage(text);
    const langDirective = LANGUAGE_DIRECTIVES[effectiveLang] || "";

    const hasVocalBursts = /<[^>]+>|\|[^|]+\|/.test(text);
    const selectedModel =
      params.model ||
      (kidPersona || hasVocalBursts ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts");

    let combinedStyle = "";
    if (kidPersona) {
      combinedStyle = kidPersona.styleDirective;
      if (langDirective) combinedStyle += `. Language guidance: ${langDirective}`;
      if (params.style?.trim()) combinedStyle += `. Expressive delivery: ${params.style.trim()}`;
    } else {
      if (langDirective) combinedStyle = langDirective;
      if (params.style?.trim()) {
        combinedStyle = combinedStyle ? `${combinedStyle}. ${params.style.trim()}` : params.style.trim();
      }
    }

    const parts: any[] = [
      {
        text: text,
        ...(combinedStyle ? { speechMetadata: { style: combinedStyle } } : {}),
      },
    ];

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: actualVoice as any },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error("No audio returned from Gemini TTS.");
    }

    let audioBase64 = inlineData.data;
    const rawBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

    // If response is raw PCM rather than WAV, wrap with WAV header
    if (rawBytes.length > 4 && String.fromCharCode(...rawBytes.slice(0, 4)) !== "RIFF") {
      const wavBuf = pcmToWavBuffer(rawBytes, 24000, 1);
      audioBase64 = uint8ArrayToBase64(new Uint8Array(wavBuf));
    }

    const pcmBytes = Math.max(0, rawBytes.length - 44);
    const duration = Number((pcmBytes / 48000).toFixed(2));

    return {
      audioBase64,
      mimeType: "audio/wav",
      duration,
      modelUsed: selectedModel,
      voice: requestedVoice,
      sampleRate: 24000,
    };
  } else {
    // Dialogue Mode
    const turns = params.turns || [];
    if (turns.length === 0) throw new Error("Dialogue turns are required.");

    const speakerMap = new Map<string, VoiceName>();
    for (const turn of turns) {
      if (!speakerMap.has(turn.speaker)) {
        speakerMap.set(turn.speaker, turn.voice || "Kore");
      }
    }
    const speakerList = Array.from(speakerMap.entries());
    if (speakerList.length < 2) {
      speakerMap.set("Sam", "Puck");
    }

    const firstTwo = Array.from(speakerMap.entries()).slice(0, 2);
    const spk1 = firstTwo[0];
    const spk2 = firstTwo[1];

    const kid1 = KID_VOICE_PERSONAS[spk1[1]];
    const baseVoice1 = kid1 ? kid1.baseVoice : spk1[1];

    const kid2 = KID_VOICE_PERSONAS[spk2[1]];
    const baseVoice2 = kid2 ? kid2.baseVoice : spk2[1];

    const allDialogueText = turns.map((t) => t.text).join(" ");
    const dialogueLang =
      params.language && params.language !== "auto"
        ? params.language
        : detectLanguage(allDialogueText);
    const dialogueLangDirective = LANGUAGE_DIRECTIVES[dialogueLang] || "";

    const parts = turns.map((t) => {
      const isSecond = t.speaker === spk2[0];
      const normalizedSpeaker = isSecond ? spk2[0] : spk1[0];
      const kid = isSecond ? kid2 : kid1;

      let styleDirection = t.style?.trim() || "";
      if (dialogueLangDirective) {
        styleDirection = styleDirection
          ? `${dialogueLangDirective}. Tone: ${styleDirection}`
          : dialogueLangDirective;
      }
      if (kid) {
        styleDirection = styleDirection
          ? `${kid.styleDirective}. ${styleDirection}`
          : kid.styleDirective;
      }

      return {
        text: `${normalizedSpeaker}: ${t.text}`,
        speechMetadata: {
          speaker: normalizedSpeaker,
          ...(styleDirection ? { style: styleDirection } : {}),
        },
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-tts",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: spk1[0],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: baseVoice1 as any } },
              },
              {
                speaker: spk2[0],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: baseVoice2 as any } },
              },
            ],
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error("No audio returned from Gemini Dialogue TTS.");
    }

    let audioBase64 = inlineData.data;
    const rawBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

    if (rawBytes.length > 4 && String.fromCharCode(...rawBytes.slice(0, 4)) !== "RIFF") {
      const wavBuf = pcmToWavBuffer(rawBytes, 24000, 1);
      audioBase64 = uint8ArrayToBase64(new Uint8Array(wavBuf));
    }

    const pcmBytes = Math.max(0, rawBytes.length - 44);
    const duration = Number((pcmBytes / 48000).toFixed(2));

    return {
      audioBase64,
      mimeType: "audio/wav",
      duration,
      modelUsed: "gemini-3.8-flash-tts",
      speakers: [
        { name: spk1[0], voice: spk1[1] },
        { name: spk2[0], voice: spk2[1] },
      ],
      sampleRate: 24000,
    };
  }
}

/**
 * Client-side script enhancement with Gemini Flash
 */
export async function enhanceClientScript(
  action: "polish" | "expressive" | "podcast" | "shorten" | "dramatic" | "accentuate",
  prompt: string
): Promise<string> {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  let instruction = "";
  if (action === "polish") {
    instruction =
      "You are a professional voiceover director. Polish the following script to make it sound natural, rhythmic, and captivating when read aloud. Keep the core meaning. Return ONLY the polished script text.";
  } else if (action === "accentuate") {
    instruction =
      "You are an expert native pronunciation editor for Text-to-Speech (TTS). Review the provided script in Spanish, French, German, Arabic, Portuguese, Italian, or other Latin/multilingual languages. Correct any missing accents, tildes (á, é, í, ó, ú, ñ, ¿, ¡, ü, ç, à, è), diacritics, or spelling quirks so that an AI neural voice synthesizes every word with 100% natural, native pronunciation. Do not alter the core meaning. Return ONLY the accentuated, corrected text.";
  } else if (action === "expressive") {
    instruction =
      "You are an expert audio dramatist for Gemini 3.8 TTS. Enhance this text by adding natural speech expressiveness tags like <breath>, <laugh>, <gasp>, <sigh>, and backchannel sounds like |mhm| or |yeah| where it makes the spoken dialogue feel profoundly human, genuine, and dynamic. Return ONLY the enhanced text with these tags included.";
  } else if (action === "podcast") {
    instruction =
      "Transform the following topic or script into an engaging dual-speaker podcast conversation between 'Alex' (energetic host) and 'Sam' (insightful co-host). Format each turn on a new line prefixed with 'Alex:' or 'Sam:'. Include conversational tags like <breath>, |yeah|, <laugh> where appropriate. Return ONLY the formatted script.";
  } else if (action === "shorten") {
    instruction =
      "Condense the following script into a punchy, high-impact 30-45 second spoken voiceover (approx 70-90 words). Focus on clarity and retention. Return ONLY the revised script.";
  } else if (action === "dramatic") {
    instruction =
      "Rewrite this script in a cinematic, suspenseful, and emotionally gripping style for a dramatic narration voiceover. Include pacing cues and expressive tags where effective. Return ONLY the rewritten script.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: `${instruction}\n\nInput:\n${prompt}`,
    config: { temperature: 0.7 },
  });

  return response.text?.trim() || "";
}
