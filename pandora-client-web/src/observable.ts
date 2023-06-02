import { noop } from 'lodash';
import { useSyncExternalStore } from 'react';
import { TypedEvent, TypedEventEmitter } from 'pandora-common';
import { produce, Draft } from 'immer';

export type Observer<T> = (value: T) => void;
export type UnsubscribeCallback = () => void;

export interface ReadonlyObservable<T> {
	readonly value: T;
	subscribe(observer: Observer<T>, callImmediately?: boolean): UnsubscribeCallback;
}

/** Class that stores value of type T, while allowing subscribers to observe reference changes */
export class Observable<T> implements ReadonlyObservable<T> {
	private _value: T;
	private readonly _observers: Set<(value: T) => void> = new Set();

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

	public subscribe(observer: (value: T) => void, callImmediately: boolean = false): () => void {
		this._observers.add(observer);
		if (callImmediately) {
			observer(this._value);
		}
		return () => this._observers.delete(observer);
	}

	public produce(producer: (value: T) => T): void {
		this.value = producer(this.value);
	}

	public produceImmer<D = Draft<T>>(producer: (value: D) => D | void | undefined): void {
		this.value = produce(this.value, producer);
	}
}

export class StaticObservable<T> implements ReadonlyObservable<T> {
	public readonly value: T;

	constructor(value: T) {
		this.value = value;
	}

	public subscribe(_observer: Observer<T>): UnsubscribeCallback {
		return noop;
	}
}

export const NULL_OBSERVABLE: ReadonlyObservable<null> = new StaticObservable(null);

export function useObservable<T>(obs: ReadonlyObservable<T>): T {
	return useSyncExternalStore((cb) => obs.subscribe(cb), () => obs.value);
}

export function useNullableObservable<T>(obs: ReadonlyObservable<T> | null | undefined): T | null {
	return useObservable(obs ?? NULL_OBSERVABLE);
}

export abstract class ObservableClass<T extends TypedEvent> extends TypedEventEmitter<T> {
}

export function ObservableProperty<const EventName extends string>(eventName: EventName) {
	return function <T extends (TypedEvent & Record<EventName, unknown>), Value extends T[EventName]>(
		target: ClassAccessorDecoratorTarget<ObservableClass<T>, Value>,
		_context: ClassAccessorDecoratorContext<ObservableClass<T>, Value>,
	): ClassAccessorDecoratorResult<ObservableClass<T>, Value> {
	return {
			get(this: ObservableClass<T>): Value {
			return target.get.call(this);
		},
			set(this: ObservableClass<T>, value: Value): void {
			if (target.get.call(this) === value) {
				return;
			}
			target.set.call(this, value);
				this.emit.apply(this, [eventName, value]);
		},
	};
	};
}

export type IObservableClass<T extends TypedEvent> = TypedEventEmitter<T> & {
	[K in keyof T]: T[K];
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useObservableProperty<O extends IObservableClass<any>, K extends O extends IObservableClass<infer R> ? keyof R : never>(obs: O, key: K): O extends IObservableClass<infer R> ? R[K] : never {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return useSyncExternalStore(obs.getSubscriber(key), () => obs[key]);
}
