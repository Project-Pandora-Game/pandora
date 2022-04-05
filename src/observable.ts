import { useEffect, useState } from 'react';
import { TypedEvent, TypedEventEmitter } from './event';

/** Class that stores value of type T, while allowing subscribers to observe reference changes */
export class Observable<T> {
	private _value: T;
	private _observers: Set<(value: T) => void> = new Set();

	constructor(defaultValue: T) {
		this._value = defaultValue;
	}

	/** Get the current value */
	public get value(): T {
		return this._value;
	}

	/** Set a new value, notifying all observers */
	public set value(value: T) {
		if (this._value !== value) {
			this._value = value;
			this._observers.forEach((observer) => observer(value));
		}

	}

	public subscribe(observer: (value: T) => void): () => void {
		this._observers.add(observer);
		return () => this._observers.delete(observer);
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useObservable<T>(obs: Observable<T>): T {
	const [value, setValue] = useState<T>(obs.value);
	useEffect(() => {
		return obs.subscribe(setValue);
	}, [obs]);
	return value;
}

export abstract class ObservableClass<T extends TypedEvent> extends TypedEventEmitter<T> {
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function observable() {
	return <T extends TypedEvent>(target: TypedEventEmitter<T>, key: keyof T) => {
		let value = target[key as keyof typeof target];
		Object.defineProperty(target, key, {
			get() {
				return value;
			},
			set(newValue: typeof value) {
				if (value !== newValue)
					value = newValue;
				// @ts-expect-error: call protected method
				target.emit(key, value as T[keyof T]);
			},
		});
	};
}

