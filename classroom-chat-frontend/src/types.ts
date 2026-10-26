export interface User {
  rollNo: string;
  name: string;
  createdAt?: string;
}

export interface ServerMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  editedAt?: string;
}

/** A message the user just typed that the server has not confirmed yet. */
export interface PendingMessage {
  tempId: string;
  to: string;
  text: string;
  createdAt: string;
  status: 'sending' | 'failed';
}

/** What the UI renders: a server message or a pending one. */
export interface ChatMessage {
  key: string;
  id?: number;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  status: 'sent' | 'sending' | 'failed';
}

/** 'class' for the group chat, otherwise the other person's roll number. */
export type ChatId = string;
export const CLASS_ID: ChatId = 'class';
export const MAX_TEXT = 500;
