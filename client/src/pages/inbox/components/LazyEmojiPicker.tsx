"use client";

import { lazy, Suspense } from "react";
import type { EmojiClickData } from "emoji-picker-react";

import { Skeleton } from "@/components/ui/skeleton";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

type Props = {
  onEmojiClick: (emojiData: EmojiClickData) => void;
  theme: "dark" | "light";
  width?: number;
  height?: number;
  searchPlaceholder: string;
};

export function LazyEmojiPicker({
  onEmojiClick,
  theme,
  width = 320,
  height = 400,
  searchPlaceholder,
}: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-[320px] rounded-lg" />}>
      <EmojiPicker
        onEmojiClick={onEmojiClick}
        theme={theme as any}
        width={width}
        height={height}
        searchPlaceHolder={searchPlaceholder}
        previewConfig={{ showPreview: false }}
      />
    </Suspense>
  );
}

