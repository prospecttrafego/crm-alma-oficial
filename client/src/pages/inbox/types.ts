import type { MessagesResponse } from "@/lib/api/conversations";

export interface PendingFile {
  id: string;
  file: globalThis.File;
  uploadURL?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}

/**
 * Status de entrega de mensagem (para optimistic updates)
 * - sending: Mensagem sendo enviada ao servidor
 * - sent: Servidor recebeu e salvou
 * - delivered: Entregue ao destinatario (WebSocket confirmou)
 * - read: Lido pelo destinatario
 * - error: Falha ao enviar
 */
export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

/**
 * Mensagem do inbox com campos adicionais para optimistic updates
 */
export type InboxMessage = MessagesResponse["messages"][number] & {
  /** Status local para mensagens otimistas (nao vem do servidor) */
  _status?: MessageStatus;
  /** ID temporario para mensagens otimistas */
  _tempId?: string;
  /** Erro se _status === 'error' */
  _error?: string;
};

export type TypingUser = {
  userId: string;
  userName?: string | null;
};

