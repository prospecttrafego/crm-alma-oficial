"use client";

import { useMemo } from "react";
import { Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatRecordingTime } from "@/pages/inbox/utils";

type Props = {
  recordingTime: number;
  onCancel: () => void;
  onStop: () => void;
};

export function RecordingUI({ recordingTime, onCancel, onStop }: Props) {
  const { t } = useTranslation();

  const bars = useMemo(() => {
    return Array.from({ length: 20 }, () => Math.random() * 20 + 8);
  }, []);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted px-4 py-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        <span className="font-mono text-lg text-foreground">{formatRecordingTime(recordingTime)}</span>
        <div className="flex flex-1 items-center gap-1">
          {bars.map((height, index) => (
            <div
              key={index}
              className="w-1 animate-pulse rounded-full bg-primary"
              style={{
                height: `${height}px`,
                animationDelay: `${index * 0.05}s`,
              }}
            />
          ))}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        onClick={onCancel}
        className="h-10 w-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
        data-testid="button-cancel-recording"
        aria-label={t("a11y.cancelRecording")}
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        onClick={onStop}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        data-testid="button-stop-recording"
        aria-label={t("a11y.stopRecording")}
      >
        <Square className="h-5 w-5 fill-current" aria-hidden="true" />
      </Button>
    </div>
  );
}
