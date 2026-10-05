import { BaseVoiceName } from "../types/tts";

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
      "Speaking as a gentle, precious 5-year-old little girl with sweet soft tones, bright giggles, and innocent delivery",
  },
};

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
