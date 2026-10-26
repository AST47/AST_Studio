import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Check,
  FastForward,
  Rewind,
  Music2,
  Sparkles,
  Film,
  Video,
  Clock,
  Scissors,
  Sliders,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
} from "lucide-react";
import { GeneratedAudioItem } from "../types/tts";
import { LANGUAGES } from "../data/languages";
import {
  fitAudioToTargetDuration,
  padAudioWithSilence,
  insertSilenceAtTimestamp,
} from "../services/audioTimeStretch";

interface AudioPlayerProps {
  item: GeneratedAudioItem | null;
  onClear?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ item, onClear }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [copied, setCopied] = useState(false);

  // Video Lip-Sync & Exact Timing Deck State
  const [showVideoSyncDeck, setShowVideoSyncDeck] = useState(false);
  const [targetDurationSec, setTargetDurationSec] = useState<number>(() =>
    item?.duration ? Number(item.duration.toFixed(2)) : 3.5
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [audioOffsetMs, setAudioOffsetMs] = useState<number>(0);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [isExportingSyncedWav, setIsExportingSyncedWav] = useState<boolean>(false);
  const [syncedExportSuccess, setSyncedExportSuccess] = useState<boolean>(false);
  const [exportSuccessDetails, setExportSuccessDetails] = useState<string>("");
  const [isPreviewingSyncSpeed, setIsPreviewingSyncSpeed] = useState<boolean>(false);
  const [insertSilenceSec, setInsertSilenceSec] = useState<number>(3.0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep target duration aligned when item changes
  useEffect(() => {
    if (item?.duration) {
      setTargetDurationSec(Number(item.duration.toFixed(2)));
    }
  }, [item?.id, item?.duration]);

  // Clean up video object URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Speed multiplier needed to fit the target duration
  const originalDur = duration || item?.duration || 1;
  const speedRatio = useMemo(() => {
    if (!targetDurationSec || targetDurationSec <= 0 || !originalDur) return 1.0;
    return Number((originalDur / targetDurationSec).toFixed(3));
  }, [originalDur, targetDurationSec]);

  const speedPercentageChange = useMemo(() => {
    const pct = (speedRatio - 1.0) * 100;
    return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
  }, [speedRatio]);

  // Video file upload handler
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = Number(videoRef.current.duration.toFixed(2));
      setVideoDuration(dur);
      // Auto-snap target duration to video duration
      if (dur > 0) {
        setTargetDurationSec(dur);
      }
    }
  };

  // Play both video and voice in lockstep
  const toggleSyncPlayback = () => {
    if (!audioRef.current || !item) return;
    const video = videoRef.current;

    if (isPlaying) {
      audioRef.current.pause();
      if (video) video.pause();
      setIsPlaying(false);
    } else {
      const targetRate = isPreviewingSyncSpeed ? speedRatio : playbackRate;
      audioRef.current.playbackRate = targetRate;
      (audioRef.current as any).preservesPitch = true;

      if (video) {
        video.currentTime = Math.max(0, currentTime);
        video.playbackRate = 1.0;
        video.play().catch(console.error);
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  // Export time-stretched WAV fitting the exact target duration
  const handleExportSyncedWav = async () => {
    if (!item?.audioBase64 || !targetDurationSec || targetDurationSec <= 0) return;
    setIsExportingSyncedWav(true);
    setSyncedExportSuccess(false);

    try {
      const result = await fitAudioToTargetDuration(item.audioBase64, targetDurationSec);

      const a = document.createElement("a");
      a.href = `data:audio/wav;base64,${result.audioBase64}`;
      const safeTitle = (item.title || "voiceover")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 24);
      a.download = `${safeTitle}-synced-${result.duration}s.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportSuccessDetails(
        `Rendered ${result.duration}s WAV at ${result.speedRatio}x tempo with pitch preserved.`
      );
      setSyncedExportSuccess(true);
      setTimeout(() => setSyncedExportSuccess(false), 6000);
    } catch (err: any) {
      console.error("Failed to fit audio duration:", err);
    } finally {
      setIsExportingSyncedWav(false);
    }
  };

  // Export silence-padded WAV to hit target duration with 100% natural speech rate
  const handlePadSilenceToTarget = async (placement: "end" | "start" | "both" = "end") => {
    if (!item?.audioBase64 || !targetDurationSec || targetDurationSec <= 0) return;
    setIsExportingSyncedWav(true);
    setSyncedExportSuccess(false);

    try {
      const result = await padAudioWithSilence(item.audioBase64, targetDurationSec, placement);

      const a = document.createElement("a");
      a.href = `data:audio/wav;base64,${result.audioBase64}`;
      const safeTitle = (item.title || "voiceover")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 24);
      a.download = `${safeTitle}-padded-${result.duration}s.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportSuccessDetails(
        `Exported ${result.duration}s WAV with ${result.silenceAddedSec}s pure silence pad (${placement}).`
      );
      setSyncedExportSuccess(true);
      setTimeout(() => setSyncedExportSuccess(false), 6000);
    } catch (err: any) {
      console.error("Failed to pad silence:", err);
    } finally {
      setIsExportingSyncedWav(false);
    }
  };

  // Insert silence gap at current timestamp in existing audio
  const handleInsertSilenceAtCurrentTime = async () => {
    if (!item?.audioBase64) return;
    setIsExportingSyncedWav(true);
    setSyncedExportSuccess(false);

    try {
      const splitAt = currentTime > 0 ? currentTime : Number(((item.duration || 4) / 2).toFixed(2));
      const result = await insertSilenceAtTimestamp(item.audioBase64, splitAt, insertSilenceSec);

      const a = document.createElement("a");
      a.href = `data:audio/wav;base64,${result.audioBase64}`;
      const safeTitle = (item.title || "voiceover")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 24);
      a.download = `${safeTitle}-silence-gap-${result.duration}s.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportSuccessDetails(
        `Inserted ${insertSilenceSec}s silence at ${splitAt.toFixed(2)}s mark. Clip duration is now ${result.duration}s.`
      );
      setSyncedExportSuccess(true);
      setTimeout(() => setSyncedExportSuccess(false), 6000);
    } catch (err: any) {
      console.error("Failed to insert silence:", err);
    } finally {
      setIsExportingSyncedWav(false);
    }
  };

  // Generate synthetic waveform bars based on item id and text
  const waveformBars = useMemo(() => {
    if (!item) return [];
    const count = 72;
    const bars: number[] = [];
    let seed = 0;
    for (let i = 0; i < item.id.length; i++) {
      seed = (seed * 31 + item.id.charCodeAt(i)) % 100000;
    }
    for (let i = 0; i < count; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      // create natural speech curve with peaks and troughs
      const envelope = Math.sin((i / count) * Math.PI);
      const val = Math.max(0.12, Math.min(0.98, envelope * (0.3 + 0.7 * rnd)));
      bars.push(val);
    }
    return bars;
  }, [item?.id]);

  // Audio source URL
  const audioSrc = useMemo(() => {
    if (!item?.audioBase64) return "";
    return `data:${item.mimeType || "audio/wav"};base64,${item.audioBase64}`;
  }, [item?.audioBase64, item?.mimeType]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.loop = isLooping;
    }
  }, [playbackRate, volume, isMuted, isLooping]);

  // When item changes, reset state without playing on initial load
  useEffect(() => {
    if (!item || !audioSrc) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    setCurrentTime(0);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }

    // Never autoplay on initial page load / code reload / dev server restart
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // On subsequent new items generated by the user in this session, keep paused unless user presses play
    // (This guarantees the voice NEVER starts on its own unexpectedly)
  }, [item?.id, audioSrc]);

  // Draw waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformBars.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const barCount = waveformBars.length;
    const gap = 3;
    const totalBarWidth = (width - (barCount - 1) * gap) / barCount;
    const progress = duration > 0 ? currentTime / duration : 0;

    waveformBars.forEach((amplitude, index) => {
      const x = index * (totalBarWidth + gap);
      const barHeight = Math.max(6, amplitude * (height - 12));
      const y = (height - barHeight) / 2;
      const barProgress = index / barCount;

      const isPlayed = barProgress <= progress;

      if (isPlayed) {
        // Gradient for played portion
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, "#818cf8"); // indigo-400
        grad.addColorStop(1, "#6366f1"); // indigo-500
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "rgba(75, 85, 99, 0.4)"; // neutral-600
      }

      ctx.beginPath();
      ctx.roundRect(x, y, totalBarWidth, barHeight, 2);
      ctx.fill();
    });
  }, [waveformBars, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current || !item) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || item?.duration || 0);
    }
  };

  const handleEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const seekRelative = (delta: number) => {
    if (!audioRef.current || !duration) return;
    const target = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleDownload = () => {
    if (!item || !audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    const safeTitle = (item.title || "voxstudio-ai-speech")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32);
    a.download = `${safeTitle}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyBase64 = () => {
    if (!item?.audioBase64) return;
    navigator.clipboard.writeText(item.audioBase64);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!item) {
    return (
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-neutral-800/80 pb-3">
          <Play className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
            3. Listen to the Outcome
          </h3>
        </div>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-neutral-800/70 border border-neutral-700/50 flex items-center justify-center mx-auto mb-3 text-neutral-400">
            <Music2 className="w-6 h-6 text-indigo-400/80" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-200">Outcome Player Ready</h4>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Write or customize your script in <span className="text-indigo-400 font-medium">Step 2</span> and click <span className="text-indigo-400 font-medium">Generate Speech</span> to listen to your voice here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all">
      {/* Background audio glow */}
      {isPlaying && (
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      )}

      {/* Step 3 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-neutral-800/80">
        <div>
          <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-400" />
            3. Listen to the Outcome
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Play back, inspect the neural waveform, adjust speed, and export 24kHz WAV audio.
          </p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer transition-colors self-start sm:self-auto"
            title="Clear Audio Deck"
          >
            <span>Clear Audio</span>
          </button>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Track Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase border ${
                item.voice?.includes("boy") || item.voice?.includes("girl")
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
              }`}
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              {item.mode === "dialogue"
                ? "Dual Dialogue"
                : item.voice === "leo-boy"
                ? "👦 Leo (Young Boy)"
                : item.voice === "mia-girl"
                ? "👧 Mia (Young Girl)"
                : item.voice === "toby-boy"
                ? "🧒 Toby (Little Brother)"
                : item.voice === "lily-girl"
                ? "👧 Lily (Little Sister)"
                : item.voice || "Neural Voice"}
            </span>

            {item.language && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-900 border border-neutral-700 text-neutral-300">
                <span>{LANGUAGES.find((l) => l.code === item.language)?.flag || "🌐"}</span>
                <span>{LANGUAGES.find((l) => l.code === item.language)?.nativeName || item.language.toUpperCase()}</span>
              </span>
            )}

            <span className="text-xs text-neutral-400 font-mono">
              24kHz WAV • {item.modelUsed.replace("gemini-3.8-", "")}
            </span>
          </div>
          <h3 className="text-base font-bold text-neutral-100 truncate mt-1">
            {item.title}
          </h3>
          <p className="text-xs text-neutral-400 line-clamp-1 italic mt-0.5">
            "{item.textPreview}"
          </p>
        </div>

        {/* Action icons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          {/* Video Lip-Sync Deck Toggle */}
          <button
            onClick={() => setShowVideoSyncDeck(!showVideoSyncDeck)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showVideoSyncDeck
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400/50"
                : "bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 border border-purple-500/30"
            }`}
            title="Video Lip-Sync, Exact Duration Matcher & Time-Stretch Deck"
          >
            <Film className="w-3.5 h-3.5 text-purple-300" />
            <span>Video Lip-Sync</span>
            {videoFile && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Video clip attached" />
            )}
          </button>

          <button
            onClick={handleCopyBase64}
            title="Copy audio Base64 string"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center gap-1.5 border border-neutral-700/60"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Base64</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download WAV</span>
          </button>
        </div>
      </div>

      {/* Interactive Waveform Visualizer */}
      <div className="py-4">
        <div className="relative group cursor-pointer">
          <canvas
            ref={canvasRef}
            onClick={handleWaveformClick}
            className="w-full h-20 rounded-xl bg-neutral-950/70 border border-neutral-800/80 transition-all hover:border-neutral-700/80"
          />
          <div className="absolute bottom-2 left-3 text-[11px] font-mono text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800 pointer-events-none">
            Click anywhere on waveform to scrub
          </div>
        </div>

        {/* Timecodes */}
        <div className="flex justify-between items-center text-xs font-mono text-neutral-400 px-1 mt-1.5">
          <span className="text-indigo-400 font-semibold">{formatTime(currentTime)}</span>
          <span>{formatTime(duration || item.duration)}</span>
        </div>
      </div>

      {/* Audio Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Main Transport */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => seekRelative(-5)}
            title="Rewind 5 seconds"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekRelative(5)}
            title="Forward 5 seconds"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <FastForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            title="Restart clip"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Playback rate & Loop */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-950/80 rounded-lg p-0.5 border border-neutral-800">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-1 text-[11px] font-mono rounded font-medium transition-colors ${
                  playbackRate === rate
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsLooping(!isLooping)}
            title="Toggle Loop"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isLooping
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                : "bg-neutral-800/80 text-neutral-400 border-neutral-700/50 hover:text-neutral-200"
            }`}
          >
            Loop
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-32">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-neutral-400 hover:text-neutral-200"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>

      {/* Video Lip-Sync & Timing Deck */}
      {showVideoSyncDeck && (
        <div className="mt-5 pt-5 border-t border-purple-900/40 bg-gradient-to-b from-purple-950/25 via-neutral-900/90 to-neutral-950/95 rounded-2xl p-4 sm:p-5 space-y-5 shadow-inner">
          {/* Deck Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Video Lip-Sync & Exact Duration Fit
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Pitch-Preserved SOLA
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Fit speech to your video's exact timestamp down to milliseconds without chipmunk distortion.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowVideoSyncDeck(false)}
              className="text-xs text-neutral-400 hover:text-neutral-200 self-end sm:self-auto cursor-pointer"
            >
              Hide Deck
            </button>
          </div>

          {/* Section 1: Target Duration & Speed Calculator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Target Duration Control */}
            <div className="bg-neutral-950/80 rounded-xl p-3.5 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Target Video Duration
                </span>
                <span className="font-mono text-neutral-400">
                  Current Audio: <strong className="text-indigo-400">{originalDur.toFixed(2)}s</strong>
                </span>
              </div>

              {/* Input & Steppers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTargetDurationSec((prev) => Math.max(0.3, Number((prev - 0.5).toFixed(2))))}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-800 transition-colors"
                  title="Minus 0.5s"
                >
                  -0.5s
                </button>
                <button
                  onClick={() => setTargetDurationSec((prev) => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                  className="px-2 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-800 transition-colors"
                  title="Minus 0.1s"
                >
                  -0.1s
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0.2"
                    max="180"
                    value={targetDurationSec}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setTargetDurationSec(val);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-center text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-neutral-400 pointer-events-none">
                    sec
                  </span>
                </div>

                <button
                  onClick={() => setTargetDurationSec((prev) => Number((prev + 0.1).toFixed(2)))}
                  className="px-2 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-800 transition-colors"
                  title="Plus 0.1s"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => setTargetDurationSec((prev) => Number((prev + 0.5).toFixed(2)))}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-800 transition-colors"
                  title="Plus 0.5s"
                >
                  +0.5s
                </button>
              </div>

              {/* Quick Timing Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-neutral-500 font-medium mr-1">Presets:</span>
                {[
                  { label: "1.5s Hook", val: 1.5 },
                  { label: "3.0s", val: 3.0 },
                  { label: "5.0s", val: 5.0 },
                  { label: "10.0s", val: 10.0 },
                  { label: "15.0s Reel", val: 15.0 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => setTargetDurationSec(preset.val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      Math.abs(targetDurationSec - preset.val) < 0.05
                        ? "bg-purple-600 text-white font-semibold"
                        : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                {videoDuration > 0 && (
                  <button
                    onClick={() => setTargetDurationSec(videoDuration)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 ml-auto"
                  >
                    <span>Match Video ({videoDuration.toFixed(2)}s)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Calculated Ratio & Live Preview / Export */}
            <div className="bg-neutral-950/80 rounded-xl p-3.5 border border-neutral-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Speed & Timbre Analysis
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-purple-300">
                  {speedRatio}x ({speedPercentageChange})
                </span>
              </div>

              {/* Sync Advisory */}
              <div className="text-xs">
                {speedRatio >= 0.85 && speedRatio <= 1.25 ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Optimal for video lip-sync. Natural cadence & transparent tone.</span>
                  </div>
                ) : (speedRatio >= 0.70 && speedRatio < 0.85) || (speedRatio > 1.25 && speedRatio <= 1.45) ? (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Moderate stretch. Pitch preserved; suitable for energetic or slowed clips.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Significant stretch ({speedRatio}x). We recommend adjusting script word count.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.playbackRate = speedRatio;
                      (audioRef.current as any).preservesPitch = true;
                      audioRef.current.currentTime = 0;
                      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
                      setIsPreviewingSyncSpeed(true);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <Play className="w-3 h-3 fill-current text-purple-400" />
                  <span>Preview Speed</span>
                </button>

                <button
                  onClick={handleExportSyncedWav}
                  disabled={isExportingSyncedWav}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-purple-300 transition-all border border-purple-500/40 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Stretches or compresses voice tempo preserving pitch"
                >
                  <FastForward className="w-3 h-3 text-purple-400" />
                  <span>SOLA Time-Stretch</span>
                </button>

                <button
                  onClick={() => handlePadSilenceToTarget("end")}
                  disabled={isExportingSyncedWav}
                  className="flex-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Pads pure digital silence at the end so speech speed remains 100% natural"
                >
                  {isExportingSyncedWav ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Pad Silence to {targetDurationSec.toFixed(1)}s</span>
                    </>
                  )}
                </button>
              </div>

              {/* Insert Silence in Middle Tool */}
              <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
                  <Pause className="w-3.5 h-3.5 text-purple-400" />
                  <span>Insert Silence in Audio:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="30"
                    value={insertSilenceSec}
                    onChange={(e) => setInsertSilenceSec(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs font-mono text-white text-center"
                  />
                  <span className="text-[11px] font-mono text-neutral-400">sec</span>
                  <button
                    onClick={handleInsertSilenceAtCurrentTime}
                    disabled={isExportingSyncedWav}
                    className="px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                    title={`Splits audio at ${currentTime > 0 ? currentTime.toFixed(1) + "s" : "middle"} and inserts ${insertSilenceSec}s digital silence`}
                  >
                    Insert Silence at {currentTime > 0 ? `${currentTime.toFixed(1)}s` : "Middle"}
                  </button>
                </div>
              </div>

              {syncedExportSuccess && exportSuccessDetails && (
                <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>{exportSuccessDetails}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Interactive Video Lip-Sync Audition Deck */}
          <div className="bg-neutral-950/90 rounded-xl p-4 border border-purple-900/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-purple-400" />
                <h5 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Video Reference Lip-Sync Tester
                </h5>
              </div>

              {/* Upload Video Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/quicktime,video/mov"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/70 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>{videoFile ? "Change Video Clip" : "Load Video Clip (.mp4/.mov)"}</span>
                </button>

                {videoFile && (
                  <button
                    onClick={() => {
                      if (videoUrl) URL.revokeObjectURL(videoUrl);
                      setVideoFile(null);
                      setVideoUrl(null);
                      setVideoDuration(0);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                    title="Remove Video"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Video Player Display */}
            {videoUrl ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Video Box */}
                  <div className="md:col-span-1 bg-black rounded-lg overflow-hidden border border-neutral-800 relative aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      muted={isVideoMuted}
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={() => setIsVideoMuted(!isVideoMuted)}
                      className="absolute bottom-2 right-2 p-1 rounded bg-black/70 text-neutral-300 hover:text-white text-[10px] flex items-center gap-1 border border-neutral-700/60"
                      title={isVideoMuted ? "Video Muted (Listening to AI Voice)" : "Video Unmuted"}
                    >
                      {isVideoMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
                      <span>{isVideoMuted ? "Muted" : "Original Audio"}</span>
                    </button>
                  </div>

                  {/* Synchronized Transport & Offset Controls */}
                  <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-neutral-300 font-mono pb-1">
                        <span>Video: <strong>{videoDuration.toFixed(2)}s</strong></span>
                        <span>Voiceover: <strong>{originalDur.toFixed(2)}s</strong></span>
                        <span className="text-purple-400">Target: <strong>{targetDurationSec.toFixed(2)}s</strong></span>
                      </div>

                      {/* Audio Lip-Sync Offset Slider */}
                      <div className="space-y-1.5 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-400 font-medium">Audio Offset (Onset Alignment):</span>
                          <span className="font-mono text-purple-300 font-semibold">
                            {audioOffsetMs > 0 ? `+${audioOffsetMs}ms (Voice Delayed)` : audioOffsetMs < 0 ? `${audioOffsetMs}ms (Voice Earlier)` : "0ms (Simultaneous)"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-500"
                          max="500"
                          step="25"
                          value={audioOffsetMs}
                          onChange={(e) => setAudioOffsetMs(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                          <span>-500ms</span>
                          <span>0ms</span>
                          <span>+500ms</span>
                        </div>
                      </div>
                    </div>

                    {/* Dual Sync Play Button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSyncPlayback}
                        className="flex-1 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pause Synced Playback</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Play Video & Voice Synced</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (audioRef.current) audioRef.current.currentTime = 0;
                          if (videoRef.current) videoRef.current.currentTime = 0;
                          setCurrentTime(0);
                        }}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                        title="Restart both to 0:00"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-neutral-800 hover:border-purple-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-neutral-950/40"
              >
                <FileVideo className="w-6 h-6 text-neutral-500 mx-auto mb-1.5" />
                <p className="text-xs text-neutral-300 font-medium">
                  Drop or select a video clip to test lip-sync timing directly in browser
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Supports MP4, WebM, and MOV. Video stays 100% private in local browser memory.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
