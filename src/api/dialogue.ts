import { demoMode, request } from './client';

export interface DialogueMessage {
  messageId: string;
  templateId: string;
  language: 'EN' | 'ID' | 'DE';
  renderedText: string;
  englishCopy: string;
  status: 'DRAFT' | 'SENT' | 'REPLIED' | 'TIMED_OUT' | 'BLOCKED';
  createdAt?: string;
  sentAt?: string;
  reminderSent?: boolean;
  replySignalId?: string;
  reply?: { receivedAt: string; text: string };
}

export async function dialogue(caseId: string, signal?: AbortSignal): Promise<DialogueMessage[]> {
  if (demoMode) return [];
  const result = await request<unknown>(`/cases/${encodeURIComponent(caseId)}/dialogue`, undefined, signal);
  if (!Array.isArray(result) || !result.every(isDialogueMessage)) {
    throw new Error('Dialogue response is not compatible with this console.');
  }
  return result;
}

export function isDialogueMessage(value: unknown): value is DialogueMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DialogueMessage>;
  return typeof item.messageId === 'string' && typeof item.templateId === 'string'
    && ['EN', 'ID', 'DE'].includes(item.language ?? '')
    && typeof item.renderedText === 'string' && typeof item.englishCopy === 'string'
    && ['DRAFT', 'SENT', 'REPLIED', 'TIMED_OUT', 'BLOCKED'].includes(item.status ?? '')
    && (item.reply === undefined || typeof item.reply.text === 'string'
      && typeof item.reply.receivedAt === 'string');
}
