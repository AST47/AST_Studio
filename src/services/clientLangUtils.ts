import { BaseVoiceName } from "../types/tts";

export const VOICE_PERSONAS: Record<
  string,
  { baseVoice: BaseVoiceName; name: string; styleDirective: string; category: "kids" | "character" }
> = {
  // Kids & Youth
  "leo-boy": {
    baseVoice: "Puck",
    name: "Leo (Young Boy)",
    styleDirective:
      "Speaking as an excited, energetic 8-year-old young boy with a lively high-pitched voice, joyful enthusiasm, and natural childlike cadence",
    category: "kids",
  },
  "mia-girl": {
    baseVoice: "Kore",
    name: "Mia (Young Girl)",
    styleDirective:
      "Speaking as a sweet, imaginative 7-year-old young girl with a cheerful, innocent, childlike high voice, full of wonder and bright smiles",
    category: "kids",
  },
  "toby-boy": {
    baseVoice: "Puck",
    name: "Toby (Little Brother)",
    styleDirective:
      "Speaking as a cute, enthusiastic 5-year-old little toddler boy with sweet giggles, bright high pitch, and curious bouncy speech",
    category: "kids",
  },
  "lily-girl": {
    baseVoice: "Zephyr",
    name: "Lily (Little Sister)",
    styleDirective:
      "Speaking as a gentle, precious 5-year-old little girl with sweet soft tones, bright giggles, and innocent delivery",
    category: "kids",
  },
  "oliver-boy": {
    baseVoice: "Fenrir",
    name: "Oliver (Curious Boy)",
    styleDirective:
      "Speaking as a smart, enthusiastic 10-year-old boy fascinated by science and nature, with an articulate, eager, and inquisitive delivery",
    category: "kids",
  },
  "chloe-girl": {
    baseVoice: "Aoede",
    name: "Chloe (Bubbly Tween)",
    styleDirective:
      "Speaking as a bright, expressive 11-year-old girl with infectious upbeat energy, cheerful inflections, and conversational warmth",
    category: "kids",
  },
  "noah-toddler": {
    baseVoice: "Puck",
    name: "Noah (Little Explorer)",
    styleDirective:
      "Speaking as an adorable 4-year-old toddler with cute wide-eyed wonder, simple words, and joyful giggles",
    category: "kids",
  },
  "emma-girl": {
    baseVoice: "Leda",
    name: "Emma (Storybook Fairy)",
    styleDirective:
      "Speaking as a gentle 9-year-old girl reading a magical fairy tale, with lyrical charm, soft wonder, and dreamy pacing",
    category: "kids",
  },

  // Character Archetypes & Creative Voice Design
  "cyber-ai": {
    baseVoice: "Zephyr",
    name: "Nova Synth AI",
    styleDirective:
      "Speaking as an ultra-crisp, futuristic neural companion AI. Highly articulate, perfectly poised, with subtle electronic precision and calm intelligence",
    category: "character",
  },
  "movie-titan": {
    baseVoice: "Charon",
    name: "Titan Trailer Narrator",
    styleDirective:
      "Speaking as a blockbuster movie trailer narrator with deep, thunderous cinematic bass, suspenseful pauses, and epic dramatic weight",
    category: "character",
  },
  "mindful-guide": {
    baseVoice: "Kore",
    name: "Serenity Guide (ASMR)",
    styleDirective:
      "Speaking as an ultra-calm, whispering mindfulness and meditation guide with gentle soothing breaths, serene pacing, and peaceful tranquility",
    category: "character",
  },
  "nature-doc": {
    baseVoice: "Rasalgethi",
    name: "Sir David Heritage",
    styleDirective:
      "Speaking as a legendary nature documentary narrator with profound reverence for wildlife, hushed awe, cultured warmth, and thoughtful cadence",
    category: "character",
  },
  "noir-detective": {
    baseVoice: "Algenib",
    name: "Sam Spade Detective",
    styleDirective:
      "Speaking as a gritty, cynical 1940s noir detective reciting an inner monologue in a rainy city, with dry wit and gravelly baritone resonance",
    category: "character",
  },
  "hype-radio": {
    baseVoice: "Enceladus",
    name: "Blitz Hype Host",
    styleDirective:
      "Speaking as an electric, high-octane commercial broadcaster and radio DJ with relentless enthusiasm, punchy punchlines, and infectious drive",
    category: "character",
  },
  "fantasy-wizard": {
    baseVoice: "Iapetus",
    name: "Eldrin The Mage",
    styleDirective:
      "Speaking as an ancient, mystic sorcerer delivering a spell or prophecy, with resonant archaic gravitas, crackling mystery, and timeless wisdom",
    category: "character",
  },
  "executive-anchor": {
    baseVoice: "Schedar",
    name: "Victoria Anchor",
    styleDirective:
      "Speaking as a prestigious global television news anchor with commanding clarity, authoritative cadence, and impeccable neutrality",
    category: "character",
  },
};

export const KID_VOICE_PERSONAS = VOICE_PERSONAS;

export const LANGUAGE_DIRECTIVES: Record<string, string> = {
  es: "Speaking in fluent, authentic native Spanish with accurate Spanish phonetics, clear vowel articulation, proper rolled r's, and natural cadence. Pronounce all numbers, digits, and mathematical symbols completely in native Spanish words (e.g., '1+1' must be spoken as 'uno más uno', '+' as 'más', '-' as 'menos', '=' as 'es igual a').",
  en: "Speaking in clear, natural native English with proper pronunciation and articulation. Pronounce all numbers, digits, and mathematical symbols clearly (e.g., '1+1' as 'one plus one').",
  ar: "Speaking in authentic native Arabic with accurate Arabic phonetics, correct makharij, and natural cadence. Pronounce all numbers and mathematical symbols completely in native Arabic (e.g., '1+1' as 'واحد زائد واحد').",
  fr: "Speaking in authentic native French with accurate French phonetics, proper liaisons, correct nasal vowels, and natural cadence. Pronounce all numbers and mathematical symbols completely in native French (e.g., '1+1' as 'un plus un').",
  de: "Speaking in authentic native German with accurate German phonetics, proper articulation of umlauts and consonants, and natural cadence. Pronounce all numbers and mathematical symbols completely in native German (e.g., '1+1' as 'eins plus eins').",
  it: "Speaking in authentic native Italian with natural cadence, correct gemination, and pure Italian vowels. Pronounce all numbers and mathematical symbols completely in native Italian (e.g., '1+1' as 'uno più uno').",
  pt: "Speaking in authentic native Portuguese with accurate phonetics and natural cadence. Pronounce all numbers and mathematical symbols completely in native Portuguese (e.g., '1+1' as 'um mais um').",
  ja: "Speaking in authentic native Japanese with natural pitch accent and rhythm. Pronounce all numbers and mathematical symbols in native Japanese (e.g., '1+1' as 'いち たす いち').",
  tr: "Speaking in authentic native Turkish with proper vowel harmony and natural rhythm. Pronounce all numbers and mathematical symbols in native Turkish (e.g., '1+1' as 'bir artı bir').",
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

const NUMBER_WORDS: Record<string, Record<string, string>> = {
  es: {
    "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro", "5": "cinco",
    "6": "seis", "7": "siete", "8": "ocho", "9": "nueve", "10": "diez",
    "11": "once", "12": "doce", "13": "trece", "14": "catorce", "15": "quince",
    "16": "dieciséis", "17": "diecisiete", "18": "dieciocho", "19": "diecinueve", "20": "veinte",
    "30": "treinta", "40": "cuarenta", "50": "cincuenta", "60": "sesenta", "70": "setenta",
    "80": "ochenta", "90": "noventa", "100": "cien",
  },
  fr: {
    "0": "zéro", "1": "un", "2": "deux", "3": "trois", "4": "quatre", "5": "cinq",
    "6": "six", "7": "sept", "8": "huit", "9": "neuf", "10": "dix",
    "11": "onze", "12": "douze", "13": "treize", "14": "quatorze", "15": "quinze",
    "16": "seize", "17": "dix-sept", "18": "dix-huit", "19": "dix-neuf", "20": "vingt",
    "100": "cent",
  },
  de: {
    "0": "null", "1": "eins", "2": "zwei", "3": "drei", "4": "vier", "5": "fünf",
    "6": "sechs", "7": "sieben", "8": "acht", "9": "neun", "10": "zehn",
    "11": "elf", "12": "zwölf", "20": "zwanzig", "100": "hundert",
  },
  it: {
    "0": "zero", "1": "uno", "2": "due", "3": "tre", "4": "quattro", "5": "cinque",
    "6": "sei", "7": "sette", "8": "otto", "9": "nove", "10": "dieci",
    "20": "venti", "100": "cento",
  },
  pt: {
    "0": "zero", "1": "um", "2": "dois", "3": "três", "4": "quatro", "5": "cinco",
    "6": "seis", "7": "sete", "8": "oito", "9": "nove", "10": "dez",
    "20": "vinte", "100": "cem",
  },
  ar: {
    "0": "صفر", "1": "واحد", "2": "اثنان", "3": "ثلاثة", "4": "أربعة", "5": "خمسة",
    "6": "ستة", "7": "سبعة", "8": "ثمانية", "9": "تسعة", "10": "عشرة",
  },
  tr: {
    "0": "sıfır", "1": "bir", "2": "iki", "3": "üç", "4": "dört", "5": "beş",
    "6": "altı", "7": "yedi", "8": "sekiz", "9": "dokuz", "10": "on",
    "20": "yirmi", "100": "yüz",
  },
  ja: {
    "0": "ゼロ", "1": "いち", "2": "に", "3": "さん", "4": "よん", "5": "ご",
    "6": "ろく", "7": "なな", "8": "はち", "9": "きゅう", "10": "じゅう",
  },
  en: {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
    "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  },
};

const OPERATOR_WORDS: Record<string, Record<string, string>> = {
  es: { "+": "más", "-": "menos", "*": "por", "×": "por", "/": "entre", "÷": "entre", "=": "es igual a", "%": "por ciento" },
  fr: { "+": "plus", "-": "moins", "*": "fois", "×": "fois", "/": "divisé par", "÷": "divisé par", "=": "égale", "%": "pour cent" },
  de: { "+": "plus", "-": "minus", "*": "mal", "×": "mal", "/": "geteilt durch", "÷": "geteilt durch", "=": "ist gleich", "%": "Prozent" },
  it: { "+": "più", "-": "meno", "*": "per", "×": "per", "/": "diviso", "÷": "diviso", "=": "è uguale a", "%": "per cento" },
  pt: { "+": "mais", "-": "menos", "*": "vezes", "×": "vezes", "/": "dividido por", "÷": "dividido por", "=": "é igual a", "%": "por cento" },
  ar: { "+": "زائد", "-": "ناقص", "*": "ضرب", "×": "ضرب", "/": "تقسيم", "÷": "تقسيم", "=": "يساوي", "%": "بالمائة" },
  tr: { "+": "artı", "-": "eksi", "*": "çarpı", "×": "çarpı", "/": "bölü", "÷": "bölü", "=": "eşittir", "%": "yüzde" },
  ja: { "+": "たす", "-": "ひく", "*": "かける", "×": "かける", "/": "わる", "÷": "わる", "=": "は", "%": "パーセント" },
  en: { "+": "plus", "-": "minus", "*": "times", "×": "times", "/": "divided by", "÷": "divided by", "=": "equals", "%": "percent" },
};

export function spanishNumberToWords(n: number): string {
  if (isNaN(n)) return "";
  if (n < 0) return `menos ${spanishNumberToWords(-n)}`;
  if (n === 0) return "cero";
  if (n <= 20) {
    const units = [
      "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
      "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"
    ];
    return units[n];
  }
  if (n < 30) {
    const twenties = [
      "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
      "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"
    ];
    return twenties[n - 20];
  }
  if (n < 100) {
    const tens = [
      "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"
    ];
    const ten = Math.floor(n / 10);
    const rem = n % 10;
    return rem === 0 ? tens[ten] : `${tens[ten]} y ${spanishNumberToWords(rem)}`;
  }
  if (n === 100) return "cien";
  if (n < 1000) {
    const hundreds = [
      "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
      "seiscientos", "setecientos", "ochocientos", "novecientos"
    ];
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    return rem === 0 ? hundreds[hundred] : `${hundreds[hundred]} ${spanishNumberToWords(rem)}`;
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    const prefix = thousands === 1 ? "mil" : `${spanishNumberToWords(thousands)} mil`;
    return rem === 0 ? prefix : `${prefix} ${spanishNumberToWords(rem)}`;
  }
  return String(n);
}

export function formatNumberForLanguage(numStr: string, lang: string): string {
  const targetLang = (lang || "en").toLowerCase();
  const num = parseInt(numStr, 10);
  if (!isNaN(num) && num >= 0 && num < 1000000) {
    if (targetLang === "es") {
      return spanishNumberToWords(num);
    }
  }
  const numMap = NUMBER_WORDS[targetLang] || NUMBER_WORDS.en;
  return numMap[numStr] !== undefined ? numMap[numStr] : numStr;
}

/**
 * Normalizes mathematical formulas, digits, and symbols to natural words in the target language
 * e.g. "1+1" -> "uno más uno" in Spanish, avoiding English fallback pronunciation
 */
export function verbalizeTextForLanguage(text: string, lang: string): string {
  if (!text || !lang || lang === "auto") return text;
  const targetLang = lang.toLowerCase();
  const numMap = NUMBER_WORDS[targetLang] || NUMBER_WORDS.es;
  const opMap = OPERATOR_WORDS[targetLang] || OPERATOR_WORDS.es;

  let result = text;

  // 1. Math equations: e.g. "1+1", "1 + 1", "2 * 3", "10 / 2"
  // Run replacement in a loop to handle chained expressions like 1+1+1
  for (let pass = 0; pass < 3; pass++) {
    const prev = result;
    result = result.replace(/(\d+)\s*([\+\-\*\/×÷=])\s*(\d+)/g, (_match, n1, op, n2) => {
      const w1 = formatNumberForLanguage(n1, targetLang);
      const w2 = formatNumberForLanguage(n2, targetLang);
      const opWord = opMap[op] || op;
      return `${w1} ${opWord} ${w2}`;
    });
    if (result === prev) break;
  }

  // 2. Chained equal sign: e.g. "uno más uno = 2" or "1+1 = 2"
  result = result.replace(/([\wáéíóúñüçàèùâêîôûäöüß]+)\s*(=)\s*(\d+)/gi, (_match, w1, op, n) => {
    const w2 = formatNumberForLanguage(n, targetLang);
    const opWord = opMap[op] || op;
    return `${w1} ${opWord} ${w2}`;
  });

  // 3. Percentage: e.g. "50%" -> "cincuenta por ciento"
  result = result.replace(/(\d+)\s*%/g, (_match, n) => {
    const w = formatNumberForLanguage(n, targetLang);
    return `${w} ${opMap["%"] || "por ciento"}`;
  });

  // 4. Standalone numbers in text for non-English languages (e.g. "2" -> "dos" in Spanish)
  if (targetLang === "es") {
    // Replace standalone digits or numbers up to 4 digits
    result = result.replace(/\b(\d{1,4})\b/g, (_match, digits) => {
      return formatNumberForLanguage(digits, targetLang);
    });
  } else if (targetLang !== "en") {
    result = result.replace(/\b(\d{1,2})\b/g, (_match, digits) => {
      return numMap[digits] !== undefined ? numMap[digits] : digits;
    });
  }

  return result;
}
