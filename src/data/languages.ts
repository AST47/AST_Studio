import { SupportedLanguage } from "../types/tts";

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  pronunciationTip: string;
  samplePhrases: { label: string; text: string }[];
}

export const LANGUAGES: LanguageInfo[] = [
  {
    code: "auto",
    name: "Auto Detect",
    nativeName: "Auto",
    flag: "🌐",
    pronunciationTip: "Automatically detects language script and applies native phonetic directives.",
    samplePhrases: [],
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    pronunciationTip: "Forces pure Spanish vowels (a, e, i, o, u), rolling r's, and proper Spanish stress.",
    samplePhrases: [
      {
        label: "Aventura Infantil",
        text: "¡Hola amigos! <laugh> ¡Miren lo que encontré en el jardín! Un mapa del tesoro escondido entre las flores.",
      },
      {
        label: "Podcast de Tecnología",
        text: "Bienvenidos a Tech Actual. <breath> Hoy analizamos cómo los modelos de voz neuronal están transformando la comunicación moderna.",
      },
      {
        label: "Saludo Festivo",
        text: "¡Qué alegría verte hoy! <laugh> Vamos a preparar todo para la gran fiesta de esta tarde.",
      },
    ],
  },
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    pronunciationTip: "Standard English phonetics, clear diction, and natural cadence.",
    samplePhrases: [
      {
        label: "Story Adventure",
        text: "Deep in the whispering forest, a glowing trail appeared beneath the giant oak trees. <gasp> Look at those magical lights!",
      },
      {
        label: "Tech Review",
        text: "Welcome back everyone. <breath> Today we are testing high-fidelity 24kHz speech synthesis in real time.",
      },
    ],
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    pronunciationTip: "Standard Arabic (Fusha) with precise articulation (Makharij) and natural rhythm.",
    samplePhrases: [
      {
        label: "تحية وترحيب",
        text: "أهلاً وسهلاً بكم جميعاً. <breath> يسعدنا جداً حضوركم معنا اليوم في هذا اللقاء الممتع والمفيد.",
      },
      {
        label: "قصة مشوقة",
        text: "في ليلة هادئة تحت ضوء النجوم، انطلق القارب الصغير في رحلته عبر أمواج البحر الفضية.",
      },
    ],
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    pronunciationTip: "Authentic French phonetics with proper liaisons, nasal vowels, and Parisian cadence.",
    samplePhrases: [
      {
        label: "Invitation Poétique",
        text: "Bonjour tout le monde ! <breath> Quelle magnifique journée pour explorer les rues pavées de la ville.",
      },
      {
        label: "Histoire Magique",
        text: "Au cœur du village mystérieux, une mélodie douce résonnait à travers les feuilles dorées de l'automne.",
      },
    ],
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    pronunciationTip: "Precise Hochdeutsch consonants, vowel length, and umlaut articulation.",
    samplePhrases: [
      {
        label: "Abenteuer",
        text: "Hallo zusammen! <laugh> Schau mal, was wir hier entdeckt haben! Ein uraltes Buch voller Geheimnisse.",
      },
      {
        label: "Wissenschaft & Technik",
        text: "Guten Tag und herzlich willkommen. Heute werfen wir einen detaillierten Blick auf modernste Sprachtechnologien.",
      },
    ],
  },
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    pronunciationTip: "Melodic Italian rhythm, correct double consonants (gemination), and open vowels.",
    samplePhrases: [
      {
        label: "Saluti d'Italia",
        text: "Ciao a tutti! <laugh> Che splendida giornata di sole! Andiamo subito a prendere un buon gelato in piazza.",
      },
    ],
  },
  {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
    pronunciationTip: "Accurate Portuguese nasal vowels and natural syllable-timed cadence.",
    samplePhrases: [
      {
        label: "Aventura",
        text: "Olá a todos! <laugh> Olhem só que maravilha encontramos hoje na praia durante o pôr do sol.",
      },
    ],
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    pronunciationTip: "Natural Japanese pitch accent, mora timing, and clean pronunciation.",
    samplePhrases: [
      {
        label: "挨拶と紹介",
        text: "みなさん、こんにちは！<breath> 今日も素敵な一日の始まりです。どうぞよろしくお願いします。",
      },
    ],
  },
  {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    flag: "🇹🇷",
    pronunciationTip: "Clear Turkish vowel harmony, soft g (ğ) smoothing, and natural cadence.",
    samplePhrases: [
      {
        label: "Sıcak Karşılama",
        text: "Herkese merhaba! <laugh> Bugün harika bir macera için buradayız. Hep birlikte keşfetmeye hazır mısınız?",
      },
    ],
  },
];

/**
 * Fast client-side language detector for text
 */
export function detectLanguageFromText(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return "en";

  const trimmed = text.trim();

  // Arabic detection (Unicode range)
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) {
    return "ar";
  }

  // Japanese detection (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmed)) {
    return "ja";
  }

  // Spanish detection: special characters or high-frequency Spanish words
  if (
    /[ñÑ¿¡áéíóúÁÉÍÓÚ]/.test(trimmed) ||
    /\b(hola|cómo|como|estás|esta|este|están|vamos|gracias|bueno|buena|amigo|amiga|hoy|ayer|mañana|todos|todas|playa|tiempo|hacer|decir|ahora|siempre|casa|vida|niño|niña|por|para|con|pero|más|mas|bien|mira|miren|claro)\b/i.test(
      trimmed
    )
  ) {
    return "es";
  }

  // French detection
  if (
    /[œæçàèùâêîôûëïüÇÀÈÙÂÊÎÔÛËÏÜ]/.test(trimmed) ||
    /\b(bonjour|merci|oui|avec|pour|dans|nous|vous|cette|aussi|très|tres|monde|jour|toujours|salut|voilà)\b/i.test(
      trimmed
    )
  ) {
    return "fr";
  }

  // German detection
  if (
    /[äöüßÄÖÜ]/.test(trimmed) ||
    /\b(hallo|danke|bitte|und|nicht|wir|sie|ist|sind|sehr|schön|guten|morgen|abend|heute|wieder)\b/i.test(
      trimmed
    )
  ) {
    return "de";
  }

  // Italian detection
  if (
    /\b(ciao|grazie|buongiorno|perché|perche|anche|quando|questo|questa|tutto|tutta|sono|molto|bello|bella|andiamo|giornata)\b/i.test(
      trimmed
    )
  ) {
    return "it";
  }

  // Portuguese detection
  if (
    /[ãõÃÕ]/.test(trimmed) ||
    /\b(olá|ola|obrigado|obrigada|muito|tudo|bem|você|voce|vamos|hoje|agora|fazer)\b/i.test(
      trimmed
    )
  ) {
    return "pt";
  }

  // Turkish detection
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
