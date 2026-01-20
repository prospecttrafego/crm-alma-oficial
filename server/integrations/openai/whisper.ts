/**
 * OpenAI Whisper Transcription Service
 * Transcribes audio files to text using OpenAI's Whisper API
 */
import OpenAI from "openai";
import { openaiLogger } from "../../logger";
import { MAX_FILE_SIZE_BYTES } from "../../constants";

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

function getAllowedHosts(): Set<string> {
  const allowed = new Set<string>();
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      allowed.add(new URL(supabaseUrl).hostname);
    } catch (_error) {
      // Ignore invalid SUPABASE_URL; env validation should catch this.
    }
  }

  const extraHosts = process.env.AUDIO_TRANSCRIBE_ALLOWED_HOSTS;
  if (extraHosts) {
    extraHosts
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean)
      .forEach((host) => allowed.add(host));
  }

  return allowed;
}

function assertAllowedAudioUrl(audioUrl: string): URL {
  const parsed = new URL(audioUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  const allowedHosts = getAllowedHosts();
  if (allowedHosts.size === 0) {
    throw new Error("Audio transcription blocked: no allowed hosts configured");
  }

  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`Audio transcription blocked: host not allowed (${parsed.hostname})`);
  }

  return parsed;
}

async function readResponseWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > maxBytes) {
      throw new Error(`Audio file too large (${size} bytes)`);
    }
  }

  if (!response.body) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.length > maxBytes) {
      throw new Error(`Audio file too large (${fallback.length} bytes)`);
    }
    return fallback;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Audio file too large (> ${maxBytes} bytes)`);
      }
      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks);
}

function toSafeUrlForLog(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
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
    const parsedUrl = assertAllowedAudioUrl(audioUrl);
    openaiLogger.info("Fetching audio for transcription", { audioUrl: toSafeUrlForLog(parsedUrl) });

    const response = await fetch(parsedUrl.toString(), {
      signal: AbortSignal.timeout(AUDIO_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const audioBuffer = await readResponseWithLimit(response, MAX_FILE_SIZE_BYTES);
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });

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
