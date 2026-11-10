import React, { useState, useEffect } from "react";
import {
  X,
  Bookmark,
  Check,
  Sparkles,
  Sliders,
  Volume2,
  Trash2,
  Edit2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { SavedVoiceProfile, VoiceName } from "../types/tts";
import { VOICES_CATALOG } from "../data/voices";
import {
  saveVoiceProfile,
  updateVoiceProfile,
  getSavedVoices,
} from "../services/savedVoicesService";

interface SaveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVoiceId: VoiceName;
  currentStylePrompt: string;
  currentSpeakingPace: "normal" | "slow" | "brisk" | "fast";
  currentVocalMood: string;
  currentModel: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
  activeProfile?: SavedVoiceProfile | null;
  onSaved: (savedProfile: SavedVoiceProfile) => void;
}

export const SaveVoiceModal: React.FC<SaveVoiceModalProps> = ({
  isOpen,
  onClose,
  currentVoiceId,
  currentStylePrompt,
  currentSpeakingPace,
  currentVocalMood,
  currentModel,
  activeProfile,
  onSaved,
}) => {
  const [customName, setCustomName] = useState("");
  const [saveMode, setSaveMode] = useState<"new" | "update">("new");
  const [error, setError] = useState<string | null>(null);

  const voiceInfo =
    VOICES_CATALOG.find((v) => v.id === currentVoiceId) || VOICES_CATALOG[0];

  useEffect(() => {
    if (isOpen) {
      if (activeProfile && !activeProfile.isBuiltIn) {
        setCustomName(activeProfile.customName);
        setSaveMode("update");
      } else if (activeProfile?.isBuiltIn) {
        setCustomName(`${activeProfile.customName} (Custom)`);
        setSaveMode("new");
      } else {
        setCustomName(`${voiceInfo.name} - Custom`);
        setSaveMode("new");
      }
      setError(null);
    }
  }, [isOpen, activeProfile, voiceInfo.name]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setError("Please provide a name for this custom voice profile.");
      return;
    }

    if (saveMode === "update" && activeProfile && !activeProfile.isBuiltIn) {
      const updated = updateVoiceProfile(activeProfile.id, {
        customName: trimmedName,
        voiceId: currentVoiceId,
        stylePrompt: currentStylePrompt,
        speakingPace: currentSpeakingPace,
        vocalMood: currentVocalMood,
        model: currentModel,
      });
      if (updated) {
        onSaved(updated);
        onClose();
      }
    } else {
      const created = saveVoiceProfile({
        customName: trimmedName,
        voiceId: currentVoiceId,
        stylePrompt: currentStylePrompt,
        speakingPace: currentSpeakingPace,
        vocalMood: currentVocalMood,
        model: currentModel,
      });
      onSaved(created);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                Save Custom Voice Profile
              </h3>
              <p className="text-[11px] text-neutral-400">
                Save this voice, style directive, pace, and mood for 1-click reuse
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* If editing an existing profile, allow choosing between update or save-as-new */}
          {activeProfile && !activeProfile.isBuiltIn && (
            <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSaveMode("update")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  saveMode === "update"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Update "{activeProfile.customName}"
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveMode("new");
                  setCustomName(`${activeProfile.customName} (Copy)`);
                }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  saveMode === "new"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Save as New Profile
              </button>
            </div>
          )}

          {/* Voice Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
              <span>Voice Profile Name</span>
              <span className="text-[10px] text-neutral-500 font-mono">e.g. Grumpy Detective, Bedtime Story</span>
            </label>
            <input
              type="text"
              autoFocus
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Cinema Trailer Voice, Tech Explainer..."
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {error && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Voice Settings Snapshot */}
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-2 text-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Configured Settings Summary
            </span>

            <div className="flex items-center gap-2.5">
              <span className="text-xl select-none">{voiceInfo.avatarEmoji}</span>
              <div>
                <span className="font-bold text-neutral-200">{voiceInfo.name}</span>
                <span className="text-neutral-400 text-[11px] ml-1.5">
                  ({voiceInfo.gender}, {voiceInfo.ageGroup})
                </span>
                <p className="text-[11px] text-neutral-400 line-clamp-1">{voiceInfo.tone}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/60 text-[11px]">
              <div>
                <span className="text-neutral-500 block">Speaking Pace:</span>
                <span className="font-mono text-neutral-300 font-semibold capitalize">
                  {currentSpeakingPace}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Delivery Mood:</span>
                <span className="text-neutral-300 font-semibold truncate block">
                  {currentVocalMood === "default" ? "Natural / Neutral" : currentVocalMood.slice(0, 24) + "..."}
                </span>
              </div>
            </div>

            {currentStylePrompt && (
              <div className="pt-2 border-t border-neutral-800/60 text-[11px]">
                <span className="text-neutral-500 block mb-0.5">Style Directive:</span>
                <p className="text-neutral-300 italic line-clamp-2 bg-neutral-900/90 p-1.5 rounded border border-neutral-800">
                  "{currentStylePrompt}"
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saveMode === "update" ? "Update Profile" : "Save Custom Voice"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
