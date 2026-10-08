/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Header, StudioTab } from "./components/Header";
import { SoloStudio } from "./components/SoloStudio";
import { DialogueStudio } from "./components/DialogueStudio";
import { VoiceCatalog } from "./components/VoiceCatalog";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { AudioPlayer } from "./components/AudioPlayer";
import { QuotaHUD } from "./components/QuotaHUD";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { VoiceName, GeneratedAudioItem, QuotaStatus } from "./types/tts";
import { checkServerHealth, fetchQuotaStatus, subscribeToQuota } from "./services/api";
import { getStoredApiKey } from "./services/clientGeminiService";
import { SCRIPT_TEMPLATES } from "./data/voices";
import {
  Sparkles,
  Info,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Key,
  ExternalLink,
} from "lucide-react";

const STORAGE_KEY = "voxstudio_audio_history_v1";

export default function App() {
  const [currentTab, setCurrentTab] = useState<StudioTab>("solo");
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Kore");
  const [activeAudioItem, setActiveAudioItem] =
    useState<GeneratedAudioItem | null>(null);
  const [historyItems, setHistoryItems] = useState<GeneratedAudioItem[]>([]);
  const [serverStatus, setServerStatus] = useState<string>("checking");
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [storedClientKey, setStoredClientKey] = useState<string>(getStoredApiKey());
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus>({
    requestsInLastMinute: 0,
    freeTierRpmLimit: 5,
    secondsUntilNextWindowSlot: 0,
    cooldownRemaining: 0,
    sessionGenerationsCount: 0,
    isThrottled: false,
    hasApiKey: true,
  });

  const refreshQuota = () => {
    fetchQuotaStatus().then(setQuotaStatus).catch(console.error);
  };

  // Subscribe to live client and server quota updates
  useEffect(() => {
    const unsubscribe = subscribeToQuota((status) => {
      setQuotaStatus(status);
    });
    return unsubscribe;
  }, []);

  // Load history from localStorage and initialize health & quota
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistoryItems(parsed);
          setActiveAudioItem(parsed[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load audio history from localStorage", e);
    }

    // Health check
    checkServerHealth().then((res) => {
      setServerStatus(res.status);
      setHasApiKey(res.hasApiKey);
    });

    // Initial quota check
    refreshQuota();

    // Poll quota every 10 seconds to keep rolling window accurate
    const quotaInterval = setInterval(() => {
      refreshQuota();
    }, 10000);

    return () => clearInterval(quotaInterval);
  }, []);

  // Save history to localStorage
  const saveHistory = (items: GeneratedAudioItem[]) => {
    setHistoryItems(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
    } catch (e) {
      console.warn("Could not save to localStorage (quota or disabled)", e);
    }
  };

  const handleAudioGenerated = (item: GeneratedAudioItem) => {
    setActiveAudioItem(item);
    const updated = [item, ...historyItems.filter((h) => h.id !== item.id)];
    saveHistory(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = historyItems.filter((h) => h.id !== id);
    saveHistory(updated);
    if (activeAudioItem?.id === id) {
      setActiveAudioItem(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleClearAllHistory = () => {
    saveHistory([]);
    setActiveAudioItem(null);
  };

  const handleSelectFromCatalog = (voice: VoiceName) => {
    setSelectedVoice(voice);
    setCurrentTab("solo");
  };

  const handleAuditionPlayed = (
    voice: VoiceName,
    audioBase64: string,
    sampleText: string
  ) => {
    const auditionItem: GeneratedAudioItem = {
      id: `audition-${voice}-${Date.now()}`,
      title: `${voice} - Audition Sample`,
      createdAt: Date.now(),
      mode: "single",
      modelUsed: "gemini-3.8-flash-lite-tts",
      duration: 3.5,
      audioBase64,
      mimeType: "audio/wav",
      textPreview: sampleText,
      voice,
    };
    setActiveAudioItem(auditionItem);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Studio Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        historyCount={historyItems.length}
        quota={quotaStatus}
        onRefreshQuota={refreshQuota}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        hasCustomApiKey={!!storedClientKey}
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Visitor Guide Banner if no client key is stored */}
        {!hasApiKey && !storedClientKey && serverStatus !== "checking" && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-neutral-900 to-purple-950/50 border border-indigo-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Get Your Free Google Gemini API Key
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Free Tier • 15 requests/min • No Credit Card
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
                  AST Studio uses Google Gemini 3.8 to generate expressive voices. Google provides a generous free tier for all Google account holders. Get your free key in 30 seconds to start creating audio.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-neutral-700"
              >
                <span>Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Connect Free Key</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Quota & Rate Limit Dashboard Monitor */}
        <section aria-label="API Quota and Rate Limit Monitor">
          <QuotaHUD
            quota={quotaStatus}
            onRefresh={refreshQuota}
            variant="dashboard-card"
          />
        </section>

        {/* Tab Content Panels */}
        <section className="transition-opacity duration-200">
          {currentTab === "solo" && (
            <SoloStudio
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              onAudioGenerated={handleAudioGenerated}
              quotaStatus={quotaStatus}
              onQuotaUpdated={setQuotaStatus}
              activeAudioItem={activeAudioItem}
              onClearAudio={() => setActiveAudioItem(null)}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            />
          )}

          {currentTab === "dialogue" && (
            <DialogueStudio
              onAudioGenerated={handleAudioGenerated}
              quotaStatus={quotaStatus}
              onQuotaUpdated={setQuotaStatus}
              activeAudioItem={activeAudioItem}
              onClearAudio={() => setActiveAudioItem(null)}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            />
          )}

          {currentTab === "catalog" && (
            <div className="space-y-6">
              <VoiceCatalog
                selectedVoice={selectedVoice}
                onSelectVoice={handleSelectFromCatalog}
                onPlayAudition={handleAuditionPlayed}
              />
              {activeAudioItem && (
                <AudioPlayer
                  item={activeAudioItem}
                  onClear={() => setActiveAudioItem(null)}
                />
              )}
            </div>
          )}

          {currentTab === "history" && (
            <div className="space-y-6">
              <HistoryDrawer
                items={historyItems}
                activeItemId={activeAudioItem?.id || null}
                onSelectItem={(item) => setActiveAudioItem(item)}
                onDeleteItem={handleDeleteItem}
                onClearAll={handleClearAllHistory}
              />
              {activeAudioItem && (
                <AudioPlayer
                  item={activeAudioItem}
                  onClear={() => setActiveAudioItem(null)}
                />
              )}
            </div>
          )}
        </section>

        {/* Studio Info & Guide Bar */}
        <footer className="pt-8 pb-12 border-t border-neutral-900 text-neutral-500 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-400" />
            <span>
              Powered by <strong className="text-neutral-300">Gemini 3.8 TTS</strong> (Lite & Studio) • 24,000 Hz Unary WAV
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Expressive Tags: <code className="text-neutral-300 font-mono">&lt;breath&gt;</code>, <code className="text-neutral-300 font-mono">&lt;laugh&gt;</code>, <code className="text-neutral-300 font-mono">|yeah|</code>
            </span>
          </div>
        </footer>
      </main>

      {/* Gemini API Key Settings Modal (for static GitHub Pages) */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyChanged={() => setStoredClientKey(getStoredApiKey())}
      />
    </div>
  );
}
