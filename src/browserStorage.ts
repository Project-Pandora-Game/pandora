import { useMemo } from 'react';
import { Observable, useObservable } from './observable';

const BROWSER_STORAGES_LOCAL = new Map<string, BrowserStorage<unknown>>();
const BROWSER_STORAGES_SESSION = new Map<string, BrowserStorage<unknown>>();

/** Class that saves and loads a value to/from browser's Storage */
export class BrowserStorage<T> extends Observable<T> {
	/** Key used to store the value */
	public readonly _key;

	/**
	 * @param name - Unique identifier of the value used to store it
	 * @param defaultValue - Default value to use if there is no saved value (or validation fails)
	 * @param validate - Optional callback to validate currently saved value -
	 * if it returns `false`, then `defaultValue` is used instead of the saved one
	 */
	private constructor(name: string, defaultValue: T, validate?: (value: unknown) => boolean, storage: Storage = localStorage) {
		super(defaultValue);
		this._key = `pandora.${name}`;
		const saved = storage.getItem(this._key);
		if (saved !== null) {
			const value = JSON.parse(saved) as unknown;
			if (!validate || validate(value)) {
				this.value = value as T;
			}
		}
		this.subscribe((value) => {
			if (value === undefined) {
				storage.removeItem(this._key);
			} else {
				storage.setItem(this._key, JSON.stringify(value));
			}
		});
	}

	public static create<T>(name: string, defaultValue: T, validate?: (value: unknown) => boolean): BrowserStorage<T> {
		let storage = BROWSER_STORAGES_LOCAL.get(name) as BrowserStorage<T> | undefined;
		if (storage !== undefined) {
			return storage;
		}
		storage = new BrowserStorage<T>(name, defaultValue, validate);
		BROWSER_STORAGES_LOCAL.set(name, storage as BrowserStorage<unknown>);
		return storage;
	}

	public static createSession<T>(name: string, defaultValue: T, validate?: (value: unknown) => boolean): BrowserStorage<T> {
		let storage = BROWSER_STORAGES_SESSION.get(name) as BrowserStorage<T> | undefined;
		if (storage !== undefined) {
			return storage;
		}
		storage = new BrowserStorage<T>(name, defaultValue, validate, sessionStorage);
		BROWSER_STORAGES_SESSION.set(name, storage as BrowserStorage<unknown>);
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

// Code that detects tab duplication and clears session storage
window.addEventListener('beforeunload', function () {
	sessionStorage.removeItem('__lock');
});
if (sessionStorage.getItem('__lock')) {
	sessionStorage.clear();
}
sessionStorage.setItem('__lock', '1');
