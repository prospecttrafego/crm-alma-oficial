"use client";

import { AudioRecordingPreview } from "@/components/audio-waveform";
import type { PendingFile, InboxMessage } from "@/pages/inbox/types";
import type { EmailTemplate } from "@shared/schema";
import { RecordingUI } from "./RecordingUI";
import { MessageInput } from "./MessageInput";

type Props = {
  onSubmit: (e: React.FormEvent) => void;
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  onCancelRecording: () => void;
  onStopRecording: () => void;
  onSendAudioMessage: () => void;
  isSending: boolean;
  isInternalComment: boolean;
  setIsInternalComment: (value: boolean) => void;
  emailTemplates: EmailTemplate[] | undefined;
  onApplyTemplate: (template: EmailTemplate) => void;
  pendingFiles: PendingFile[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (fileId: string) => void;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  onTyping: () => void;
  onStartRecording: () => void;
  // Reply/quote feature
  replyingTo: InboxMessage | null;
  onCancelReply: () => void;
};

export function MessageComposer({
  onSubmit,
  isRecording,
  recordingTime,
  audioBlob,
  onCancelRecording,
  onStopRecording,
  onSendAudioMessage,
  isSending,
  isInternalComment,
  setIsInternalComment,
  emailTemplates,
  onApplyTemplate,
  pendingFiles,
  uploading,
  fileInputRef,
  onFileSelect,
  onRemovePendingFile,
  newMessage,
  setNewMessage,
  onTyping,
  onStartRecording,
  replyingTo,
  onCancelReply,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-muted/50 px-4 py-3">
      {isRecording && (
        <RecordingUI recordingTime={recordingTime} onCancel={onCancelRecording} onStop={onStopRecording} />
      )}

      {!isRecording && audioBlob && (
        <div className="py-2">
          <AudioRecordingPreview
            audioBlob={audioBlob}
            onSend={onSendAudioMessage}
            onDiscard={onCancelRecording}
            isSending={isSending}
          />
        </div>
      )}

      {!isRecording && !audioBlob && (
        <MessageInput
          isInternalComment={isInternalComment}
          setIsInternalComment={setIsInternalComment}
          emailTemplates={emailTemplates}
          onApplyTemplate={onApplyTemplate}
          pendingFiles={pendingFiles}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onFileSelect={onFileSelect}
          onRemovePendingFile={onRemovePendingFile}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onTyping={onTyping}
          onStartRecording={onStartRecording}
          isSending={isSending}
          replyingTo={replyingTo}
          onCancelReply={onCancelReply}
        />
      )}
    </form>
  );
}
