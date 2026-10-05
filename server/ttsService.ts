import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export type BaseVoiceName = "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr";
export type VoiceName =
  | BaseVoiceName
  | "leo-boy"
  | "mia-girl"
  | "toby-boy"
  | "lily-girl";

export interface VoiceInfo {
  id: VoiceName;
  name: string;
  category: "kids" | "adults";
  gender: "boy" | "girl" | "female" | "male" | "neutral";
  tone: string;
  description: string;
  tags: string[];
}

export const KID_VOICE_PERSONAS: Record<
  string,
  { baseVoice: BaseVoiceName; name: string; styleDirective: string }
> = {
  "leo-boy": {
    baseVoice: "Puck",
    name: "Leo (Young Boy)",
    styleDirective:
      "Speaking as an excited, energetic 8-year-old young boy with a lively high-pitched voice, joyful enthusiasm, and natural childlike cadence",
  },
  "mia-girl": {
    baseVoice: "Kore",
    name: "Mia (Young Girl)",
    styleDirective:
      "Speaking as a sweet, imaginative 7-year-old young girl with a cheerful, innocent, childlike high voice, full of wonder and bright smiles",
  },
  "toby-boy": {
    baseVoice: "Puck",
    name: "Toby (Little Brother)",
    styleDirective:
      "Speaking as a cute, enthusiastic 5-year-old little toddler boy with sweet giggles, bright high pitch, and curious bouncy speech",
  },
  "lily-girl": {
    baseVoice: "Zephyr",
    name: "Lily (Little Sister)",
    styleDirective:
      "Speaking as a delightful, giggly 5-year-old little girl with an innocent, gentle high-pitched voice and happy sighs",
  },
};

export const VOICES: VoiceInfo[] = [
  // Kids Voices
  {
    id: "leo-boy",
    name: "Leo (Young Boy)",
    category: "kids",
    gender: "boy",
    tone: "Playful, Energetic & High-Pitched",
    description: "An adventurous 8-year-old boy's voice. Full of excitement, curiosity, and childlike wonder.",
    tags: ["Kid", "Boy", "Energetic", "Adventure", "Cartoon"],
  },
  {
    id: "mia-girl",
    name: "Mia (Young Girl)",
    category: "kids",
    gender: "girl",
    tone: "Sweet, Cheerful & High-Pitched",
    description: "A bright 7-year-old girl's voice. Gentle, imaginative, and sunny with innocent warmth.",
    tags: ["Kid", "Girl", "Sweet", "Storybook", "Cheerful"],
  },
  {
    id: "toby-boy",
    name: "Toby (Little Brother)",
    category: "kids",
    gender: "boy",
    tone: "Cute, Giggling & Bouncy",
    description: "A bubbly 5-year-old toddler boy. Ideal for playful animations and funny animal stories.",
    tags: ["Toddler", "Boy", "Playful", "Cute"],
  },
  {
    id: "lily-girl",
    name: "Lily (Little Sister)",
    category: "kids",
    gender: "girl",
    tone: "Gentle, Airy & Delightful",
    description: "A sweet 5-year-old toddler girl. Perfect for bedtime lullabies and soft fairy tales.",
    tags: ["Toddler", "Girl", "Bedtime", "Gentle"],
  },
  // Adults Voices
  {
    id: "Kore",
    name: "Kore",
    category: "adults",
    gender: "female",
    tone: "Warm, melodious & soothing",
    description: "Clear and empathetic. Perfect for audiobooks, meditation, explainers, and gentle narration.",
    tags: ["Narrative", "Calm", "Warm", "Clear"],
  },
  {
    id: "Puck",
    name: "Puck",
    category: "adults",
    gender: "male",
    tone: "Youthful, energetic & lively",
    description: "Vibrant and engaging with high enthusiasm. Ideal for podcasts, YouTube intros, and commercials.",
    tags: ["Energetic", "Modern", "Upbeat", "Podcast"],
  },
  {
    id: "Charon",
    name: "Charon",
    category: "adults",
    gender: "male",
    tone: "Deep, resonant & authoritative",
    description: "Commanding baritone with great gravity. Superb for documentaries, trailers, and dramatic storytelling.",
    tags: ["Deep", "Authoritative", "Dramatic", "Cinematic"],
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    category: "adults",
    gender: "male",
    tone: "Rich, textured & confident",
    description: "Balanced, grounded, and articulated. Excellent for news, corporate presentations, and instructional guides.",
    tags: ["News", "Professional", "Textured", "Corporate"],
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    category: "adults",
    gender: "female",
    tone: "Gentle, airy & conversational",
    description: "Intimate and natural modern delivery. Ideal for personal essays, conversational apps, and lifestyle content.",
    tags: ["Conversational", "Soft", "Airy", "Casual"],
  },
];

export interface DialogueTurn {
  speaker: string;
  voice: VoiceName;
  text: string;
  style?: string;
}

export interface GenerateTtsParams {
  mode: "single" | "dialogue";
  model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
  language?: string;
  // Single speaker
  text?: string;
  voice?: VoiceName;
  style?: string;
  // Dialogue
  speakers?: { name: string; voice: VoiceName }[];
  turns?: DialogueTurn[];
}

export const LANGUAGE_DIRECTIVES: Record<string, string> = {
  es: "Speaking in authentic native Spanish with accurate Spanish phonetics, clear vowel articulation, proper rolled r's, correct Spanish syllable stress, and natural Spanish cadence",
  en: "Speaking in clear, natural native English with proper pronunciation and articulation",
  ar: "Speaking in authentic native Arabic with accurate Arabic phonetics, correct makharij, and natural cadence",
  fr: "Speaking in authentic native French with accurate French phonetics, proper liaisons, correct nasal vowels, and natural cadence",
  de: "Speaking in authentic native German with accurate German phonetics, proper articulation of umlauts and consonants, and natural cadence",
  it: "Speaking in authentic native Italian with natural cadence, correct gemination, and pure Italian vowels",
  pt: "Speaking in authentic native Portuguese with accurate phonetics and natural cadence",
  ja: "Speaking in authentic native Japanese with natural pitch accent and rhythm",
  tr: "Speaking in authentic native Turkish with proper vowel harmony and natural rhythm",
};

export function detectLanguage(text: string): string {
  if (!text) return "en";
  const trimmed = text.trim();
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) return "ar";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmed)) return "ja";
  if (
    /[ñÑ¿¡áéíóúÁÉÍÓÚ]/.test(trimmed) ||
    /\b(hola|cómo|como|estás|esta|este|vamos|gracias|bueno|buena|amigo|amiga|hoy|ayer|mañana|todos|playa|tiempo|hacer|decir|ahora|siempre|casa|vida|niño|niña|por|para|con|pero|más|mas|bien|mira|miren|claro)\b/i.test(
      trimmed
    )
  ) {
    return "es";
  }
  if (
    /[œæçàèùâêîôûëïüÇÀÈÙÂÊÎÔÛËÏÜ]/.test(trimmed) ||
    /\b(bonjour|merci|oui|avec|pour|dans|nous|vous|cette|aussi|très|tres|monde|jour|toujours|salut|voilà)\b/i.test(
      trimmed
    )
  ) {
    return "fr";
  }
  if (
    /[äöüßÄÖÜ]/.test(trimmed) ||
    /\b(hallo|danke|bitte|und|nicht|wir|sie|ist|sind|sehr|schön|guten|morgen|abend|heute|wieder)\b/i.test(
      trimmed
    )
  ) {
    return "de";
  }
  if (
    /\b(ciao|grazie|buongiorno|perché|perche|anche|quando|questo|questa|tutto|sono|molto|bello|bella|andiamo)\b/i.test(
      trimmed
    )
  ) {
    return "it";
  }
  if (
    /[ãõÃÕ]/.test(trimmed) ||
    /\b(olá|ola|obrigado|obrigada|muito|tudo|bem|você|voce|vamos|hoje)\b/i.test(
      trimmed
    )
  ) {
    return "pt";
  }
  if (
    /[çğıöşüÇĞİÖŞÜ]/.test(trimmed) ||
    /\b(merhaba|teşekkürler|nasılsın|evet|hayır|güzel|bugün|şimdi)\b/i.test(
      trimmed
    )
  ) {
    return "tr";
  }
  return "en";
}

export async function generateSpeech(params: GenerateTtsParams) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }

  if (params.mode === "single") {
    const text = params.text?.trim();
    if (!text) {
      throw new Error("Text content is required for speech generation.");
    }

    const requestedVoice = params.voice || "Kore";
    const kidPersona = KID_VOICE_PERSONAS[requestedVoice];
    const actualVoice: BaseVoiceName = kidPersona ? kidPersona.baseVoice : (requestedVoice as BaseVoiceName);

    // Determine target language and pronunciation directive
    const effectiveLang =
      params.language && params.language !== "auto"
        ? params.language
        : detectLanguage(text);
    const langDirective = LANGUAGE_DIRECTIVES[effectiveLang] || "";

    // If kid voice or expressive tags, use gemini-3.8-flash-tts for voice persona design
    const hasVocalBursts = /<[^>]+>|\|[^|]+\|/.test(text);
    let selectedModel =
      params.model ||
      (kidPersona || hasVocalBursts ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts");

    let combinedStyle = "";
    if (kidPersona) {
      combinedStyle = kidPersona.styleDirective;
      if (langDirective) {
        combinedStyle += `. Language guidance: ${langDirective}`;
      }
      if (params.style?.trim()) {
        combinedStyle += `. Expressive delivery: ${params.style.trim()}`;
      }
    } else {
      if (langDirective) {
        combinedStyle = langDirective;
      }
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

    let response;
    try {
      response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            role: "user",
            parts: parts,
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: actualVoice },
            },
          },
        },
      });
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
      const isQuota =
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.toLowerCase().includes("quota");

      // Automatic Fallback: If gemini-3.8-flash-tts hit a 429 quota error, retry with gemini-3.8-flash-lite-tts
      if (isQuota && selectedModel === "gemini-3.8-flash-tts") {
        console.warn(
          "[TTS Fallback] gemini-3.8-flash-tts hit quota limit. Automatically falling back to gemini-3.8-flash-lite-tts..."
        );
        selectedModel = "gemini-3.8-flash-lite-tts";
        response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: actualVoice },
              },
            },
          },
        });
      } else {
        throw err;
      }
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned by Gemini TTS API.");
    }

    // Estimate duration from WAV bytes
    const buffer = Buffer.from(base64Audio, "base64");
    const pcmBytes = Math.max(0, buffer.length - 44);
    // 24000 Hz, 16-bit mono = 48000 bytes/sec
    const durationSec = Number((pcmBytes / 48000).toFixed(2));

    return {
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      duration: durationSec,
      modelUsed: selectedModel,
      voice: requestedVoice,
      sampleRate: 24000,
    };
  } else {
    // Dialogue mode (2 speakers)
    const turns = params.turns || [];
    if (turns.length === 0) {
      throw new Error("At least one dialogue turn is required.");
    }

    // Extract unique speakers
    const speakerMap = new Map<string, VoiceName>();
    for (const turn of turns) {
      if (!speakerMap.has(turn.speaker)) {
        speakerMap.set(turn.speaker, turn.voice || "Kore");
      }
    }

    const speakerList = Array.from(speakerMap.entries());
    if (speakerList.length < 2) {
      // If only 1 speaker was provided in dialogue, add a default second speaker
      const currentSpeaker = speakerList[0][0];
      const otherSpeaker = currentSpeaker.toLowerCase() === "alex" ? "Sam" : "Alex";
      const otherVoice = speakerList[0][1] === "Puck" ? "Kore" : "Puck";
      speakerMap.set(otherSpeaker, otherVoice);
    }

    const firstTwoSpeakers = Array.from(speakerMap.entries()).slice(0, 2);
    const speaker1 = firstTwoSpeakers[0];
    const speaker2 = firstTwoSpeakers[1];

    const kid1 = KID_VOICE_PERSONAS[speaker1[1]];
    const baseVoice1: BaseVoiceName = kid1 ? kid1.baseVoice : (speaker1[1] as BaseVoiceName);

    const kid2 = KID_VOICE_PERSONAS[speaker2[1]];
    const baseVoice2: BaseVoiceName = kid2 ? kid2.baseVoice : (speaker2[1] as BaseVoiceName);

    const allDialogueText = turns.map((t) => t.text).join(" ");
    const dialogueLang =
      params.language && params.language !== "auto"
        ? params.language
        : detectLanguage(allDialogueText);
    const dialogueLangDirective = LANGUAGE_DIRECTIVES[dialogueLang] || "";

    const parts = turns.map((t) => {
      const isSecond = t.speaker === speaker2[0];
      const normalizedSpeaker = isSecond ? speaker2[0] : speaker1[0];
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
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speaker1[0],
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: baseVoice1 },
                },
              },
              {
                speaker: speaker2[0],
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: baseVoice2 },
                },
              },
            ],
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned for dialogue generation.");
    }

    const buffer = Buffer.from(base64Audio, "base64");
    const pcmBytes = Math.max(0, buffer.length - 44);
    const durationSec = Number((pcmBytes / 48000).toFixed(2));

    return {
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      duration: durationSec,
      modelUsed: "gemini-3.8-flash-tts",
      speakers: [
        { name: speaker1[0], voice: speaker1[1] },
        { name: speaker2[0], voice: speaker2[1] },
      ],
      sampleRate: 24000,
    };
  }
}

export async function enhanceScript(params: {
  action: "polish" | "expressive" | "podcast" | "shorten" | "dramatic" | "accentuate";
  prompt: string;
  speakerCount?: number;
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }

  let instruction = "";
  if (params.action === "polish") {
    instruction =
      "You are a professional voiceover director. Polish the following script to make it sound natural, rhythmic, and captivating when read aloud. Keep the core meaning. Return ONLY the polished script text.";
  } else if (params.action === "accentuate") {
    instruction =
      "You are an expert native pronunciation editor for Text-to-Speech (TTS). Review the provided script in Spanish, French, German, Arabic, Portuguese, Italian, or other Latin/multilingual languages. Correct any missing accents, tildes (á, é, í, ó, ú, ñ, ¿, ¡, ü, ç, à, è), diacritics, or spelling quirks so that an AI neural voice synthesizes every word with 100% natural, native pronunciation. Do not alter the core meaning. Return ONLY the accentuated, corrected text.";
  } else if (params.action === "expressive") {
    instruction =
      "You are an expert audio dramatist for Gemini 3.8 TTS. Enhance this text by adding natural speech expressiveness tags like <breath>, <laugh>, <gasp>, <sigh>, and backchannel sounds like |mhm| or |yeah| where it makes the spoken dialogue feel profoundly human, genuine, and dynamic. Return ONLY the enhanced text with these tags included.";
  } else if (params.action === "podcast") {
    instruction =
      "Transform the following topic or script into an engaging dual-speaker podcast conversation between 'Alex' (energetic host) and 'Sam' (insightful co-host). Format each turn on a new line prefixed with 'Alex:' or 'Sam:'. Include conversational tags like <breath>, |yeah|, <laugh> where appropriate. Return ONLY the formatted script.";
  } else if (params.action === "shorten") {
    instruction =
      "Condense the following script into a punchy, high-impact 30-45 second spoken voiceover (approx 70-90 words). Focus on clarity and retention. Return ONLY the revised script.";
  } else if (params.action === "dramatic") {
    instruction =
      "Rewrite this script in a cinematic, suspenseful, and emotionally gripping style for a dramatic narration voiceover. Include pacing cues and expressive tags where effective. Return ONLY the rewritten script.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `${instruction}\n\nInput:\n${params.prompt}`,
      config: {
        temperature: 0.7,
      },
    });

    return {
      result: response.text?.trim() || "",
    };
  } catch (err: any) {
    // If 3.8-flash experiences temporary load spike, fallback to flash-lite
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `${instruction}\n\nInput:\n${params.prompt}`,
        config: {
          temperature: 0.7,
        },
      });
      return {
        result: fallbackResponse.text?.trim() || "",
      };
    } catch {
      throw err;
    }
  }
}
