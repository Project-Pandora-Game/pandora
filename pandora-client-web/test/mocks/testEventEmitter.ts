import { TypedEvent, TypedEventEmitter } from 'pandora-common';

/** Event emitter implementation for testing which allows events to be manually emitted */
export class TestEventEmitter<T extends TypedEvent> extends TypedEventEmitter<T> {
	public fireEvent<K extends keyof T>(event: K, value: T[K]): void {
		this.emit(event, value);
	}
}
