import type { IChatSegment } from './chat';

export interface ChatMessageFilter {
	isActive(): boolean;
	processMessage(content: IChatSegment[]): IChatSegment[];
}

export class CompoundChatMessageFilter implements ChatMessageFilter {
	public readonly filters: readonly ChatMessageFilter[];

	constructor(filters: readonly ChatMessageFilter[]) {
		this.filters = filters;
	}

	public isActive(): boolean {
		return this.filters.some((f) => f.isActive());
	}

	public processMessage(content: IChatSegment[]): IChatSegment[] {
		for (const filter of this.filters) {
			content = filter.processMessage(content);
		}
		return content;
	}
}

export class CustomChatMessageFilter implements ChatMessageFilter {
	public readonly fn: (content: IChatSegment[]) => IChatSegment[];

	constructor(fn: (content: IChatSegment[]) => IChatSegment[]) {
		this.fn = fn;
	}

	public isActive(): boolean {
		return true;
	}

	public processMessage(content: IChatSegment[]): IChatSegment[] {
		return this.fn(content);
	}
}
