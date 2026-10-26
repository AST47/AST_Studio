import React, { useState, useEffect } from "react";
import {
  Key,
  ShieldCheck,
  ExternalLink,
  Check,
  X,
  Trash2,
  Lock,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Clipboard,
  HelpCircle,
  Zap,
  Plus,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import {
  getStoredApiKey,
  getStoredApiKeys,
  setStoredApiKey,
  addStoredApiKeys,
  removeStoredApiKey,
  clearStoredApiKey,
  isAutoRotateEnabled,
  setAutoRotateEnabled,
} from "../services/clientGeminiService";
import { clearQuotaCooldown, parseGeminiError } from "../services/quotaTracker";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChanged?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyChanged,
}) => {
  const [keysList, setKeysList] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [newKeyInput, setNewKeyInput] = useState("");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [testingKeyIndex, setTestingKeyIndex] = useState<number | null>(null);
  const [showMaskedKeys, setShowMaskedKeys] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
    rawError?: string;
  } | null>(null);

  const refreshState = () => {
    const list = getStoredApiKeys();
    const current = getStoredApiKey();
    setKeysList(list);
    setActiveKey(current);
    setAutoRotate(isAutoRotateEnabled());
  };

  useEffect(() => {
    if (isOpen) {
      refreshState();
      setFeedback(null);
      setNewKeyInput("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddKeys = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setFeedback({
        type: "error",
        message: "Please paste at least one valid Gemini API key.",
      });
      return;
    }

    const { added, total } = addStoredApiKeys(trimmed);
    if (added === 0) {
      setFeedback({
        type: "info",
        message: "Key(s) already exist in your pool or were formatted incorrectly.",
      });
    } else {
      setFeedback({
        type: "success",
        message: `Successfully added ${added} key${added > 1 ? "s" : ""} to your pool! Total keys: ${total}.`,
      });
      setNewKeyInput("");
    }

    clearQuotaCooldown();
    refreshState();
    if (onKeyChanged) onKeyChanged();
  };

  const handleSetActive = (key: string, index: number) => {
    setStoredApiKey(key);
    clearQuotaCooldown();
    refreshState();
    setFeedback({
      type: "success",
      message: `Key #${index + 1} is now set as your active generation key.`,
    });
    if (onKeyChanged) onKeyChanged();
  };

  const handleRemoveKey = (key: string, index: number) => {
    removeStoredApiKey(key);
    clearQuotaCooldown();
    refreshState();
    setFeedback({
      type: "info",
      message: `Removed Key #${index + 1} from your pool.`,
    });
    if (onKeyChanged) onKeyChanged();
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to remove all API keys from this browser?")) {
      clearStoredApiKey();
      clearQuotaCooldown();
      refreshState();
      setFeedback({
        type: "info",
        message: "All keys removed from browser storage.",
      });
      if (onKeyChanged) onKeyChanged();
    }
  };

  const handleToggleAutoRotate = (enabled: boolean) => {
    setAutoRotate(enabled);
    setAutoRotateEnabled(enabled);
    setFeedback({
      type: "info",
      message: enabled
        ? "Auto-failover enabled: When a key hits its daily quota, the studio will seamlessly switch to the next key."
        : "Auto-failover disabled: The studio will stay on your selected key.",
    });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNewKeyInput((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      }
    } catch {
      // Clipboard permission denied or unsupported
    }
  };

  const handleTestKey = async (keyToTest: string, index: number) => {
    setTestingKeyIndex(index);
    setFeedback(null);

    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [{ role: "user", parts: [{ text: "AST Studio voice check" }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        setFeedback({
          type: "success",
          message: `Key #${index + 1} is verified and working for Gemini 3.8 Speech (TTS)!`,
        });
      } else {
        throw new Error("No audio returned from Gemini Speech API.");
      }
    } catch (err: any) {
      const parsed = parseGeminiError(err);
      if (parsed.isDaily) {
        setFeedback({
          type: "error",
          message: `Key #${index + 1} Daily Limit Reached: This key reached its 10 requests/day allowance on Google's Free Tier (resets at midnight PT).`,
          rawError: parsed.rawError,
        });
      } else if (parsed.isQuota) {
        setFeedback({
          type: "error",
          message: `Key #${index + 1} Rate Limited (429): Google's free rate limit reached (5 requests/min). Please wait ${parsed.retrySeconds}s for the slot to reset.`,
          rawError: parsed.rawError,
        });
      } else {
        setFeedback({
          type: "error",
          message: `Key #${index + 1} Error: ${parsed.message || "Failed to validate key."}`,
          rawError: parsed.rawError,
        });
      }
    } finally {
      setTestingKeyIndex(null);
    }
  };

  const maskKey = (key: string, show: boolean) => {
    if (show) return key;
    if (key.length <= 10) return "••••••••••••";
    return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <span>Multi-Key Pool & Rotation</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {keysList.length} Key{keysList.length === 1 ? "" : "s"} Connected
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Paste multiple free keys to bypass the 10/day limit with auto-failover
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Capacity Banner */}
          <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-neutral-900 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-neutral-200 block">
                  Combined Daily Allowance:{" "}
                  <strong className="text-emerald-300 font-mono">
                    ~{Math.max(1, keysList.length) * 10} Audio Clips / Day
                  </strong>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Each free Google project gives 10 audio requests. Having {Math.max(1, keysList.length)} key{keysList.length === 1 ? "" : "s"} gives you ~{Math.max(1, keysList.length) * 10}/day.
                </span>
              </div>
            </div>

            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-medium text-[11px] flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>+ Get More Keys</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </a>
          </div>

          {/* Auto-Rotation Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="font-semibold text-neutral-200 block">
                  Auto-Failover / Key Rotation
                </span>
                <span className="text-[11px] text-neutral-400">
                  When a key hits daily quota (10 requests) or rate limit, automatically switch to the next key.
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={(e) => handleToggleAutoRotate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Connected Keys Pool */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Your API Key Pool ({keysList.length})</span>
              </label>

              {keysList.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Clear All Keys
                </button>
              )}
            </div>

            {keysList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-neutral-800 text-center space-y-1 bg-neutral-950/40">
                <p className="text-xs text-neutral-400">
                  No API keys saved yet. Paste one or more Gemini API keys below.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {keysList.map((k, idx) => {
                  const isActive = k === activeKey;
                  const isMasked = !showMaskedKeys[idx];
                  const isTestingThis = testingKeyIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isActive
                          ? "bg-indigo-950/30 border-indigo-500/50 shadow-sm"
                          : "bg-neutral-950/70 border-neutral-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-mono shrink-0">
                          {idx + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-neutral-200 truncate">
                              {maskKey(k, !isMasked)}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setShowMaskedKeys((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="p-1 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                          title={isMasked ? "Show key" : "Hide key"}
                        >
                          {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          disabled={isTestingThis}
                          onClick={() => handleTestKey(k, idx)}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                          title="Test speech synthesis with this key"
                        >
                          {isTestingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                          )}
                          <span>Test</span>
                        </button>

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleSetActive(k, idx)}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                            title="Set as currently active key"
                          >
                            Use This Key
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveKey(k, idx)}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete this key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Key(s) Box */}
          <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Key(s) to Pool</span>
              </label>

              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3 h-3" />
                <span>Paste from Clipboard</span>
              </button>
            </div>

            <textarea
              rows={2}
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              placeholder="Paste one or multiple Gemini API keys here (e.g. AIzaSy...)\nTip: You can paste multiple keys separated by new lines or commas!"
              className="w-full p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-neutral-400">
                Pasting multiple keys combines them into an automated pool.
              </span>
              <button
                type="button"
                onClick={handleAddKeys}
                disabled={!newKeyInput.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Pool</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : feedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
              }`}
            >
              <div className="flex items-start gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : feedback.type === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                )}
                <span className="leading-relaxed">{feedback.message}</span>
              </div>
              {feedback.rawError && (
                <details className="mt-1 pt-1.5 border-t border-rose-500/20 text-[11px] font-mono opacity-80">
                  <summary className="cursor-pointer hover:underline text-rose-300 font-semibold select-none">
                    View Raw Error
                  </summary>
                  <pre className="mt-1.5 p-2 bg-black/40 rounded-lg text-rose-200/90 whitespace-pre-wrap break-all text-[10px] max-h-24 overflow-y-auto">
                    {feedback.rawError}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div className="text-xs text-neutral-400 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-200 block mb-0.5">100% Client-Side Private Storage</strong>
              All your keys are kept strictly inside your device's browser (<code className="text-indigo-300">localStorage</code>). They are never sent to external servers or logged.
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between gap-2 shrink-0">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>Create another free key in Google AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
