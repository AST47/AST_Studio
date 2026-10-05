import React from "react";
import {
  Mic,
  Users,
  Sparkles,
  History,
  Activity,
  Radio,
  Sliders,
  AudioWaveform,
} from "lucide-react";
import { QuotaHUD } from "./QuotaHUD";
import { QuotaStatus } from "../types/tts";
import { AstLogo } from "./AstLogo";

export type StudioTab = "solo" | "dialogue" | "catalog" | "history";

interface HeaderProps {
  currentTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  historyCount: number;
  quota?: QuotaStatus;
  onRefreshQuota?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  historyCount,
  quota,
  onRefreshQuota,
}) => {
  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand with recolored AST logo */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <AstLogo className="h-7 sm:h-8 w-auto" showStudioText={true} />
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 3.8 TTS
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block mt-0.5">
              Neural Text-to-Speech & Voice Production Suite
            </p>
          </div>
        </div>

        {/* Right side: Quota HUD Pill & Studio Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {quota && (
            <QuotaHUD quota={quota} onRefresh={onRefreshQuota} variant="header-pill" />
          )}

          {/* Studio Navigation Tabs */}
          <div className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 overflow-x-auto">
            <button
              onClick={() => onTabChange("solo")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "solo"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Solo Studio</span>
            </button>

            <button
              onClick={() => onTabChange("dialogue")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "dialogue"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Dialogue</span>
            </button>

            <button
              onClick={() => onTabChange("catalog")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "catalog"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Voices</span>
            </button>

            <button
              onClick={() => onTabChange("history")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "history"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Soundboard</span>
              {historyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                  {historyCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
