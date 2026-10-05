import { VoiceName, DialogueTurn, QuotaStatus } from "../types/tts";

export interface GenerateSingleTtsRequest {
  mode: "single";
  text: string;
  voice: VoiceName;
  style?: string;
  language?: string;
  model?: "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";
}

export interface GenerateDialogueTtsRequest {
  mode: "dialogue";
  language?: string;
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
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMessage = "Speech generation failed";
    let isQuotaExceeded = false;
    let details: string | undefined;
    let retryDelaySeconds: number | undefined;

    if (contentType.includes("application/json")) {
      try {
        const errData = await response.json();
        if (errData.error) errorMessage = errData.error;
        if (errData.isQuotaExceeded) isQuotaExceeded = true;
        if (errData.details) details = errData.details;
        if (errData.retryDelaySeconds) retryDelaySeconds = errData.retryDelaySeconds;
      } catch {
        errorMessage = `Server returned status ${response.status}`;
      }
    } else {
      const text = await response.text();
      errorMessage = text.slice(0, 150) || `Server returned status ${response.status}`;
    }

    throw new ApiError(errorMessage, isQuotaExceeded, details, retryDelaySeconds);
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new ApiError(`Unexpected server response: ${text.slice(0, 80)}`, false);
  }

  return response.json();
}

export async function requestScriptEnhance(
  action: "polish" | "expressive" | "podcast" | "shorten" | "dramatic" | "accentuate",
  prompt: string
): Promise<string> {
  const response = await fetch("/api/enhance-script", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, prompt }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let errorMessage = "Script enhancement failed";
    let isQuotaExceeded = false;
    let details: string | undefined;
    let retryDelaySeconds: number | undefined;

    if (contentType.includes("application/json")) {
      try {
        const errData = await response.json();
        if (errData.error) errorMessage = errData.error;
        if (errData.isQuotaExceeded) isQuotaExceeded = true;
        if (errData.details) details = errData.details;
        if (errData.retryDelaySeconds) retryDelaySeconds = errData.retryDelaySeconds;
      } catch {
        errorMessage = `Server returned ${response.status}`;
      }
    } else {
      const text = await response.text();
      errorMessage = text.slice(0, 150) || `Server returned ${response.status}`;
    }

    throw new ApiError(errorMessage, isQuotaExceeded, details, retryDelaySeconds);
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new ApiError(`Unexpected response from server: ${text.slice(0, 80)}`, false);
  }

  const data = await response.json();
  return data.result || "";
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
  try {
    const res = await fetch("/api/quota-status");
    if (!res.ok) {
      return {
        requestsInLastMinute: 0,
        freeTierRpmLimit: 5,
        secondsUntilNextWindowSlot: 0,
        cooldownRemaining: 0,
        sessionGenerationsCount: 0,
        isThrottled: false,
        hasApiKey: true,
      };
    }
    return res.json();
  } catch {
    return {
      requestsInLastMinute: 0,
      freeTierRpmLimit: 5,
      secondsUntilNextWindowSlot: 0,
      cooldownRemaining: 0,
      sessionGenerationsCount: 0,
      isThrottled: false,
      hasApiKey: false,
    };
  }
}
