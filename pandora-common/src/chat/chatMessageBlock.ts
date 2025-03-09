import type { IClientMessage } from './chat.ts';

export type BlockableChatMessage = Extract<IClientMessage, { type: 'chat'; }>;

export type ChatMessageBlockingResult = {
	result: 'ok';
} | {
	result: 'block';
	reason: string;
};
