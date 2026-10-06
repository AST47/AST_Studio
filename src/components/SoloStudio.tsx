import React, { useState, useRef, useMemo } from "react";
import {
  Mic,
  Sparkles,
  Wand2,
  Play,
  RotateCcw,
  Copy,
  Check,
  BookOpen,
  Sliders,
  Zap,
  Flame,
  Loader2,
  ChevronDown,
  Globe,
  SpellCheck,
} from "lucide-react";
import { VoiceName, GeneratedAudioItem, QuotaStatus, SupportedLanguage } from "../types/tts";
import { VOICES_CATALOG, PRESET_STYLES, SCRIPT_TEMPLATES } from "../data/voices";
import { LANGUAGES, detectLanguageFromText } from "../data/languages";
import { requestTts, requestScriptEnhance } from "../services/api";
import { AudioPlayer } from "./AudioPlayer";

interface SoloStudioProps {
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  onAudioGenerated: (item: GeneratedAudioItem) => void;
  quotaStatus?: QuotaStatus;
  onQuotaUpdated?: (quota: QuotaStatus) => void;
  activeAudioItem?: GeneratedAudioItem | null;
  onClearAudio?: () => void;
}

export const SoloStudio: React.FC<SoloStudioProps> = ({
  selectedVoice,
  onSelectVoice,
  onAudioGenerated,
  quotaStatus,
  onQuotaUpdated,
  activeAudioItem,
  onClearAudio,
}) => {
  const [scriptText, setScriptText] = useState(
    SCRIPT_TEMPLATES[0].text
  );
  const [stylePrompt, setStylePrompt] = useState(
    SCRIPT_TEMPLATES[0].style
  );
  const [selectedModel, setSelectedModel] = useState<
    "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts"
  >("gemini-3.8-flash-lite-tts");

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    isQuota: boolean;
    details?: string;
  } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showStylePresets, setShowStylePresets] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLanguageSamples, setShowLanguageSamples] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Dynamic language detection
  const detectedLanguage = useMemo(() => detectLanguageFromText(scriptText), [scriptText]);
  const activeEffectiveLanguage = selectedLanguage === "auto" ? detectedLanguage : selectedLanguage;
  const activeLangConfig = LANGUAGES.find((l) => l.code === activeEffectiveLanguage) || LANGUAGES[1];

  // Stats calculation
  const words = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const chars = scriptText.length;
  // Average speaking rate: ~140 words per minute -> 2.33 words/sec
  const estimatedSeconds = Math.max(1, Math.round((words / 140) * 60));

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setScriptText((prev) => prev + " " + tag + " ");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = scriptText;
    const updated =
      current.substring(0, start) + ` ${tag} ` + current.substring(end);
    setScriptText(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
    }, 10);
  };

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      setErrorState({
        message: "Please enter or select some text to generate speech.",
        isQuota: false,
      });
      return;
    }

    setErrorState(null);
    setIsGenerating(true);

    try {
      const res = await requestTts({
        mode: "single",
        text: scriptText,
        voice: selectedVoice,
        style: stylePrompt,
        language: selectedLanguage,
        model: selectedModel,
      });

      const newItem: GeneratedAudioItem = {
        id: `vox-${Date.now()}`,
        title: scriptText.slice(0, 36) + (scriptText.length > 36 ? "..." : ""),
        createdAt: Date.now(),
        mode: "single",
        modelUsed: res.modelUsed,
        duration: res.duration,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        textPreview: scriptText.slice(0, 90),
        voice: selectedVoice,
        style: stylePrompt,
        language: activeEffectiveLanguage,
      };

      if (res.quotaStatus && onQuotaUpdated) {
        onQuotaUpdated(res.quotaStatus);
      }

      onAudioGenerated(newItem);
    } catch (err: any) {
      console.error("Speech error", err);
      const isQuota = err.isQuotaExceeded || err.message?.includes("Quota");
      setErrorState({
        message: err.message || "Failed to generate speech.",
        isQuota,
        details: err.details,
      });
      if (isQuota) {
        setRetryCountdown(30);
        const timer = setInterval(() => {
          setRetryCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhanceScript = async (
    action: "polish" | "expressive" | "shorten" | "dramatic" | "accentuate"
  ) => {
    if (!scriptText.trim()) return;
    setIsEnhancing(true);
    setErrorState(null);
    try {
      const enhanced = await requestScriptEnhance(action, scriptText);
      if (enhanced) {
        setScriptText(enhanced);
        // If expressive tags were added, automatically recommend flash-tts
        if (action === "expressive" || /<[^>]+>/.test(enhanced)) {
          setSelectedModel("gemini-3.8-flash-tts");
        }
      }
    } catch (err: any) {
      const isQuota = err.isQuotaExceeded || err.message?.includes("Quota");
      setErrorState({
        message: err.message || "Script AI enhancement failed.",
        isQuota,
        details: err.details,
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyTemplate = (tmpl: (typeof SCRIPT_TEMPLATES)[0]) => {
    setScriptText(tmpl.text);
    setStylePrompt(tmpl.style);
    onSelectVoice(tmpl.voice);
    setShowTemplates(false);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Voice Selection Carousel */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <Mic className="w-4 h-4 text-indigo-400" />
              1. Select Speaker Voice
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Choose from Gemini 3.8's neural voice catalog.
            </p>
          </div>

          {/* Model Switcher */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setSelectedModel("gemini-3.8-flash-lite-tts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedModel === "gemini-3.8-flash-lite-tts"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Ultra-fast standard speech model"
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Flash-Lite TTS</span>
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.8-flash-tts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedModel === "gemini-3.8-flash-tts"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Flagship audio model with vocal bursts and expressive personas"
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>Flash TTS (Studio)</span>
            </button>
          </div>
        </div>

        {/* Voice Chips - Kid Voices vs Adult Voices */}
        <div className="space-y-3">
          {/* Kids Voices Row */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                👦👧 Kids Voices (Boy & Girl)
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-medium border border-amber-500/30">
                New Personas
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {VOICES_CATALOG.filter((v) => v.category === "kids").map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      onSelectVoice(v.id);
                      setSelectedModel("gemini-3.8-flash-tts");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/50"
                        : "bg-neutral-950/60 border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl" role="img" aria-label={v.name}>{v.avatarEmoji}</span>
                      <div>
                        <div className="text-xs font-bold text-neutral-100">{v.name}</div>
                        <div className="text-[10px] text-amber-300/90 font-medium">
                          {v.gender === "boy" ? "Young Boy" : "Young Girl"} ({v.ageGroup})
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{v.tone}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adult Voices Row */}
          <div className="pt-2 border-t border-neutral-800/80">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">
              🎙️ Adult Voices
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {VOICES_CATALOG.filter((v) => v.category === "adults").map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVoice(v.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/50"
                        : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    )}
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-neutral-100">{v.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400 uppercase">
                        {v.gender[0]}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{v.tags.slice(0, 2).join(", ")}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Script & Voice Direction Workspace */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Style & Persona Direction Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              2. Voice Style & Direction
            </label>

            <div className="relative">
              <button
                onClick={() => setShowStylePresets(!showStylePresets)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Style Presets</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showStylePresets && (
                <div className="absolute right-0 top-6 z-20 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 space-y-1">
                  {PRESET_STYLES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setStylePrompt(preset.prompt);
                        setShowStylePresets(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors text-xs cursor-pointer"
                    >
                      <div className="font-semibold text-neutral-200">{preset.label}</div>
                      <div className="text-[11px] text-neutral-400 truncate">{preset.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            type="text"
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="e.g. Warm, slow-paced audiobook narrator with gentle breath and soothing tone"
            className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
          />
        </div>

        {/* Script Editor Header */}
        <div className="pt-2 border-t border-neutral-800/80">
          {/* Language Selection & Pronunciation Bar */}
          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-2.5 mb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" /> Language & Pronunciation:
                </span>
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setSelectedLanguage(lang.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                          : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/60"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Detection / Native Pronunciation Indicator */}
              <div className="flex items-center gap-2">
                {selectedLanguage === "auto" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-700/80 text-neutral-300">
                    <span className="text-xs">{activeLangConfig.flag}</span>
                    <span>Detected: <strong className="text-white">{activeLangConfig.name}</strong></span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                    <span className="text-xs">{activeLangConfig.flag}</span>
                    <span>{activeLangConfig.name} Phonics Active</span>
                  </span>
                )}

                {/* Language Sample Phrases Dropdown */}
                {activeLangConfig.samplePhrases && activeLangConfig.samplePhrases.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLanguageSamples(!showLanguageSamples)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{activeLangConfig.flag} Phrases</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showLanguageSamples && (
                      <div className="absolute right-0 top-7 z-20 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 space-y-1">
                        {activeLangConfig.samplePhrases.map((phrase, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setScriptText(phrase.text);
                              setShowLanguageSamples(false);
                            }}
                            className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors text-xs cursor-pointer"
                          >
                            <div className="font-semibold text-neutral-200">{phrase.label}</div>
                            <div className="text-[11px] text-neutral-400 line-clamp-1">{phrase.text}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pronunciation tip */}
            <div className="mt-2 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="line-clamp-1">
                💡 <strong className="text-neutral-300">{activeLangConfig.name}:</strong> {activeLangConfig.pronunciationTip}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Script Workspace
              </label>

              {/* Template dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1 border border-neutral-700/60 cursor-pointer"
                >
                  <span>Sample Scripts</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showTemplates && (
                  <div className="absolute left-0 top-8 z-20 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 space-y-1">
                    {SCRIPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors text-xs cursor-pointer"
                      >
                        <div className="font-semibold text-neutral-200">{tmpl.title}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">Voice: {tmpl.voice}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Script Copilot Actions */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Rewrite:
              </span>
              <button
                onClick={() => handleEnhanceScript("accentuate")}
                disabled={isEnhancing}
                className="px-2.5 py-1 text-xs rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
                title="Fix missing Spanish tildes (á, é, í, ó, ú, ñ, ¿, ¡) and phonetic spellings for perfect TTS pronunciation"
              >
                <SpellCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Fix Accents & Spelling</span>
              </button>
              <button
                onClick={() => handleEnhanceScript("polish")}
                disabled={isEnhancing}
                className="px-2 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                Polish Speech
              </button>
              <button
                onClick={() => handleEnhanceScript("expressive")}
                disabled={isEnhancing}
                className="px-2 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/20 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                title="Inject natural breaths, laughs, and pauses"
              >
                + Vocal Bursts
              </button>
              <button
                onClick={() => handleEnhanceScript("dramatic")}
                disabled={isEnhancing}
                className="px-2 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                Cinematic
              </button>
              <button
                onClick={() => handleEnhanceScript("shorten")}
                disabled={isEnhancing}
                className="px-2 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                Condense (30s)
              </button>
            </div>
          </div>

          {/* Expressive Vocal Burst Tag Toolbar */}
          <div className="bg-neutral-950/60 rounded-xl p-2.5 border border-neutral-800/80 mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-indigo-400" /> Insert Expression:
            </span>
            {[
              { tag: "<breath>", label: "<breath> Natural Breath" },
              { tag: "<laugh>", label: "<laugh> Chuckle" },
              { tag: "<gasp>", label: "<gasp> Gasp" },
              { tag: "<sigh>", label: "<sigh> Gentle Sigh" },
              { tag: "<cough>", label: "<cough> Cough" },
              { tag: "|mhm|", label: "|mhm| Agreement" },
              { tag: "|yeah|", label: "|yeah| Casual Backchannel" },
            ].map(({ tag, label }) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg bg-neutral-900 hover:bg-indigo-950/50 hover:text-indigo-300 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Script Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={6}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Enter text here to generate lifelike speech..."
              className="w-full p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 font-sans text-sm sm:text-base leading-relaxed focus:outline-none focus:border-indigo-500/80 transition-all resize-y"
            />

            {/* Quick Actions in bottom of textarea */}
            <div className="flex items-center justify-between text-xs text-neutral-400 px-2 py-1.5 font-mono">
              <div className="flex items-center gap-3">
                <span>{words} words</span>
                <span>•</span>
                <span>{chars} characters</span>
                <span>•</span>
                <span className="text-indigo-400 font-semibold">
                  ~{estimatedSeconds}s spoken
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="hover:text-neutral-200 transition-colors flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => setScriptText("")}
                  className="hover:text-neutral-200 transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorState && (
          errorState.isQuota ? (
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Gemini API Quota / Rate Limit Reached
                </span>
                {retryCountdown > 0 && (
                  <span className="font-mono text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded text-[11px]">
                    Auto-retry ready in {retryCountdown}s
                  </span>
                )}
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                {errorState.details || "Your attached Gemini API key reached its free-tier rate limit (Requests Per Minute or Daily Quota). This is a temporary Google API quota limitation, not a flaw in your app."}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-800/50">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || retryCountdown > 0}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  {retryCountdown > 0 ? `Wait ${retryCountdown}s to retry` : "Retry Generation Now"}
                </button>
                <span className="text-[11px] text-amber-300/70">
                  Tip: Free tier per-minute quotas reset every 30–60s. For heavy usage, attach a pay-as-you-go key in Settings &gt; Secrets.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300">
              <strong className="font-semibold">Generation error: </strong>
              {errorState.message}
            </div>
          )
        )}

        {/* Bottom Generation Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span
              className={`w-2 h-2 rounded-full ${
                quotaStatus?.isThrottled || (quotaStatus?.requestsInLastMinute || 0) >= 5
                  ? "bg-red-400 animate-ping"
                  : (quotaStatus?.requestsInLastMinute || 0) >= 4
                  ? "bg-amber-400 animate-pulse"
                  : "bg-emerald-400"
              }`}
            />
            <span className="font-mono">
              Quota: <strong className="text-neutral-200">{quotaStatus?.requestsInLastMinute || 0}/{quotaStatus?.freeTierRpmLimit || 5} RPM</strong>
            </span>
            {quotaStatus && quotaStatus.cooldownRemaining > 0 ? (
              <span className="text-red-400 font-bold font-mono">
                • Cooldown {quotaStatus.cooldownRemaining}s
              </span>
            ) : quotaStatus && quotaStatus.secondsUntilNextWindowSlot > 0 ? (
              <span className="text-neutral-500 font-mono">
                • Slot reset in {quotaStatus.secondsUntilNextWindowSlot}s
              </span>
            ) : (
              <span className="text-emerald-400/90 font-mono">• Safe</span>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !scriptText.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing Voice...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Generate Speech (WAV)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Listen to the Outcome (Audio Deck) */}
      <section aria-label="Listen to the Outcome">
        <AudioPlayer
          item={activeAudioItem || null}
          onClear={onClearAudio}
        />
      </section>
    </div>
  );
};
