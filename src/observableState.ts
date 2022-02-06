import { useEffect, useState } from 'react';

/** Class that stores value of type T, while allowing React to observe it for changes */
export class ObservableState<T> {
	private _value: T;

	/** List of handlers listening for change */
	private updateHandlers: Set<() => void> = new Set();

	constructor(defaultValue: T) {
		this._value = defaultValue;
	}

	/** Get the current value */
	public get(): T {
		return this._value;
	}

	/** Set a new value, notifying all observers */
	public set(value: T) {
		this._value = value;
		this.updateHandlers.forEach((handler) => handler());
	}

	/** **React hook** to observe current value */
	public useHook(): T {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const [value, update] = useState<T>(this._value);

		// eslint-disable-next-line react-hooks/rules-of-hooks
		useEffect(() => {
			const handleChange = () => {
				update(this._value);
			};
			this.updateHandlers.add(handleChange);
			handleChange();
			return () => {
				this.updateHandlers.delete(handleChange);
			};
		});
		return value;
	}
}
