import type { IChatSegment } from './chat';

export interface ChatMessageFilter {
	isActive(): boolean;
	processMessage(content: IChatSegment[]): IChatSegment[];
}
