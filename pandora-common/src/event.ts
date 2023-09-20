export type TypedEvent = Record<string | symbol | number, unknown>;

export interface ITypedEventEmitter<T extends TypedEvent> {
	on<K extends keyof T>(s: K, listener: (v: T[K]) => void): () => void;
	onAny(listener: (value: Partial<T>) => void): () => void;
	getSubscriber(key: keyof T): (onStoreChange: () => void) => () => void;
}

export abstract class TypedEventEmitter<T extends TypedEvent> implements ITypedEventEmitter<T> {
	private readonly _listeners: Map<keyof T, Set<(value: T[keyof T]) => void>> = new Map();
	private readonly _allListeners: Set<(value: Partial<T>) => void> = new Set();

	public onAny(listener: (value: Partial<T>) => void): () => void {
		this._allListeners.add(listener);
		return () => {
			this._allListeners.delete(listener);
		};
	}

	public on<K extends keyof T>(event: K, listener: (value: T[K]) => void): () => void {
		let listeners = this._listeners.get(event) as Set<(value: T[K]) => void>;
		if (!listeners) {
			listeners = new Set<(value: T[K]) => void>();
			this._listeners.set(event, listeners as Set<(value: T[keyof T]) => void>);
		}
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) {
				this._listeners.delete(event);
			}
		};
	}

	public getSubscriber(key: keyof T): (onStoreChange: () => void) => () => void {
		return (onStoreChange) => this.on(key, () => onStoreChange());
	}

	protected emit<K extends keyof T>(event: K, value: T[K]): void {
		this._listeners.get(event)?.forEach((observer) => observer(value));
		const obj: Partial<T> = { [event]: value } as unknown as Partial<T>;
		this._allListeners.forEach((observer) => observer(obj));
	}
}

export class NoopEventEmitter<T extends TypedEvent> extends TypedEventEmitter<T> {
}
