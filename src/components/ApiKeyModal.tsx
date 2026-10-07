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
  const [showKey, setShowKey] = useState(false);
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

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setKeyInput(text.trim());
      }
    } catch {
      // Clipboard permission denied or unsupported
    }
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
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <span>Google Gemini API Key</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  100% Free
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Connect your key to generate realistic neural speech
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
          {/* Step-by-Step Visitor Guide Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-neutral-900 to-purple-950/30 border border-indigo-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                How to get your free key (30 seconds)
              </span>
              <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                No Credit Card Needed
              </span>
            </div>

            <ol className="text-xs text-neutral-300 space-y-2.5 pl-1">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  Click the button below to open{" "}
                  <strong className="text-white">Google AI Studio</strong> in a new tab.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  Sign in with any Google account and click the blue{" "}
                  <strong className="text-indigo-300">"+ Create API key"</strong> button.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-white">Copy the key</strong>, come back here, and paste it into the field below.
                </div>
              </li>
            </ol>

            {/* Direct Link to Google AI Studio */}
            <div className="pt-1">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <span>Open Google AI Studio to Create Key</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="text-xs text-neutral-400 bg-neutral-950/80 p-3 rounded-xl border border-neutral-800/80 flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-200 block mb-0.5">100% Client-Side Private Storage</strong>
              Your API key is saved solely inside your device's browser (<code className="text-indigo-300">localStorage</code>). It is never logged or shared with anyone.
            </div>
          </div>

          {/* Input Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Your Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3 h-3" />
                <span>Paste Key</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500/80 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between gap-2 shrink-0">
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
              className="px-3 py-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>Test Key</span>
            </button>

            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
