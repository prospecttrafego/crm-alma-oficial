/**
 * OpenAI Whisper Transcription Service
 * Transcribes audio files to text using OpenAI's Whisper API
 */
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

  try {
    // Fetch the audio file from the URL
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

    // Convert Blob to File for OpenAI API
    const audioFile = new File([audioBlob], "audio.webm", { type: "audio/webm" });

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: language || "pt", // Default to Portuguese
      response_format: "verbose_json",
    });

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
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
