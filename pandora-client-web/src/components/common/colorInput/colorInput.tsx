import classNames from 'classnames';
import parse from 'color-parse';
import { clamp, throttle } from 'lodash-es';
import { type HexColorString, HexColorStringSchema, HexRGBAColorString, HexRGBAColorStringSchema } from 'pandora-common';
import React, { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { DraggableDialog } from '../../dialog/dialog.tsx';
import { Button } from '../button/button.tsx';
import './colorInput.scss';

type ColorInputProps<THexString extends `#${string}`> = {
	title: string;
	initialValue: THexString;
	resetValue?: THexString;
	onChange?: (value: THexString) => void;
	throttle?: number;
	disabled?: boolean;
	hideTextInput?: boolean;
	classNameTextInput?: string;
	classNameColorButton?: string;
};

export function ColorInput(props: ColorInputProps<HexColorString>): ReactElement {
	return (
		<ColorInputRGBA { ...props } minAlpha={ Color.maxAlpha } />
	);
}

type ColorInputRGBAProps = ColorInputProps<HexRGBAColorString> & {
	minAlpha?: number;
};

export function ColorInputRGBA({
	title,
	initialValue,
	resetValue,
	onChange,
	throttle: throttleMs = 0,
	disabled = false,
	hideTextInput = false,
	minAlpha = 255,
	classNameTextInput,
	classNameColorButton,
}: ColorInputRGBAProps): ReactElement {
	const [value, setInput] = useState<HexRGBAColorString>(initialValue.toUpperCase() as HexRGBAColorString);
	const [showEditor, setShowEditor] = useState(false);

	const onChangeCaller = useCallback((color: HexRGBAColorString) => onChange?.(color), [onChange]);
	const onChangeCallerThrottled = useMemo(() => throttleMs <= 0 ? onChangeCaller : throttle(onChangeCaller, throttleMs), [onChangeCaller, throttleMs]);

	const changeCallback = useCallback((input: string) => {
		input = '#' + input.replace(/[^0-9a-f]/gi, '').toUpperCase();
		setInput(input as HexRGBAColorString);
		const valid = (minAlpha === Color.maxAlpha) ? HexColorStringSchema.safeParse(input).success : HexRGBAColorStringSchema.safeParse(input).success;
		if (valid) {
			onChangeCallerThrottled(input as HexRGBAColorString);
		}
	}, [minAlpha, setInput, onChangeCallerThrottled]);

	const onPaste = useCallback((ev: React.ClipboardEvent<HTMLInputElement>) => {
		const result = ColorParsePaste(ev, minAlpha < Color.maxAlpha);
		if (result) {
			changeCallback(result);
			ev.currentTarget.value = result;
		}
	}, [changeCallback, minAlpha]);

	const onEdit = useCallback((color: HexRGBAColorString) => {
		onChangeCallerThrottled(color);
		setInput(color);
	}, [onChangeCallerThrottled]);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		setShowEditor(true);
	}, [setShowEditor]);

	return (
		<>
			{
				hideTextInput ? null : (
					<TextInput
						value={ value }
						onChange={ changeCallback }
						disabled={ disabled }
						maxLength={ minAlpha === Color.maxAlpha ? 7 : 9 }
						onPaste={ onPaste }
						className={ classNameTextInput }
					/>
				)
			}
			<button
				className={ classNames('color-input-button', classNameColorButton) }
				disabled={ disabled }
				onClick={ onClick }
				style={ { backgroundColor: value } }
			/>
			{
				resetValue != null &&
				<Button className='slim' onClick={ () => changeCallback(resetValue) } disabled={ disabled }>↺</Button>
			}
			{
				showEditor &&
				<ColorEditor initialValue={ value } onChange={ onEdit } minAlpha={ minAlpha } close={ () => setShowEditor(false) } title={ title } />
			}
		</>
	);
}

function ColorEditor({
	initialValue,
	onChange,
	minAlpha,
	close,
	title,
}: {
	initialValue: HexRGBAColorString;
	onChange: (value: HexRGBAColorString) => void;
	minAlpha: number;
	close: () => void;
	title: string;
}): ReactElement {
	const [color, setState] = useState(new Color(initialValue));
	const lastUpdate = useRef(color.toHex());
	const [input, setInput] = useState(color.toHex());
	const [dragging, setDragging] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let newHex = color.toHex();
		if (minAlpha === Color.maxAlpha) {
			newHex = newHex.substring(0, 7) as HexColorString;
		}
		if (newHex !== lastUpdate.current) {
			lastUpdate.current = newHex;
			setInput(newHex);
			onChange(newHex);
		}
	}, [color, onChange, minAlpha]);

	useEffect(() => {
		if (ref.current)
			color.writeCss(ref.current.style);
	}, [color, ref]);

	const setHue = useCallback((newValue: number) => {
		setState(color.setHue(newValue));
	}, [color, setState]);
	const setSaturation = useCallback((newValue: number) => {
		setState(color.setSaturation(newValue));
	}, [color, setState]);
	const setValue = useCallback((newValue: number) => {
		setState(color.setValue(newValue));
	}, [color, setState]);
	const setAlpha = useCallback((newValue: number) => {
		let value = Number(newValue);
		if (value < minAlpha) {
			value = minAlpha;
		}
		setState(color.setAlpha(value));
	}, [minAlpha, color, setState]);

	const onTextInput = useCallback((text: string) => {
		const value = '#' + text.replace(/[^0-9a-f]/gi, '').toUpperCase() as HexRGBAColorString;
		setInput(value);
		const result = HexRGBAColorStringSchema.safeParse(value);
		if (result.success) {
			let newColor = new Color(result.data);
			if (color.alpha < minAlpha) {
				newColor = newColor.setAlpha(minAlpha);
			}
			setState(newColor);
		}
	}, [color, setState, minAlpha]);

	const onPaste = useCallback((ev: React.ClipboardEvent<HTMLInputElement>) => {
		const result = ColorParsePaste(ev, minAlpha < Color.maxAlpha);
		if (result) {
			onTextInput(result);
			ev.currentTarget.value = result;
		}
	}, [onTextInput, minAlpha]);

	const onPointerDown = useCallback((ev: React.PointerEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		ev.currentTarget.setPointerCapture(ev.pointerId);
		setDragging(true);
	}, [setDragging]);
	const onPointerUp = useCallback((ev: React.PointerEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		ev.currentTarget.releasePointerCapture(ev.pointerId);
		setDragging(false);
	}, [setDragging]);
	const onPointerMove = useCallback((ev: React.PointerEvent) => {
		if (!dragging) return;
		ev.preventDefault();
		ev.stopPropagation();
		const rect = ev.currentTarget.getBoundingClientRect();
		const x = ev.clientX - rect.left;
		const y = ev.clientY - rect.top;
		setState(color
			.setSaturation(Math.floor((x / rect.width) * Color.maxSaturation))
			.setValue(Math.floor((1 - y / rect.height) * Color.maxValue)));
	}, [dragging, color, setState]);

	return (
		<DraggableDialog title={ title } close={ close }>
			<div className='color-editor' ref={ ref }>
				<div className='color-editor__rect'>
					<div className='color-editor__rect__color'
						onPointerDown={ onPointerDown } onPointerUp={ onPointerUp } onPointerMove={ onPointerMove } onPointerCancel={ onPointerUp } onLostPointerCapture={ onPointerUp }>
						<div className='color-editor__rect__color__pointer' />
					</div>
				</div>
				<NumberInput className='color-editor__hue' rangeSlider min={ 0 } max={ Color.maxHue } value={ color.hue } onChange={ setHue } />
				<NumberInput className='color-editor__saturation' rangeSlider min={ 0 } max={ Color.maxSaturation } value={ color.saturation } onChange={ setSaturation } />
				<NumberInput className='color-editor__value' rangeSlider min={ 0 } max={ Color.maxValue } value={ color.value } onChange={ setValue } />
				{
					minAlpha < Color.maxAlpha &&
					<NumberInput className='color-editor__alpha' rangeSlider min={ 0 } max={ Color.maxAlpha } value={ color.alpha } onChange={ setAlpha } />
				}
				<TextInput className='color-editor__hex' value={ input } maxLength={ minAlpha === Color.maxAlpha ? 7 : 9 } onChange={ onTextInput } onPaste={ onPaste } />
			</div>
		</DraggableDialog>
	);
}

function ColorParsePaste(ev: React.ClipboardEvent, allowAlpha: boolean): string | undefined {
	ev.preventDefault();
	let text = ev.clipboardData.getData('text').trim();
	if (/^[0-9a-f]{3,8}/i.test(text)) {
		text = '#' + text;
	}
	const { space, values, alpha } = parse(text);
	switch (space) {
		case 'rgb':
			return `#${Color.toHexPart(values[0])}${Color.toHexPart(values[1])}${Color.toHexPart(values[2])}${allowAlpha ? Color.toHexPart(Math.floor(Color.maxAlpha * alpha)) : ''}`;
		default:
			toast(`Unsupported color space: ${space}`, TOAST_OPTIONS_ERROR);
			break;
	}
	return undefined;
}

type ColorArray = readonly [number, number, number];

export class Color {
	/** Edge length constant */
	private static e: number = 65537;

	public static maxHue: number = Color.e * 6;
	public static maxSaturation: number = Color.e;
	public static maxValue: number = 255;
	public static maxAlpha: number = 255;

	public readonly rbg: ColorArray;
	public readonly hsv: ColorArray;
	public readonly alpha: number;

	public get hue(): number {
		return this.hsv[0];
	}

	public get saturation(): number {
		return this.hsv[1];
	}

	public get value(): number {
		return this.hsv[2];
	}

	public setHue(hue: number) {
		const h = clamp(hue, 0, Color.maxHue);
		return new Color({
			hsv: [h, this.hsv[1], this.hsv[2]],
			alpha: this.alpha,
		});
	}

	public setSaturation(saturation: number) {
		const s = clamp(saturation, 0, Color.maxSaturation);
		return new Color({
			hsv: [this.hsv[0], s, this.hsv[2]],
			alpha: this.alpha,
		});
	}

	public setAlpha(alpha: number) {
		alpha = clamp(alpha, 0, Color.maxAlpha);
		return new Color({
			rgb: this.rbg,
			hsv: this.hsv,
			alpha,
		});
	}

	public setValue(value: number) {
		const v = clamp(value, 0, Color.maxValue);
		return new Color({
			hsv: [this.hsv[0], this.hsv[1], v],
			alpha: this.alpha,
		});
	}

	public writeCss(style: CSSStyleDeclaration) {
		style.setProperty('--rgb', `rgb(${this.rbg[0]}, ${this.rbg[1]}, ${this.rbg[2]})`);
		style.setProperty('--rgba', `rgba(${this.rbg[0]}, ${this.rbg[1]}, ${this.rbg[2]}, ${this.alpha / Color.maxAlpha})`);

		const hue = this.hue / Color.maxHue;
		const saturation = this.saturation / Color.maxSaturation;
		const value = this.value / Color.maxValue;
		const alpha = this.alpha / Color.maxAlpha;

		style.setProperty('--hue', (hue * 360).toString());
		style.setProperty('--saturation', saturation.toString());
		style.setProperty('--value', value.toString());
		style.setProperty('--alpha', alpha.toString());

		const hslLightness = value - value * saturation / 2;
		style.setProperty('--hsl-lightness', hslLightness.toString());

		style.setProperty('--gradient-saturation', Color.hsvLinerGradient([
			[this.hue, 0, this.value],
			[this.hue, Color.maxSaturation, this.value],
		]));
		style.setProperty('--gradient-value', Color.hsvLinerGradient([
			[this.hue, this.saturation, 0],
			[this.hue, this.saturation, Color.maxValue],
		]));
	}

	public toHex(): HexRGBAColorString {
		const [r, g, b] = this.rbg;
		if (this.alpha === Color.maxAlpha) {
			return `#${Color.toHexPart(r)}${Color.toHexPart(g)}${Color.toHexPart(b)}` as HexColorString;
		}
		return `#${Color.toHexPart(r)}${Color.toHexPart(g)}${Color.toHexPart(b)}${Color.toHexPart(Math.round(this.alpha))}` as HexRGBAColorString;
	}

	constructor(color: Color);
	constructor(color: HexColorString | HexRGBAColorString);
	constructor(color: { rgb?: ColorArray; hsv: ColorArray; alpha: number; } | { rgba: ColorArray; hsv?: ColorArray; alpha: number; });
	constructor(color: HexColorString | HexRGBAColorString | Color | { rgb?: ColorArray; hsv?: ColorArray; alpha: number; }) {
		if (color instanceof Color) {
			this.rbg = color.rbg;
			this.hsv = color.hsv;
			this.alpha = color.alpha;
			return;
		}
		if (typeof color === 'string') {
			const [r, g, b, a] = Color.hexToRgba(color);
			this.rbg = [r, g, b];
			this.hsv = Color.rgbToHsv(this.rbg);
			this.alpha = a;
			return;
		}
		this.rbg = color.rgb ?? (color.hsv ? Color.hsvToRgb(color.hsv) : [0, 0, 0]);
		this.hsv = color.hsv ?? Color.rgbToHsv(this.rbg);
		this.alpha = color.alpha;
	}

	public static hexToRgba(hex: string): [number, number, number, number] {
		const r = parseInt(hex.substring(1, 3), 16);
		const g = parseInt(hex.substring(3, 5), 16);
		const b = parseInt(hex.substring(5, 7), 16);
		const a = hex.length > 7 ? parseInt(hex.substring(7, 9), 16) : Color.maxAlpha;
		return [r, g, b, a];
	}

	/* eslint-disable no-bitwise */

	public static rgbToHsv([r, g, b]: ColorArray): ColorArray {
		// Step 1: Find the maximum (M), minimum (m) and middle (c) of R; G, and B.
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const mid = r + g + b - max - min;
		// Step 2: Assign V with M.
		const v = max;
		// Step 3: Calculate the delta (d) between M and m
		const d = max - min;
		// Step 4: If d is equal to 0 then assign S with 0 and return. H is undefined in this case.
		if (d === 0) {
			return [0, 0, v];
		}
		// Step 5: Determine sector index (I).
		let i: 0 | 1 | 2 | 3 | 4 | 5;
		if (max === r && min === b) i = 0;
		else if (max === g && min === b) i = 1;
		else if (max === g && min === r) i = 2;
		else if (max === b && min === r) i = 3;
		else if (max === b && min === g) i = 4;
		else i = 5; // if (max === r && min === g)
		// Step 6: Calculate integer-based saturation (S).
		const s = ((d << 16) / v) + 1;
		// Step 7:  Calculate the fractional part of hue (F)
		let f = ((mid - min) << 16) / (d + 1);
		// Step 8: Inverse F for specific sectors (1, 3, and 5), by subtracting F from the edge length constant (E).
		if (i === 1 || i === 3 || i === 5) {
			f = Color.e - f;
		}
		// Step 9: Calculate the final integer-based hue (H).
		const h = Color.e * i + f;

		return [h, s, v];
	}

	public static hsvToRgb([h, s, v]: ColorArray): ColorArray {
		// Step 1: If S or V is equal to 0 then assign all R; G, and B with V and return.
		if (s === 0 || v === 0) {
			return [v, v, v];
		}
		// Step 2: Calculate delta (d).
		const d = ((s * v) >> 16) + 1;
		// Step 3: Calculate m, the minimal value of R; G, and B.
		const m = v - d;
		// Step 4: Determine the hue sector index (I) using the hexagon edge length constant (E).
		const e = Color.e;
		let i: 0 | 1 | 2 | 3 | 4 | 5;
		if (h < e) i = 0;
		else if (h >= e && h < e * 2) i = 1;
		else if (h >= e * 2 && h < e * 3) i = 2;
		else if (h >= e * 3 && h < e * 4) i = 3;
		else if (h >= e * 4 && h < e * 5) i = 4;
		else i = 5; // if (h >= e *5)
		// Step 5: Calculate the fractional part of hue (F).
		let f = h - e * i;
		// Step 6: Inverse F for specific sectors (1, 3, and 5), by subtracting F from the edge length constant (E).
		if (i === 1 || i === 3 || i === 5) {
			f = Color.e - f;
		}
		// Step 7: Calculate the middle component (c).
		const c = ((f * d) >> 16) + m;
		// Step 8: Assign R; G, and B according to the sector index (I).
		switch (i) {
			case 0: return [v, c, m];
			case 1: return [c, v, m];
			case 2: return [m, v, c];
			case 3: return [m, c, v];
			case 4: return [c, m, v];
			case 5: return [v, m, c];
		}
	}

	private static hsvLinerGradient(hsvs: ColorArray[]): string {
		const colors = hsvs.map((hsv) => {
			const [h, s, v] = hsv;
			const [r, g, b] = Color.hsvToRgb([h, s, v]);
			return `rgb(${r}, ${g}, ${b})`;
		});
		return `linear-gradient(to right, ${colors.join(', ')})`;
	}

	/* eslint-enable no-bitwise */

	public static toHexPart(value: number) {
		value = clamp(value, 0, 255);
		return value.toString(16).padStart(2, '0').substring(0, 2).toUpperCase();
	}
}
