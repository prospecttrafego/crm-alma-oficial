import { useCallback, useEffect, useRef, useState } from "react";
import { filesApi } from "@/lib/api/files";
import { conversationsApi } from "@/lib/api/conversations";
import { queryClient } from "@/lib/queryClient";
import type { ConversationWithRelations } from "@/lib/api/conversations";

interface UseInboxAudioRecorderOptions {
  selectedConversation: ConversationWithRelations | null;
  isInternalComment: boolean;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onSentSound: () => void;
}

export function useInboxAudioRecorder({
  selectedConversation,
  isInternalComment,
  onError,
  onSuccess,
  onSentSound,
}: UseInboxAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream; // Store stream reference for cleanup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        // Stop stream tracks and clear ref
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (_error) {
      // Clean up stream on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      onError("Erro ao iniciar gravação");
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [isRecording]);

  const sendAudioMessage = useCallback(async () => {
    if (!audioBlob || !selectedConversation) return;

    try {
      // Upload audio file
      const { uploadURL, objectPath } = await filesApi.getUploadUrl({ size: audioBlob.size });

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      // Create message with audio
      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: "Mensagem de audio",
        isInternal: isInternalComment,
      });

      // Attach audio file to message
      await filesApi.register({
        name: `audio_${Date.now()}.webm`,
        mimeType: "audio/webm",
        size: audioBlob.size,
        objectPath,
        entityType: "message",
        entityId: messageData.id,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setAudioBlob(null);
      setRecordingTime(0);
      onSentSound();
      onSuccess("Mensagem salva");
    } catch (_error) {
      onError("Erro ao enviar áudio");
    }
  }, [audioBlob, selectedConversation, isInternalComment, onSuccess, onError, onSentSound]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    sendAudioMessage,
  };
}
