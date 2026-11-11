import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  Star,
  Save,
  Wand2,
  FileAudio,
  Sliders,
  ChevronRight,
  Info,
} from "lucide-react";
import { VoiceCloneMatchResult, SavedVoiceProfile, VoiceName } from "../types/tts";
import { VOICES_CATALOG } from "../data/voices";
import { analyzeAndMatchVoice } from "../services/voiceMatchingService";
import { saveVoiceProfile } from "../services/savedVoicesService";
import { requestTts } from "../services/api";
import { prepareAudioForAcousticAnalysis } from "../services/audioDownsampler";

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyClonedVoice: (profile: SavedVoiceProfile) => void;
  onOpenApiKeyModal?: () => void;
}

const SAMPLE_RECORDING_SCRIPT =
  "The quick brown fox jumps over the lazy dog. In modern digital media, voice synthesis allows creators to generate organic human speech with natural emotion, presence, and expressive acting.";

export const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({
  isOpen,
  onClose,
  onApplyClonedVoice,
  onOpenApiKeyModal,
}) => {
  const [activeTab, setActiveTab] = useState<"upload" | "record">("upload");
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>("audio/wav");
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("");
  const [audioDurationSec, setAudioDurationSec] = useState<number>(0);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStepText, setAnalysisStepText] = useState<string>("");
  const [matchResult, setMatchResult] = useState<VoiceCloneMatchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clone Customization State
  const [cloneName, setCloneName] = useState<string>("");
  const [customStylePrompt, setCustomStylePrompt] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<VoiceName>("Puck");
  const [speakingPace, setSpeakingPace] = useState<"normal" | "slow" | "brisk" | "fast">("normal");

  // Audition State
  const [isAuditioning, setIsAuditioning] = useState<boolean>(false);
  const [auditionAudioUrl, setAuditionAudioUrl] = useState<string | null>(null);
  const [isPlayingAudition, setIsPlayingAudition] = useState<boolean>(false);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Reference Player State
  const [isPlayingRef, setIsPlayingRef] = useState<boolean>(false);
  const refAudioRef = useRef<HTMLAudioElement | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    if (auditionAudioUrl) URL.revokeObjectURL(auditionAudioUrl);
    setAudioBase64(null);
    setAudioBlobUrl(null);
    setAudioFileName("");
    setAudioDurationSec(0);
    setMatchResult(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setIsAuditioning(false);
    setAuditionAudioUrl(null);
    setIsPlayingAudition(false);
    setIsPlayingRef(false);
    setCloneName("");
    setCustomStylePrompt("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
      if (auditionAudioUrl) URL.revokeObjectURL(auditionAudioUrl);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAudioFile(file);
  };

  const processAudioFile = (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac)$/i)) {
      setErrorMessage("Please select a valid audio file (.mp3, .wav, .m4a, .ogg, .webm).");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("Audio file must be under 25 MB.");
      return;
    }

    setErrorMessage(null);
    setAudioFileName(file.name);
    setAudioMimeType(file.type || "audio/wav");

    const blobUrl = URL.createObjectURL(file);
    setAudioBlobUrl(blobUrl);

    // Read duration
    const tempAudio = new Audio(blobUrl);
    tempAudio.onloadedmetadata = () => {
      setAudioDurationSec(Math.round(tempAudio.duration || 0));
    };

    // Pre-process & downsample audio to 16kHz WAV immediately
    prepareAudioForAcousticAnalysis(file, 8)
      .then((downsampled) => {
        setAudioBase64(downsampled.base64);
        setAudioMimeType("audio/wav");
      })
      .catch((e) => {
        console.warn("Pre-downsample failed, using raw audio:", e);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          setAudioBase64(base64);
        };
        reader.readAsDataURL(file);
      });
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processAudioFile(file);
  };

  // Handle Microphone Recording
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        setAudioMimeType("audio/wav");
        setAudioFileName(`Microphone_Recording_${new Date().toLocaleTimeString().replace(/:/g, "-")}`);

        const blobUrl = URL.createObjectURL(audioBlob);
        setAudioBlobUrl(blobUrl);

        // Pre-downsample recorded speech to 16kHz WAV
        prepareAudioForAcousticAnalysis(audioBlob, 8)
          .then((downsampled) => {
            setAudioBase64(downsampled.base64);
            setAudioMimeType("audio/wav");
          })
          .catch((e) => {
            console.warn("Downsampling recorded audio failed, using raw blob:", e);
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              const b64 = res.split(",")[1];
              setAudioBase64(b64);
            };
            reader.readAsDataURL(audioBlob);
          });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setErrorMessage("Could not access microphone. Please ensure microphone permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setAudioDurationSec(recordingSeconds);
    }
  };

  // Run Acoustic Analysis
  const handleAnalyze = async () => {
    if (!audioBase64) {
      setErrorMessage("Please upload an audio file or record speech first.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    // Dynamic progress indicators
    setAnalysisStepText("Optimizing acoustic profile (16kHz mono snippet)...");
    const t1 = setTimeout(() => {
      setAnalysisStepText("Analyzing pitch, register & cadence with Gemini...");
    }, 800);
    const t2 = setTimeout(() => {
      setAnalysisStepText("Matching against 30 Google Gemini Studio voices...");
    }, 2000);
    const t3 = setTimeout(() => {
      setAnalysisStepText("Crafting reverse-engineered style directive...");
    }, 3500);

    try {
      const result = await analyzeAndMatchVoice(audioBase64, audioMimeType);
      setMatchResult(result);
      setSelectedVoiceId(result.matchedVoiceId);
      setCloneName(result.suggestedCustomName || `Cloned Voice (${result.matchedVoiceId})`);
      setCustomStylePrompt(result.recommendedStylePrompt);
      setSpeakingPace(result.detectedPace || "normal");
    } catch (err: any) {
      console.error("Voice matching failed:", err);
      const rawMsg = String(err?.message || err || "");
      if (rawMsg.includes("503") || rawMsg.includes("Deadline expired") || rawMsg.includes("UNAVAILABLE")) {
        setErrorMessage("Google's audio analysis service experienced high load. We have prepared a fast 6-second acoustic profile — please click 'Analyze & Match' once more.");
      } else {
        setErrorMessage(
          err.message || "Failed to analyze voice sample. Please ensure your Gemini API key is valid."
        );
      }
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsAnalyzing(false);
      setAnalysisStepText("");
    }
  };

  // Audition Cloned Voice
  const handleAudition = async () => {
    if (!matchResult) return;
    setIsAuditioning(true);
    try {
      const auditionText = `Hello! This is your cloned voice profile in AST Studio, matched to Google's ${selectedVoiceId} voice.`;
      const res = await requestTts({
        mode: "single",
        text: auditionText,
        voice: selectedVoiceId,
        style: customStylePrompt,
        model: "gemini-3.8-flash-tts",
      });

      const audioUrl = `data:audio/wav;base64,${res.audioBase64}`;
      setAuditionAudioUrl(audioUrl);

      const audio = new Audio(audioUrl);
      auditionAudioRef.current = audio;
      setIsPlayingAudition(true);

      audio.onended = () => setIsPlayingAudition(false);
      audio.onpause = () => setIsPlayingAudition(false);

      await audio.play();
    } catch (err: any) {
      console.error("Audition generation failed:", err);
      setErrorMessage("Audition generation failed: " + (err.message || "Unknown error"));
    } finally {
      setIsAuditioning(false);
    }
  };

  const toggleAuditionPlayback = () => {
    if (!auditionAudioRef.current) return;
    if (isPlayingAudition) {
      auditionAudioRef.current.pause();
      setIsPlayingAudition(false);
    } else {
      auditionAudioRef.current.play();
      setIsPlayingAudition(true);
    }
  };

  const toggleRefPlayback = () => {
    if (!refAudioRef.current) return;
    if (isPlayingRef) {
      refAudioRef.current.pause();
      setIsPlayingRef(false);
    } else {
      refAudioRef.current.play();
      setIsPlayingRef(true);
    }
  };

  // Save to Library
  const handleSaveAndApply = (applyImmediately: boolean) => {
    if (!matchResult) return;

    const finalName = cloneName.trim() || `Cloned ${selectedVoiceId} Voice`;

    const saved = saveVoiceProfile({
      customName: finalName,
      voiceId: selectedVoiceId,
      stylePrompt: customStylePrompt,
      speakingPace: speakingPace,
      vocalMood: matchResult.detectedMood || "default",
      model: "gemini-3.8-flash-tts",
    });

    if (applyImmediately) {
      onApplyClonedVoice(saved);
    }

    onClose();
  };

  if (!isOpen) return null;

  const matchedVoiceObj = VOICES_CATALOG.find((v) => v.id === selectedVoiceId) || VOICES_CATALOG[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Wand2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">AI Voice Matcher & Clone Studio</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  Google Ecosystem
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Upload or record sample speech to match against Google's 30 Studio voices & reverse-engineer their style
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMessage}</p>
                {errorMessage.includes("API Key") && onOpenApiKeyModal && (
                  <button
                    onClick={onOpenApiKeyModal}
                    className="mt-1 font-semibold text-red-300 underline hover:text-white cursor-pointer"
                  >
                    Open API Key Settings →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Input Mode Selection Tabs (if not analyzed yet) */}
          {!matchResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "upload"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Audio File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("record")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "record"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record Microphone</span>
                </button>
              </div>

              {/* Upload Tab View */}
              {activeTab === "upload" && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-neutral-700/80 hover:border-indigo-500/60 rounded-2xl p-6 text-center space-y-3 transition-colors bg-neutral-950/40"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-200">
                      Drag and drop your audio clip here, or browse
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Supports MP3, WAV, M4A, OGG, or WebM (ideal length: 5–30 seconds)
                    </p>
                  </div>

                  <label className="inline-block">
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <span className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Audio File</span>
                    </span>
                  </label>
                </div>
              )}

              {/* Record Tab View */}
              {activeTab === "record" && (
                <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-4 text-center">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Suggested Speaking Prompt:
                    </span>
                    <p className="text-xs text-neutral-300 italic bg-neutral-900 p-3 rounded-xl border border-neutral-800 leading-relaxed max-w-lg mx-auto">
                      "{SAMPLE_RECORDING_SCRIPT}"
                    </p>
                  </div>

                  {/* Recording status & timer */}
                  <div className="py-2">
                    <div className="text-2xl font-mono font-bold text-white mb-2">
                      00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                    </div>

                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mx-auto cursor-pointer animate-pulse"
                      >
                        <MicOff className="w-4 h-4" />
                        <span>Stop Recording</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mx-auto cursor-pointer transition-transform active:scale-95"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-500">
                    Aim for 5 to 15 seconds of clean, natural speech without background music.
                  </p>
                </div>
              )}

              {/* Uploaded / Recorded Audio Preview Bar */}
              {audioBlobUrl && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={toggleRefPlayback}
                      className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-md shadow-indigo-600/20"
                    >
                      {isPlayingRef ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-200 truncate">{audioFileName || "Voice Sample"}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        Ready for analysis {audioDurationSec > 0 ? `(~${audioDurationSec}s)` : ""}
                      </div>
                    </div>
                  </div>

                  <audio
                    ref={refAudioRef}
                    src={audioBlobUrl}
                    onEnded={() => setIsPlayingRef(false)}
                    onPause={() => setIsPlayingRef(false)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Change Sample
                  </button>
                </div>
              )}

              {/* Action Button: Analyze */}
              {audioBase64 && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{analysisStepText || "Analyzing Vocal Acoustics..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze & Match with Google Studio Voices</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Match Results & Voice Replicator Deck */}
          {matchResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Match Header Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-indigo-950/30 border border-amber-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl select-none">{matchedVoiceObj.avatarEmoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-white">
                          Matched Base: {matchedVoiceObj.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {matchResult.matchScorePercent}% Acoustic Match
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {matchResult.matchExplanation}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="self-start sm:self-center px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800/80 border border-neutral-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Re-analyze</span>
                  </button>
                </div>

                {/* Acoustic Breakdown Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800/80 text-[11px]">
                  <div className="bg-neutral-950/80 p-2 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 block uppercase font-mono text-[9px]">Pitch / Register</span>
                    <strong className="text-neutral-200 truncate block">{matchResult.detectedPitch}</strong>
                  </div>
                  <div className="bg-neutral-950/80 p-2 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 block uppercase font-mono text-[9px]">Vocal Timbre</span>
                    <strong className="text-neutral-200 truncate block">{matchResult.detectedTimbre}</strong>
                  </div>
                  <div className="bg-neutral-950/80 p-2 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 block uppercase font-mono text-[9px]">Detected Pace</span>
                    <strong className="text-indigo-300 capitalize block">{matchResult.detectedPace} Cadence</strong>
                  </div>
                  <div className="bg-neutral-950/80 p-2 rounded-xl border border-neutral-800">
                    <span className="text-neutral-500 block uppercase font-mono text-[9px]">Delivery Mood</span>
                    <strong className="text-amber-300 truncate block">{matchResult.detectedMood}</strong>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Audition Player */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                  Listen & Compare (Original vs Gemini Cloned Voice):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Original Sample Player */}
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={toggleRefPlayback}
                        className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center cursor-pointer"
                      >
                        {isPlayingRef ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <div>
                        <div className="font-semibold text-neutral-200">Original Reference</div>
                        <div className="text-[10px] text-neutral-400">Your uploaded / recorded clip</div>
                      </div>
                    </div>
                  </div>

                  {/* Synthesized Clone Audition Player */}
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {auditionAudioUrl ? (
                        <button
                          type="button"
                          onClick={toggleAuditionPlayback}
                          className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer shadow-md shadow-indigo-600/30"
                        >
                          {isPlayingAudition ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAudition}
                          disabled={isAuditioning}
                          className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          {isAuditioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <div>
                        <div className="font-semibold text-indigo-200">Gemini Cloned Synthesis</div>
                        <div className="text-[10px] text-neutral-400">
                          {auditionAudioUrl ? "Audition audio ready" : "Click to test synthesized phrase"}
                        </div>
                      </div>
                    </div>

                    {!auditionAudioUrl && (
                      <button
                        type="button"
                        onClick={handleAudition}
                        disabled={isAuditioning}
                        className="px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-50"
                      >
                        {isAuditioning ? "Synthesizing..." : "Audition"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Customization & Direction Controls */}
              <div className="space-y-3 bg-neutral-950/50 p-4 rounded-2xl border border-neutral-800 text-xs">
                <div>
                  <label className="font-bold text-neutral-300 block mb-1">
                    Choose a Custom Name for this Voice:
                  </label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="e.g. Warm Podcast Host, Storytelling Titan"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-300 block mb-1 flex items-center justify-between">
                    <span>Reverse-Engineered Directing Directive:</span>
                    <span className="text-[10px] text-neutral-500 font-normal">Editable</span>
                  </label>
                  <textarea
                    rows={2}
                    value={customStylePrompt}
                    onChange={(e) => setCustomStylePrompt(e.target.value)}
                    placeholder="Directing directive for tone, cadence, and texture..."
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-semibold text-neutral-400 block mb-1">Google Base Voice:</label>
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value as VoiceName)}
                      className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {VOICES_CATALOG.filter((v) => v.category === "official").map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.avatarEmoji} {v.name} ({v.gender}) - {v.tone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-400 block mb-1">Pace:</label>
                    <select
                      value={speakingPace}
                      onChange={(e) => setSpeakingPace(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="slow">0.85x Slow</option>
                      <option value="normal">1.0x Normal</option>
                      <option value="brisk">1.15x Brisk</option>
                      <option value="fast">1.25x Fast</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveAndApply(false)}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Save to Voice Library</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveAndApply(true)}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save & Use in Studio Immediately</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
