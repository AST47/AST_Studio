import { VoiceName, DialogueTurn, QuotaStatus, SupportedLanguage } from "../types/tts";
import {
  generateClientSpeech,
  enhanceClientScript,
  getStoredApiKey,
} from "./clientGeminiService";
import {
  recordRequest,
  recordQuotaExceeded,
  getQuotaStatus,
  parseGeminiError,
  subscribeToQuota,
} from "./quotaTracker";

export { subscribeToQuota };

export interface GenerateSingleTtsRequest {
  mode: "single";
  text: string;
  voice: VoiceName;
  style?: string;
  language?: SupportedLanguage;
  model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
}

export interface GenerateDialogueTtsRequest {
  mode: "dialogue";
  language?: SupportedLanguage;
  turns: {
    speaker: string;
    voice: VoiceName;
    text: string;
    style?: string;
  }[];
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
  duration: number;
  modelUsed: string;
  voice?: VoiceName;
  speakers?: { name: string; voice: VoiceName }[];
  sampleRate: number;
  quotaStatus?: QuotaStatus;
}

export class ApiError extends Error {
  isQuotaExceeded: boolean;
  retryDelaySeconds?: number;
  details?: string;

  constructor(
    message: string,
    isQuotaExceeded = false,
    details?: string,
    retryDelaySeconds?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.isQuotaExceeded = isQuotaExceeded;
    this.details = details;
    this.retryDelaySeconds = retryDelaySeconds;
  }
}

export async function requestTts(
  params: GenerateSingleTtsRequest | GenerateDialogueTtsRequest
): Promise<TtsResponse> {
  // If user provided a client-side API key and we are in static mode (or by preference), use client directly
  const hasClientKey = !!getStoredApiKey();

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const contentType = response.headers.get("content-type") || "";

    // If 404 on static host (like GitHub Pages where /api/tts doesn't exist), try client fallback
    if (response.status === 404 || !contentType.includes("application/json")) {
      try {
        const clientRes = await generateClientSpeech(params as any);
        recordRequest();
        return {
          ...clientRes,
          quotaStatus: getQuotaStatus(),
        };
      } catch (clientErr: any) {
        if (clientErr.message === "NO_API_KEY") {
          throw new ApiError(
            "API_KEY_REQUIRED",
            false,
            "Please click the 'API Key' button in the top bar to connect your Google Gemini API key for this static site."
          );
        }
        const parsed = parseGeminiError(clientErr);
        if (parsed.isQuota) {
          recordQuotaExceeded(parsed.retrySeconds, parsed.isDaily);
        }
        throw new ApiError(parsed.message, parsed.isQuota, parsed.details, parsed.retrySeconds);
      }
    }

    if (!response.ok) {
      let errorMessage = "Speech generation failed";
      let isQuotaExceeded = false;
      let details: string | undefined;
      let retryDelaySeconds: number | undefined;

      try {
        const errData = await response.json();
        if (errData.error) errorMessage = errData.error;
        if (errData.isQuotaExceeded) isQuotaExceeded = true;
        if (errData.details) details = errData.details;
        if (errData.retryDelaySeconds) retryDelaySeconds = errData.retryDelaySeconds;
      } catch {
        errorMessage = `Server returned status ${response.status}`;
      }

      if (isQuotaExceeded) {
        recordQuotaExceeded(retryDelaySeconds || 45);
      }

      throw new ApiError(errorMessage, isQuotaExceeded, details, retryDelaySeconds);
    }

    recordRequest();
    return response.json();
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network failure or static environment without Express server
    try {
      const clientRes = await generateClientSpeech(params as any);
      recordRequest();
      return {
        ...clientRes,
        quotaStatus: getQuotaStatus(),
      };
    } catch (clientErr: any) {
      if (clientErr.message === "NO_API_KEY") {
        throw new ApiError(
          "API_KEY_REQUIRED",
          false,
          "Please click the 'API Key' button in the top bar to connect your Google Gemini API key for this static site."
        );
      }
      const parsed = parseGeminiError(clientErr);
      if (parsed.isQuota) {
        recordQuotaExceeded(parsed.retrySeconds, parsed.isDaily);
      }
      throw new ApiError(parsed.message, parsed.isQuota, parsed.details, parsed.retrySeconds);
    }
  }
}

export async function requestScriptEnhance(
  action: "polish" | "expressive" | "podcast" | "shorten" | "dramatic" | "accentuate",
  prompt: string
): Promise<string> {
  try {
    const response = await fetch("/api/enhance-script", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, prompt }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (response.status === 404 || !contentType.includes("application/json")) {
      return await enhanceClientScript(action, prompt);
    }

    if (!response.ok) {
      let errorMessage = "Script enhancement failed";
      let isQuotaExceeded = false;
      let details: string | undefined;
      let retryDelaySeconds: number | undefined;

      try {
        const errData = await response.json();
        if (errData.error) errorMessage = errData.error;
        if (errData.isQuotaExceeded) isQuotaExceeded = true;
        if (errData.details) details = errData.details;
        if (errData.retryDelaySeconds) retryDelaySeconds = errData.retryDelaySeconds;
      } catch {
        errorMessage = `Server returned ${response.status}`;
      }

      throw new ApiError(errorMessage, isQuotaExceeded, details, retryDelaySeconds);
    }

    const data = await response.json();
    return data.result || "";
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    try {
      return await enhanceClientScript(action, prompt);
    } catch (clientErr: any) {
      if (clientErr.message === "NO_API_KEY") {
        throw new ApiError(
          "API_KEY_REQUIRED",
          false,
          "Please enter your Google Gemini API key to use AI Script Assistant on GitHub Pages."
        );
      }
      throw clientErr;
    }
  }
}

export async function checkServerHealth(): Promise<{ status: string; hasApiKey: boolean }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { status: "error", hasApiKey: false };
    return res.json();
  } catch {
    return { status: "offline", hasApiKey: false };
  }
}

export async function fetchQuotaStatus(): Promise<QuotaStatus> {
  const localStatus = getQuotaStatus();
  try {
    const res = await fetch("/api/quota-status");
    if (!res.ok) {
      return localStatus;
    }
    const serverStatus = await res.json();
    // Prioritize active cooldown or higher local request counts
    if (localStatus.cooldownRemaining > (serverStatus.cooldownRemaining || 0) || localStatus.requestsInLastMinute > (serverStatus.requestsInLastMinute || 0)) {
      return {
        ...serverStatus,
        ...localStatus,
      };
    }
    return serverStatus;
  } catch {
    return localStatus;
  }
}
