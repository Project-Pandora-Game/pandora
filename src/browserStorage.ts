import { useMemo } from 'react';
import { Observable, useObservable } from './observable';

const BROWSER_STORAGES = new Map<string, BrowserStorage<unknown>>();

/** Class that saves and loads a value to/from browser's localStorage */
export class BrowserStorage<T> extends Observable<T> {
	/** Key used to store the value */
	public readonly _key;

	/**
	 * @param name - Unique identifier of the value used to store it
	 * @param defaultValue - Default value to use if there is no saved value (or validation fails)
	 * @param validate - Optional callback to validate currently saved value -
	 * if it returns `false`, then `defaultValue` is used instead of the saved one
	 */
	private constructor(name: string, defaultValue: T, validate?: (value: unknown) => boolean) {
		super(defaultValue);
		this._key = `pandora.${name}`;
		const saved = localStorage.getItem(this._key);
		if (saved !== null) {
			const value = JSON.parse(saved) as unknown;
			if (!validate || validate(value)) {
				this.value = value as T;
			}
		}
		this.subscribe((value) => {
			if (value === undefined) {
				localStorage.removeItem(this._key);
			} else {
				localStorage.setItem(this._key, JSON.stringify(value));
			}
		});
	}

	public static create<T>(name: string, defaultValue: T, validate?: (value: unknown) => boolean): BrowserStorage<T> {
		let storage = BROWSER_STORAGES.get(name) as BrowserStorage<T> | undefined;
		if (storage !== undefined) {
			return storage;
		}
		storage = new BrowserStorage<T>(name, defaultValue, validate);
		BROWSER_STORAGES.set(name, storage as BrowserStorage<unknown>);
		return storage;
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useBrowserStorage<T>(name: string, defaultValue: T, validate?: (value: unknown) => boolean): [T, (value: T) => void] {
	const storage = useMemo(() => BrowserStorage.create(name, defaultValue, validate), [name, defaultValue, validate]);
	const value = useObservable(storage);
	const setValue = useMemo(() => (newValue: T): void => {
		storage.value = newValue;
	}, [storage]);
	return [value, setValue];
}
