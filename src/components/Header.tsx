import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Users,
  Sparkles,
  History,
  Activity,
  Radio,
  Sliders,
  AudioWaveform,
  Key,
  Upload,
} from "lucide-react";
import { QuotaHUD } from "./QuotaHUD";
import { QuotaStatus } from "../types/tts";

export type StudioTab = "solo" | "dialogue" | "catalog" | "history";

interface HeaderProps {
  currentTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  historyCount: number;
  quota?: QuotaStatus;
  onRefreshQuota?: () => void;
  onOpenApiKeyModal?: () => void;
  hasCustomApiKey?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  historyCount,
  quota,
  onRefreshQuota,
  onOpenApiKeyModal,
  hasCustomApiKey,
}) => {
  // Clear any legacy localStorage banner overrides to ensure the repo's Logo.png is always used
  useEffect(() => {
    try {
      localStorage.removeItem("ast_studio_custom_banner");
      localStorage.removeItem("ast_studio_custom_ast_logo");
    } catch {}
  }, []);

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand: Official AST Studio Header Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5 select-none">
            <img
              src="./Logo.png?v=3"
              alt="AST Studio - Neural Text-to-Speech & Voice Production Suite"
              className="h-9 sm:h-11 md:h-12 w-auto object-contain drop-shadow-[0_4px_16px_rgba(99,102,241,0.22)] shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes("logo.png")) {
                  target.src = "./logo.png?v=3";
                }
              }}
            />
            {/* Gemini 3.8 TTS Model Capsule - matches shape, height, and style of the API key capsule on the right */}
            <div
              title="Active Model: Gemini 3.8 Neural Text-to-Speech"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900/90 text-neutral-300 border border-neutral-800 shadow-sm whitespace-nowrap select-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Gemini 3.8 TTS</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Model Ready" />
            </div>
          </div>
        </div>

        {/* Right side: API Key button, Quota HUD Pill & Studio Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gemini API Key Settings Button */}
          {onOpenApiKeyModal && (
            <button
              onClick={onOpenApiKeyModal}
              title={hasCustomApiKey ? "Google Gemini API Key Connected" : "Get Free Google Gemini API Key"}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                hasCustomApiKey
                  ? "bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-800"
                  : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-500/30"
              }`}
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">
                {hasCustomApiKey ? "API Key Connected" : "Get Free API Key"}
              </span>
              {hasCustomApiKey ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="API Key Connected" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Click to connect free Gemini API Key" />
              )}
            </button>
          )}

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
