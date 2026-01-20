/**
 * Hook for playing notification sounds
 * Requires user interaction before playing sounds (browser policy)
 * Syncs with backend user.preferences (soundEnabled)
 */
import { useCallback, useRef, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usersApi } from "@/lib/api/users";

export type SoundType = "message_received" | "message_sent" | "notification";

// Sound settings stored in localStorage (cache)
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
  isUpdating: boolean;
  playMessageReceived: () => void;
  playMessageSent: () => void;
  playNotification: () => void;
}

export function useNotificationSound(): UseNotificationSoundResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabledRef = useRef(true);

  // Get initial value: user preferences > localStorage > default (true)
  const getInitialEnabled = (): boolean => {
    const userPrefs = user?.preferences as { soundEnabled?: boolean } | undefined;
    if (typeof userPrefs?.soundEnabled === "boolean") {
      return userPrefs.soundEnabled;
    }
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    return true; // default enabled
  };

  const [isEnabled, setIsEnabledState] = useState(getInitialEnabled);

  // Update when user preferences change
  useEffect(() => {
    const userPrefs = user?.preferences as { soundEnabled?: boolean } | undefined;
    if (typeof userPrefs?.soundEnabled === "boolean") {
      setIsEnabledState(userPrefs.soundEnabled);
      isEnabledRef.current = userPrefs.soundEnabled;
    }
  }, [user?.preferences]);

  // Keep ref in sync with state for callbacks
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Listen for user interaction to enable audio
  useEffect(() => {
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

  // Mutation to save preference
  const updateSoundMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
      if (user) {
        return usersApi.updateMe({ preferences: { soundEnabled: enabled } });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    isEnabledRef.current = enabled;
    updateSoundMutation.mutate(enabled);
  }, [updateSoundMutation]);

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
    isEnabled,
    setEnabled,
    isUpdating: updateSoundMutation.isPending,
    playMessageReceived,
    playMessageSent,
    playNotification,
  };
}
