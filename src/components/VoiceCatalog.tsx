import React, { useState, useMemo } from "react";
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
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Flame,
} from "lucide-react";
import { VOICES_CATALOG } from "../data/voices";
import { VoiceName, VoiceInfo, VoiceCategory } from "../types/tts";
import { requestTts } from "../services/api";

interface VoiceCatalogProps {
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  onPlayAudition?: (voice: VoiceName, audioBase64: string, text: string) => void;
  onSelectForDialogue?: (voice: VoiceName, speakerSlot?: "speaker1" | "speaker2") => void;
}

export const VoiceCatalog: React.FC<VoiceCatalogProps> = ({
  selectedVoice,
  onSelectVoice,
  onPlayAudition,
  onSelectForDialogue,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [playingVoice, setPlayingVoice] = useState<VoiceName | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<VoiceName | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "official" | "kids" | "character">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male" | "kids">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    VOICES_CATALOG.forEach((v) => v.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, []);

  // Filtered voice catalog
  const filteredVoices = useMemo(() => {
    return VOICES_CATALOG.filter((v) => {
      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "official" && v.category !== "official") return false;
        if (categoryFilter === "kids" && v.category !== "kids") return false;
        if (categoryFilter === "character" && v.category !== "character") return false;
      }

      // Gender filter
      if (genderFilter !== "all") {
        if (genderFilter === "female" && v.gender !== "female") return false;
        if (genderFilter === "male" && v.gender !== "male") return false;
        if (genderFilter === "kids" && v.gender !== "boy" && v.gender !== "girl") return false;
      }

      // Tag filter
      if (selectedTag && !v.tags.includes(selectedTag)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = v.name.toLowerCase().includes(q);
        const matchesTone = v.tone.toLowerCase().includes(q);
        const matchesDesc = v.description.toLowerCase().includes(q);
        const matchesTags = v.tags.some((t) => t.toLowerCase().includes(q));
        const matchesBase = v.baseVoice.toLowerCase().includes(q);
        return matchesName || matchesTone || matchesDesc || matchesTags || matchesBase;
      }

      return true;
    });
  }, [categoryFilter, genderFilter, selectedTag, searchQuery]);

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
        model: voice.category === "kids" || voice.category === "character" ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts",
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

  const officialCount = VOICES_CATALOG.filter((v) => v.category === "official").length;
  const kidsCount = VOICES_CATALOG.filter((v) => v.category === "kids").length;
  const characterCount = VOICES_CATALOG.filter((v) => v.category === "character").length;

  return (
    <div className="space-y-6">
      {/* Catalog Header & Stats Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-indigo-950/40 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                Max Voice Roster
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                {VOICES_CATALOG.length} Choices Available
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              Complete Neural Voice Catalog
            </h2>
            <p className="text-sm text-neutral-300 max-w-2xl mt-1.5 leading-relaxed">
              Every available Gemini 3.8 and Chirp 3 studio voice. Audition standard narrators, authentic child personas, and cinematic character archetypes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-center">
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl px-3.5 py-2 text-center">
              <div className="text-xs text-neutral-400 font-mono">Studio Prebuilt</div>
              <div className="text-lg font-extrabold text-indigo-300">{officialCount}</div>
            </div>
            <div className="bg-neutral-950/80 border border-amber-900/40 rounded-2xl px-3.5 py-2 text-center">
              <div className="text-xs text-amber-300/80 font-mono">Kids & Youth</div>
              <div className="text-lg font-extrabold text-amber-400">{kidsCount}</div>
            </div>
            <div className="bg-neutral-950/80 border border-purple-900/40 rounded-2xl px-3.5 py-2 text-center">
              <div className="text-xs text-purple-300/80 font-mono">Characters</div>
              <div className="text-lg font-extrabold text-purple-400">{characterCount}</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by voice name, tone, tag (#Audiobook, #Deep), or role..."
              className="w-full pl-10 pr-9 py-2.5 bg-neutral-950/90 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Gender Filter Buttons */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            {[
              { id: "all", label: "All Genders" },
              { id: "female", label: "👩 Female" },
              { id: "male", label: "👨 Male" },
              { id: "kids", label: "👦👧 Youth" },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGenderFilter(g.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  genderFilter === g.id
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400"
                : "bg-neutral-950/70 text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:bg-neutral-800"
            }`}
          >
            <span>All Voices</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
              {VOICES_CATALOG.length}
            </span>
          </button>

          <button
            onClick={() => setCategoryFilter("official")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "official"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400"
                : "bg-neutral-950/70 text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:bg-neutral-800"
            }`}
          >
            <span>🎙️ Studio Prebuilt (Google HD)</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full">
              {officialCount}
            </span>
          </button>

          <button
            onClick={() => setCategoryFilter("kids")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "kids"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400"
                : "bg-neutral-950/70 text-amber-300/80 hover:text-amber-200 border border-amber-900/40 hover:bg-amber-950/30"
            }`}
          >
            <span>👦👧 Kids & Toddlers</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full">
              {kidsCount}
            </span>
          </button>

          <button
            onClick={() => setCategoryFilter("character")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "character"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400"
                : "bg-neutral-950/70 text-purple-300/80 hover:text-purple-200 border border-purple-900/40 hover:bg-purple-950/30"
            }`}
          >
            <span>🎭 Character Archetypes</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded-full">
              {characterCount}
            </span>
          </button>

          {/* Quick Popular Tags */}
          <div className="ml-auto hidden lg:flex items-center gap-1 text-xs">
            <span className="text-neutral-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Quick Filter:
            </span>
            {["Audiobook", "Cinematic", "Narrator", "ASMR", "Clear", "Broadcast"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  selectedTag === tag
                    ? "bg-indigo-500 text-white font-bold"
                    : "bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                }`}
              >
                #{tag}
              </button>
            ))}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-xs text-indigo-400 hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono text-neutral-400">
          Showing <strong className="text-white">{filteredVoices.length}</strong> of {VOICES_CATALOG.length} voices
          {selectedTag && <span> tagged with <strong className="text-indigo-400">#{selectedTag}</strong></span>}
          {searchQuery && <span> matching "<strong className="text-indigo-300">{searchQuery}</strong>"</span>}
        </span>

        {(selectedTag || searchQuery || categoryFilter !== "all" || genderFilter !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedTag(null);
              setCategoryFilter("all");
              setGenderFilter("all");
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Reset Filters
          </button>
        )}
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          const isAuditioning = playingVoice === voice.id;
          const isLoading = loadingVoice === voice.id;
          const isKid = voice.category === "kids";
          const isCharacter = voice.category === "character";

          return (
            <div
              key={voice.id}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden backdrop-blur-sm group ${
                isSelected
                  ? isKid
                    ? "bg-amber-950/25 border-amber-500 shadow-xl shadow-amber-950/50 ring-1 ring-amber-500/60"
                    : isCharacter
                    ? "bg-purple-950/25 border-purple-500 shadow-xl shadow-purple-950/50 ring-1 ring-purple-500/60"
                    : "bg-indigo-950/25 border-indigo-500 shadow-xl shadow-indigo-950/50 ring-1 ring-indigo-500/60"
                  : isKid
                  ? "bg-neutral-900/60 border-amber-500/20 hover:border-amber-500/50 hover:bg-neutral-900/90"
                  : isCharacter
                  ? "bg-neutral-900/60 border-purple-500/20 hover:border-purple-500/50 hover:bg-neutral-900/90"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90"
              }`}
            >
              {/* Active voice badge */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <Check className="w-3 h-3" /> Active Solo Voice
                </div>
              )}

              <div>
                {/* Voice Icon & Name */}
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${
                      isKid
                        ? "bg-amber-950/50 border-amber-500/40"
                        : isCharacter
                        ? "bg-purple-950/50 border-purple-500/40"
                        : "bg-neutral-800/80 border-neutral-700/60"
                    }`}
                  >
                    {getVoiceAvatar(voice)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-neutral-100 truncate">{voice.name}</h3>
                      {isKid ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          {voice.gender === "boy" ? "👦 Boy" : "👧 Girl"} ({voice.ageGroup})
                        </span>
                      ) : isCharacter ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                          {voice.ageGroup}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 uppercase">
                          {voice.gender}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-indigo-300 mt-0.5 line-clamp-1">{voice.tone}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed mb-3 line-clamp-3">
                  {voice.description}
                </p>

                {/* Base voice info tag if persona */}
                {(isKid || isCharacter) && (
                  <div className="mb-3 text-[11px] font-mono text-neutral-400 bg-neutral-950/60 px-2 py-1 rounded border border-neutral-800 flex items-center justify-between">
                    <span>Base Model:</span>
                    <span className="text-neutral-200 font-semibold">{voice.baseVoice} (Gemini 3.8 Flash-TTS)</span>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {voice.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        selectedTag === tag
                          ? "bg-indigo-600 text-white border-indigo-400 font-bold"
                          : tag === "Kid" || tag === "Boy" || tag === "Girl"
                          ? "bg-amber-950/40 text-amber-300 border-amber-500/30 font-semibold"
                          : tag === "AI" || tag === "Trailer" || tag === "ASMR"
                          ? "bg-purple-950/40 text-purple-300 border-purple-500/30 font-semibold"
                          : "bg-neutral-800/90 text-neutral-300 border-neutral-700/50 hover:bg-neutral-700"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                {/* Sample line preview */}
                <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800/80 mb-5 group-hover:border-neutral-700/80 transition-colors">
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

      {filteredVoices.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
          <Mic className="w-8 h-8 text-neutral-500 mx-auto" />
          <h3 className="text-base font-bold text-neutral-200">No voices match your filters</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Try adjusting your search terms, changing the gender filter, or clearing selected tags.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedTag(null);
              setCategoryFilter("all");
              setGenderFilter("all");
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            View All {VOICES_CATALOG.length} Voices
          </button>
        </div>
      )}
    </div>
  );
};
