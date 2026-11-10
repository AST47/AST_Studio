import React, { useState, useEffect } from "react";
import {
  X,
  Bookmark,
  Sparkles,
  Volume2,
  Trash2,
  Check,
  Search,
  Loader2,
  Sliders,
  Plus,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { SavedVoiceProfile, VoiceName } from "../types/tts";
import { VOICES_CATALOG } from "../data/voices";
import {
  getSavedVoices,
  deleteVoiceProfile,
  resetToDefaultVoices,
  subscribeToSavedVoices,
} from "../services/savedVoicesService";
import { requestTts } from "../services/api";

interface SavedVoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId?: string | null;
  onSelectProfile: (profile: SavedVoiceProfile) => void;
  onOpenSaveNewModal?: () => void;
}

export const SavedVoicesModal: React.FC<SavedVoicesModalProps> = ({
  isOpen,
  onClose,
  activeProfileId,
  onSelectProfile,
  onOpenSaveNewModal,
}) => {
  const [profiles, setProfiles] = useState<SavedVoiceProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [auditioningId, setAuditioningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProfiles(getSavedVoices());
      const unsub = subscribeToSavedVoices((updated) => setProfiles(updated));
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = profiles.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.customName.toLowerCase().includes(q) ||
      p.voiceId.toLowerCase().includes(q) ||
      p.stylePrompt.toLowerCase().includes(q) ||
      (p.vocalMood && p.vocalMood.toLowerCase().includes(q))
    );
  });

  const handleAudition = async (p: SavedVoiceProfile) => {
    if (auditioningId) return;
    setAuditioningId(p.id);

    const voiceInfo = VOICES_CATALOG.find((v) => v.id === p.voiceId);
    const text = voiceInfo?.sampleText || "This is an audition of my custom tuned voice settings.";

    try {
      const res = await requestTts({
        mode: "single",
        text,
        voice: p.voiceId,
        style: p.stylePrompt,
        model: p.model || "gemini-3.8-flash-lite-tts",
      });
      const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`);
      await audio.play();
    } catch (e) {
      console.error("Audition failed", e);
    } finally {
      setAuditioningId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the voice profile "${name}"?`)) {
      deleteVoiceProfile(id);
    }
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        "Reset custom voices library to standard defaults? This will restore the curated starter voice profiles."
      )
    ) {
      const restored = resetToDefaultVoices();
      setProfiles(restored);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <span>Custom Voice Library</span>
                <span className="text-[10px] font-mono text-neutral-400">
                  ({profiles.length} profiles)
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Saved voice actors configured with unique custom styles, moods, and pacing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSaveNewModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSaveNewModal();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Current</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-neutral-950/40 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by custom name, voice, or style keywords..."
              className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer px-2 py-1 rounded bg-neutral-900 border border-neutral-800"
            title="Restore default curated profiles"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>

        {/* Profiles List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800">
              <Bookmark className="w-6 h-6 text-neutral-500 mx-auto" />
              <p className="text-xs text-neutral-400">
                {searchQuery
                  ? "No saved voices match your search query."
                  : "No custom voices saved yet."}
              </p>
            </div>
          ) : (
            filtered.map((profile) => {
              const voiceInfo = VOICES_CATALOG.find((v) => v.id === profile.voiceId);
              const isActive = activeProfileId === profile.id;
              const isAuditioning = auditioningId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive
                      ? "bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md"
                      : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl shrink-0">
                      {voiceInfo?.avatarEmoji || "🎙️"}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">
                          {profile.customName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-indigo-300 border border-neutral-700">
                          {profile.voiceId} ({voiceInfo?.gender || "Voice"})
                        </span>
                        {profile.speakingPace !== "normal" && (
                          <span className="text-[10px] font-mono text-neutral-400">
                            • {profile.speakingPace} pace
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Active in Studio
                          </span>
                        )}
                      </div>

                      {profile.stylePrompt ? (
                        <p className="text-xs text-neutral-400 line-clamp-2 italic">
                          "{profile.stylePrompt}"
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          Natural voice with default delivery
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      disabled={isAuditioning}
                      onClick={() => handleAudition(profile)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Audition voice"
                    >
                      {isAuditioning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Audition</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectProfile(profile);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isActive
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isActive ? "Active" : "Use Voice"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(profile.id, profile.customName)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 shrink-0">
          <span>
            💡 Saved voice profiles persist across browser sessions in private local storage.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
