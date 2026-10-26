import React, { useState, useEffect } from "react";
import {
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  Zap,
  HelpCircle,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { QuotaStatus } from "../types/tts";
import { resetGenerationsCount } from "../services/quotaTracker";

interface QuotaHUDProps {
  quota: QuotaStatus;
  onRefresh?: () => void;
  variant?: "header-pill" | "dashboard-card";
}

export const QuotaHUD: React.FC<QuotaHUDProps> = ({
  quota,
  onRefresh,
  variant = "dashboard-card",
}) => {
  const [showModal, setShowModal] = useState(false);
  const [localWindowSecs, setLocalWindowSecs] = useState(quota.secondsUntilNextWindowSlot);
  const [localCooldown, setLocalCooldown] = useState(quota.cooldownRemaining);

  const handleResetTodayCount = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetGenerationsCount();
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    setLocalWindowSecs(quota.secondsUntilNextWindowSlot);
    setLocalCooldown(quota.cooldownRemaining);
  }, [quota.secondsUntilNextWindowSlot, quota.cooldownRemaining]);

  // Live countdown timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalWindowSecs((prev) => (prev > 0 ? prev - 1 : 0));
      setLocalCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const maxRpm = quota.freeTierRpmLimit || 5;
  const isDaily = !!quota.isDailyLimitExceeded;
  const rpm = isDaily || quota.isThrottled || localCooldown > 0 ? Math.max(quota.requestsInLastMinute, maxRpm) : quota.requestsInLastMinute;
  const isNearLimit = rpm >= maxRpm - 1 && rpm < maxRpm && !isDaily;
  const isAtLimit = rpm >= maxRpm || quota.isThrottled || localCooldown > 0 || isDaily;

  // Header Pill
  if (variant === "header-pill") {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border ${
            isDaily || isAtLimit
              ? "bg-red-950/50 text-red-300 border-red-500/40 hover:bg-red-900/60"
              : isNearLimit
              ? "bg-amber-950/50 text-amber-300 border-amber-500/40 hover:bg-amber-900/60"
              : "bg-neutral-900 text-neutral-300 border-neutral-700/60 hover:border-neutral-600 hover:bg-neutral-800"
          }`}
          title="Click to view Gemini API Quota & Rate Limit Monitor"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDaily || isAtLimit
                  ? "bg-red-400 animate-pulse"
                  : isNearLimit
                  ? "bg-amber-400 animate-pulse"
                  : "bg-emerald-400"
              }`}
            />
            <Gauge className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-semibold">{rpm}/{maxRpm} RPM</span>
          </span>

          <span className="text-[10px] text-neutral-400 border-l border-neutral-700 pl-2">
            {isDaily ? (
              <span className="text-red-400 font-bold">Daily Limit Reached</span>
            ) : localCooldown > 0 ? (
              <span className="text-red-400 font-bold">Cooldown {localCooldown}s</span>
            ) : isAtLimit ? (
              <span className="text-red-400 font-bold">Cooldown {localWindowSecs || 30}s</span>
            ) : localWindowSecs > 0 ? (
              <span>Resets in {localWindowSecs}s</span>
            ) : (
              <span className="text-emerald-400">100% Ready</span>
            )}
          </span>
        </button>

        {/* Modal Info */}
        {showModal && <QuotaInfoModal quota={quota} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // Dashboard Card variant
  return (
    <>
      <div
        className={`rounded-2xl border p-4 sm:p-5 transition-all backdrop-blur-md relative overflow-hidden ${
          isAtLimit
            ? "bg-red-950/20 border-red-900/60 shadow-lg shadow-red-950/20"
            : isNearLimit
            ? "bg-amber-950/20 border-amber-900/60 shadow-lg shadow-amber-950/20"
            : "bg-neutral-900/70 border-neutral-800/90 shadow-xl"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                isAtLimit
                  ? "bg-red-950/80 border-red-700 text-red-400"
                  : isNearLimit
                  ? "bg-amber-950/80 border-amber-700 text-amber-400"
                  : "bg-neutral-800 border-neutral-700 text-indigo-400"
              }`}
            >
              <Gauge className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                  Gemini API Rate Limit & Quota Monitor
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Free Tier (~5 RPM)
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Live monitoring of rolling 60-second audio generation limits from Google AI Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh Quota Status"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setShowModal(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Quota Details & Tips</span>
            </button>
          </div>
        </div>

        {/* Meters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          {/* RPM Meter */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-mono">1-Minute Window</span>
              <span
                className={`font-mono font-bold ${
                  isAtLimit
                    ? "text-red-400"
                    : isNearLimit
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {rpm} / {maxRpm} Requests
              </span>
            </div>

            {/* Segmented bar */}
            <div className="grid grid-cols-5 gap-1 h-2">
              {Array.from({ length: maxRpm }).map((_, i) => {
                const filled = i < rpm;
                const isOver = i >= maxRpm;
                return (
                  <div
                    key={i}
                    className={`rounded-sm transition-all ${
                      filled
                        ? isAtLimit
                          ? "bg-red-500 shadow-sm shadow-red-500/50"
                          : isNearLimit
                          ? "bg-amber-500"
                          : "bg-indigo-500"
                        : "bg-neutral-800/80"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400 pt-0.5">
              <span className={isDaily ? "text-red-400 font-bold" : isAtLimit ? "text-red-400 font-bold" : isNearLimit ? "text-amber-400 font-medium" : "text-emerald-400"}>
                {isDaily ? "Daily Limit Reached (Resets midnight PT)" : isAtLimit ? "Rate limit reached (Wait cooldown)" : isNearLimit ? "Near limit" : "Safe to generate"}
              </span>
              <span>{isDaily ? "100%" : `${Math.round((rpm / maxRpm) * 100)}%`} load</span>
            </div>
          </div>

          {/* Reset Countdown */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
              <span>{isDaily ? "Daily Reset" : localCooldown > 0 || isAtLimit ? "Cooldown Timer" : "Window Reset"}</span>
              <Clock className={`w-3.5 h-3.5 ${isDaily || isAtLimit ? "text-red-400" : "text-indigo-400"}`} />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold font-mono ${isDaily || isAtLimit ? "text-red-400 animate-pulse" : "text-neutral-100"}`}>
                {isDaily
                  ? "Midnight PT"
                  : localCooldown > 0
                  ? `${localCooldown}s`
                  : localWindowSecs > 0
                  ? `${localWindowSecs}s`
                  : isAtLimit
                  ? "30s"
                  : "0s"}
              </span>
              <span className="text-[11px] text-neutral-400">
                {isDaily ? "Google AI Studio daily reset" : localCooldown > 0 || isAtLimit ? "cooldown remaining" : "until next request slot"}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 line-clamp-1">
              {isDaily
                ? "Switch to another free Gemini key to generate now"
                : localCooldown > 0
                ? "Wait for timer before generating again"
                : localWindowSecs > 0
                ? "Slots free up automatically in rolling 60s"
                : "Full capacity available"}
            </p>
          </div>

          {/* Today's Activity & Reset */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
              <span>Today's Activity</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetTodayCount}
                  title="Reset today's clip counter"
                  className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-indigo-400">
                {quota.sessionGenerationsCount || 0}
              </span>
              <span className="text-[11px] text-neutral-400">clips today</span>
            </div>

            <p className="text-[11px] text-neutral-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Auto-resets daily (midnight PT)</span>
            </p>
          </div>
        </div>

        {/* Throttled Banner if active */}
        {localCooldown > 0 && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/80 rounded-xl flex items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>Rate Limit Active:</strong> Please pause for {localCooldown} seconds to allow the Gemini API quota window to reset.
              </span>
            </div>
            <span className="font-mono font-bold bg-red-900/60 px-2 py-1 rounded text-red-300 shrink-0">
              {localCooldown}s
            </span>
          </div>
        )}
      </div>

      {showModal && <QuotaInfoModal quota={quota} onClose={() => setShowModal(false)} />}
    </>
  );
};

interface QuotaInfoModalProps {
  quota: QuotaStatus;
  onClose: () => void;
}

const QuotaInfoModal: React.FC<QuotaInfoModalProps> = ({ quota, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-100">
              Gemini API Quota & Rate Limit Guide
            </h3>
            <p className="text-xs text-neutral-400">
              Understanding Google AI Studio's audio generation allowances
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-neutral-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          {/* Daily Limit Explanation */}
          <div className="p-3 bg-red-950/30 rounded-xl border border-red-800/40 space-y-1.5">
            <h4 className="font-bold text-red-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-red-400" />
              Daily Limit: 10 Audio Requests / Day on Free Tier
            </h4>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Google AI Studio enforces a strict hard cap of <strong>10 requests per day per project</strong> on preview audio models (such as <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">gemini-3.8-flash-lite-tts</code>).
            </p>
            <p className="text-[11px] text-neutral-400">
              When Google returns <code className="bg-black/40 px-1 py-0.5 rounded text-red-300">Generate content requests per day limit exceeded</code>, this quota resets at <strong>midnight Pacific Time (PT)</strong>.
            </p>
          </div>

          {/* Pause segments consuming quota */}
          <div className="p-3 bg-amber-950/25 rounded-xl border border-amber-800/40 space-y-1.5">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Why Did I Hit The Limit After Only 3 to 5 Clips?
            </h4>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              When your script uses silence pause tags like <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">[pause 2s]</code>, AST Studio splits your text into spoken segments, generates each part with Gemini, and seamlessly joins them with digital silence.
            </p>
            <p className="text-[11px] text-neutral-400">
              A script with 1 pause tag makes <strong>2 API calls</strong>. Generating 3 clips with pauses consumes 6 to 8 of your 10 daily requests!
            </p>
          </div>

          {/* Zero-Quota Browser Tools */}
          <div className="p-3 bg-emerald-950/25 rounded-xl border border-emerald-800/40 space-y-1.5">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pro-Tip: 0-Quota Client-Side Timing Tools
            </h4>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              AST Studio includes 100% free, local browser audio DSP tools inside the <strong>Audio Player</strong> below:
            </p>
            <ul className="space-y-1 list-disc list-inside text-[11px] text-neutral-400">
              <li><strong>Pad Silence to Exact Video Length:</strong> Pads the clip to exactly 7.0s or any duration using Web Audio API (0 API calls, 0 quota).</li>
              <li><strong>Insert Silence Gap:</strong> Adds custom silence anywhere inside your audio in your browser (0 API calls).</li>
            </ul>
          </div>

          {/* Rate Limit RPM */}
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
            <h4 className="font-bold text-neutral-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              Rolling 60-Second Window (3 to 5 RPM)
            </h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              In addition to the daily limit, Google limits requests to 3–5 per minute. If you hit a rate limit, the live countdown displays the exact remaining delay (e.g. 150s) and unlocks automatically.
            </p>
          </div>

          <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-800/40 text-neutral-300 space-y-1">
            <h4 className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Need higher quota?
            </h4>
            <p className="text-[11px] text-neutral-400">
              Create another free API key in Google AI Studio (<code className="text-neutral-300">aistudio.google.com/apikey</code>) and click <strong>Switch Key</strong>, or enable Pay-As-You-Go billing in Google Cloud for enterprise throughput.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
