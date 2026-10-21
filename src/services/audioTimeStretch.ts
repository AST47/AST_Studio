/**
 * audioTimeStretch.ts
 * High-quality pitch-preserving time-scale modification (SOLA - Synchronous Overlap Add)
 * and Web Audio utilities to precisely match voiceover timing to video clip durations.
 */

/**
 * Decode a base64 WAV string into an AudioBuffer using the browser's AudioContext
 */
export async function decodeBase64ToAudioBuffer(
  base64Audio: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer.slice(0));
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Uint8Array
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = audioBuffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data subchunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, Math.round(intSample), true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Converts a Uint8Array to a base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Pitch-preserving Time Scale Modification (SOLA - Synchronous Overlap-Add).
 * Stretches or compresses speech duration to targetDurationSec while keeping original vocal pitch.
 */
export function solaTimeStretch(
  inputData: Float32Array,
  sampleRate: number,
  targetDurationSec: number
): Float32Array {
  const originalDurationSec = inputData.length / sampleRate;
  if (originalDurationSec <= 0 || targetDurationSec <= 0) return inputData;

  // speedFactor > 1 means faster (shorter duration), < 1 means slower (longer duration)
  const speedFactor = originalDurationSec / targetDurationSec;

  // If change is negligible (< 1%), return original
  if (Math.abs(speedFactor - 1.0) < 0.005) {
    return inputData;
  }

  // SOLA parameters tuned for 24kHz speech
  // Window size ~30ms
  const windowSize = Math.round(sampleRate * 0.03); 
  // Synthesis hop size ~15ms
  const synthHop = Math.round(windowSize / 2);
  // Analysis hop size
  const analysisHop = Math.round(synthHop * speedFactor);
  // Max search offset for cross-correlation (~10ms)
  const maxSearch = Math.round(sampleRate * 0.01);

  const targetSamples = Math.round(targetDurationSec * sampleRate);
  const output = new Float32Array(targetSamples);

  // Initialize output with first window
  const initLen = Math.min(windowSize, inputData.length, targetSamples);
  for (let i = 0; i < initLen; i++) {
    output[i] = inputData[i];
  }

  let inPos = analysisHop;
  let outPos = synthHop;

  while (outPos + windowSize < targetSamples && inPos + windowSize + maxSearch < inputData.length) {
    // Find optimal offset using normalized cross-correlation
    let bestOffset = 0;
    let maxCorrelation = -Infinity;

    for (let offset = 0; offset < maxSearch; offset++) {
      let correlation = 0;
      let power1 = 0;
      let power2 = 0;

      for (let j = 0; j < windowSize; j += 2) {
        const outSample = output[outPos + j];
        const inSample = inputData[inPos + offset + j];
        correlation += outSample * inSample;
        power1 += outSample * outSample;
        power2 += inSample * inSample;
      }

      const denom = Math.sqrt(power1 * power2) + 1e-6;
      const normalizedCorr = correlation / denom;

      if (normalizedCorr > maxCorrelation) {
        maxCorrelation = normalizedCorr;
        bestOffset = offset;
      }
    }

    // Overlap-add with linear crossfade
    const bestInPos = inPos + bestOffset;
    for (let j = 0; j < windowSize; j++) {
      const alpha = j / windowSize; // 0 to 1 fade-in for new frame
      const currentIdx = outPos + j;
      if (currentIdx < targetSamples) {
        const existing = output[currentIdx];
        const incoming = inputData[bestInPos + j];
        output[currentIdx] = existing * (1 - alpha) + incoming * alpha;
      }
    }

    outPos += synthHop;
    inPos += analysisHop;
  }

  return output;
}

/**
 * Time stretch an entire AudioBuffer to a target duration preserving pitch,
 * and return the new base64 WAV string and duration.
 */
export async function fitAudioToTargetDuration(
  audioBase64: string,
  targetDurationSec: number
): Promise<{
  audioBase64: string;
  duration: number;
  speedRatio: number;
}> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffer = await decodeBase64ToAudioBuffer(audioBase64, ctx);
    const originalDuration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;

    const stretchedChannels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      const stretched = solaTimeStretch(channelData, sampleRate, targetDurationSec);
      stretchedChannels.push(stretched);
    }

    const newLength = stretchedChannels[0].length;
    const newBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      newBuffer.copyToChannel(stretchedChannels[c], c);
    }

    const wavBytes = encodeAudioBufferToWav(newBuffer);
    const newBase64 = uint8ArrayToBase64(wavBytes);
    const actualDuration = Number((newLength / sampleRate).toFixed(2));
    const speedRatio = Number((originalDuration / actualDuration).toFixed(2));

    return {
      audioBase64: newBase64,
      duration: actualDuration,
      speedRatio,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

export interface ScriptSegment {
  type: "speech" | "silence";
  text?: string;
  durationSec?: number;
  isAuto?: boolean;
}

export const SILENCE_TAG_REGEX = /(?:\[\s*(?:pause|silence|wait|gap)\s*(?::\s*)?(auto|\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?\s*\]|\[\s*(?:pause|silence)\s*\]|<break\s+time=["']?(\d+(?:\.\d+)?)(s|ms)?["']?\s*\/?>|\(\s*(?:(?:pause|silence)\s*(?::\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?|(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\s+(?:pause|silence))\s*\)|\(\s*(?:pause|silence)\s*\))/gi;

/**
 * Checks if a script contains explicit silence/pause tags
 */
export function hasSilenceTags(text: string): boolean {
  if (!text) return false;
  return /(?:\[\s*(?:pause|silence|wait|gap)|<break\s+time=|\(\s*(?:pause|silence|\d+s\s+pause))/i.test(text);
}

/**
 * Parses script text into sequential speech parts and silence intervals
 */
export function parseScriptPauseSegments(text: string): ScriptSegment[] {
  if (!text || !text.trim()) return [];

  const segments: ScriptSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex index
  SILENCE_TAG_REGEX.lastIndex = 0;

  while ((match = SILENCE_TAG_REGEX.exec(text)) !== null) {
    const speechText = text.substring(lastIndex, match.index).trim();
    if (speechText) {
      segments.push({ type: "speech", text: speechText });
    }

    const tagStr = match[0].toLowerCase();
    let durationSec = 1.5; // default fallback
    let isAuto = false;

    if (tagStr.includes("auto")) {
      isAuto = true;
      durationSec = 2.0; // default initial placeholder
    } else if (match[1]) {
      durationSec = parseFloat(match[1]);
    } else if (match[2]) {
      const val = parseFloat(match[2]);
      durationSec = match[3] === "ms" ? val / 1000 : val;
    } else if (match[4]) {
      durationSec = parseFloat(match[4]);
    } else if (match[5]) {
      durationSec = parseFloat(match[5]);
    }

    segments.push({
      type: "silence",
      durationSec: Math.max(0.1, Number(durationSec.toFixed(2))),
      isAuto,
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    segments.push({ type: "speech", text: remaining });
  }

  return segments;
}

/**
 * Pads a base64 WAV with pure digital silence to reach an exact target duration.
 * Keeps spoken voice at 100% natural conversational pitch and tempo.
 */
export async function padAudioWithSilence(
  audioBase64: string,
  targetDurationSec: number,
  placement: "end" | "start" | "both" = "end"
): Promise<{
  audioBase64: string;
  duration: number;
  silenceAddedSec: number;
}> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffer = await decodeBase64ToAudioBuffer(audioBase64, ctx);
    const originalDur = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;

    if (targetDurationSec <= originalDur) {
      // Audio is already at or above target length, return original
      return {
        audioBase64,
        duration: Number(originalDur.toFixed(2)),
        silenceAddedSec: 0,
      };
    }

    const totalSamples = Math.round(targetDurationSec * sampleRate);
    const speechSamples = audioBuffer.length;
    const silenceSamples = Math.max(0, totalSamples - speechSamples);
    const silenceAddedSec = Number((silenceSamples / sampleRate).toFixed(2));

    let startOffset = 0;
    if (placement === "start") {
      startOffset = silenceSamples;
    } else if (placement === "both") {
      startOffset = Math.floor(silenceSamples / 2);
    }

    const newBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      const srcChannel = audioBuffer.getChannelData(c);
      const destChannel = newBuffer.getChannelData(c); // filled with 0s by default
      destChannel.set(srcChannel, startOffset);
    }

    const wavBytes = encodeAudioBufferToWav(newBuffer);
    const newBase64 = uint8ArrayToBase64(wavBytes);
    const actualDuration = Number((totalSamples / sampleRate).toFixed(2));

    return {
      audioBase64: newBase64,
      duration: actualDuration,
      silenceAddedSec,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Inserts a silence interval of silenceDurationSec into an existing audio at splitSec
 */
export async function insertSilenceAtTimestamp(
  audioBase64: string,
  splitSec: number,
  silenceDurationSec: number
): Promise<{
  audioBase64: string;
  duration: number;
}> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffer = await decodeBase64ToAudioBuffer(audioBase64, ctx);
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;

    const splitSample = Math.max(0, Math.min(audioBuffer.length, Math.round(splitSec * sampleRate)));
    const silenceSamples = Math.round(silenceDurationSec * sampleRate);
    const totalSamples = audioBuffer.length + silenceSamples;

    const newBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const src = audioBuffer.getChannelData(c);
      const dest = newBuffer.getChannelData(c);

      // Part 1: before split
      dest.set(src.subarray(0, splitSample), 0);
      // Silence is already zeros in Web Audio buffer between splitSample and splitSample + silenceSamples
      // Part 2: after split
      dest.set(src.subarray(splitSample), splitSample + silenceSamples);
    }

    const wavBytes = encodeAudioBufferToWav(newBuffer);
    const newBase64 = uint8ArrayToBase64(wavBytes);
    const actualDuration = Number((totalSamples / sampleRate).toFixed(2));

    return {
      audioBase64: newBase64,
      duration: actualDuration,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Stitches multiple audio segments with silence intervals into a single coherent WAV audio file.
 * If targetDurationSec is supplied and there is an `isAuto` silence segment, that segment dynamically
 * expands to hit the exact target duration (e.g. 7.00s).
 */
export async function assembleSegmentedAudio(
  speechBuffersBase64: string[],
  segments: ScriptSegment[],
  targetDurationSec?: number
): Promise<{
  audioBase64: string;
  duration: number;
  silenceTotalSec: number;
}> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    // Decode all speech buffers
    const decodedSpeech: AudioBuffer[] = [];
    for (const b64 of speechBuffersBase64) {
      decodedSpeech.push(await decodeBase64ToAudioBuffer(b64, ctx));
    }

    const sampleRate = decodedSpeech[0]?.sampleRate || 24000;
    const numChannels = decodedSpeech[0]?.numberOfChannels || 1;

    // Calculate total speech duration
    let totalSpeechDuration = 0;
    for (const buf of decodedSpeech) {
      totalSpeechDuration += buf.duration;
    }

    // Identify auto-silence segments if target duration is requested
    const autoSilenceCount = segments.filter((s) => s.type === "silence" && s.isAuto).length;
    let fixedSilenceTotal = 0;
    for (const s of segments) {
      if (s.type === "silence" && !s.isAuto) {
        fixedSilenceTotal += s.durationSec || 1.5;
      }
    }

    let dynamicAutoSilenceDuration = 1.5;
    if (targetDurationSec && targetDurationSec > totalSpeechDuration + fixedSilenceTotal) {
      const remainingForAuto = targetDurationSec - (totalSpeechDuration + fixedSilenceTotal);
      dynamicAutoSilenceDuration = autoSilenceCount > 0 ? remainingForAuto / autoSilenceCount : 1.5;
    }

    // Build timeline of audio components
    let totalSamples = 0;
    let speechIdx = 0;
    const timeline: { type: "speech" | "silence"; buffer?: AudioBuffer; samples: number; durationSec: number }[] = [];

    for (const seg of segments) {
      if (seg.type === "speech") {
        const buf = decodedSpeech[speechIdx++];
        if (buf) {
          timeline.push({ type: "speech", buffer: buf, samples: buf.length, durationSec: buf.duration });
          totalSamples += buf.length;
        }
      } else {
        const dur = seg.isAuto ? dynamicAutoSilenceDuration : (seg.durationSec || 1.5);
        const samples = Math.round(dur * sampleRate);
        timeline.push({ type: "silence", samples, durationSec: dur });
        totalSamples += samples;
      }
    }

    // Create master composite buffer
    const finalBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);
    let sampleOffset = 0;
    let totalSilenceDuration = 0;

    for (const item of timeline) {
      if (item.type === "speech" && item.buffer) {
        for (let c = 0; c < numChannels; c++) {
          finalBuffer.getChannelData(c).set(item.buffer.getChannelData(c), sampleOffset);
        }
        sampleOffset += item.samples;
      } else {
        // Silence: samples are already initialized to 0.0
        totalSilenceDuration += item.durationSec;
        sampleOffset += item.samples;
      }
    }

    let actualDuration = Number((totalSamples / sampleRate).toFixed(2));
    let finalWavBase64 = uint8ArrayToBase64(encodeAudioBufferToWav(finalBuffer));

    // If targetDurationSec was set, but no auto silence was placed, and pad is needed:
    if (targetDurationSec && actualDuration < targetDurationSec) {
      const padded = await padAudioWithSilence(finalWavBase64, targetDurationSec, "end");
      finalWavBase64 = padded.audioBase64;
      actualDuration = padded.duration;
      totalSilenceDuration += padded.silenceAddedSec;
    }

    return {
      audioBase64: finalWavBase64,
      duration: actualDuration,
      silenceTotalSec: Number(totalSilenceDuration.toFixed(2)),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

