/**
 * Audio Waveform Component using wavesurfer.js
 * Used for visualizing and playing audio messages
 */
import { useRef, useEffect, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { filesApi } from "@/lib/api/files";

interface AudioWaveformProps {
  /** Audio source URL or Blob */
  src: string | Blob;
  /** File ID for transcription (if from uploaded file) */
  fileId?: number;
  /** Height of the waveform in pixels */
  height?: number;
  /** Primary color for the waveform */
  waveColor?: string;
  /** Color of the played portion */
  progressColor?: string;
  /** Whether to show download button */
  showDownload?: boolean;
  /** Whether to show transcription button */
  showTranscribe?: boolean;
  /** Initial transcription text (if already transcribed) */
  initialTranscription?: string;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback when transcription completes */
  onTranscribed?: (text: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

export function AudioWaveform({
  src,
  fileId,
  height = 48,
  waveColor = "hsl(var(--muted-foreground))",
  progressColor = "hsl(var(--primary))",
  showDownload = false,
  showTranscribe = false,
  initialTranscription,
  onEnded,
  onTranscribed,
  className,
  compact = false,
}: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [transcription, setTranscription] = useState<string | undefined>(initialTranscription);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscription, setShowTranscription] = useState(!!initialTranscription);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor,
      progressColor,
      cursorWidth: 1,
      cursorColor: progressColor,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      hideScrollbar: true,
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    if (typeof src === "string") {
      wavesurfer.load(src);
    } else {
      // For Blob, create object URL
      const url = URL.createObjectURL(src);
      wavesurfer.load(url);
      // Cleanup URL when wavesurfer is destroyed
      wavesurfer.on("destroy", () => URL.revokeObjectURL(url));
    }

    // Event handlers
    wavesurfer.on("ready", () => {
      setDuration(wavesurfer.getDuration());
      setIsReady(true);
    });

    wavesurfer.on("audioprocess", () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on("play", () => setIsPlaying(true));
    wavesurfer.on("pause", () => setIsPlaying(false));
    wavesurfer.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    });

    wavesurfer.on("seeking", () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [src, height, waveColor, progressColor, onEnded]);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  // Handle download
  const handleDownload = useCallback(() => {
    if (typeof src === "string") {
      const link = document.createElement("a");
      link.href = src;
      link.download = "audio.webm";
      link.click();
    } else {
      const url = URL.createObjectURL(src);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audio.webm";
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [src]);

  // Handle transcription request
  const handleTranscribe = useCallback(async () => {
    if (isTranscribing || transcription) return;

    setIsTranscribing(true);
    try {
      let result;
      if (fileId) {
        // Transcribe by file ID
        result = await filesApi.transcribeFile(fileId);
      } else if (typeof src === "string") {
        // Transcribe by URL
        result = await filesApi.transcribeAudio(src);
      } else {
        throw new Error("Cannot transcribe blob without file ID");
      }

      const text = result.text ?? "";
      setTranscription(text);
      setShowTranscription(true);
      if (text) {
        onTranscribed?.(text);
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
    }
  }, [fileId, src, isTranscribing, transcription, onTranscribed]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-muted/50 p-2",
          compact ? "min-w-[180px]" : "min-w-[240px]"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-full",
            compact ? "h-8 w-8" : "h-10 w-10"
          )}
          onClick={togglePlayback}
          disabled={!isReady}
        >
          {isPlaying ? (
            <Pause className={compact ? "h-4 w-4" : "h-5 w-5"} />
          ) : (
            <Play className={cn(compact ? "h-4 w-4" : "h-5 w-5", "ml-0.5")} />
          )}
        </Button>

        <div className="flex flex-1 flex-col gap-1">
          <div
            ref={containerRef}
            className="w-full cursor-pointer"
            style={{ height: compact ? 32 : height }}
          />
          <div className="flex justify-between px-0.5">
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {showTranscribe && !transcription && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleTranscribe}
            disabled={!isReady || isTranscribing}
            title="Transcrever áudio"
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>
        )}

        {transcription && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => setShowTranscription(!showTranscription)}
            title={showTranscription ? "Ocultar transcrição" : "Mostrar transcrição"}
          >
            {showTranscription ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}

        {showDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleDownload}
            disabled={!isReady}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Transcription text */}
      {showTranscription && transcription && (
        <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground italic">
          "{transcription}"
        </div>
      )}
    </div>
  );
}

/**
 * Audio Recording Preview Component
 * Shows waveform preview of recorded audio before sending
 */
interface AudioRecordingPreviewProps {
  /** The recorded audio blob */
  audioBlob: Blob;
  /** Callback to send the audio */
  onSend: () => void;
  /** Callback to discard the recording */
  onDiscard: () => void;
  /** Whether sending is in progress */
  isSending?: boolean;
}

export function AudioRecordingPreview({
  audioBlob,
  onSend,
  onDiscard,
  isSending = false,
}: AudioRecordingPreviewProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <AudioWaveform
        src={audioBlob}
        compact
        className="flex-1 bg-transparent p-0"
        height={32}
      />
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={isSending}
          className="text-destructive hover:text-destructive"
        >
          Descartar
        </Button>
        <Button size="sm" onClick={onSend} disabled={isSending}>
          {isSending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

export default AudioWaveform;
