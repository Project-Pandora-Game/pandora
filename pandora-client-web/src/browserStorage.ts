import { GetLogger, type Logger } from 'pandora-common';
import { useCallback, useMemo } from 'react';
import * as z from 'zod';
import { Observable, useObservable } from './observable.ts';

const BROWSER_STORAGES_LOCAL = new Map<string, BrowserStorage<unknown>>();
const BROWSER_STORAGES_SESSION = new Map<string, BrowserStorage<unknown>>();

/** Class that saves and loads a value to/from browser's Storage */
export class BrowserStorage<T> extends Observable<T> {
	/** Key used to store the value */
	public readonly _key;
	public readonly validate: z.ZodType<T>;
	/** Inhibitor of saving to prevent infinite loop */
	private _saveInhibit: boolean = false;
	private logger: Logger;

	/**
	 * @param name - Unique identifier of the value used to store it
	 * @param defaultValue - Default value to use if there is no saved value (or validation fails)
	 * @param validate - Optional callback to validate currently saved value -
	 * if it returns `false`, then `defaultValue` is used instead of the saved one
	 */
	private constructor(storage: Storage, name: string, defaultValue: NoInfer<T>, validate: z.ZodType<T>) {
		super(defaultValue);
		this._key = name;
		this.validate = validate;
		this.logger = GetLogger('BrowserStorage', `[BrowserStorage ${this._key}]`);

		this.setParse(storage.getItem(this._key));
		this.subscribe((value) => {
			if (this._saveInhibit)
				return;
			if (value === undefined) {
				storage.removeItem(this._key);
			} else {
				storage.setItem(this._key, JSON.stringify(value));
			}
		});
	}

	public setParse(value: string | null): void {
		try {
			if (value !== null) {
				const parsedValue = JSON.parse(value) as unknown;
				const validated = this.validate.safeParse(parsedValue);
				if (validated.success) {
					try {
						this._saveInhibit = true;
						this.value = validated.data;
					} finally {
						this._saveInhibit = false;
					}
				} else {
					this.logger.error('Error validating value:', z.prettifyError(validated.error));
				}
			}
		} catch (err) {
			this.logger.error('Error during setParse:', err);
		}
	}

	public static create<T>(name: string, defaultValue: NoInfer<T>, validate: z.ZodType<T>): BrowserStorage<T> {
		name = `pandora.${name}`;
		let storage = BROWSER_STORAGES_LOCAL.get(name) as BrowserStorage<T> | undefined;
		if (storage !== undefined) {
			return storage;
		}
		storage = new BrowserStorage<T>(localStorage, name, defaultValue, validate);
		BROWSER_STORAGES_LOCAL.set(name, storage as BrowserStorage<unknown>);
		return storage;
	}

	public static createSession<T>(name: string, defaultValue: NoInfer<T>, validate: z.ZodType<T>): BrowserStorage<T> {
		name = `pandora.${name}`;
		let storage = BROWSER_STORAGES_SESSION.get(name) as BrowserStorage<T> | undefined;
		if (storage !== undefined) {
			return storage;
		}
		storage = new BrowserStorage<T>(sessionStorage, name, defaultValue, validate);
		BROWSER_STORAGES_SESSION.set(name, storage as BrowserStorage<unknown>);
		return storage;
	}
}

window.addEventListener('storage', (ev) => {
	if (ev.key && ev.storageArea === localStorage) {
		const storage = BROWSER_STORAGES_LOCAL.get(ev.key);
		if (storage) {
			storage.setParse(ev.newValue);
		}
	}
});

export function useBrowserStorage<T>(name: string, defaultValue: NoInfer<T>, validate: z.ZodType<T>): [T, (value: T) => void] {
	const storage = useMemo(() => BrowserStorage.create<T>(name, defaultValue, validate), [name, defaultValue, validate]);
	const value = useObservable(storage);
	const setValue = useCallback((newValue: T): void => {
		storage.value = newValue;
	}, [storage]);
	return [value, setValue];
}

export function useBrowserSessionStorage<T>(name: string, defaultValue: NoInfer<T>, validate: z.ZodType<T>): [T, (value: T) => void] {
	const storage = useMemo(() => BrowserStorage.createSession<T>(name, defaultValue, validate), [name, defaultValue, validate]);
	const value = useObservable(storage);
	const setValue = useCallback((newValue: T): void => {
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
