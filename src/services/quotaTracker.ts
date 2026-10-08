import { QuotaStatus } from "../types/tts";
import { getStoredApiKey } from "./clientGeminiService";

const STORAGE_TIMESTAMPS_KEY = "ast_studio_quota_timestamps_v1";
const STORAGE_COOLDOWN_KEY = "ast_studio_quota_cooldown_v1";
const STORAGE_GENERATIONS_COUNT_KEY = "ast_studio_generations_count_v1";
const STORAGE_DAILY_EXCEEDED_KEY = "ast_studio_daily_quota_exceeded_v1";

const FREE_TIER_RPM_LIMIT = 5; // Standard Gemini TTS Free tier rate limit is 5 RPM

type QuotaSubscriber = (status: QuotaStatus) => void;
const subscribers = new Set<QuotaSubscriber>();

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
  // Send initial state immediately
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

/**
 * Record a new TTS generation request in the rolling 60-second window
 */
export function recordRequest(): QuotaStatus {
  const now = Date.now();
  const current = getStoredTimestamps();
  current.push(now);
  saveTimestamps(current);

  // Increment total session generations counter
  try {
    const count = parseInt(localStorage.getItem(STORAGE_GENERATIONS_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(STORAGE_GENERATIONS_COUNT_KEY, String(count));
  } catch {}

  const status = getQuotaStatus();
  notifySubscribers();
  return status;
}

/**
 * Record that Google Gemini returned a 429 Quota / Rate limit error
 */
export function recordQuotaExceeded(retrySeconds = 45, isDaily = false): QuotaStatus {
  const now = Date.now();
  const cooldownUntil = now + Math.max(15, retrySeconds) * 1000;
  setCooldownUntil(cooldownUntil);

  if (isDaily) {
    try {
      localStorage.setItem(STORAGE_DAILY_EXCEEDED_KEY, new Date().toISOString());
    } catch {}
  }

  const status = getQuotaStatus();
  notifySubscribers();
  return status;
}

/**
 * Clear cooldown manually or upon successful test
 */
export function clearQuotaCooldown(): void {
  try {
    localStorage.removeItem(STORAGE_COOLDOWN_KEY);
    localStorage.removeItem(STORAGE_DAILY_EXCEEDED_KEY);
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
  const isThrottled = cooldownRemaining > 0 || requestsInLastMinute >= FREE_TIER_RPM_LIMIT;
  const hasApiKey = !!getStoredApiKey();

  let sessionGenerationsCount = 0;
  try {
    sessionGenerationsCount = parseInt(
      localStorage.getItem(STORAGE_GENERATIONS_COUNT_KEY) || "0",
      10
    );
  } catch {}

  let isDailyLimitExceeded = false;
  try {
    const dailyRaw = localStorage.getItem(STORAGE_DAILY_EXCEEDED_KEY);
    if (dailyRaw) {
      const dailyDate = new Date(dailyRaw);
      if (
        new Date().toDateString() === dailyDate.toDateString() &&
        cooldownRemaining > 0
      ) {
        isDailyLimitExceeded = true;
      }
    }
  } catch {}

  return {
    requestsInLastMinute,
    freeTierRpmLimit: FREE_TIER_RPM_LIMIT,
    secondsUntilNextWindowSlot,
    cooldownRemaining,
    sessionGenerationsCount,
    isThrottled,
    hasApiKey,
    isDailyLimitExceeded,
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
} {
  const msg = err?.message || String(err || "");
  const lower = msg.toLowerCase();

  const isQuota =
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("exhausted") ||
    lower.includes("too many requests");

  const isDaily =
    lower.includes("per day") ||
    lower.includes("daily") ||
    lower.includes("day limit") ||
    (lower.includes("resource has been exhausted") && !lower.includes("minute"));

  // Check if error contains specific retry delay e.g. "retry after 32s" or "wait 30s"
  let retrySeconds = 45;
  const matchSeconds = lower.match(/(?:retry after|wait)\s*(\d+)\s*(?:s|sec|second)/);
  if (matchSeconds && matchSeconds[1]) {
    retrySeconds = parseInt(matchSeconds[1], 10);
  } else if (lower.match(/(\d+)\s*second/)) {
    const s = parseInt(lower.match(/(\d+)\s*second/)![1], 10);
    if (s > 0 && s <= 300) retrySeconds = s;
  }

  let friendlyDetails = "";
  if (isDaily) {
    friendlyDetails =
      "Your Google Gemini API key has reached its free-tier Daily Quota (RPD) for today. Google AI Studio resets free quotas daily at midnight Pacific Time (PT). You can switch to another free Gemini API key or enable pay-as-you-go billing in Google AI Studio.";
  } else if (isQuota) {
    friendlyDetails =
      `Your Google Gemini API key reached the free-tier Rate Limit (5 requests per minute). This is a standard Google AI Studio quota policy. Please wait ${retrySeconds} seconds for the quota slot to reset.`;
  }

  return {
    isQuota,
    isDaily,
    retrySeconds,
    message: isQuota ? "Gemini API Quota / Rate Limit Reached" : msg,
    details: friendlyDetails || msg,
  };
}

// Global 1-second ticker to update countdowns and notify subscribers
if (typeof window !== "undefined") {
  setInterval(() => {
    const status = getQuotaStatus();
    // Only notify if there are active countdowns to avoid redundant re-renders
    if (status.cooldownRemaining > 0 || status.secondsUntilNextWindowSlot > 0 || status.requestsInLastMinute > 0) {
      notifySubscribers();
    }
  }, 1000);
}
