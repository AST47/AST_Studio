export type BaseVoiceName =
  | "Puck"
  | "Charon"
  | "Kore"
  | "Fenrir"
  | "Zephyr"
  | "Aoede"
  | "Leda"
  | "Orus"
  | "Achernar"
  | "Achird"
  | "Algenib"
  | "Algieba"
  | "Alnilam"
  | "Autonoe"
  | "Callirrhoe"
  | "Despina"
  | "Enceladus"
  | "Erinome"
  | "Gacrux"
  | "Iapetus"
  | "Laomedeia"
  | "Pulcherrima"
  | "Rasalgethi"
  | "Sadachbia"
  | "Sadaltager"
  | "Schedar"
  | "Sulafat"
  | "Umbriel"
  | "Vindemiatrix"
  | "Zubenelgenubi";

export type PersonaVoiceId =
  | "leo-boy"
  | "mia-girl"
  | "toby-boy"
  | "lily-girl"
  | "oliver-boy"
  | "chloe-girl"
  | "noah-toddler"
  | "emma-girl"
  | "cyber-ai"
  | "movie-titan"
  | "mindful-guide"
  | "nature-doc"
  | "noir-detective"
  | "hype-radio"
  | "fantasy-wizard"
  | "executive-anchor";

export type VoiceId = BaseVoiceName | PersonaVoiceId | string;

export type VoiceName = VoiceId;

export type VoiceCategory = "official" | "kids" | "character" | "adults";

export interface VoiceInfo {
  id: VoiceName;
  baseVoice: BaseVoiceName;
  name: string;
  category: VoiceCategory;
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
  voice: VoiceName;
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


