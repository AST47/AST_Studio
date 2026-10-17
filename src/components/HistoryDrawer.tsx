import React, { useState } from "react";
import {
  History,
  Play,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Search,
  Volume2,
  Share2,
  Check,
} from "lucide-react";
import { GeneratedAudioItem } from "../types/tts";

interface HistoryDrawerProps {
  items: GeneratedAudioItem[];
  activeItemId: string | null;
  onSelectItem: (item: GeneratedAudioItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  items,
  activeItemId,
  onSelectItem,
  onDeleteItem,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.textPreview.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.voice && item.voice.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDownload = (item: GeneratedAudioItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = `data:${item.mimeType || "audio/wav"};base64,${item.audioBase64}`;
    const safeTitle = (item.title || "speech")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    a.download = `${safeTitle}-${item.createdAt}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyBase64 = (item: GeneratedAudioItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.audioBase64);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            Generation Soundboard & Library ({items.length})
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Your recently synthesized speech clips are cached locally in your studio session.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Library</span>
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved clips by text, title or voice..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-8 text-center">
          <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-neutral-300">
            {items.length === 0 ? "No speech recordings yet" : "No matching clips found"}
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
            {items.length === 0
              ? "Synthesize your first narration or dual dialogue in the studio to populate your library."
              : "Try adjusting your search query."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "bg-indigo-950/30 border-indigo-500/80 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/40"
                    : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {item.mode === "dialogue" ? "Dialogue" : item.voice}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        {formatDuration(item.duration)}
                      </span>
                    </div>

                    <span className="text-[10px] text-neutral-500 font-mono">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-neutral-100 line-clamp-1 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-neutral-400 line-clamp-2 italic mb-3">
                    "{item.textPreview}"
                  </p>
                </div>

                {/* Footer action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {item.modelUsed.replace("gemini-3.8-", "")}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleCopyBase64(item, e)}
                      title="Copy base64"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleDownload(item, e)}
                      title="Download WAV"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      title="Delete clip"
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onSelectItem(item)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 ml-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
