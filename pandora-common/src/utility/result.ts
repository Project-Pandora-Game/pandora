import { Option, OptionSome, type OptionNone } from './option.ts';

/* eslint-disable @typescript-eslint/naming-convention */

interface ResultBase<T, E> extends Iterable<T, void> {
	/** Returns `true` if the result is `Ok`. */
	is_ok(): this is ResultOk<T>;

	/** Returns `true` if the result is `Ok` and the value inside of it matches a predicate. */
	is_ok_and(f: (value: T) => boolean): boolean;

	/** Returns `true` if the result is `Err`. */
	is_err(): this is ResultErr<E>;

	/** Returns `true` if the result is `Err` and the value inside of it matches a predicate. */
	is_err_and(f: (error: E) => boolean): boolean;

	/**
	 * Converts from `Result<T, E>` to `Option<T>`.
	 *
	 * Converts self into an `Option<T>`, and converting the error to `None`, if any.
	 */
	ok(): Option<T>;

	/**
	 * Converts from `Result<T, E>` to `Option<E>`.
	 *
	 * Converts self into an `Option<E>`, and discarding the success value, if any.
	 */
	err(): Option<E>;

	/**
	 * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained `Ok` value, leaving an `Err` value untouched.
	 *
	 * This function can be used to compose the results of two functions.
	 */
	map<U>(op: (value: T) => U): Result<U, E>;

	/**
	 * Returns the provided default (if `Err`), or applies a function to the contained value (if `Ok`).
	 *
	 * Arguments passed to `map_or` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `map_or_else`, which is lazily evaluated.
	 */
	map_or<U, V>(defaultValue: U, f: (value: T) => V): U | V;

	/**
	 * Maps a `Result<T, E>` to `U` by applying fallback function `defaultF` to a contained `Err` value, or function `f` to a contained `Ok` value.
	 *
	 * This function can be used to unpack a successful result while handling an error.
	 */
	map_or_else<U, V>(defaultF: (error: E) => U, f: (value: T) => V): U | V;

	/**
	 * Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a contained `Err` value, leaving an `Ok` value untouched.
	 *
	 * This function can be used to pass through a successful result while handling an error.
	 */
	map_err<F>(op: (error: E) => F): Result<T, F>;

	/**
	 * Calls a function with the contained value if `Ok`.
	 *
	 * Returns the original result.
	 */
	inspect(f: (value: T) => void): this;

	/**
	 * Calls a function with a reference to the contained value if `Err`.
	 *
	 * Returns the original result.
	 */
	inspect_err(f: (error: E) => void): this;

	/**
	 * Returns an iterator over the possibly contained value.
	 *
	 * The iterator yields one value if the result is `Result::Ok`, otherwise none.
	 */
	iter(): Iterator<T, void>;

	/**
	 * Returns the contained `Ok` value.
	 *
	 * Because this function may throw, its use is generally discouraged.
	 * Instead, prefer to use pattern matching and handle the `Err` case explicitly, or call `unwrap_or` or `unwrap_or_else`.
	 *
	 * @throws if the value is an `Err`, with an error including the passed message, and the content of the `Err`.
	 */
	expect(msg: string): T;

	/**
	 * Returns the contained `Ok` value.
	 *
	 * Because this function may throw, its use is generally discouraged.
	 *Instead, prefer to use pattern matching and handle the `Err` case explicitly, or call `unwrap_or` or `unwrap_or_else`.
	 *
	 * @throws if the value is an `Err`, with an error including the `Err`'s value.
	 */
	unwrap(): T;

	/**
	 * Returns the contained `Err` value.
	 *
	 * @throws if the value is an `Ok`, with an error message including the passed message, and the content of the `Ok`.
	 */
	expect_err(msg: string): E;

	/**
	 * Returns the contained `Err` value.
	 *
	 * @throws if the value is an `Ok`, with an error including the `Ok`'s value.
	 */
	unwrap_err(): E;

	/**
	 * Returns `res` if the result is `Ok`, otherwise returns the `Err` value of self.
	 *
	 * Arguments passed to `and` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `and_then`, which is lazily evaluated.
	 */
	and<U, F>(res: Result<U, F>): Result<U, F> | ResultErr<E>;

	/**
	 * Calls `op` if the result is `Ok`, otherwise returns the `Err` value of self.
	 *
	 * This function can be used for control flow based on `Result` values.
	 */
	and_then<U, F>(op: (value: T) => Result<U, F>): Result<U, F> | ResultErr<E>;

	/**
	 * Returns `res` if the result is `Err`, otherwise returns the `Ok` value of self.
	 *
	 * Arguments passed to `or` are eagerly evaluated; if you are passing the result of a function call, it is recommended to use `or_else`, which is lazily evaluated.
	 */
	or<U, F>(res: Result<U, F>): Result<U, F> | ResultOk<T>;

	/**
	 * Calls `op` if the result is `Err`, otherwise returns the `Ok` value of self.
	 *
	 * This function can be used for control flow based on result values.
	 */
	or_else<U, F>(op: (error: E) => Result<U, F>): Result<U, F> | ResultOk<T>;

	/**
	 * Returns the contained Ok value or a provided default.
	 *
	 * Arguments passed to unwrap_or are eagerly evaluated; if you are passing the result of a function call, it is recommended to use unwrap_or_else, which is lazily evaluated.
	 */
	unwrap_or<U>(defaultValue: U): T | U;

	/**
	 * Returns the contained Ok value or computes it from a closure.
	 */
	unwrap_or_else<U>(op: (error: E) => U): T | U;
}

export class ResultOk<T> implements ResultBase<T, never> {
	public readonly value: T;

	constructor(value: T) {
		this.value = value;
	}

	public is_ok(): this is ResultOk<T> {
		return true;
	}

	public is_ok_and(f: (value: T) => boolean): boolean {
		return f(this.value);
	}

	public is_err(): this is never {
		return false;
	}

	public is_err_and(_f: (error: never) => boolean): false {
		return false;
	}

	public ok(): OptionSome<T> {
		return Option.Some(this.value);
	}

	public err(): OptionNone {
		return Option.None;
	}

	public map<U>(op: (value: T) => U): ResultOk<U> {
		return new ResultOk(op(this.value));
	}

	public map_or<U, V>(_defaultValue: U, f: (value: T) => V): V {
		return f(this.value);
	}

	public map_or_else<U, V>(_defaultF: (error: never) => U, f: (value: T) => V): V {
		return f(this.value);
	}

	public map_err<F>(_op: (error: never) => F): this {
		return this;
	}

	public inspect(f: (value: T) => void): this {
		f(this.value);
		return this;
	}

	public inspect_err(_f: (error: never) => void): this {
		return this;
	}

	public *iter(): Iterator<T, void> {
		yield this.value;
	}

	public *[Symbol.iterator](): Iterator<T, void> {
		yield this.value;
	}

	public expect(_msg: string): T {
		return this.value;
	}

	public unwrap(): T {
		return this.value;
	}

	public expect_err(msg: string): never {
		throw new Error(msg, { cause: this.value });
	}

	public unwrap_err(): never {
		throw new Error('called `Result::unwrap_err()` on an `Ok` value', { cause: this.value });
	}

	public and<U, F>(res: Result<U, F>): Result<U, F> {
		return res;
	}

	public and_then<U, F>(op: (value: T) => Result<U, F>): Result<U, F> {
		return op(this.value);
	}

	public or<U, F>(_res: Result<U, F>): this {
		return this;
	}

	public or_else<U, F>(_op: (error: never) => Result<U, F>): this {
		return this;
	}

	public unwrap_or<U>(_defaultValue: U): T {
		return this.value;
	}

	public unwrap_or_else<U>(_op: (error: never) => U): T {
		return this.value;
	}
}

export class ResultErr<E> implements ResultBase<never, E> {
	public readonly error: E;

	constructor(error: E) {
		this.error = error;
	}

	public is_ok(): this is never {
		return false;
	}

	public is_ok_and(_f: (value: never) => boolean): false {
		return false;
	}

	public is_err(): this is ResultErr<E> {
		return true;
	}

	public is_err_and(f: (error: E) => boolean): boolean {
		return f(this.error);
	}

	public ok(): OptionNone {
		return Option.None;
	}

	public err(): OptionSome<E> {
		return Option.Some(this.error);
	}

	public map<U>(_op: (value: never) => U): this {
		return this;
	}

	public map_or<U, V>(defaultValue: U, _f: (value: never) => V): U {
		return defaultValue;
	}

	public map_or_else<U, V>(defaultF: (error: E) => U, _f: (value: never) => V): U {
		return defaultF(this.error);
	}

	public map_err<F>(op: (error: E) => F): ResultErr<F> {
		return new ResultErr(op(this.error));
	}

	public inspect(_f: (value: never) => void): this {
		return this;
	}

	public inspect_err(f: (error: E) => void): this {
		f(this.error);
		return this;
	}

	public *iter(): Iterator<never, void> {
		// Nothing
	}

	public *[Symbol.iterator](): Iterator<never, void> {
		// Nothing
	}

	public expect(msg: string): never {
		throw new Error(msg, { cause: this.error });
	}

	public unwrap(): never {
		throw new Error('called `Result::unwrap()` on an `Err` value', { cause: this.error });
	}

	public expect_err(_msg: string): E {
		return this.error;
	}

	public unwrap_err(): E {
		return this.error;
	}

	public and<U, F>(_res: Result<U, F>): this {
		return this;
	}

	public and_then<U, F>(_op: (value: never) => Result<U, F>): this {
		return this;
	}

	public or<U, F>(res: Result<U, F>): Result<U, F> {
		return res;
	}

	public or_else<U, F>(op: (error: E) => Result<U, F>): Result<U, F> {
		return op(this.error);
	}

	public unwrap_or<U>(defaultValue: U): U {
		return defaultValue;
	}

	public unwrap_or_else<U>(op: (error: E) => U): U {
		return op(this.error);
	}
}

/**
 * Result is a type that represents either success (Ok) or failure (Err).
 */
export type Result<T, E> = ResultOk<T> | ResultErr<E>;

export const Result = {
	Ok<T>(value: T): ResultOk<T> {
		return new ResultOk(value);
	},
	Err<E>(error: E): ResultErr<E> {
		return new ResultErr(error);
	},
};
