import React, { useState } from "react";
import {
  Mic,
  Play,
  Pause,
  Sparkles,
  Volume2,
  Check,
  User,
  Radio,
  BookOpen,
  Film,
  MessageSquareQuote,
  Loader2,
  Baby,
} from "lucide-react";
import { VOICES_CATALOG } from "../data/voices";
import { VoiceName, VoiceInfo } from "../types/tts";
import { requestTts } from "../services/api";

interface VoiceCatalogProps {
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  onPlayAudition?: (voice: VoiceName, audioBase64: string, text: string) => void;
}

export const VoiceCatalog: React.FC<VoiceCatalogProps> = ({
  selectedVoice,
  onSelectVoice,
  onPlayAudition,
}) => {
  const [playingVoice, setPlayingVoice] = useState<VoiceName | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<VoiceName | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "kids" | "adults">("all");

  const filteredVoices = VOICES_CATALOG.filter((v) => {
    if (categoryFilter === "kids") return v.category === "kids";
    if (categoryFilter === "adults") return v.category === "adults";
    return true;
  });

  const handleAudition = async (voice: VoiceInfo) => {
    if (playingVoice === voice.id) {
      if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
      }
      setPlayingVoice(null);
      return;
    }

    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }

    setLoadingVoice(voice.id);
    try {
      const res = await requestTts({
        mode: "single",
        text: voice.sampleText,
        voice: voice.id,
        style: voice.stylePrompt,
        model: voice.category === "kids" ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts",
      });

      const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`);
      audio.onended = () => {
        setPlayingVoice(null);
        setActiveAudio(null);
      };
      setActiveAudio(audio);
      setPlayingVoice(voice.id);
      await audio.play();

      if (onPlayAudition) {
        onPlayAudition(voice.id, res.audioBase64, voice.sampleText);
      }
    } catch (err) {
      console.error("Audition playback failed", err);
    } finally {
      setLoadingVoice(null);
    }
  };

  const getVoiceAvatar = (voice: VoiceInfo) => {
    if (voice.avatarEmoji) {
      return (
        <span className="text-2xl select-none" role="img" aria-label={voice.name}>
          {voice.avatarEmoji}
        </span>
      );
    }
    return <Mic className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Catalog Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Neural Voice Catalog
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Choose from authentic adult narrators or expressive child personas (boy and girl).
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 self-start md:self-auto">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categoryFilter === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            All Voices ({VOICES_CATALOG.length})
          </button>
          <button
            onClick={() => setCategoryFilter("kids")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              categoryFilter === "kids"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-400 hover:text-amber-300"
            }`}
          >
            <span>👦👧 Kids Voices</span>
            <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.2 rounded-full border border-amber-500/30">
              4
            </span>
          </button>
          <button
            onClick={() => setCategoryFilter("adults")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categoryFilter === "adults"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Adults ({VOICES_CATALOG.filter((v) => v.category === "adults").length})
          </button>
        </div>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          const isAuditioning = playingVoice === voice.id;
          const isLoading = loadingVoice === voice.id;
          const isKid = voice.category === "kids";

          return (
            <div
              key={voice.id}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden backdrop-blur-sm ${
                isSelected
                  ? isKid
                    ? "bg-amber-950/20 border-amber-500/80 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/50"
                    : "bg-indigo-950/20 border-indigo-500/70 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/40"
                  : isKid
                  ? "bg-neutral-900/60 border-amber-500/20 hover:border-amber-500/40 hover:bg-neutral-900/90"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90"
              }`}
            >
              {/* Active voice badge */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Check className="w-3 h-3" /> Active
                </div>
              )}

              <div>
                {/* Voice Icon & Name */}
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                      isKid
                        ? "bg-amber-950/50 border-amber-500/30"
                        : "bg-neutral-800/80 border-neutral-700/60"
                    }`}
                  >
                    {getVoiceAvatar(voice)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-neutral-100">{voice.name}</h3>
                      {isKid ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          {voice.gender === "boy" ? "👦 Boy" : "👧 Girl"} ({voice.ageGroup})
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase">
                          {voice.gender}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-indigo-300 mt-0.5">{voice.tone}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  {voice.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {voice.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        tag === "Kid" || tag === "Boy" || tag === "Girl"
                          ? "bg-amber-950/40 text-amber-300 border-amber-500/30 font-semibold"
                          : "bg-neutral-800/90 text-neutral-300 border-neutral-700/50"
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Sample line preview */}
                <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800/80 mb-5">
                  <span className="text-[10px] font-mono text-neutral-400 block mb-1 uppercase tracking-wider">
                    Audition Line
                  </span>
                  <p className="text-xs text-neutral-300 italic line-clamp-2">
                    "{voice.sampleText}"
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  onClick={() => handleAudition(voice)}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isAuditioning
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAuditioning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Audition
                    </>
                  )}
                </button>

                <button
                  onClick={() => onSelectVoice(voice.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-neutral-800 hover:bg-indigo-600 hover:text-white text-neutral-300 border border-neutral-700/60"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  {isSelected ? "Active" : "Use Voice"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
