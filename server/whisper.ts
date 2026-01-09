/**
 * OpenAI Whisper Transcription Service
 * Transcribes audio files to text using OpenAI's Whisper API
 */
import OpenAI from "openai";
import { openaiLogger } from "./logger";

// Timeout para download de audio (60 segundos - arquivos podem ser grandes)
const AUDIO_FETCH_TIMEOUT_MS = 60000;
// Timeout para transcricao OpenAI (120 segundos - processamento pode ser demorado)
const WHISPER_TIMEOUT_MS = 120000;

// Initialize OpenAI client with timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: WHISPER_TIMEOUT_MS,
});

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Transcribe audio from a URL using OpenAI Whisper
 * @param audioUrl - URL of the audio file to transcribe
 * @param language - Optional language code (e.g., 'pt', 'en')
 * @returns Transcription result with text
 */
export async function transcribeAudio(
  audioUrl: string,
  language?: string
): Promise<TranscriptionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const start = Date.now();

  try {
    // Fetch the audio file from the URL with timeout
    openaiLogger.info("Fetching audio for transcription", { audioUrl: audioUrl.substring(0, 100) });

    const response = await fetch(audioUrl, {
      signal: AbortSignal.timeout(AUDIO_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

    // Convert Blob to File for OpenAI API
    const audioFile = new File([audioBlob], "audio.webm", { type: "audio/webm" });

    // Call OpenAI Whisper API
    openaiLogger.info("Starting Whisper transcription", {
      audioSizeKB: Math.round(audioBuffer.byteLength / 1024),
      language: language || "pt",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: language || "pt", // Default to Portuguese
      response_format: "verbose_json",
    });

    const duration = Date.now() - start;
    openaiLogger.info("Transcription completed", {
      duration,
      textLength: transcription.text.length,
      audioDuration: transcription.duration,
    });

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    openaiLogger.error("Transcription error", {
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    throw error;
  }
}

/**
 * Check if Whisper transcription is available
 * @returns true if OPENAI_API_KEY is configured
 */
export function isWhisperAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
