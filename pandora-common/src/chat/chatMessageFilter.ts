import type { Immutable } from 'immer';
import type { CharacterId } from '../character/index.ts';
import type { IChatSegment } from './chat.ts';

export interface ChatMessageFilter {
	isActive(): boolean;
	processMessage(content: IChatSegment[], metadata: Immutable<ChatMessageFilterMetadata>): IChatSegment[];
}

export interface ChatMessageFilterMetadata {
	/** Id of the character the message is from */
	from: CharacterId;
	/** Character(s) this message is being whispered to, or `null` of normal chat message */
	to: CharacterId[] | null;
}

export class CompoundChatMessageFilter implements ChatMessageFilter {
	public readonly filters: readonly ChatMessageFilter[];

	constructor(filters: readonly ChatMessageFilter[]) {
		this.filters = filters;
	}

	public isActive(): boolean {
		return this.filters.some((f) => f.isActive());
	}

	public processMessage(content: IChatSegment[], metadata: Immutable<ChatMessageFilterMetadata>): IChatSegment[] {
		for (const filter of this.filters) {
			content = filter.processMessage(content, metadata);
		}
		return content;
	}
}

export class CustomChatMessageFilter implements ChatMessageFilter {
	public readonly fn: (content: IChatSegment[], metadata: Immutable<ChatMessageFilterMetadata>) => IChatSegment[];

	constructor(fn: (content: IChatSegment[], metadata: Immutable<ChatMessageFilterMetadata>) => IChatSegment[]) {
		this.fn = fn;
	}

	public isActive(): boolean {
		return true;
	}

	public processMessage(content: IChatSegment[], metadata: Immutable<ChatMessageFilterMetadata>): IChatSegment[] {
		return this.fn(content, metadata);
	}
}
