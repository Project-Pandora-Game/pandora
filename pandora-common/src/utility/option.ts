/* eslint-disable @typescript-eslint/naming-convention */

interface OptionBase<T> extends Iterable<T, void> {
	/** Returns `true` if the option is a `Some` value. */
	is_some(): this is OptionSome<T>;

	/**
	 * Returns `true` if the option is a `Some` and the value inside of it matches a predicate.
	 */
	is_some_and(f: (value: T) => boolean): boolean;

	/**
	 * Returns `true` if the option is a `None` value.
	 */
	is_none(): this is OptionNone;

	/**
	 * Returns `true` if the option is a `None` or the value inside of it matches a predicate.
	 */
	is_none_or(f: (value: T) => boolean): boolean;

	/**
	 * Returns a slice of the contained value, if any. If this is `None`, an empty slice is returned. This can be useful to have a single type of iterator over an `Option` or slice.
	 */
	as_slice(): [T] | [];

	/**
	 * Returns the contained `Some` value, consuming the `self` value.
	 *
	 * @throws if the value is a `None` with a custom panic message provided by `msg`.
	 */
	expect(msg: string): T;

	/**
	 * Returns the contained `Some` value.
	 *
	 * Because this function may throw, its use is generally discouraged.
	 * Instead, prefer to use pattern matching and handle the `None` case explicitly, or call `unwrap_or`, or `unwrap_or_else`.
	 *
	 * @throws if the self value equals `None`.
	 */
	unwrap(): T;

	/**
	 * Returns the contained `Some` value or a provided default.
	 *
	 * Arguments passed to `unwrap_or` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `unwrap_or_else`, which is lazily evaluated.
	 */
	unwrap_or<U>(defaultValue: U): T | U;

	/**
	 * Returns the contained `Some` value or computes it from a closure.
	 */
	unwrap_or_else<U>(f: () => U): T | U;

	/**
	 * Maps an `Option<T>` to `Option<U>` by applying a function to a contained value (if `Some`) or returns None (if `None`).
	 */
	map<U>(f: (value: T) => U): Option<U>;

	/**
	 * Calls a function with a reference to the contained value if `Some`.
	 *
	 * Returns the original option.
	 */
	inspect(f: (value: T) => void): this;

	/**
	 * Returns the provided default result (if none), or applies a function to the contained value (if any).
	 *
	 * Arguments passed to `map_or` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `map_or_else`, which is lazily evaluated.
	 */
	map_or<U, V>(defaultValue: U, f: (value: T) => V): U | V;

	/**
	 * Computes a default function result (if none), or applies a different function to the contained value (if any).
	 */
	map_or_else<U, V>(defaultF: () => U, f: (value: T) => V): U | V;

	/**
	 * Returns an iterator over the possibly contained value.
	 */
	iter(): Iterator<T, void>;

	/**
	 * Returns `None` if the option is `None`, otherwise returns `optb`.
	 *
	 * Arguments passed to `and` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `and_then`, which is lazily evaluated.
	 */
	and<U>(optb: Option<U>): Option<U>;

	/**
	 * Returns `None` if the option is `None`, otherwise calls `f` with the wrapped value and returns the result.
	 *
	 * Some languages call this operation flatmap.
	 */
	and_then<U>(f: (value: T) => Option<U>): Option<U>;

	/**
	 * Returns `None` if the option is `None`, otherwise calls `predicate` with the wrapped value and returns:
	 *
	 * - `Some(t)` if `predicate` returns `true` (where `t` is the wrapped value), and
	 * - `None` if `predicate` returns `false`.
	 *
	 * This function works similar to `Iterator::filter()`. You can imagine the Option<T> being an iterator over one or zero elements. `filter()` lets you decide which elements to keep.
	 */
	filter(predicate: (value: T) => boolean): Option<T>;
	filter<U extends T>(predicate: (value: T) => value is U): Option<U>;

	/**
	 * Returns the option if it contains a value, otherwise returns `optb`.
	 *
	 * Arguments passed to `or` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `or_else`, which is lazily evaluated.
	 */
	or<U>(optb: Option<U>): OptionSome<T> | Option<U>;

	/**
	 * Returns the option if it contains a value, otherwise calls `f` and returns the result.
	 */
	or_else<U>(f: () => Option<U>): OptionSome<T> | Option<U>;

	/**
	 * Returns `Some` if exactly one of `self`, `optb` is `Some`, otherwise returns `None`.
	 */
	xor<U>(optb: Option<U>): Option<T> | Option<U>;

	/**
	 * Zips `self` with another `Option`.
	 *
	 * If `self` is `Some(s)` and `other` is `Some(o)`, this method returns `Some((s, o))`. Otherwise, `None` is returned.
	 */
	zip<U>(other: Option<U>): Option<[T, U]>;

	/**
	 * Zips `self` and another `Option` with function `f`.
	 *
	 * If `self` is `Some(s)` and `other` is `Some(o)`, this method returns `Some(f(s, o))`. Otherwise, `None` is returned.
	 */
	zip_with<U, R>(other: Option<U>, f: (value: T, otherValue: U) => R): Option<R>;

	/**
	 * Reduces two options into one, using the provided function if both are `Some`.
	 *
	 * If `self` is `Some(s)` and `other` is `Some(o)`, this method returns `Some(f(s, o))`. Otherwise, if only one of `self` and `other` is `Some`, that one is returned. If both `self` and `other` are `None`, `None` is returned.
	 */
	reduce<U, R>(other: Option<U>, f: (value: T, otherValue: U) => R): Option<T> | Option<U> | OptionSome<R>;
}

export class OptionSome<T> implements OptionBase<T> {
	public readonly value: T;

	constructor(value: T) {
		this.value = value;
	}

	public is_some(): this is OptionSome<T> {
		return true;
	}

	public is_some_and(f: (value: T) => boolean): boolean {
		return f(this.value);
	}

	public is_none(): this is never {
		return false;
	}

	public is_none_or(f: (value: T) => boolean): boolean {
		return f(this.value);
	}

	public as_slice(): [] | [T] {
		return [this.value];
	}

	public expect(_msg: string): T {
		return this.value;
	}

	public unwrap(): T {
		return this.value;
	}

	public unwrap_or<U>(_defaultValue: U): T {
		return this.value;
	}

	public unwrap_or_else<U>(_f: () => U): T {
		return this.value;
	}

	public map<U>(f: (value: T) => U): Option<U> {
		return new OptionSome(f(this.value));
	}

	public inspect(f: (value: T) => void): this {
		f(this.value);
		return this;
	}

	public map_or<U, V>(_defaultValue: U, f: (value: T) => V): V {
		return f(this.value);
	}

	public map_or_else<U, V>(_defaultF: () => U, f: (value: T) => V): V {
		return f(this.value);
	}

	public *iter(): Iterator<T, void> {
		yield this.value;
	}

	public *[Symbol.iterator](): Iterator<T, void> {
		yield this.value;
	}

	public and<U>(optb: Option<U>): Option<U> {
		return optb;
	}

	public and_then<U>(f: (value: T) => Option<U>): Option<U> {
		return f(this.value);
	}

	public filter(predicate: (value: T) => boolean): Option<T>;
	public filter<U extends T>(predicate: (value: T) => value is U): Option<U>;
	public filter(predicate: (value: T) => boolean): OptionSome<T> | OptionNone {
		return predicate(this.value) ? this : Option.None;
	}

	public or<U>(_optb: Option<U>): this {
		return this;
	}

	public or_else<U>(_f: () => Option<U>): this {
		return this;
	}

	public xor<U>(optb: Option<U>): OptionSome<T> | OptionNone {
		if (optb.is_some()) {
			return Option.None;
		} else {
			return this;
		}
	}

	public zip<U>(other: Option<U>): Option<[T, U]> {
		if (other.is_some()) {
			return new OptionSome<[T, U]>([this.value, other.value]);
		} else {
			return Option.None;
		}
	}

	public zip_with<U, R>(other: Option<U>, f: (value: T, otherValue: U) => R): Option<R> {
		if (other.is_some()) {
			return new OptionSome(f(this.value, other.value));
		} else {
			return Option.None;
		}
	}

	public reduce<U, R>(other: Option<U>, f: (value: T, otherValue: U) => R): OptionSome<T> | OptionSome<R> {
		if (other.is_some()) {
			return new OptionSome(f(this.value, other.value));
		} else {
			return this;
		}
	}
}

export class OptionNone implements OptionBase<never> {
	private constructor() {
		// Nothing
	}

	public is_some(): this is never {
		return false;
	}

	public is_some_and(_f: (value: never) => boolean): false {
		return false;
	}

	public is_none(): this is OptionNone {
		return true;
	}

	public is_none_or(_f: (value: never) => boolean): true {
		return true;
	}

	public as_slice(): [] | [never] {
		return [];
	}

	public expect(msg: string): never {
		throw new Error(msg);
	}

	public unwrap(): never {
		throw new Error('called `Option::unwrap()` on a `None` value');
	}

	public unwrap_or<U>(defaultValue: U): U {
		return defaultValue;
	}

	public unwrap_or_else<U>(f: () => U): U {
		return f();
	}

	public map<U>(_f: (value: never) => U): this {
		return this;
	}

	public inspect(_f: (value: never) => void): this {
		return this;
	}

	public map_or<U, V>(defaultValue: U, _f: (value: never) => V): U {
		return defaultValue;
	}

	public map_or_else<U, V>(defaultF: () => U, _f: (value: never) => V): U {
		return defaultF();
	}

	public *iter(): Iterator<never, void> {
		// Nothing
	}

	public *[Symbol.iterator](): Iterator<never, void> {
		// Nothing
	}

	public and<U>(_optb: Option<U>): this {
		return this;
	}

	public and_then<U>(_f: (value: never) => Option<U>): this {
		return this;
	}

	public filter(predicate: (value: never) => boolean): Option<never>;
	public filter<U extends never>(predicate: (value: never) => value is U): Option<U>;
	public filter(_predicate: unknown): this {
		return this;
	}

	public or<U>(optb: Option<U>): Option<U> {
		return optb;
	}

	public or_else<U>(f: () => Option<U>): Option<U> {
		return f();
	}

	public xor<U>(optb: Option<U>): Option<U> {
		return optb;
	}

	public zip<U>(_other: Option<U>): this {
		return this;
	}

	public zip_with<U, R>(_other: Option<U>, _f: (value: never, otherValue: U) => R): this {
		return this;
	}

	public reduce<U, R>(other: Option<U>, _f: (value: never, otherValue: U) => R): Option<U> {
		return other;
	}

	public static readonly INSTANCE: OptionNone = new OptionNone();
}

/**
 * Result is a type that represents either success (Ok) or failure (Err).
 */
export type Option<T> = OptionSome<T> | OptionNone;

export const Option: {
	Some<T>(value: T): OptionSome<T>;
	readonly None: OptionNone;
} = {
	Some<T>(value: T): OptionSome<T> {
		return new OptionSome(value);
	},
	None: OptionNone.INSTANCE,
};
