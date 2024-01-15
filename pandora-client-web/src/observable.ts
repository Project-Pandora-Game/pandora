import { noop } from 'lodash';
import { useSyncExternalStore } from 'react';
import { ClassNamedAccessorDecoratorContext, GetLogger, TypedEvent, TypedEventEmitter } from 'pandora-common';
import { produce, Draft } from 'immer';
import { NODE_ENV, USER_DEBUG } from './config/Environment';

export type Observer<T> = (value: T) => void;
export type UnsubscribeCallback = () => void;

export interface ReadonlyObservable<T> {
	readonly value: T;
	subscribe(observer: Observer<T>, callImmediately?: boolean): UnsubscribeCallback;
}

class NormalObservable<T> implements ReadonlyObservable<T> {
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

class RateLimitedObservable<T> extends NormalObservable<T> {
	private static timeWindow = 1000;
	private static maxEvents = 10;
	private static maxDelay = 10;
	// TODO: maybe enable this, but for now it breaks the hover preview
	private static enabled = false;

	private lastEventTime = 0;
	private storageEventCount = 0;
	private async = false;

	constructor(defaultValue: T) {
		super(defaultValue);
	}

	public override get value(): T {
		return super.value;
	}

	public override set value(value: T) {
		if (!RateLimitedObservable.enabled) {
			super.value = value;
			return;
		}
		const actualSet = () => {
			super.value = value;

			const now = Date.now();
			const timeDiff = now - this.lastEventTime;

			this.storageEventCount++;

			if (timeDiff < RateLimitedObservable.timeWindow) {
				if (this.storageEventCount > RateLimitedObservable.maxEvents) {
					this.async = true;
					GetLogger('RateLimitedObservable').error('Too many observable events in a short time window!!!', new Error().stack, this);
				}
			} else {
				this.storageEventCount = 1;
				this.lastEventTime = now;
			}
		};
		if (this.async && RateLimitedObservable.maxDelay) {
			setTimeout(actualSet, RateLimitedObservable.maxDelay);
		} else {
			actualSet();
		}
	}
}

/** Class that stores value of type T, while allowing subscribers to observe reference changes */
export const Observable = (USER_DEBUG && NODE_ENV !== 'test') ? RateLimitedObservable : NormalObservable;
/** Class that stores value of type T, while allowing subscribers to observe reference changes */
export type Observable<T> = NormalObservable<T>;

if (USER_DEBUG && NODE_ENV !== 'test') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
	(window as any).RateLimitedObservable = RateLimitedObservable;
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

export type IObservableClass<T extends TypedEvent> = ObservableClass<T> & {
	[K in keyof T]: T[K];
};

export function ObservableProperty<T extends TypedEvent, K extends keyof T & (string | symbol)>(
	target: ClassAccessorDecoratorTarget<ObservableClass<T>, T[K]>,
	context: ClassNamedAccessorDecoratorContext<IObservableClass<T>, K>,
): ClassAccessorDecoratorResult<IObservableClass<T>, T[K]> {
	return {
		get(this: ObservableClass<T>): T[K] {
			return target.get.call(this);
		},
		set(this: ObservableClass<T>, value: T[K]): void {
			if (target.get.call(this) === value) {
				return;
			}
			target.set.call(this, value);
			this.emit.apply(this, [context.name, value]);
		},
	};
}

export function useObservableProperty<T extends TypedEvent, const K extends keyof T>(obs: IObservableClass<T>, key: K): T[K] {
	return useSyncExternalStore(obs.getSubscriber(key), () => obs[key]);
}
