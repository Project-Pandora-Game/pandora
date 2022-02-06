/** Class that saves and loads a value to/from browser's localStorage */
export class BrowserStorage<T> {
	/** Key used to store the value */
	public readonly key;

	private _value: T;

	/**
	 * @param name - Unique identifier of the value used to store it
	 * @param defaultValue - Default value to use if there is no saved value (or validation fails)
	 * @param validate - Optional callback to validate currently saved value -
	 * if it returns `false`, then `defaultValue` is used instead of the saved one
	 */
	constructor(name: string, defaultValue: T, validate?: (value: unknown) => boolean) {
		this.key = `pandora.${name}`;
		const saved = localStorage.getItem(this.key);
		if (saved !== null) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this._value = JSON.parse(saved);
			if (validate && !validate(this._value)) {
				this._value = defaultValue;
			}
		} else {
			this._value = defaultValue;
		}
	}

	/** Get the current value */
	public get(): T {
		return this._value;
	}

	/** Set a new value, saving it to localStorage */
	public set(value: T) {
		this._value = value;
		if (this._value === undefined) {
			localStorage.removeItem(this.key);
		} else {
			localStorage.setItem(this.key, JSON.stringify(this._value));
		}
	}
}
