export type BaseVoiceName = "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr";
export type VoiceId =
  | BaseVoiceName
  | "leo-boy"
  | "mia-girl"
  | "toby-boy"
  | "lily-girl";

export type VoiceName = VoiceId;

export interface VoiceInfo {
  id: VoiceId;
  baseVoice: BaseVoiceName;
  name: string;
  category: "kids" | "adults";
  gender: "boy" | "girl" | "male" | "female" | "neutral";
  ageGroup: string;
  tone: string;
  description: string;
  stylePrompt: string;
  tags: string[];
  sampleText: string;
  avatarEmoji: string;
}

export interface DialogueTurn {
  id: string;
  speaker: string;
  voice: VoiceId;
  text: string;
  style?: string;
}

export type SupportedLanguage =
  | "auto"
  | "es"
  | "en"
  | "ar"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ja"
  | "tr";

export interface GeneratedAudioItem {
  id: string;
  title: string;
  createdAt: number;
  mode: "single" | "dialogue";
  modelUsed: string;
  duration: number;
  audioBase64: string;
  mimeType: string;
  textPreview: string;
  voice?: VoiceId;
  speakers?: { name: string; voice: VoiceId }[];
  style?: string;
  language?: SupportedLanguage;
}

export interface QuotaStatus {
  requestsInLastMinute: number;
  freeTierRpmLimit: number;
  secondsUntilNextWindowSlot: number;
  cooldownRemaining: number;
  sessionGenerationsCount: number;
  isThrottled: boolean;
  hasApiKey: boolean;
  isDailyLimitExceeded?: boolean;
  timestamp?: string;
}


