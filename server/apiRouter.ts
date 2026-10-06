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

function recordQuotaErrorOccurred(retrySecs = 30) {
  lastQuotaErrorTimestamp = Date.now();
  lastQuotaCooldownSeconds = Math.max(5, retrySecs);
}

function getQuotaStatus() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  const oldestInWindow = requestTimestamps[0];
  const secondsUntilNextWindowSlot = oldestInWindow
    ? Math.max(0, Math.ceil((oldestInWindow + 60000 - now) / 1000))
    : 0;

  const cooldownRemaining = lastQuotaErrorTimestamp
    ? Math.max(0, Math.ceil((lastQuotaErrorTimestamp + lastQuotaCooldownSeconds * 1000 - now) / 1000))
    : 0;

  return {
    requestsInLastMinute: requestTimestamps.length,
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
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }
  const match = rawMsg.match(/retry in\s+([0-9.]+)\s*s/i);
  if (match && match[1]) {
    const parsed = Math.ceil(parseFloat(match[1]));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 30;
}

function formatGeminiError(error: any): {
  message: string;
  isQuotaExceeded: boolean;
  retryDelaySeconds?: number;
  details?: string;
} {
  const rawMsg = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
  const isQuota =
    rawMsg.includes("429") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.toLowerCase().includes("quota") ||
    rawMsg.toLowerCase().includes("rate limit");

  if (isQuota) {
    const retrySecs = extractRetryDelaySeconds(rawMsg, error);
    return {
      message: `Gemini API Quota Limit Reached (Retry in ${retrySecs}s)`,
      isQuotaExceeded: true,
      retryDelaySeconds: retrySecs,
      details: `Google Gemini API has temporarily rate-limited audio requests on this free-tier project key. Please pause for ${retrySecs} seconds before generating again.`,
    };
  }

  return {
    message: rawMsg.replace(/^{.*"message":"([^"]+)".*}$/, "$1") || "Speech generation failed.",
    isQuotaExceeded: false,
  };
}

// Generate speech
apiRouter.post("/tts", async (req, res) => {
  try {
    const params: GenerateTtsParams = req.body;
    if (!params) {
      return res.status(400).json({ error: "Missing request body" });
    }

    recordApiCall();
    const result = await generateSpeech(params);
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
      retryDelaySeconds: parsed.retryDelaySeconds,
      details: parsed.details,
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
