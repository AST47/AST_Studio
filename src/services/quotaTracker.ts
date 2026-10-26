import { QuotaStatus } from "../types/tts";
import { getStoredApiKey } from "./clientGeminiService";

const STORAGE_TIMESTAMPS_KEY = "ast_studio_quota_timestamps_v1";
const STORAGE_COOLDOWN_KEY = "ast_studio_quota_cooldown_v1";
const STORAGE_TODAY_DATE_KEY = "ast_studio_today_date_v2";
const STORAGE_TODAY_COUNT_KEY = "ast_studio_today_count_v2";
const STORAGE_DAILY_EXCEEDED_KEY = "ast_studio_daily_quota_exceeded_v1";

const FREE_TIER_RPM_LIMIT = 5; // Standard Gemini TTS Free tier rate limit is 5 RPM

type QuotaSubscriber = (status: QuotaStatus) => void;
const subscribers = new Set<QuotaSubscriber>();

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStoredTimestamps(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_TIMESTAMPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    // Keep only timestamps within the rolling 60-second window
    return parsed.filter((t) => typeof t === "number" && now - t < 60000);
  } catch {
    return [];
  }
}

function saveTimestamps(timestamps: number[]) {
  try {
    localStorage.setItem(STORAGE_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch (e) {
    console.error("Failed to save timestamps", e);
  }
}

function getCooldownUntil(): number {
  try {
    const raw = localStorage.getItem(STORAGE_COOLDOWN_KEY);
    if (!raw) return 0;
    const until = parseInt(raw, 10);
    return isNaN(until) ? 0 : until;
  } catch {
    return 0;
  }
}

function setCooldownUntil(until: number) {
  try {
    if (until <= Date.now()) {
      localStorage.removeItem(STORAGE_COOLDOWN_KEY);
    } else {
      localStorage.setItem(STORAGE_COOLDOWN_KEY, String(until));
    }
  } catch (e) {
    console.error("Failed to save cooldown", e);
  }
}

export function subscribeToQuota(callback: QuotaSubscriber): () => void {
  subscribers.add(callback);
  callback(getQuotaStatus());
  return () => {
    subscribers.delete(callback);
  };
}

export function notifySubscribers() {
  const current = getQuotaStatus();
  subscribers.forEach((cb) => {
    try {
      cb(current);
    } catch (e) {
      console.error("Quota subscriber error", e);
    }
  });
}

// Immediate self-heal on load: purge legacy counters and locks
if (typeof window !== "undefined") {
  try {
    // Purge old cumulative count (which showed 141)
    localStorage.removeItem("ast_studio_generations_count_v1");
    localStorage.removeItem(STORAGE_DAILY_EXCEEDED_KEY);
  } catch {}
}

export function getTodayGenerationsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const todayStr = getTodayDateStr();
    const storedDate = localStorage.getItem(STORAGE_TODAY_DATE_KEY);
    if (storedDate !== todayStr) {
      // New day: reset today's counter to 0
      localStorage.setItem(STORAGE_TODAY_DATE_KEY, todayStr);
      localStorage.setItem(STORAGE_TODAY_COUNT_KEY, "0");
      return 0;
    }
    const raw = localStorage.getItem(STORAGE_TODAY_COUNT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function incrementTodayGenerationsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const todayStr = getTodayDateStr();
    const count = getTodayGenerationsCount() + 1;
    localStorage.setItem(STORAGE_TODAY_DATE_KEY, todayStr);
    localStorage.setItem(STORAGE_TODAY_COUNT_KEY, String(count));
    return count;
  } catch {
    return 1;
  }
}

export function resetGenerationsCount(): void {
  if (typeof window === "undefined") return;
  try {
    const todayStr = getTodayDateStr();
    localStorage.setItem(STORAGE_TODAY_DATE_KEY, todayStr);
    localStorage.setItem(STORAGE_TODAY_COUNT_KEY, "0");
    localStorage.removeItem("ast_studio_generations_count_v1");
  } catch {}
  notifySubscribers();
}

/**
 * Record a new TTS generation request in the rolling 60-second window
 */
export function recordRequest(): QuotaStatus {
  const now = Date.now();
  const current = getStoredTimestamps();
  current.push(now);
  saveTimestamps(current);

  // Increment today's count
  incrementTodayGenerationsCount();

  const status = getQuotaStatus();
  notifySubscribers();
  return status;
}

/**
 * Record that Google Gemini returned a 429 Quota / Rate limit error
 */
export function recordQuotaExceeded(retrySeconds = 20, isDaily = false): QuotaStatus {
  const now = Date.now();
  // Allow cooldown up to 300s (5 minutes) if Google specifies a delay, min 5s
  const safeCooldown = Math.max(5, Math.min(300, retrySeconds));
  const cooldownUntil = now + safeCooldown * 1000;
  setCooldownUntil(cooldownUntil);

  const status = getQuotaStatus();
  notifySubscribers();
  return status;
}

/**
 * Clear cooldown manually or upon successful key change
 */
export function clearQuotaCooldown(): void {
  try {
    localStorage.removeItem(STORAGE_COOLDOWN_KEY);
    localStorage.removeItem(STORAGE_DAILY_EXCEEDED_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMPS_KEY);
  } catch {}
  notifySubscribers();
}

/**
 * Returns accurate real-time QuotaStatus
 */
export function getQuotaStatus(): QuotaStatus {
  const now = Date.now();
  const timestamps = getStoredTimestamps();
  const oldest = timestamps[0];

  const secondsUntilNextWindowSlot = oldest
    ? Math.max(0, Math.ceil((oldest + 60000 - now) / 1000))
    : 0;

  const cooldownUntil = getCooldownUntil();
  const cooldownRemaining =
    cooldownUntil > now ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  const requestsInLastMinute = timestamps.length;
  const isThrottled = cooldownRemaining > 0;
  const hasApiKey = !!getStoredApiKey();
  const sessionGenerationsCount = getTodayGenerationsCount();

  return {
    requestsInLastMinute,
    freeTierRpmLimit: FREE_TIER_RPM_LIMIT,
    secondsUntilNextWindowSlot: cooldownRemaining > 0 ? cooldownRemaining : secondsUntilNextWindowSlot,
    cooldownRemaining,
    sessionGenerationsCount,
    isThrottled,
    hasApiKey,
    isDailyLimitExceeded: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse raw Google GenAI errors into actionable quota details
 */
export function parseGeminiError(err: any): {
  isQuota: boolean;
  isDaily: boolean;
  retrySeconds: number;
  message: string;
  details: string;
  rawError: string;
} {
  const rawError = err?.message || (typeof err === "string" ? err : JSON.stringify(err || ""));
  const lower = rawError.toLowerCase();

  const isQuota =
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("exhausted") ||
    lower.includes("too many requests");

  let retrySeconds = 30;
  let parsedExactDelay = false;

  // 1. Check error details array for RetryInfo or delay
  const detailArrays = [err?.details, err?.error?.details];
  for (const arr of detailArrays) {
    if (Array.isArray(arr)) {
      for (const d of arr) {
        if (d?.retryDelay) {
          const parsed = parseInt(String(d.retryDelay).replace(/[^0-9]/g, ""), 10);
          if (!isNaN(parsed) && parsed > 0) {
            retrySeconds = parsed;
            parsedExactDelay = true;
          }
        }
      }
    }
  }

  // 2. Check "retry in XmYs" (minutes and seconds) e.g. "retry in 2m31.125s"
  const minSecMatch = rawError.match(/retry in\s*(\d+)m\s*([\d.]+)s/i);
  if (minSecMatch) {
    const s = parseInt(minSecMatch[1], 10) * 60 + Math.ceil(parseFloat(minSecMatch[2]));
    if (!isNaN(s) && s > 0) {
      retrySeconds = s;
      parsedExactDelay = true;
    }
  } else {
    const secMatch = rawError.match(/retry in\s*([\d.]+)s/i);
    if (secMatch) {
      const s = Math.ceil(parseFloat(secMatch[1]));
      if (!isNaN(s) && s > 0) {
        retrySeconds = s;
        parsedExactDelay = true;
      }
    }
  }

  const hasDailyWords =
    lower.includes("per day") ||
    lower.includes("per_day") ||
    lower.includes("requests_per_day") ||
    lower.includes("daily quota") ||
    lower.includes("daily limit");

  // If Google provides a retry window under 10 minutes (like 2m31s), treat it as a temporary rate limit cooldown with live countdown!
  const isDaily = hasDailyWords && (!parsedExactDelay || retrySeconds > 600);

  let friendlyDetails = "";
  if (isDaily) {
    friendlyDetails =
      "Your Google Gemini API key has reached its free-tier Daily Quota (limit: 10 requests/day on preview models). Google AI Studio resets free quotas daily at midnight Pacific Time (PT). You can switch to another free Gemini API key to continue generating immediately.";
  } else if (isQuota) {
    if (parsedExactDelay && retrySeconds > 60) {
      const mins = Math.floor(retrySeconds / 60);
      const secs = retrySeconds % 60;
      friendlyDetails = `Google's free-tier rate limit was reached (limit: 10 requests per bucket). Google has scheduled your slot to reopen in ${mins}m ${secs}s. You can wait for the live countdown, click 'Clear Cooldown' to retry, or switch to another free Gemini API key now.`;
    } else {
      friendlyDetails = `Your Google Gemini API key reached the free-tier Rate Limit (5 requests per minute). Please wait ${retrySeconds} seconds for the quota slot to reset, or switch to another free key.`;
    }
  }

  return {
    isQuota,
    isDaily,
    retrySeconds: Math.max(5, Math.min(300, retrySeconds)),
    message: isDaily
      ? "Google Gemini Daily Quota Limit (10/Day Reached)"
      : isQuota
      ? parsedExactDelay && retrySeconds > 60
        ? `Rate Limit Reached (Retry in ${Math.ceil(retrySeconds / 60)} min)`
        : "Gemini API Rate Limit Reached"
      : rawError,
    details: friendlyDetails || rawError,
    rawError,
  };
}

// Global 1-second ticker to update countdowns and notify subscribers
if (typeof window !== "undefined") {
  setInterval(() => {
    const status = getQuotaStatus();
    if (status.cooldownRemaining > 0 || status.secondsUntilNextWindowSlot > 0 || status.requestsInLastMinute > 0) {
      notifySubscribers();
    }
  }, 1000);
}
