/**
 * Downsamples and slices audio into a lightweight, high-fidelity 16kHz mono WAV snippet (max 8-10s)
 * perfectly optimized for Gemini Multimodal Acoustic Analysis without hitting network or API timeouts.
 */

export async function prepareAudioForAcousticAnalysis(
  input: Blob | ArrayBuffer | string,
  maxDurationSeconds = 10
): Promise<{ base64: string; mimeType: string; durationSec: number }> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (typeof input === "string") {
      // Base64 string
      const clean = input.replace(/^data:audio\/\w+;base64,/, "");
      const binaryString = atob(clean);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else if (input instanceof Blob) {
      arrayBuffer = await input.arrayBuffer();
    } else {
      arrayBuffer = input;
    }

    // Use Web Audio API to decode and downsample
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API not supported in this environment");
    }

    const audioCtx = new AudioContextClass();
    let audioBuffer: AudioBuffer;

    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      if (audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
    }

    const targetSampleRate = 16000;
    const originalDuration = audioBuffer.duration;
    // Cap snippet duration between 4s and maxDurationSeconds (ideal 8s)
    const snippetDuration = Math.min(originalDuration, maxDurationSeconds);
    const targetLength = Math.floor(snippetDuration * targetSampleRate);

    // Render downsampled mono audio via OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);

    // Create source buffer
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const monoChannelData = renderedBuffer.getChannelData(0);

    // Encode to 16-bit PCM WAV
    const wavBuffer = encodeWav16Bit(monoChannelData, targetSampleRate);
    const base64Wav = arrayBufferToBase64(wavBuffer);

    return {
      base64: base64Wav,
      mimeType: "audio/wav",
      durationSec: Number(snippetDuration.toFixed(1)),
    };
  } catch (err) {
    console.warn("[audioDownsampler] Fallback to raw audio due to decode failure:", err);
    // Fallback: If Web Audio decoding fails (e.g. rare codec), return raw input if string or convert blob
    if (typeof input === "string") {
      return {
        base64: input.replace(/^data:audio\/\w+;base64,/, ""),
        mimeType: "audio/wav",
        durationSec: 10,
      };
    } else if (input instanceof Blob) {
      const b64 = await blobToBase64(input);
      return {
        base64: b64,
        mimeType: input.type || "audio/wav",
        durationSec: 10,
      };
    } else {
      return {
        base64: arrayBufferToBase64(input),
        mimeType: "audio/wav",
        durationSec: 10,
      };
    }
  }
}

function encodeWav16Bit(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples clamped to [-1, 1]
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    // Scale to 16-bit signed int
    let val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
