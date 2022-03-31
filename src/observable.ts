import { useEffect, useState } from 'react';

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
		this._value = value;
		this._observers.forEach((observer) => observer(value));
	}

	public subscribe(observer: (value: T) => void): () => void {
		this._observers.add(observer);
		return () => this._observers.delete(observer);
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useObservable<T>(observable: Observable<T>): T {
	const [value, setValue] = useState<T>(observable.value);
	useEffect(() => {
		return observable.subscribe(setValue);
	}, [observable]);
	return value;
}

export class ObservableSet<T> {
	private _observers: Map<keyof T, Set<(value: T[keyof T]) => void>> = new Map();
	private _allObservers: Set<(value: Partial<T>) => void> = new Set();

	protected dispatch<K extends keyof T>(key: K, value: T[K]) {
		this._observers.get(key)?.forEach((observer) => observer(value));
		const obj: Partial<T> = { [key]: value } as unknown as Partial<T>;
		this._allObservers.forEach((observer) => observer(obj));
	}

	public subscribe<K extends keyof T>(key: K, observer: (value: T[K]) => void): () => void {
		let observers = this._observers.get(key) as Set<(value: T[K]) => void>;
		if (!observers) {
			observers = new Set<(value: T[K]) => void>();
			this._observers.set(key, observers as Set<(value: T[keyof T]) => void>);
		}
		observers.add(observer);
		return () => {
			observers.delete(observer);
			if (observers.size === 0) {
				this._observers.delete(key);
			}
		};
	}

	public subscribeAll(observer: (value: Partial<T>) => void): () => void {
		this._allObservers.add(observer);
		return () => this._allObservers.delete(observer);
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useObservableSet<T, K extends keyof T>(
	observable: ObservableSet<T> & { [key in K]: T[K] },
	key: K,
): T[K] {
	const [value, setValue] = useState<T[K]>(observable[key]);
	useEffect(() => {
		return observable.subscribe(key, setValue);
	}, [observable, key]);
	return value;
}
