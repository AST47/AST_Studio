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
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from "../services/clientGeminiService";

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
  const [keyInput, setKeyInput] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const existing = getStoredApiKey();
      setSavedKey(existing);
      setKeyInput(existing);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!keyInput.trim()) {
      clearStoredApiKey();
      setSavedKey("");
      setKeyInput("");
      setTestResult({
        success: true,
        message: "API key removed from browser storage.",
      });
      if (onKeyChanged) onKeyChanged();
      return;
    }

    setStoredApiKey(keyInput.trim());
    setSavedKey(keyInput.trim());
    setTestResult({
      success: true,
      message: "API key successfully saved to browser storage!",
    });
    if (onKeyChanged) onKeyChanged();
  };

  const handleClear = () => {
    clearStoredApiKey();
    setSavedKey("");
    setKeyInput("");
    setTestResult({
      success: true,
      message: "API key removed.",
    });
    if (onKeyChanged) onKeyChanged();
  };

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim() || savedKey;
    if (!keyToTest) {
      setTestResult({
        success: false,
        message: "Please enter an API key first.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "Respond with 'OK'",
      });

      if (res.text) {
        setStoredApiKey(keyToTest);
        setSavedKey(keyToTest);
        setTestResult({
          success: true,
          message: "Key is valid and active for Gemini 3.8!",
        });
        if (onKeyChanged) onKeyChanged();
      } else {
        throw new Error("No response from Gemini API.");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to validate key. Please check for typos.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">
                Gemini API Key Settings
              </h3>
              <p className="text-xs text-neutral-400">
                Required for static GitHub Pages hosting
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
        <div className="p-5 space-y-4">
          <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800/80">
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>100% Client-Side Private Storage</span>
            </div>
            When running on GitHub Pages, your key is stored strictly inside your own browser's <code className="text-indigo-300">localStorage</code>. It is never sent to any intermediary server.
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>
          </div>

          {/* Test / Save Status Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="line-clamp-2">{testResult.message}</span>
            </div>
          )}

          {/* Get a Free Key link */}
          <div className="pt-1">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Get a free Gemini API key from Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between gap-2">
          {savedKey ? (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Key</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestKey}
              disabled={isTesting || (!keyInput && !savedKey)}
              className="px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTesting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 text-indigo-400" />
              )}
              <span>Test Key</span>
            </button>

            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
