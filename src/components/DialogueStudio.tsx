import React, { useState, useMemo } from "react";
import {
  Users,
  Plus,
  Trash2,
  Play,
  Sparkles,
  Loader2,
  Wand2,
  Layers,
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  Globe,
  SpellCheck,
  Key,
  Clock,
  ExternalLink,
  X,
  AlertCircle,
} from "lucide-react";
import { VoiceName, DialogueTurn, GeneratedAudioItem, QuotaStatus, SupportedLanguage } from "../types/tts";
import { VOICES_CATALOG, DIALOGUE_TEMPLATES } from "../data/voices";
import { LANGUAGES, detectLanguageFromText } from "../data/languages";
import { requestTts, requestScriptEnhance } from "../services/api";
import { recordQuotaExceeded, clearQuotaCooldown } from "../services/quotaTracker";
import { verbalizeTextForLanguage } from "../services/clientLangUtils";
import { AudioPlayer } from "./AudioPlayer";

interface DialogueStudioProps {
  onAudioGenerated: (item: GeneratedAudioItem) => void;
  quotaStatus?: QuotaStatus;
  onQuotaUpdated?: (quota: QuotaStatus) => void;
  activeAudioItem?: GeneratedAudioItem | null;
  onClearAudio?: () => void;
  onOpenApiKeyModal?: () => void;
}

export const DialogueStudio: React.FC<DialogueStudioProps> = ({
  onAudioGenerated,
  quotaStatus,
  onQuotaUpdated,
  activeAudioItem,
  onClearAudio,
  onOpenApiKeyModal,
}) => {
  const [speaker1, setSpeaker1] = useState<{
    name: string;
    voice: VoiceName;
    style: string;
  }>(DIALOGUE_TEMPLATES[0].speaker1);

  const [speaker2, setSpeaker2] = useState<{
    name: string;
    voice: VoiceName;
    style: string;
  }>(DIALOGUE_TEMPLATES[0].speaker2);

  const [turns, setTurns] = useState<DialogueTurn[]>(
    DIALOGUE_TEMPLATES[0].turns.map((t, idx) => ({
      id: `turn-${idx}-${Date.now()}`,
      speaker: t.speaker,
      voice: t.voice,
      text: t.text,
      style: t.speaker === DIALOGUE_TEMPLATES[0].speaker1.name ? DIALOGUE_TEMPLATES[0].speaker1.style : DIALOGUE_TEMPLATES[0].speaker2.style,
    }))
  );

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("auto");
  const [isAccentuating, setIsAccentuating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    isQuota: boolean;
    isDaily?: boolean;
    isApiKeyRequired?: boolean;
    details?: string;
    rawError?: string;
  } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [showTemplates, setShowTemplates] = useState(false);

  // Dynamic language detection from turns
  const detectedLanguage = useMemo(() => {
    const combined = turns.map((t) => t.text).join(" ");
    return detectLanguageFromText(combined);
  }, [turns]);

  const activeEffectiveLanguage = selectedLanguage === "auto" ? detectedLanguage : selectedLanguage;
  const activeLangConfig = LANGUAGES.find((l) => l.code === activeEffectiveLanguage) || LANGUAGES[1];

  const handleAccentuateTurns = async () => {
    setIsAccentuating(true);
    setErrorState(null);
    try {
      const updated = await Promise.all(
        turns.map(async (t) => {
          if (!t.text.trim()) return t;
          const fixed = await requestScriptEnhance("accentuate", t.text);
          return { ...t, text: fixed || t.text };
        })
      );
      setTurns(updated);
    } catch (err: any) {
      setErrorState({
        message: err.message || "Failed to fix accents in dialogue.",
        isQuota: err.isQuotaExceeded || false,
      });
    } finally {
      setIsAccentuating(false);
    }
  };

  const addTurn = (speakerName: string) => {
    const isSpk1 = speakerName === speaker1.name;
    const newTurn: DialogueTurn = {
      id: `turn-${Date.now()}-${Math.random()}`,
      speaker: speakerName,
      voice: isSpk1 ? speaker1.voice : speaker2.voice,
      text: "",
      style: isSpk1 ? speaker1.style : speaker2.style,
    };
    setTurns([...turns, newTurn]);
  };

  const removeTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns(turns.filter((t) => t.id !== id));
  };

  const updateTurnText = (id: string, text: string) => {
    setTurns(turns.map((t) => (t.id === id ? { ...t, text } : t)));
  };

  const switchTurnSpeaker = (id: string) => {
    setTurns(
      turns.map((t) => {
        if (t.id !== id) return t;
        const nextSpeaker = t.speaker === speaker1.name ? speaker2.name : speaker1.name;
        const nextVoice = nextSpeaker === speaker1.name ? speaker1.voice : speaker2.voice;
        const nextStyle = nextSpeaker === speaker1.name ? speaker1.style : speaker2.style;
        return {
          ...t,
          speaker: nextSpeaker,
          voice: nextVoice,
          style: nextStyle,
        };
      })
    );
  };

  const insertTagToTurn = (id: string, tag: string) => {
    setTurns(
      turns.map((t) =>
        t.id === id ? { ...t, text: (t.text ? t.text + " " : "") + tag + " " } : t
      )
    );
  };

  const handleApplyTemplate = (tmpl: (typeof DIALOGUE_TEMPLATES)[0]) => {
    setSpeaker1(tmpl.speaker1);
    setSpeaker2(tmpl.speaker2);
    setTurns(
      tmpl.turns.map((t, idx) => ({
        id: `turn-${idx}-${Date.now()}`,
        speaker: t.speaker,
        voice: t.voice,
        text: t.text,
        style: t.speaker === tmpl.speaker1.name ? tmpl.speaker1.style : tmpl.speaker2.style,
      }))
    );
    setShowTemplates(false);
  };

  const handleAiGenerateDialogue = async () => {
    if (!topicPrompt.trim()) return;
    setIsGeneratingScript(true);
    setErrorState(null);

    try {
      const generatedScript = await requestScriptEnhance("podcast", topicPrompt);
      // Parse generated lines
      const lines = generatedScript.split("\n").filter((l) => l.trim().length > 0);
      const parsedTurns: DialogueTurn[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let speakerName = speaker1.name;
        let lineText = line;

        if (line.toLowerCase().startsWith("alex:") || line.toLowerCase().startsWith(`${speaker1.name.toLowerCase()}:`)) {
          speakerName = speaker1.name;
          lineText = line.substring(line.indexOf(":") + 1).trim();
        } else if (line.toLowerCase().startsWith("sam:") || line.toLowerCase().startsWith(`${speaker2.name.toLowerCase()}:`)) {
          speakerName = speaker2.name;
          lineText = line.substring(line.indexOf(":") + 1).trim();
        } else {
          speakerName = i % 2 === 0 ? speaker1.name : speaker2.name;
        }

        parsedTurns.push({
          id: `turn-ai-${i}-${Date.now()}`,
          speaker: speakerName,
          voice: speakerName === speaker1.name ? speaker1.voice : speaker2.voice,
          text: lineText,
          style: speakerName === speaker1.name ? speaker1.style : speaker2.style,
        });
      }

      if (parsedTurns.length > 0) {
        setTurns(parsedTurns);
        setShowTopicModal(false);
      }
    } catch (err: any) {
      const isQuota = err.isQuotaExceeded || err.message?.includes("Quota");
      setErrorState({
        message: err.message || "Failed to generate dialogue script.",
        isQuota,
        details: err.details,
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSynthesizeDialogue = async () => {
    // Validate
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0) {
      setErrorState({
        message: "Please enter text for at least one dialogue turn.",
        isQuota: false,
      });
      return;
    }

    setErrorState(null);
    setIsGenerating(true);

    try {
      const res = await requestTts({
        mode: "dialogue",
        language: selectedLanguage,
        turns: validTurns.map((t) => ({
          speaker: t.speaker,
          voice: t.voice,
          text: t.text,
          style: t.style,
        })),
      });

      const newItem: GeneratedAudioItem = {
        id: `vox-dial-${Date.now()}`,
        title: `${speaker1.name} & ${speaker2.name}: ${validTurns[0].text.slice(0, 30)}...`,
        createdAt: Date.now(),
        mode: "dialogue",
        modelUsed: res.modelUsed,
        duration: res.duration,
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        textPreview: `${validTurns[0].speaker}: ${validTurns[0].text}`,
        language: activeEffectiveLanguage,
        speakers: [
          { name: speaker1.name, voice: speaker1.voice },
          { name: speaker2.name, voice: speaker2.voice },
        ],
      };

      if (res.quotaStatus && onQuotaUpdated) {
        onQuotaUpdated(res.quotaStatus);
      }

      onAudioGenerated(newItem);
    } catch (err: any) {
      console.error("Dialogue speech error", err);
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
      const delaySecs = err.retryDelaySeconds || err.retrySeconds || (isDaily ? 150 : 30);

      if (isQuota) {
        const updatedQuota = recordQuotaExceeded(delaySecs, isDaily);
        if (onQuotaUpdated) onQuotaUpdated(updatedQuota);

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

      setErrorState({
        message: isApiKeyRequired
          ? "Google Gemini API Key Required"
          : isDaily
          ? "Google Gemini Daily Quota Limit Reached"
          : isQuota
          ? "Gemini API Quota / Rate Limit Reached"
          : err.message || "Failed to render dialogue audio.",
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

  return (
    <div className="space-y-6">
      {/* Dialogue Language & Pronunciation Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Globe className="w-4 h-4 text-indigo-400" /> Dialogue Language:
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
                      : "bg-neutral-950 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800"
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {selectedLanguage === "auto" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-neutral-950 border border-neutral-800 text-neutral-300">
                <span>{activeLangConfig.flag}</span>
                <span>Detected: <strong className="text-white">{activeLangConfig.name}</strong></span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                <span>{activeLangConfig.flag}</span>
                <span>{activeLangConfig.name} Phonics Active</span>
              </span>
            )}

            <button
              onClick={handleAccentuateTurns}
              disabled={isAccentuating}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              title="Fix missing Spanish tildes and accents across all turns for pristine pronunciation"
            >
              {isAccentuating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SpellCheck className="w-3.5 h-3.5" />
              )}
              <span>Fix Accents</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          💡 <strong className="text-neutral-300">{activeLangConfig.name}:</strong> {activeLangConfig.pronunciationTip}
        </p>
      </div>

      {/* Speaker Identity Configuration */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              1. Dialogue Cast (2 Speakers)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Gemini 3.8 Flash-TTS synthesizes organic conversations between two distinct voices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Templates */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1.5 border border-neutral-700/60 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                <span>Dialogue Presets</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showTemplates && (
                <div className="absolute right-0 top-8 z-20 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 space-y-1">
                  {DIALOGUE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 transition-colors text-xs cursor-pointer"
                    >
                      <div className="font-semibold text-neutral-200">{tmpl.title}</div>
                      <div className="text-[11px] text-neutral-400">
                        {tmpl.speaker1.name} ({tmpl.speaker1.voice}) & {tmpl.speaker2.name} ({tmpl.speaker2.voice})
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Generator button */}
            <button
              onClick={() => setShowTopicModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Script Writer</span>
            </button>
          </div>
        </div>

        {/* Cast Configuration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Speaker 1 */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Speaker A
              </span>
              <span className="text-[11px] font-mono text-neutral-400">Host / Lead</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={speaker1.name}
                  onChange={(e) => setSpeaker1({ ...speaker1, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Voice ({VOICES_CATALOG.length} options)</label>
                <select
                  value={speaker1.voice}
                  onChange={(e) => setSpeaker1({ ...speaker1, voice: e.target.value as VoiceName })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <optgroup label="🎙️ Google Studio HD Voices (30)">
                    {VOICES_CATALOG.filter((v) => v.category === "official").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} ({v.gender}) - {v.tone}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="👦👧 Kids & Youth Personas (8)">
                    {VOICES_CATALOG.filter((v) => v.category === "kids").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} ({v.gender === "boy" ? "Boy" : "Girl"}, {v.ageGroup})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎭 Character Archetypes (8)">
                    {VOICES_CATALOG.filter((v) => v.category === "character").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} - {v.tone}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Persona Style</label>
              <input
                type="text"
                value={speaker1.style}
                onChange={(e) => setSpeaker1({ ...speaker1, style: e.target.value })}
                placeholder="e.g. Enthusiastic, bright podcast host"
                className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 placeholder-neutral-500"
              />
            </div>
          </div>

          {/* Speaker 2 */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Speaker B
              </span>
              <span className="text-[11px] font-mono text-neutral-400">Co-Host / Guest</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={speaker2.name}
                  onChange={(e) => setSpeaker2({ ...speaker2, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Voice ({VOICES_CATALOG.length} options)</label>
                <select
                  value={speaker2.voice}
                  onChange={(e) => setSpeaker2({ ...speaker2, voice: e.target.value as VoiceName })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <optgroup label="🎙️ Google Studio HD Voices (30)">
                    {VOICES_CATALOG.filter((v) => v.category === "official").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} ({v.gender}) - {v.tone}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="👦👧 Kids & Youth Personas (8)">
                    {VOICES_CATALOG.filter((v) => v.category === "kids").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} ({v.gender === "boy" ? "Boy" : "Girl"}, {v.ageGroup})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎭 Character Archetypes (8)">
                    {VOICES_CATALOG.filter((v) => v.category === "character").map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.avatarEmoji} {v.name} - {v.tone}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Persona Style</label>
              <input
                type="text"
                value={speaker2.style}
                onChange={(e) => setSpeaker2({ ...speaker2, style: e.target.value })}
                placeholder="e.g. Curious, articulate co-host"
                className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 placeholder-neutral-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screenplay Dialogue Timeline */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              2. Screenplay Turns ({turns.length})
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Each turn is spoken in sequence. Use backchannels like <code className="text-indigo-300">|mhm|</code> or <code className="text-indigo-300">|yeah|</code> for realistic flow.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => addTurn(speaker1.name)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ {speaker1.name}</span>
            </button>
            <button
              onClick={() => addTurn(speaker2.name)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ {speaker2.name}</span>
            </button>
          </div>
        </div>

        {/* Turns List */}
        <div className="space-y-3">
          {turns.map((turn, index) => {
            const isSpk1 = turn.speaker === speaker1.name;
            return (
              <div
                key={turn.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSpk1
                    ? "bg-neutral-950/70 border-indigo-900/40"
                    : "bg-neutral-950/70 border-purple-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-500">#{index + 1}</span>
                    <button
                      onClick={() => switchTurnSpeaker(turn.id)}
                      className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        isSpk1
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      }`}
                      title="Click to switch speaker"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>{turn.speaker}</span>
                    </button>
                    <span className="text-[11px] font-mono text-neutral-400">
                      ({isSpk1 ? speaker1.voice : speaker2.voice})
                    </span>
                  </div>

                  {/* Quick expression insertion */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => insertTagToTurn(turn.id, "<breath>")}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800"
                    >
                      +breath
                    </button>
                    <button
                      onClick={() => insertTagToTurn(turn.id, "<laugh>")}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800"
                    >
                      +laugh
                    </button>
                    <button
                      onClick={() => insertTagToTurn(turn.id, "[pause 1.5s]")}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-950/60 text-purple-300 hover:text-purple-200 rounded border border-purple-500/40"
                      title="Insert 1.5s silence pause"
                    >
                      +1.5s pause
                    </button>
                    <button
                      onClick={() => insertTagToTurn(turn.id, "|yeah|")}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800"
                    >
                      +|yeah|
                    </button>

                    <button
                      onClick={() => removeTurn(turn.id)}
                      disabled={turns.length <= 1}
                      className="p-1 text-neutral-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                      title="Delete turn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={turn.text}
                  onChange={(e) => updateTurnText(turn.id, e.target.value)}
                  placeholder={`What does ${turn.speaker} say?`}
                  className="w-full px-3 py-2 bg-neutral-900/90 border border-neutral-800 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60"
                />

                {(() => {
                  const verbalized = verbalizeTextForLanguage(turn.text, activeEffectiveLanguage);
                  if (verbalized && verbalized.trim() !== turn.text.trim() && turn.text.trim().length > 0) {
                    return (
                      <div className="mt-1.5 px-2.5 py-1 bg-indigo-950/40 border border-indigo-500/30 rounded-lg flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-indigo-300 truncate">
                          Spoken as: <strong className="text-white italic">"{verbalized}"</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => updateTurnText(turn.id, verbalized)}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] shrink-0 font-medium cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
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
                Your Google Gemini API key has reached its free-tier Daily Quota (RPD) allowance for today. Free quotas reset daily at midnight Pacific Time (PT). You can attach another free Gemini API key to continue generating multi-speaker dialogue immediately.
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
                <button
                  type="button"
                  onClick={handleSynthesizeDialogue}
                  disabled={isGenerating || Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0) > 0
                      ? `Retry Now (or wait ${Math.max(retryCountdown, quotaStatus?.cooldownRemaining || 0)}s)`
                      : "Retry Generation Now"}
                  </span>
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
                <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
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
                  : "The cooldown period has finished. Click 'Retry Generation Now' below to render your dialogue. If limit errors persist across multiple minutes, your key may have reached its daily quota."}
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
                  onClick={handleSynthesizeDialogue}
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
            <div className="p-4 bg-gradient-to-r from-purple-950/60 to-indigo-950/50 border border-indigo-500/40 rounded-xl space-y-2.5 text-xs relative">
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
                AST Studio runs as a static web app on GitHub Pages. Connect your free Gemini API key from Google AI Studio to render multi-speaker dialogue with Gemini 3.8.
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
              <strong className="font-semibold">Dialogue error: </strong>
              {errorState.message}
            </div>
          )
        )}

        {/* Bottom Generation Bar */}
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {errorState && (
              <div className="flex items-center gap-2 mr-auto sm:mr-0">
                <button
                  type="button"
                  onClick={() => {
                    clearQuotaCooldown();
                    setRetryCountdown(0);
                    setErrorState(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs border border-neutral-700 cursor-pointer transition-colors"
                  title="Clear cooldown timer and retry"
                >
                  Clear Cooldown
                </button>

                {onOpenApiKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs border border-neutral-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Switch or enter a new Gemini API key"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Switch Key</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleSynthesizeDialogue}
              disabled={
                isGenerating ||
                turns.every((t) => !t.text.trim()) ||
                retryCountdown > 0 ||
                (quotaStatus?.cooldownRemaining || 0) > 0
              }
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Dialogue...</span>
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
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Render Full Dialogue (WAV)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Podcast Writer Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                AI Podcast & Dialogue Generator
              </h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-neutral-400 hover:text-neutral-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Provide any topic, scenario, or debate subject. Gemini will write a witty, natural multi-turn script with conversational backchannels.
            </p>

            <textarea
              rows={4}
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              placeholder="e.g. A friendly debate between two game developers about whether graphics or gameplay matter more in modern VR games..."
              className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTopicModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAiGenerateDialogue}
                disabled={isGeneratingScript || !topicPrompt.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingScript ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Writing Screenplay...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Generate Screenplay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Player Deck */}
      <section aria-label="Listen to the Outcome">
        <AudioPlayer
          item={activeAudioItem || null}
          onClear={onClearAudio}
        />
      </section>
    </div>
  );
};
