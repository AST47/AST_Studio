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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullBannerSrc, setFullBannerSrc] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem("ast_studio_custom_banner") ||
        localStorage.getItem("ast_studio_custom_ast_logo") ||
        null
      );
    } catch {
      return null;
    }
  });

  // Check if an image was placed in public/ (logo.png or ast-studio-banner-template.png)
  useEffect(() => {
    if (!fullBannerSrc) {
      const probe1 = new Image();
      probe1.src = "./logo.png";
      probe1.onload = () => setFullBannerSrc("./logo.png");
      probe1.onerror = () => {
        const probe2 = new Image();
        probe2.src = "./ast-studio-banner-template.png";
        probe2.onload = () => setFullBannerSrc("./ast-studio-banner-template.png");
      };
    }
  }, [fullBannerSrc]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setFullBannerSrc(dataUrl);
        try {
          localStorage.setItem("ast_studio_custom_banner", dataUrl);
        } catch (err) {
          console.warn("Could not save to localStorage", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand: The whole left side of header */}
        <div className="flex items-center gap-3">
          {fullBannerSrc ? (
            <div className="flex items-center gap-2.5">
              <img
                src={fullBannerSrc}
                alt="AST Studio"
                className="h-10 sm:h-12 w-auto object-contain cursor-pointer transition-transform hover:scale-[1.02] drop-shadow-[0_2px_12px_rgba(99,102,241,0.25)]"
                onClick={() => fileInputRef.current?.click()}
                title="AST Studio (Click to update banner image)"
              />
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 3.8 TTS
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 cursor-pointer group"
              title="Click anywhere here to upload your AST Studio header image"
            >
              {/* Wave Badge */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-600/25 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                  <AudioWaveform className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                    AST <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Studio</span>
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 group-hover:bg-indigo-500/20 transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Gemini 3.8 TTS
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 hidden sm:block mt-0.5">
                  Neural Text-to-Speech & Voice Production Suite
                </p>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Right side: API Key button, Quota HUD Pill & Studio Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gemini API Key Settings Button */}
          {onOpenApiKeyModal && (
            <button
              onClick={onOpenApiKeyModal}
              title="Configure Google Gemini API Key (Required for static GitHub Pages)"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">API Key</span>
              {hasCustomApiKey ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="API Key Connected" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Server Key Active" />
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
