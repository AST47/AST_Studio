import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateSpeech,
  enhanceScript,
  VOICES,
  GenerateTtsParams,
} from "./ttsService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const apiRouter = Router();

// Save uploaded logo directly to public/logo.png
apiRouter.post("/save-logo", (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "Missing dataUrl" });
    }
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const targetPath = path.resolve(__dirname, "../public/logo.png");
    fs.writeFileSync(targetPath, buffer);
    console.log("Successfully saved official logo to public/logo.png, size:", buffer.length);
    res.json({ success: true, size: buffer.length });
  } catch (err: any) {
    console.error("Failed to save logo to disk:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Rate limit & quota tracking
const requestTimestamps: number[] = [];
let sessionGenerationsCount = 0;
let lastQuotaErrorTimestamp: number | null = null;
let lastQuotaCooldownSeconds = 30;

function recordApiCall() {
  const now = Date.now();
  requestTimestamps.push(now);
  sessionGenerationsCount++;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
}

function recordQuotaErrorOccurred(retrySecs = 20) {
  lastQuotaErrorTimestamp = Date.now();
  lastQuotaCooldownSeconds = Math.min(30, Math.max(5, retrySecs));
  const now = Date.now();
  while (requestTimestamps.length < 5) {
    requestTimestamps.push(now);
  }
}

function resetQuotaTracking() {
  requestTimestamps.length = 0;
  lastQuotaErrorTimestamp = null;
  lastQuotaCooldownSeconds = 0;
}

function getQuotaStatus() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  const oldestInWindow = requestTimestamps[0];

  const cooldownRemaining = lastQuotaErrorTimestamp
    ? Math.max(0, Math.ceil((lastQuotaErrorTimestamp + lastQuotaCooldownSeconds * 1000 - now) / 1000))
    : 0;

  const secondsUntilNextWindowSlot = cooldownRemaining > 0
    ? cooldownRemaining
    : oldestInWindow
    ? Math.max(0, Math.ceil((oldestInWindow + 60000 - now) / 1000))
    : 0;

  const requestsInLastMinute = cooldownRemaining > 0
    ? Math.max(requestTimestamps.length, 5)
    : requestTimestamps.length;

  return {
    requestsInLastMinute,
    freeTierRpmLimit: 5,
    secondsUntilNextWindowSlot,
    cooldownRemaining,
    sessionGenerationsCount,
    isThrottled: cooldownRemaining > 0,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  };
}

// Quota status endpoint
apiRouter.get("/quota-status", (req, res) => {
  res.json(getQuotaStatus());
});

// Reset quota endpoint
apiRouter.post("/reset-quota", (req, res) => {
  resetQuotaTracking();
  res.json(getQuotaStatus());
});

// Voice catalog
apiRouter.get("/voices", (req, res) => {
  res.json({
    voices: VOICES,
  });
});

function extractRetryDelaySeconds(rawMsg: string, error: any): number {
  if (Array.isArray(error?.details)) {
    for (const d of error.details) {
      if (d?.retryDelay) {
        const parsed = parseInt(String(d.retryDelay).replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsed) && parsed > 0) return Math.min(30, parsed);
      }
    }
  }
  const match = rawMsg.match(/retry in\s+([0-9.]+)\s*s/i);
  if (match && match[1]) {
    const parsed = Math.ceil(parseFloat(match[1]));
    if (!isNaN(parsed) && parsed > 0) return Math.min(30, parsed);
  }
  return 20;
}

function formatGeminiError(error: any): {
  message: string;
  isQuotaExceeded: boolean;
  isDaily?: boolean;
  retryDelaySeconds?: number;
  details?: string;
  rawError?: string;
} {
  const rawMsg = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
  const lower = rawMsg.toLowerCase();
  const isQuota =
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    lower.includes("quota") ||
    lower.includes("rate limit");

  // Only classify as daily quota exhaustion when explicitly stated:
  const isDaily =
    lower.includes("per day") ||
    lower.includes("per_day") ||
    lower.includes("requests_per_day") ||
    lower.includes("daily quota") ||
    lower.includes("daily limit") ||
    lower.includes("day limit") ||
    lower.includes("rpd") ||
    (lower.includes("quota exceeded") && (lower.includes("day") || lower.includes("24 hour")));

  if (isDaily) {
    return {
      message: "Google Gemini Daily Quota Limit Reached",
      isQuotaExceeded: true,
      isDaily: true,
      retryDelaySeconds: 30,
      details: "Your Google Gemini API key reached its free-tier daily quota limit. Google AI Studio resets free quotas daily at midnight Pacific Time (PT). You can attach another free Gemini API key to continue generating.",
      rawError: rawMsg,
    };
  }

  if (isQuota) {
    const retrySecs = extractRetryDelaySeconds(rawMsg, error);
    return {
      message: `Gemini API Quota Limit Reached (Retry in ${retrySecs}s)`,
      isQuotaExceeded: true,
      isDaily: false,
      retryDelaySeconds: retrySecs,
      details: `Google Gemini API has temporarily rate-limited audio requests on this key (5 requests per minute). Please pause for ${retrySecs} seconds before generating again.`,
      rawError: rawMsg,
    };
  }

  return {
    message: rawMsg.replace(/^{.*"message":"([^"]+)".*}$/, "$1") || "Speech generation failed.",
    isQuotaExceeded: false,
    rawError: rawMsg,
  };
}

// Generate speech
apiRouter.post("/tts", async (req, res) => {
  try {
    const params: GenerateTtsParams = req.body;
    if (!params) {
      return res.status(400).json({ error: "Missing request body" });
    }

    const customApiKey =
      (req.headers["x-gemini-api-key"] as string) ||
      (req.body as any)?.customApiKey ||
      undefined;

    recordApiCall();
    const result = await generateSpeech(params, customApiKey);
    res.json({
      ...result,
      quotaStatus: getQuotaStatus(),
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    const parsed = formatGeminiError(error);
    if (parsed.isQuotaExceeded) {
      recordQuotaErrorOccurred(parsed.retryDelaySeconds);
    }
    res.status(parsed.isQuotaExceeded ? 429 : 500).json({
      error: parsed.message,
      isQuotaExceeded: parsed.isQuotaExceeded,
      isDaily: parsed.isDaily,
      retryDelaySeconds: parsed.retryDelaySeconds,
      details: parsed.details,
      rawError: parsed.rawError,
      quotaStatus: getQuotaStatus(),
    });
  }
});

// Enhance script with Gemini Flash
apiRouter.post("/enhance-script", async (req, res) => {
  try {
    const { action, prompt } = req.body;
    if (!prompt || !action) {
      return res.status(400).json({ error: "Prompt and action are required." });
    }

    recordApiCall();
    const result = await enhanceScript({ action, prompt });
    res.json({
      ...result,
      quotaStatus: getQuotaStatus(),
    });
  } catch (error: any) {
    console.error("Script enhancement error:", error);
    const parsed = formatGeminiError(error);
    if (parsed.isQuotaExceeded) {
      recordQuotaErrorOccurred(parsed.retryDelaySeconds);
    }
    res.status(parsed.isQuotaExceeded ? 429 : 500).json({
      error: parsed.message,
      isQuotaExceeded: parsed.isQuotaExceeded,
      retryDelaySeconds: parsed.retryDelaySeconds,
      details: parsed.details,
      quotaStatus: getQuotaStatus(),
    });
  }
});
