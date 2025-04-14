import React, { type ChangeEvent } from 'react';

/** Dictates how long will the element definitely not update for after being modified */
const INPUT_CHANGE_COOLDOWN_PERIOD = 500;

export interface InputBaseProps<TValue> {
	value: TValue;
	onChange?: (newValue: TValue) => void;
}

export interface IInputBase {
	focus(): void;
}

export abstract class InputBase<TValue, TProps extends InputBaseProps<TValue>, TElement extends HTMLElement> extends React.Component<TProps> implements IInputBase {

	private _element: TElement | null = null;
	public get element(): TElement | null {
		return this._element;
	}

	private _elementCleanupHooks: (() => void)[] = [];

	protected lastValidValue: TValue;

	constructor(props: TProps) {
		super(props);
		this.lastValidValue = props.value;
	}

	protected readonly elementRef = (element: TElement | null) => {
		if (this._element === element)
			return;

		this._elementCleanupHooks.forEach((cb) => cb());
		this._elementCleanupHooks = [];
		this._element = element;

		if (element != null) {
			const onBlur = () => {
				// Enter cooldown, which will make the element update after a bit
				this._enterCooldown();
			};

			element.addEventListener('blur', onBlur);

			this._elementCleanupHooks.push(() => {
				element.removeEventListener('blur', onBlur);
			});
		}
	};

	protected readonly elementOnChange = (ev: ChangeEvent<TElement>) => {
		const { onChange } = this.props;

		ev.stopPropagation();

		const newValue = this.getValue();

		// Focus the element if it changed while not focused
		// (looking at you, Firefox and your number inputs)
		if (!this.isSelected()) {
			this.focus();
		}

		// When element changes in any way, trigger cooldown
		this._enterCooldown();

		// If the actual value changed, send it out (unless we are readonly)
		if (this.lastValidValue !== newValue && !this.isReadonly()) {
			this.lastValidValue = newValue;
			onChange?.(newValue);
		}
	};

	protected abstract setValue(value: TValue): void;
	protected abstract getValue(): TValue;
	protected abstract isReadonly(): boolean;

	private _cooldownState: boolean = false;
	private _cooldownLeaveTimer: number | null = null;

	public isSelected(): boolean {
		return document.activeElement != null && document.activeElement === this.element;
	}

	public override componentDidUpdate(prevProps: Readonly<TProps>): void {
		const { value } = this.props;

		if (value !== prevProps.value) {
			// If value changed, check that we can just reset it
			if (!this.isSelected() && !this._cooldownState) {
				this._resetValue();
			}
		}
	}

	private _enterCooldown(): void {
		if (this._cooldownLeaveTimer != null) {
			clearTimeout(this._cooldownLeaveTimer);
			this._cooldownLeaveTimer = null;
		}

		this._cooldownState = true;
		this._cooldownLeaveTimer = setTimeout(() => {
			this._leaveCooldown();
		}, INPUT_CHANGE_COOLDOWN_PERIOD);
	}

	private _leaveCooldown(): void {
		if (this._cooldownLeaveTimer != null) {
			clearTimeout(this._cooldownLeaveTimer);
			this._cooldownLeaveTimer = null;
		}

		if (!this._cooldownState)
			return;

		this._cooldownState = false;
		if (!this.isSelected()) {
			this._resetValue();
		}
	}

	private _resetValue(): void {
		const { value } = this.props;

		this.lastValidValue = value;
		if (this.element != null) {
			this.setValue(value);
		}
	}

	public focus(): void {
		this.element?.focus();
	}

	public resetValue(): void {
		this._cooldownState = false;
		this._leaveCooldown();
		if (!this.isSelected()) {
			this._resetValue();
		}
	}
}
