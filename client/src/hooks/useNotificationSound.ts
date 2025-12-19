/**
 * Hook for playing notification sounds
 * Requires user interaction before playing sounds (browser policy)
 */
import { useCallback, useRef, useEffect } from "react";

export type SoundType = "message_received" | "message_sent" | "notification";

// Sound settings stored in localStorage
const SOUND_ENABLED_KEY = "crm_notification_sound_enabled";

// Base64 encoded short notification sounds (to avoid external dependencies)
// These are simple sine wave tones
const SOUNDS: Record<SoundType, string> = {
  // A pleasant "pop" sound - 440Hz + 880Hz sine wave, 100ms
  message_received: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVYGAACAf35+f4GDhYaIiYuNjpCSlJaYmpydoKGjpaaoqqutrq+xsrO1tre4uru8vL28vLy8u7u6ubm4t7a1tLOysa+urKupp6Wko6GfnZuZl5WTkY+NjImHhYOBf359fHt6eXh4d3d3d3d4eHl5enp7fH1+f4CCg4SGh4mKjI2PkJKTlZaYmZucnaChoqOlpqiqq6ytr7Cxs7S1tre4ubq7vLy9vb29vby8vLu6urm4t7a1tLOysbCuraysq6qoqKeoqKipqqusr7GytrjAwcvMz9XW2d3h5Ojo6+3u7/Hx8fLy8vLx8fDw7+/t7ezq6efl4+Hf3NrX1dLQzcvIxsPAvrq4tbKwraupp6WjoaCenZybmpqZmZmZmpucnaChoqWoq66ys7i7wcXL0NXb3+Tp7fDz9vj5+vv7+/v6+fj39fPx7+zq5+Tj39zY1NHNyca/u7e0sayopaKfnZybmpqZmZmam5yen6KlqKyyuL7Hz9ng5+/1+/4A",
  // A softer "whoosh" sound for sent messages
  message_sent: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVYGAACAgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/v/+/v39/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYCAgICAgICAgIA=",
  // A short "ding" for general notifications
  notification: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVYGAACAf4GDhYiLjpKVmZ2hpKisr7O2ury/wsXIy83Q0tXX2dvc3d7f4OHh4uLi4uLi4eLh4ODf3t3c29nX1dPRz8zKyMXCv7y5trOwraqnpKGem5iVko+Mi4mHhYOBf358enl3dnV0dHR0dHV2d3l6fH6Ag4aIi46RlJeaoKOmqq6xt7vAx87V4Ovw8/Hx8vLy8fHv7ers6ujm4uDc2NTQzMjEwLy4tLCsqKSgnZqXlJGOi4mHhIOBgH5+fX19fX5/gIKDhYeJi42PkZOVl5mbnZ+ho6Wmp6iqqqqrq6uqqqmpp6alpKKhn5ybmZeVk5GQjo2MioqJiYmJiYmKiouMjY+QkpSWmJqdoKOmqq2xtr3EzNXi8Pn/AP8=",
};

// Audio context for better control
let audioContext: AudioContext | null = null;
let userInteracted = false;

// Initialize audio context on user interaction
function initAudioContext() {
  if (!audioContext && typeof window !== "undefined" && window.AudioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Mark that user has interacted
function markUserInteraction() {
  userInteracted = true;
  const ctx = initAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume();
  }
}

// Play a sound using Web Audio API
async function playSound(type: SoundType, volume: number = 0.5): Promise<void> {
  if (!userInteracted) {
    console.log("[Sound] Skipping - no user interaction yet");
    return;
  }

  const ctx = initAudioContext();
  if (!ctx) {
    console.log("[Sound] AudioContext not available");
    return;
  }

  try {
    // Decode the base64 audio
    const soundData = SOUNDS[type];
    const response = await fetch(soundData);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Create source and gain nodes
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = audioBuffer;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0);
  } catch (error) {
    console.error("[Sound] Error playing sound:", error);
  }
}

export interface UseNotificationSoundResult {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  playMessageReceived: () => void;
  playMessageSent: () => void;
  playNotification: () => void;
}

export function useNotificationSound(): UseNotificationSoundResult {
  const isEnabledRef = useRef(true);

  // Load preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    if (stored !== null) {
      isEnabledRef.current = stored === "true";
    }

    // Listen for user interaction to enable audio
    const handleInteraction = () => {
      markUserInteraction();
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    isEnabledRef.current = enabled;
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }, []);

  const playMessageReceived = useCallback(() => {
    if (isEnabledRef.current) {
      playSound("message_received", 0.4);
    }
  }, []);

  const playMessageSent = useCallback(() => {
    if (isEnabledRef.current) {
      playSound("message_sent", 0.3);
    }
  }, []);

  const playNotification = useCallback(() => {
    if (isEnabledRef.current) {
      playSound("notification", 0.5);
    }
  }, []);

  return {
    isEnabled: isEnabledRef.current,
    setEnabled,
    playMessageReceived,
    playMessageSent,
    playNotification,
  };
}
