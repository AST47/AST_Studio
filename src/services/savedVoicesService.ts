import { SavedVoiceProfile, VoiceName } from "../types/tts";

const STORAGE_SAVED_VOICES_KEY = "ast_studio_custom_voices_v2";

export const DEFAULT_BUILTIN_PROFILES: SavedVoiceProfile[] = [
  {
    id: "builtin-cinema-trailer",
    customName: "Cinema Trailer Titan",
    voiceId: "Charon",
    stylePrompt: "Gripping, dramatic cinematic trailer narrator with intense sub-bass gravitas and measured tempo",
    speakingPace: "slow",
    vocalMood: "Deep, cinematic, and dramatic with intense pauses",
    model: "gemini-3.8-flash-lite-tts",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: "builtin-bedtime-story",
    customName: "Bedtime Storyteller",
    voiceId: "Kore",
    stylePrompt: "Warm, soothing, and intimate narrator with gentle pacing, soft quiet pauses, and tranquil empathy",
    speakingPace: "slow",
    vocalMood: "Warm, intimate, and comforting with gentle breathing",
    model: "gemini-3.8-flash-lite-tts",
    createdAt: 1700000000001,
    updatedAt: 1700000000001,
    isBuiltIn: true,
  },
  {
    id: "builtin-tech-reviewer",
    customName: "Tech Reviewer & Host",
    voiceId: "Puck",
    stylePrompt: "Youthful, upbeat, and energetic delivery with crisp articulation, punchy emphasis, and modern enthusiasm",
    speakingPace: "brisk",
    vocalMood: "Energetic, bright, and enthusiastic with dynamic delivery",
    model: "gemini-3.8-flash-lite-tts",
    createdAt: 1700000000002,
    updatedAt: 1700000000002,
    isBuiltIn: true,
  },
  {
    id: "builtin-broadcast-anchor",
    customName: "Prime News Anchor",
    voiceId: "Fenrir",
    stylePrompt: "Authoritative, crisp, and professional broadcast presenter with neutral clarity and executive poise",
    speakingPace: "normal",
    vocalMood: "Crisp, authoritative professional news anchor",
    model: "gemini-3.8-flash-lite-tts",
    createdAt: 1700000000003,
    updatedAt: 1700000000003,
    isBuiltIn: true,
  },
  {
    id: "builtin-asmr-meditation",
    customName: "Mindful ASMR Guide",
    voiceId: "Zephyr",
    stylePrompt: "Deeply calming, slow-paced meditation guide with gentle breaths, tranquil warmth, and peaceful whispering intimacy",
    speakingPace: "slow",
    vocalMood: "Ultra-calm, whispering tranquil ASMR meditation cadence",
    model: "gemini-3.8-flash-lite-tts",
    createdAt: 1700000000004,
    updatedAt: 1700000000004,
    isBuiltIn: true,
  },
];

export function getSavedVoices(): SavedVoiceProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_VOICES_KEY);
    if (!raw) {
      // Seed with initial high-quality defaults
      localStorage.setItem(STORAGE_SAVED_VOICES_KEY, JSON.stringify(DEFAULT_BUILTIN_PROFILES));
      return DEFAULT_BUILTIN_PROFILES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_BUILTIN_PROFILES;
  } catch (err) {
    console.error("Failed to load saved voices from storage", err);
    return DEFAULT_BUILTIN_PROFILES;
  }
}

export function saveVoiceProfile(profileData: {
  customName: string;
  voiceId: VoiceName;
  stylePrompt: string;
  speakingPace?: "normal" | "slow" | "brisk" | "fast";
  vocalMood?: string;
  model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
}): SavedVoiceProfile {
  const list = getSavedVoices();
  const now = Date.now();
  const newProfile: SavedVoiceProfile = {
    id: `custom-voice-${now}-${Math.random().toString(36).slice(2, 7)}`,
    customName: profileData.customName.trim() || `Custom Voice ${list.length + 1}`,
    voiceId: profileData.voiceId,
    stylePrompt: profileData.stylePrompt.trim(),
    speakingPace: profileData.speakingPace || "normal",
    vocalMood: profileData.vocalMood || "default",
    model: profileData.model || "gemini-3.8-flash-lite-tts",
    createdAt: now,
    updatedAt: now,
    isBuiltIn: false,
  };

  const updated = [newProfile, ...list];
  try {
    localStorage.setItem(STORAGE_SAVED_VOICES_KEY, JSON.stringify(updated));
    notifySavedVoicesChanged();
  } catch (e) {
    console.error("Failed to save voice profile", e);
  }
  return newProfile;
}

export function updateVoiceProfile(
  id: string,
  updates: Partial<Omit<SavedVoiceProfile, "id" | "createdAt">>
): SavedVoiceProfile | null {
  const list = getSavedVoices();
  const index = list.findIndex((v) => v.id === id);
  if (index === -1) return null;

  const updatedProfile: SavedVoiceProfile = {
    ...list[index],
    ...updates,
    updatedAt: Date.now(),
    isBuiltIn: false, // Once edited, it's user custom
  };

  list[index] = updatedProfile;
  try {
    localStorage.setItem(STORAGE_SAVED_VOICES_KEY, JSON.stringify(list));
    notifySavedVoicesChanged();
  } catch (e) {
    console.error("Failed to update voice profile", e);
  }
  return updatedProfile;
}

export function deleteVoiceProfile(id: string): boolean {
  const list = getSavedVoices();
  const filtered = list.filter((v) => v.id !== id);
  try {
    localStorage.setItem(STORAGE_SAVED_VOICES_KEY, JSON.stringify(filtered));
    notifySavedVoicesChanged();
    return true;
  } catch (e) {
    console.error("Failed to delete voice profile", e);
    return false;
  }
}

export function resetToDefaultVoices(): SavedVoiceProfile[] {
  try {
    localStorage.setItem(STORAGE_SAVED_VOICES_KEY, JSON.stringify(DEFAULT_BUILTIN_PROFILES));
    notifySavedVoicesChanged();
    return DEFAULT_BUILTIN_PROFILES;
  } catch {
    return DEFAULT_BUILTIN_PROFILES;
  }
}

const EVENT_NAME = "ast_saved_voices_updated";

function notifySavedVoicesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function subscribeToSavedVoices(callback: (voices: SavedVoiceProfile[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    callback(getSavedVoices());
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
