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
  Key,
  Clock,
  ExternalLink,
  X,
  AlertCircle,
  Search,
  Volume2,
  SlidersHorizontal,
  Film,
  Video,
  CheckCircle2,
  Scissors,
  Lock,
  Unlock,
  Pause,
  Clock3,
} from "lucide-react";
import { VoiceName, GeneratedAudioItem, QuotaStatus, SupportedLanguage } from "../types/tts";
import { VOICES_CATALOG, PRESET_STYLES, SCRIPT_TEMPLATES } from "../data/voices";
import { LANGUAGES, detectLanguageFromText } from "../data/languages";
import { requestTts, requestScriptEnhance } from "../services/api";
import { recordQuotaExceeded, clearQuotaCooldown } from "../services/quotaTracker";
import { verbalizeTextForLanguage } from "../services/clientLangUtils";
import {
  parseScriptPauseSegments,
  hasSilenceTags,
  assembleSegmentedAudio,
  padAudioWithSilence,
  fitAudioToTargetDuration,
} from "../services/audioTimeStretch";
import { AudioPlayer } from "./AudioPlayer";

interface SoloStudioProps {
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  onAudioGenerated: (item: GeneratedAudioItem) => void;
  quotaStatus?: QuotaStatus;
  onQuotaUpdated?: (quota: QuotaStatus) => void;
  activeAudioItem?: GeneratedAudioItem | null;
  onClearAudio?: () => void;
  onOpenApiKeyModal?: () => void;
}

export const SoloStudio: React.FC<SoloStudioProps> = ({
  selectedVoice,
  onSelectVoice,
  onAudioGenerated,
  quotaStatus,
  onQuotaUpdated,
  activeAudioItem,
  onClearAudio,
  onOpenApiKeyModal,
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
  const [voiceFilterTab, setVoiceFilterTab] = useState<"all" | "official" | "kids" | "character">("all");
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [isVoicePickerExpanded, setIsVoicePickerExpanded] = useState(false);
  const [auditionLoading, setAuditionLoading] = useState(false);
  const [speakingPace, setSpeakingPace] = useState<"normal" | "slow" | "brisk" | "fast">("normal");
  const [vocalMood, setVocalMood] = useState<string>("default");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStepText, setGenerationStepText] = useState<string>("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    isQuota: boolean;
    isDaily?: boolean;
    isApiKeyRequired?: boolean;
    details?: string;
    rawError?: string;
  } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showStylePresets, setShowStylePresets] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLanguageSamples, setShowLanguageSamples] = useState(false);
  const [showVideoTimingHelper, setShowVideoTimingHelper] = useState(false);
  const [videoTargetSec, setVideoTargetSec] = useState<number>(7.0);
  const [enforceDurationLock, setEnforceDurationLock] = useState<boolean>(false);
  const [durationAdjustmentMode, setDurationAdjustmentMode] = useState<"pad_silence" | "sola_stretch">("pad_silence");
  const [customPauseSec, setCustomPauseSec] = useState<number>(2.5);
  const [showCustomPauseModal, setShowCustomPauseModal] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Active voice info
  const currentVoiceInfo = useMemo(() => {
    return VOICES_CATALOG.find((v) => v.id === selectedVoice) || VOICES_CATALOG[0];
  }, [selectedVoice]);

  // Filtered voice roster for studio selector
  const filteredVoicesForStudio = useMemo(() => {
    return VOICES_CATALOG.filter((v) => {
      if (voiceFilterTab !== "all" && v.category !== voiceFilterTab) return false;
      if (voiceSearchQuery.trim()) {
        const q = voiceSearchQuery.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.tone.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)) ||
          v.baseVoice.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [voiceFilterTab, voiceSearchQuery]);

  // Dynamic language detection
  const detectedLanguage = useMemo(() => detectLanguageFromText(scriptText), [scriptText]);
  const activeEffectiveLanguage = selectedLanguage === "auto" ? detectedLanguage : selectedLanguage;
  const activeLangConfig = LANGUAGES.find((l) => l.code === activeEffectiveLanguage) || LANGUAGES[1];

  // Dynamic verbalized pronunciation preview for numbers, formulas, and math symbols
  const verbalizedPreview = useMemo(() => {
    return verbalizeTextForLanguage(scriptText, activeEffectiveLanguage);
  }, [scriptText, activeEffectiveLanguage]);

  // Script Segment and Silence Analysis
  const scriptSegments = useMemo(() => parseScriptPauseSegments(scriptText), [scriptText]);
  const silenceSegmentCount = useMemo(() => scriptSegments.filter((s) => s.type === "silence").length, [scriptSegments]);
  const totalExplicitSilenceSec = useMemo(() => {
    return Number(
      scriptSegments
        .filter((s) => s.type === "silence" && !s.isAuto)
        .reduce((acc, curr) => acc + (curr.durationSec || 0), 0)
        .toFixed(2)
    );
  }, [scriptSegments]);
  const hasAutoSilence = useMemo(() => scriptSegments.some((s) => s.type === "silence" && s.isAuto), [scriptSegments]);

  // Stats calculation
  const words = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const chars = scriptText.length;
  // Average speaking rate: ~140 words per minute -> 2.33 words/sec
  const estimatedSeconds = Math.max(1, Math.round((words / 140) * 60));
  const estimatedTotalClipSec = Number((estimatedSeconds + totalExplicitSilenceSec).toFixed(1));

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
    setGenerationStepText("Initiating speech synthesis...");

    try {
      let effectiveStyle = stylePrompt.trim();
      if (speakingPace === "slow") {
        effectiveStyle = effectiveStyle
          ? `${effectiveStyle}. Pacing: Speak slowly and deliberately`
          : "Speak slowly and deliberately";
      } else if (speakingPace === "brisk") {
        effectiveStyle = effectiveStyle
          ? `${effectiveStyle}. Pacing: Speak at a brisk, energetic tempo`
          : "Speak at a brisk, energetic tempo";
      } else if (speakingPace === "fast") {
        effectiveStyle = effectiveStyle
          ? `${effectiveStyle}. Pacing: Fast, high-tempo cadence`
          : "Fast, high-tempo cadence";
      }

      if (vocalMood && vocalMood !== "default") {
        effectiveStyle = effectiveStyle
          ? `${effectiveStyle}. Delivery mood: ${vocalMood}`
          : `Delivery mood: ${vocalMood}`;
      }

      let finalAudioBase64: string;
      let finalDuration: number;
      let actualModelUsed = selectedModel;
      let finalQuotaStatus: any = null;

      if (silenceSegmentCount > 0) {
        // Multi-segment generation: split script at silence/pause markers, synthesize speech parts, and splice with pure digital silence
        const speechSegments = scriptSegments.filter((s) => s.type === "speech" && s.text?.trim());
        if (speechSegments.length === 0) {
          throw new Error("Please enter spoken text along with your silence/pause tags.");
        }

        const speechWavs: string[] = [];
        for (let i = 0; i < speechSegments.length; i++) {
          const chunk = speechSegments[i];
          setGenerationStepText(`Synthesizing speech segment ${i + 1} of ${speechSegments.length}...`);
          const chunkRes = await requestTts({
            mode: "single",
            text: chunk.text!,
            voice: selectedVoice,
            style: effectiveStyle,
            language: selectedLanguage,
            model: selectedModel,
          });
          speechWavs.push(chunkRes.audioBase64);
          actualModelUsed = chunkRes.modelUsed;
          if (chunkRes.quotaStatus) finalQuotaStatus = chunkRes.quotaStatus;
        }

        setGenerationStepText("Splicing pure digital silence & assembling audio timeline...");
        const targetSec = enforceDurationLock ? videoTargetSec : undefined;
        const assembled = await assembleSegmentedAudio(speechWavs, scriptSegments, targetSec);
        finalAudioBase64 = assembled.audioBase64;
        finalDuration = assembled.duration;
      } else if (enforceDurationLock && videoTargetSec > 0) {
        // Enforce exact duration requested by user for video matching (e.g. 7.0s)
        setGenerationStepText(`Synthesizing neural voice with Gemini 3.8...`);
        const res = await requestTts({
          mode: "single",
          text: scriptText,
          voice: selectedVoice,
          style: effectiveStyle,
          language: selectedLanguage,
          model: selectedModel,
        });
        actualModelUsed = res.modelUsed;
        if (res.quotaStatus) finalQuotaStatus = res.quotaStatus;

        if (durationAdjustmentMode === "sola_stretch") {
          setGenerationStepText(`Time-stretching speech to exact ${videoTargetSec.toFixed(2)}s (preserving pitch)...`);
          const fitted = await fitAudioToTargetDuration(res.audioBase64, videoTargetSec);
          finalAudioBase64 = fitted.audioBase64;
          finalDuration = fitted.duration;
        } else {
          // Default: pad clean digital silence at the end so speech remains 100% natural and total length is exact
          setGenerationStepText(`Finalizing clip to exact ${videoTargetSec.toFixed(2)}s with digital silence pad...`);
          const padded = await padAudioWithSilence(res.audioBase64, videoTargetSec, "end");
          finalAudioBase64 = padded.audioBase64;
          finalDuration = padded.duration;
        }
      } else {
        // Standard single generation
        setGenerationStepText("Generating voiceover with Gemini 3.8...");
        const res = await requestTts({
          mode: "single",
          text: scriptText,
          voice: selectedVoice,
          style: effectiveStyle,
          language: selectedLanguage,
          model: selectedModel,
        });
        finalAudioBase64 = res.audioBase64;
        finalDuration = res.duration;
        actualModelUsed = res.modelUsed;
        if (res.quotaStatus) finalQuotaStatus = res.quotaStatus;
      }

      const newItem: GeneratedAudioItem = {
        id: `vox-${Date.now()}`,
        title: scriptText.slice(0, 36) + (scriptText.length > 36 ? "..." : ""),
        createdAt: Date.now(),
        mode: "single",
        modelUsed: actualModelUsed,
        duration: finalDuration,
        audioBase64: finalAudioBase64,
        mimeType: "audio/wav",
        textPreview: scriptText.slice(0, 90),
        voice: selectedVoice,
        style: effectiveStyle,
        language: activeEffectiveLanguage,
      };

      if (finalQuotaStatus && onQuotaUpdated) {
        onQuotaUpdated(finalQuotaStatus);
      }

      onAudioGenerated(newItem);
    } catch (err: any) {
      console.error("Speech error", err);
      const errMsg = (err?.message || "").toLowerCase();
      const isDaily = !!err.isDailyQuota || errMsg.includes("daily") || errMsg.includes("per day") || errMsg.includes("rpd");
      const isQuota =
        err.isQuotaExceeded ||
        isDaily ||
        errMsg.includes("quota") ||
        errMsg.includes("rate limit") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("429");
      const isApiKeyRequired =
        err.message === "API_KEY_REQUIRED" ||
        err.message?.includes("API_KEY") ||
        err.message?.includes("API key");
      const delaySecs = err.retryDelaySeconds || (isDaily ? 3600 : 45);

      if (isQuota) {
        // Record quota exceeded in global tracker so every component, HUD, pill & bottom bar stays in sync
        const updatedQuota = recordQuotaExceeded(delaySecs, isDaily);
        if (onQuotaUpdated) onQuotaUpdated(updatedQuota);

        if (!isDaily) {
          setRetryCountdown(delaySecs);
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
      }

      setErrorState({
        message: isApiKeyRequired
          ? "Google Gemini API Key Required"
          : isDaily
          ? "Google Gemini Daily Quota Limit Reached"
          : isQuota
          ? "Gemini API Quota / Rate Limit Reached"
          : err.message || "Failed to generate speech.",
        isQuota,
        isDaily,
        isApiKeyRequired,
        details: err.details,
        rawError: err.rawError || err.message,
      });
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
      {/* Voice Selection & Studio Control Center */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Header with Title and Model Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-400" />
                1. Speaker Voice & Delivery Controls
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {VOICES_CATALOG.length} Choices
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Choose from all 30 Google Gemini studio voices, 8 child personas, or 8 dramatic archetypes.
            </p>
          </div>

          {/* Model Switcher */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 self-start sm:self-auto">
            <button
              onClick={() => setSelectedModel("gemini-3.8-flash-lite-tts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedModel === "gemini-3.8-flash-lite-tts"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Ultra-fast standard speech model (free tier high efficiency)"
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
              title="Flagship studio model supporting vocal bursts (<breath>, <laugh>) and custom personas"
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>Flash TTS (Studio)</span>
            </button>
          </div>
        </div>

        {/* Active Voice Showcase Card */}
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center text-2xl shrink-0 shadow-inner">
              {currentVoiceInfo.avatarEmoji}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-white">{currentVoiceInfo.name}</span>
                {currentVoiceInfo.category === "kids" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    👦👧 {currentVoiceInfo.ageGroup}
                  </span>
                ) : currentVoiceInfo.category === "character" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                    🎭 {currentVoiceInfo.ageGroup}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                    🎙️ Google Studio HD ({currentVoiceInfo.gender})
                  </span>
                )}
                <span className="text-xs text-indigo-300 font-medium">• {currentVoiceInfo.tone}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl line-clamp-2">
                {currentVoiceInfo.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            {/* Audition Button */}
            <button
              type="button"
              onClick={async () => {
                if (auditionLoading) return;
                setAuditionLoading(true);
                try {
                  const res = await requestTts({
                    mode: "single",
                    text: currentVoiceInfo.sampleText,
                    voice: currentVoiceInfo.id,
                    style: currentVoiceInfo.stylePrompt,
                    model: currentVoiceInfo.category === "kids" || currentVoiceInfo.category === "character" ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts",
                  });
                  const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`);
                  await audio.play();
                } catch (e) {
                  console.error("Quick audition failed", e);
                } finally {
                  setAuditionLoading(false);
                }
              }}
              disabled={auditionLoading}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Audition a sample phrase with this voice"
            >
              {auditionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Audition</span>
            </button>

            {/* Toggle Full Picker */}
            <button
              type="button"
              onClick={() => setIsVoicePickerExpanded(!isVoicePickerExpanded)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isVoicePickerExpanded
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-neutral-800 hover:bg-indigo-600 hover:text-white text-neutral-200 border border-neutral-700"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isVoicePickerExpanded ? "Hide Voice Grid" : "Switch Voice (46 Options)"}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isVoicePickerExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Expandable Voice Selection Grid */}
        {isVoicePickerExpanded && (
          <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-4 space-y-3.5 transition-all">
            {/* Category Filter and Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {[
                  { id: "all", label: `All (${VOICES_CATALOG.length})` },
                  { id: "official", label: `🎙️ Studio HD (${VOICES_CATALOG.filter((v) => v.category === "official").length})` },
                  { id: "kids", label: `👦👧 Kids (${VOICES_CATALOG.filter((v) => v.category === "kids").length})` },
                  { id: "character", label: `🎭 Characters (${VOICES_CATALOG.filter((v) => v.category === "character").length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVoiceFilterTab(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      voiceFilterTab === tab.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={voiceSearchQuery}
                  onChange={(e) => setVoiceSearchQuery(e.target.value)}
                  placeholder="Filter voices..."
                  className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                {voiceSearchQuery && (
                  <button
                    onClick={() => setVoiceSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Voices Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
              {filteredVoicesForStudio.map((v) => {
                const isSelected = selectedVoice === v.id;
                const isKid = v.category === "kids";
                const isCharacter = v.category === "character";

                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      onSelectVoice(v.id);
                      if (isKid || isCharacter) {
                        setSelectedModel("gemini-3.8-flash-tts");
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? isKid
                          ? "bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500"
                          : isCharacter
                          ? "bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500"
                          : "bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500"
                        : "bg-neutral-900/70 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-lg select-none">{v.avatarEmoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-100 truncate">{v.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {isKid ? v.gender === "boy" ? "Boy" : "Girl" : v.gender}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-400 line-clamp-1">{v.tone}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Advanced Voice Delivery Controls (Pace & Mood Tuning) */}
        <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Speaking Pace */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
              ⚡ Speaking Pace:
            </span>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {[
                { id: "slow", label: "0.85x Slow" },
                { id: "normal", label: "1.0x Normal" },
                { id: "brisk", label: "1.15x Brisk" },
                { id: "fast", label: "1.25x Fast" },
              ].map((pace) => (
                <button
                  key={pace.id}
                  type="button"
                  onClick={() => setSpeakingPace(pace.id as any)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    speakingPace === pace.id
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {pace.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Mood */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
              🎭 Delivery Mood:
            </span>
            <select
              value={vocalMood}
              onChange={(e) => setVocalMood(e.target.value)}
              className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="default">✨ Natural & Neutral</option>
              <option value="Warm, intimate, and comforting with gentle breathing">🌸 Warm & Intimate</option>
              <option value="Energetic, bright, and enthusiastic with dynamic delivery">⚡ Dynamic & Upbeat</option>
              <option value="Deep, cinematic, and dramatic with intense pauses">🎬 Deep & Dramatic</option>
              <option value="Crisp, authoritative professional news anchor">📡 Authoritative Broadcast</option>
              <option value="Ultra-calm, whispering tranquil ASMR meditation cadence">🧘‍♀️ Whispering ASMR</option>
              <option value="Inspiring, visionary keynote speaker with brisk momentum">💡 Visionary Keynote</option>
            </select>
          </div>

          {/* Video Clip Timing Helper Toggle */}
          <button
            type="button"
            onClick={() => setShowVideoTimingHelper(!showVideoTimingHelper)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showVideoTimingHelper
                ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-400"
                : "bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30"
            }`}
            title="Calculate script word count and timing to fit video clip durations"
          >
            <Film className="w-3.5 h-3.5 text-purple-300" />
            <span>Video Clip Timing</span>
          </button>
        </div>

        {/* Video Clip Timing & Exact Duration Lock Deck */}
        {showVideoTimingHelper && (
          <div className="mt-3 pt-3 border-t border-purple-900/40 bg-gradient-to-r from-purple-950/30 via-neutral-900/90 to-purple-950/25 rounded-2xl p-4 space-y-4 border border-purple-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white uppercase tracking-wider">
                  Video Lip-Sync & Duration Timing Guide
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  Zero Timing Error
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">
                Natural speech rate: ~2.3 words/sec (140 WPM)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              {/* Column 1: Target Video Duration Input */}
              <div className="bg-neutral-950/80 p-3 rounded-xl border border-neutral-800 space-y-2">
                <label className="text-neutral-300 font-semibold block flex items-center justify-between">
                  <span>Target Video Duration:</span>
                  <span className="text-[10px] font-mono text-purple-400">Target Match</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="180"
                    value={videoTargetSec}
                    onChange={(e) => setVideoTargetSec(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    className="w-24 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-white text-center focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <span className="font-mono text-neutral-300 font-semibold">seconds</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {[1.5, 3.0, 5.0, 7.0, 10.0, 15.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setVideoTargetSec(sec)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        videoTargetSec === sec
                          ? "bg-purple-600 text-white font-bold shadow-sm"
                          : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: Exact Duration Lock Controls */}
              <div className="bg-neutral-950/80 p-3 rounded-xl border border-purple-500/30 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-neutral-200 font-bold flex items-center gap-1.5">
                      {enforceDurationLock ? (
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                      <span>Exact Duration Lock</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnforceDurationLock(!enforceDurationLock)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        enforceDurationLock
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                      }`}
                    >
                      {enforceDurationLock ? "ACTIVE (ON)" : "DISABLED"}
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-snug">
                    {enforceDurationLock
                      ? `Guarantees the output audio is finalized to exactly ${videoTargetSec.toFixed(2)}s.`
                      : "Enable to guarantee the generated audio matches your exact video length."}
                  </p>
                </div>

                {enforceDurationLock && (
                  <div className="pt-2 border-t border-neutral-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                      Lock Mode:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDurationAdjustmentMode("pad_silence")}
                        className={`px-2 py-1 rounded text-left transition-colors cursor-pointer ${
                          durationAdjustmentMode === "pad_silence"
                            ? "bg-purple-950 text-purple-200 border border-purple-500/60 font-semibold"
                            : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-neutral-300"
                        }`}
                        title="Keeps speech 100% natural, pads clean digital silence at the end or at pauses"
                      >
                        🔇 Pad Silence (Natural Pace)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationAdjustmentMode("sola_stretch")}
                        className={`px-2 py-1 rounded text-left transition-colors cursor-pointer ${
                          durationAdjustmentMode === "sola_stretch"
                            ? "bg-purple-950 text-purple-200 border border-purple-500/60 font-semibold"
                            : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-neutral-300"
                        }`}
                        title="Stretches voice tempo smoothly preserving vocal pitch"
                      >
                        ⚡ SOLA Time-Stretch
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: Real-Time Script Timing Breakdown */}
              <div className="bg-neutral-950/80 p-3 rounded-xl border border-neutral-800 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-neutral-300 font-semibold block mb-1">Timing Breakdown:</span>
                  <div className="space-y-1 text-neutral-300 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Spoken Speech:</span>
                      <strong className="text-indigo-300">{words} words (~{estimatedSeconds}s)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Explicit Pauses:</span>
                      <strong className="text-purple-300">
                        {silenceSegmentCount} tags ({totalExplicitSilenceSec}s)
                      </strong>
                    </div>
                    <div className="flex justify-between border-t border-neutral-800/80 pt-1 font-bold">
                      <span className="text-neutral-300">Estimated Total:</span>
                      <span className="text-emerald-400">~{estimatedTotalClipSec}s</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] pt-1">
                  {enforceDurationLock ? (
                    <div className="p-1.5 rounded bg-purple-950/40 border border-purple-500/30 text-purple-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-purple-400" />
                      <span>
                        Final audio will be finalized to <strong>{videoTargetSec.toFixed(2)}s</strong>
                      </span>
                    </div>
                  ) : Math.abs(estimatedTotalClipSec - videoTargetSec) <= 0.5 ? (
                    <span className="text-emerald-400 font-medium">✓ Timing closely matches video clip!</span>
                  ) : estimatedTotalClipSec > videoTargetSec ? (
                    <span className="text-amber-400">
                      ⚡ Trim ~{Math.round((estimatedTotalClipSec - videoTargetSec) * 2.3)} words to fit {videoTargetSec}s
                    </span>
                  ) : (
                    <span className="text-purple-400">
                      ✨ Tip: Insert <strong>[pause {(videoTargetSec - estimatedTotalClipSec).toFixed(1)}s]</strong> to fill exact duration
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick 1-Click Silence Tag Insertion Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-neutral-300 border-t border-neutral-800/60">
              <span className="font-semibold text-purple-300 flex items-center gap-1">
                <Pause className="w-3 h-3" /> Insert Timed Silence:
              </span>
              {[
                { tag: "[pause 1s]", label: "+ 1.0s Silence" },
                { tag: "[pause 2s]", label: "+ 2.0s Silence" },
                { tag: "[pause 3s]", label: "+ 3.0s Silence" },
                { tag: "[pause 5s]", label: "+ 5.0s Silence" },
                { tag: "[pause: auto]", label: "+ Auto Fill to Target" },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertTag(item.tag)}
                  className="px-2 py-1 rounded-lg bg-neutral-900 border border-purple-500/30 hover:bg-purple-950/60 hover:text-purple-200 text-neutral-200 font-mono transition-colors cursor-pointer"
                  title={`Inserts ${item.tag} into script. AST Studio generates digital silence for exact duration.`}
                >
                  {item.label}
                </button>
              ))}
              <span className="text-neutral-500 ml-auto hidden md:inline">
                Spliced with 100% digital zero-PCM silence — never skipped!
              </span>
            </div>
          </div>
        )}
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

          {/* Silence & Pause Tags Toolbar */}
          <div className="bg-neutral-950/60 rounded-xl p-2.5 border border-purple-900/40 mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-purple-300 uppercase tracking-wider flex items-center gap-1 font-semibold">
              <Pause className="w-3 h-3 text-purple-400" /> Insert Silence:
            </span>
            {[
              { tag: "[pause 1s]", label: "+1.0s Silence" },
              { tag: "[pause 2s]", label: "+2.0s Silence" },
              { tag: "[pause 3s]", label: "+3.0s Silence" },
              { tag: "[pause 5s]", label: "+5.0s Silence" },
              { tag: "[pause: auto]", label: "Auto-Fill to Target" },
            ].map(({ tag, label }) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg bg-neutral-900 hover:bg-purple-950/60 hover:text-purple-200 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
                title={`Insert ${tag} to generate pure digital silence`}
              >
                {label}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="number"
                step="0.5"
                min="0.1"
                max="30"
                value={customPauseSec}
                onChange={(e) => setCustomPauseSec(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-xs font-mono text-white text-center"
              />
              <button
                type="button"
                onClick={() => insertTag(`[pause ${customPauseSec}s]`)}
                className="px-2 py-0.5 text-xs rounded bg-purple-700 hover:bg-purple-600 text-white font-medium cursor-pointer"
                title="Insert custom duration pause"
              >
                + Custom Silence
              </button>
            </div>
          </div>

          {/* Expressive Vocal Burst Tag Toolbar */}
          <div className="bg-neutral-950/60 rounded-xl p-2.5 border border-neutral-800/80 mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-indigo-400" /> Vocal Expression:
            </span>
            {[
              { tag: "<breath>", label: "<breath> Natural Breath" },
              { tag: "<laugh>", label: "<laugh> Chuckle" },
              { tag: "<gasp>", label: "<gasp> Gasp" },
              { tag: "<sigh>", label: "<sigh> Gentle Sigh" },
              { tag: "<cough>", label: "<cough> Cough" },
              { tag: "|mhm|", label: "|mhm| Agreement" },
              { tag: "|yeah|", label: "|yeah| Backchannel" },
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
              placeholder="Enter text here to generate lifelike speech... You can insert [pause 3s] for exact silence in between phrases."
              className="w-full p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 font-sans text-sm sm:text-base leading-relaxed focus:outline-none focus:border-indigo-500/80 transition-all resize-y"
            />

            {/* Quick Actions & Live Timing in bottom of textarea */}
            <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 px-2 py-1.5 font-mono gap-2 border-t border-neutral-800/60 mt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span>{words} words</span>
                <span>•</span>
                <span>{chars} chars</span>
                <span>•</span>
                <span className="text-indigo-400 font-semibold">
                  ~{estimatedSeconds}s spoken
                </span>
                {silenceSegmentCount > 0 && (
                  <>
                    <span>+</span>
                    <span className="text-purple-300 font-bold bg-purple-950/70 px-1.5 py-0.5 rounded border border-purple-500/30">
                      {totalExplicitSilenceSec}s silence ({silenceSegmentCount} pause{silenceSegmentCount > 1 ? "s" : ""})
                    </span>
                    <span>=</span>
                    <span className="text-emerald-400 font-bold">
                      ~{estimatedTotalClipSec}s total
                    </span>
                  </>
                )}
                {enforceDurationLock && (
                  <span className="text-purple-200 bg-purple-900/60 border border-purple-400/40 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ml-1">
                    <Lock className="w-3 h-3 text-purple-300" />
                    Locked: {videoTargetSec.toFixed(2)}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleCopyText}
                  className="hover:text-neutral-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => setScriptText("")}
                  className="hover:text-neutral-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Verbalized Pronunciation Preview for Math/Numbers/Symbols */}
            {verbalizedPreview && verbalizedPreview.trim() !== scriptText.trim() && scriptText.trim().length > 0 && (
              <div className="mt-2.5 px-3 py-2 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-indigo-300 shrink-0">
                    {activeLangConfig.flag} {activeLangConfig.name} Pronunciation:
                  </span>
                  <span className="font-mono text-neutral-200 truncate italic bg-black/40 px-2 py-0.5 rounded border border-indigo-500/20">
                    "{verbalizedPreview}"
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setScriptText(verbalizedPreview)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shrink-0 cursor-pointer shadow-sm transition-colors"
                  title="Replace script text with full native words"
                >
                  Apply to Script
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error notification */}
        {errorState && (
          errorState.isDaily ? (
            <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-xl space-y-3 text-xs relative">
              <button
                type="button"
                onClick={() => setErrorState(null)}
                className="absolute top-3 right-3 text-red-400/70 hover:text-red-200 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-between pr-6">
                <span className="font-bold text-red-300 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                  Google Gemini Daily Quota Limit Reached
                </span>
                <span className="font-mono text-red-300 bg-red-900/80 border border-red-700/60 px-2 py-0.5 rounded text-[11px] font-bold">
                  Resets Daily (Midnight PT)
                </span>
              </div>
              <p className="text-red-200/90 leading-relaxed">
                Your Google Gemini API key has reached its free-tier Daily Quota (RPD) allowance for today. Free quotas reset daily at midnight Pacific Time (PT). You can attach another free Gemini API key to continue generating voice clips immediately.
              </p>
              {errorState.rawError && (
                <details className="mt-1 pt-1.5 border-t border-red-800/40 text-[11px] font-mono opacity-80">
                  <summary className="cursor-pointer hover:underline text-red-300 font-semibold select-none">
                    View Raw API Error Message
                  </summary>
                  <pre className="mt-1.5 p-2 bg-black/40 rounded-lg text-red-200/90 whitespace-pre-wrap break-all text-[10px] max-h-32 overflow-y-auto">
                    {errorState.rawError}
                  </pre>
                </details>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-800/50">
                {onOpenApiKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-indigo-600/30"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Switch / Enter New API Key</span>
                  </button>
                )}

                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center gap-1.5 transition-colors"
                >
                  <span>Get Free Key in Google AI Studio ↗</span>
                </a>

                <a
                  href="https://aistudio.google.com/app/plan_information"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-red-300/80 hover:text-red-200 text-xs flex items-center gap-1 transition-colors"
                >
                  <span>Google AI Studio Quotas</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : errorState.isQuota ? (
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-3 text-xs relative">
              <button
                type="button"
                onClick={() => setErrorState(null)}
                className="absolute top-3 right-3 text-amber-400/70 hover:text-amber-200 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-between pr-6">
                <span className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0 ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
                  {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0
                    ? "Gemini API Quota / Rate Limit Reached"
                    : "Cooldown Completed (Ready to Retry)"}
                </span>
                {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0 ? (
                  <span className="font-mono text-amber-300 bg-amber-900/80 border border-amber-700/60 px-2 py-0.5 rounded text-[11px] font-bold">
                    Cooldown: {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0)}s
                  </span>
                ) : (
                  <span className="font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded text-[11px] font-bold">
                    Slot Ready
                  </span>
                )}
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0
                  ? (errorState.details || "Your attached Gemini API key reached Google's free-tier rate limit (5 requests per minute). Please wait for the cooldown slot to reset.")
                  : "The cooldown period has finished. Click 'Retry Generation Now' below to generate your speech clip. If limit errors persist across multiple minutes, your key may have hit its daily quota."}
              </p>
              {errorState.rawError && (
                <details className="mt-1 pt-1.5 border-t border-amber-800/40 text-[11px] font-mono opacity-80">
                  <summary className="cursor-pointer hover:underline text-amber-300 font-semibold select-none">
                    View Raw API Error Message
                  </summary>
                  <pre className="mt-1.5 p-2 bg-black/40 rounded-lg text-amber-200/90 whitespace-pre-wrap break-all text-[10px] max-h-32 overflow-y-auto">
                    {errorState.rawError}
                  </pre>
                </details>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-800/50">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-colors shadow-sm"
                >
                  {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0
                    ? `Wait ${Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0)}s to retry`
                    : "Retry Generation Now"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearQuotaCooldown();
                    setRetryCountdown(0);
                    setErrorState(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs border border-neutral-700 cursor-pointer transition-colors"
                  title="Reset cooldown immediately"
                >
                  Clear Cooldown
                </button>

                {onOpenApiKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Switch / Enter New API Key</span>
                  </button>
                )}

                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center gap-1.5 transition-colors"
                >
                  <span>Get Free Key in Google AI Studio ↗</span>
                </a>
              </div>
            </div>
          ) : errorState.isApiKeyRequired ? (
            <div className="p-4 bg-gradient-to-r from-indigo-950/60 to-purple-950/50 border border-indigo-500/40 rounded-xl space-y-2.5 text-xs relative">
              <button
                type="button"
                onClick={() => setErrorState(null)}
                className="absolute top-3 right-3 text-indigo-300/70 hover:text-white transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-between pr-6">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  Free Google Gemini API Key Needed
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  100% Free • No Credit Card
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                AST Studio runs as a static web app on GitHub Pages. Connect your free Gemini API key from Google AI Studio to synthesize realistic neural speech with Gemini 3.8.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-indigo-800/40">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors border border-neutral-700"
                >
                  <span>1. Get Free Key from Google AI Studio ↗</span>
                </a>
                {onOpenApiKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>2. Connect Key Here</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300 relative">
              <button
                type="button"
                onClick={() => setErrorState(null)}
                className="absolute top-2.5 right-2.5 text-red-400/70 hover:text-red-200 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
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
                quotaStatus?.isDailyLimitExceeded || errorState?.isDaily
                  ? "bg-red-500 animate-pulse"
                  : retryCountdown > 0 || (quotaStatus?.cooldownRemaining || 0) > 0
                  ? "bg-amber-400 animate-ping"
                  : (quotaStatus?.requestsInLastMinute || 0) >= (quotaStatus?.freeTierRpmLimit || 5)
                  ? "bg-red-400 animate-pulse"
                  : (quotaStatus?.requestsInLastMinute || 0) >= 4
                  ? "bg-amber-400 animate-pulse"
                  : "bg-emerald-400"
              }`}
            />
            <span className="font-mono">
              Quota: <strong className="text-neutral-200">
                {quotaStatus?.requestsInLastMinute || 0}/{quotaStatus?.freeTierRpmLimit || 5} RPM
              </strong>
            </span>
            {quotaStatus?.isDailyLimitExceeded || errorState?.isDaily ? (
              <span className="text-red-400 font-bold font-mono">
                • Daily Limit Reached (Resets midnight PT)
              </span>
            ) : retryCountdown > 0 || (quotaStatus && (quotaStatus.cooldownRemaining > 0 || quotaStatus.isThrottled)) ? (
              <span className="text-amber-400 font-bold font-mono animate-pulse">
                • Cooldown active ({Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0)}s left)
              </span>
            ) : quotaStatus && quotaStatus.requestsInLastMinute >= (quotaStatus.freeTierRpmLimit || 5) ? (
              <span className="text-red-400 font-bold font-mono">
                • Max RPM reached (Resets in {quotaStatus.secondsUntilNextWindowSlot}s)
              </span>
            ) : quotaStatus && quotaStatus.requestsInLastMinute >= 4 ? (
              <span className="text-amber-400 font-medium font-mono">
                • Near limit ({quotaStatus.freeTierRpmLimit - quotaStatus.requestsInLastMinute} left)
              </span>
            ) : quotaStatus && quotaStatus.secondsUntilNextWindowSlot > 0 ? (
              <span className="text-neutral-400 font-mono">
                • Slot resets in {quotaStatus.secondsUntilNextWindowSlot}s
              </span>
            ) : (
              <span className="text-emerald-400/90 font-mono">• Safe</span>
            )}
          </div>

          <button
            onClick={
              quotaStatus?.isDailyLimitExceeded || errorState?.isDaily
                ? onOpenApiKeyModal
                : handleGenerate
            }
            disabled={
              isGenerating ||
              !scriptText.trim() ||
              (retryCountdown > 0 && !(quotaStatus?.isDailyLimitExceeded || errorState?.isDaily)) ||
              ((quotaStatus?.cooldownRemaining || 0) > 0 && !(quotaStatus?.isDailyLimitExceeded || errorState?.isDaily))
            }
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{generationStepText || "Synthesizing Voice..."}</span>
              </>
            ) : quotaStatus?.isDailyLimitExceeded || errorState?.isDaily ? (
              <>
                <Key className="w-4 h-4 text-amber-300" />
                <span>Switch Key (Daily Limit Reached)</span>
              </>
            ) : retryCountdown > 0 || (quotaStatus?.cooldownRemaining || 0) > 0 ? (
              <>
                <Clock className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Wait {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0)}s (Cooldown)</span>
              </>
            ) : errorState ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Retry Generation Now</span>
              </>
            ) : enforceDurationLock ? (
              <>
                <Lock className="w-4 h-4 text-purple-200" />
                <span>Generate Voice (Locked to {videoTargetSec.toFixed(1)}s)</span>
              </>
            ) : silenceSegmentCount > 0 ? (
              <>
                <Pause className="w-4 h-4 text-purple-200" />
                <span>Generate Voice ({silenceSegmentCount} Silence Pause{silenceSegmentCount > 1 ? "s" : ""})</span>
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
