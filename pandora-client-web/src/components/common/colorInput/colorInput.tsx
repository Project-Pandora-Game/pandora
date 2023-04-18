import _ from 'lodash';
import { type HexColorString, HexColorStringSchema, HexRGBAColorString, HexRGBAColorStringSchema } from 'pandora-common';
import React, { useState, type ChangeEvent, useCallback, useMemo, type ReactElement, useEffect, useRef } from 'react';
import { Button } from '../button/button';
import './colorInput.scss';
import { DraggableDialog } from '../../dialog/dialog';

export function ColorInput({
	initialValue,
	resetValue,
	onChange,
	throttle = 0,
	disabled = false,
	hideTextInput = false,
	inputColorTitle,
}: {
	initialValue: HexColorString;
	resetValue?: HexColorString;
	onChange?: (value: HexColorString) => void;
	throttle?: number;
	disabled?: boolean;
	hideTextInput?: boolean;
	inputColorTitle?: string;
}): ReactElement {
	const [value, setInput] = useState<HexColorString>(initialValue.toUpperCase() as HexColorString);

	const onChangeCaller = useCallback((color: HexColorString) => onChange?.(color), [onChange]);
	const onChangeCallerThrottled = useMemo(() => throttle <= 0 ? onChangeCaller : _.throttle(onChangeCaller, throttle), [onChangeCaller, throttle]);

	const changeCallback = useCallback((input: string) => {
		input = '#' + input.replace(/[^0-9a-f]/gi, '').toUpperCase();
		setInput(input as HexColorString);
		const valid = HexColorStringSchema.safeParse(input).success;
		if (valid) {
			onChangeCallerThrottled(input as HexColorString);
		}
	}, [setInput, onChangeCallerThrottled]);

	const onInputChange = (ev: ChangeEvent<HTMLInputElement>) => changeCallback(ev.target.value);

	return (
		<>
			{ !hideTextInput && <input type='text' value={ value } onChange={ onInputChange } disabled={ disabled } maxLength={ 7 } /> }
			<input type='color' value={ value } onChange={ onInputChange } disabled={ disabled } title={ inputColorTitle } />
			{
				resetValue != null &&
				<Button className='slim' onClick={ () => changeCallback(resetValue) }>↺</Button>
			}
		</>
	);
}

export function useColorInput(initialValue?: HexColorString) {
	return useState((initialValue ?? '#ffffff').toUpperCase() as HexColorString);
}

export function ColorInputRGBA({
	initialValue, resetValue, onChange, throttle = 0, disabled = false, minAlpha = 255, title,
}: {
	initialValue: HexRGBAColorString;
	resetValue?: HexRGBAColorString;
	onChange?: (value: HexRGBAColorString) => void;
	throttle?: number;
	disabled?: boolean;
	minAlpha?: number;
	title: string;
}): ReactElement {
	const [value, setInput] = useState<HexRGBAColorString>(initialValue.toUpperCase() as HexRGBAColorString);
	const [showEditor, setShowEditor] = useState(false);

	const onChangeCaller = useCallback((color: HexRGBAColorString) => onChange?.(color), [onChange]);
	const onChangeCallerThrottled = useMemo(() => throttle <= 0 ? onChangeCaller : _.throttle(onChangeCaller, throttle), [onChangeCaller, throttle]);

	const changeCallback = useCallback((input: string) => {
		input = '#' + input.replace(/[^0-9a-f]/gi, '').toUpperCase();
		setInput(input as HexRGBAColorString);
		const valid = HexRGBAColorStringSchema.safeParse(input).success;
		if (valid) {
			onChangeCallerThrottled(input as HexRGBAColorString);
		}
	}, [setInput, onChangeCallerThrottled]);

	const onInputChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => changeCallback(ev.target.value), [changeCallback]);
	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		ev.preventDefault();
		setShowEditor(true);
	}, [setShowEditor]);

	return (
		<>
			<input type='text' value={ value } onChange={ onInputChange } disabled={ disabled } maxLength={ minAlpha === 255 ? 7 : 9 } />
			<input type='color' value={ value.substring(0, 7) } disabled={ disabled } onClick={ onClick } readOnly />
			{
				resetValue != null &&
				<Button className='slim' onClick={ () => changeCallback(resetValue) }>↺</Button>
			}
			{
				showEditor &&
				<ColorEditor initialValue={ value } onChange={ onChangeCallerThrottled } minAlpha={ minAlpha } close={ () => setShowEditor(false) } title={ title } />
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
		if (minAlpha === 255) {
			newHex = newHex.substring(0, 7) as HexColorString;
		}
		if (newHex !== lastUpdate.current) {
			lastUpdate.current = newHex;
			setInput(newHex);
			onChange(newHex);
		}
	}, [color, onChange, minAlpha]);

	useEffect(() => {
		if (!ref.current) return;
		ref.current.style.setProperty('--hue', (color.hue * 360).toString());
		ref.current.style.setProperty('--saturation', color.saturation.toString());
		ref.current.style.setProperty('--lightness', color.lightness.toString());
		ref.current.style.setProperty('--alpha', color.alpha.toString());
	}, [color, ref]);

	useEffect(() => {
		const handler = (ev: MouseEvent) => {
			if (ref.current && !ref.current.contains(ev.target as Node)) {
				close();
			}
		};
		const onEscape = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') {
				close();
			}
		};
		document.addEventListener('click', handler);
		document.addEventListener('keydown', onEscape);
		return () => {
			document.removeEventListener('click', handler);
			document.removeEventListener('keydown', onEscape);
		};
	}, [close]);

	const setHue = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
		setState(color.setHue(Number(ev.target.value) / 360));
	}, [color, setState]);
	const setSaturation = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
		setState(color.setSaturation(Number(ev.target.value) / 100));
	}, [color, setState]);
	const setLightness = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
		setState(color.setLightness(Number(ev.target.value) / 100));
	}, [color, setState]);
	const setAlpha = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
		const value = Number(ev.target.value);
		if (value < minAlpha) {
			return;
		}
		setState(color.setAlpha(value / 255));
	}, [minAlpha, color, setState]);

	const onInputChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
		const value = '#' + ev.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase() as HexRGBAColorString;
		setInput(value);
		const result = HexRGBAColorStringSchema.safeParse(value);
		if (result.success) {
			let newColor = new Color(result.data);
			if (color.alpha < minAlpha / 255) {
				newColor = newColor.setAlpha(minAlpha / 255);
			}
			setState(newColor);
		}
	}, [color, setState, minAlpha]);

	const onPointerDown = useCallback((ev: React.PointerEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setDragging(true);
	}, [setDragging]);
	const onPointerUp = useCallback((ev: React.PointerEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
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
			.setSaturation(x / rect.width)
			.setLightness(1 - (1 - y / rect.height)));
	}, [dragging, color, setState]);

	return (
		<DraggableDialog title={ title }>
			<div className='color-editor' ref={ ref }>
				<div className='color-editor__rect'>
					<div className='color-editor__rect__color'
						onPointerDown={ onPointerDown } onPointerUp={ onPointerUp } onPointerMove={ onPointerMove } onPointerCancel={ onPointerUp }>
						<div className='color-editor__rect__color__pointer' />
					</div>
				</div>
				<input className='color-editor__hue' type='range' min='0' max='360' value={ Math.round(color.hue * 360) } onChange={ setHue } />
				<input className='color-editor__saturation' type='range' min='0' max='100' value={ Math.round(color.saturation * 100) } onChange={ setSaturation } />
				<input className='color-editor__lightness' type='range' min='0' max='100' value={ Math.round(color.lightness * 100) } onChange={ setLightness } />
				{
					minAlpha < 255 &&
					<input className='color-editor__alpha' type='range' min='0' max='255' value={ Math.round(color.alpha * 255) } onChange={ setAlpha } />
				}
				<input className='color-editor_hex' type='text' value={ input } maxLength={ minAlpha === 255 ? 7 : 9 } onChange={ onInputChange } />
			</div>
		</DraggableDialog>
	);
}

class Color {
	public readonly rbga: readonly [number, number, number, number];
	public readonly hsla: readonly [number, number, number, number];

	public get hue(): number {
		return this.hsla[0];
	}

	public get saturation(): number {
		return this.hsla[1];
	}

	public get lightness(): number {
		return this.hsla[2];
	}

	public get alpha(): number {
		return this.rbga[3];
	}

	public setHue(hue: number) {
		return new Color({
			hsla: [_.clamp(hue, 0, 1), this.hsla[1], this.hsla[2], this.hsla[3]],
		});
	}

	public setSaturation(saturation: number) {
		return new Color({
			hsla: [this.hsla[0], _.clamp(saturation, 0, 1), this.hsla[2], this.hsla[3]],
		});
	}

	public setLightness(lightness: number) {
		return new Color({
			hsla: [this.hsla[0], this.hsla[1], _.clamp(lightness, 0, 1), this.hsla[3]],
		});
	}

	public setAlpha(alpha: number) {
		alpha = _.clamp(alpha, 0, 1);
		return new Color({
			rgba: [this.rbga[0], this.rbga[1], this.rbga[2], alpha],
			hsla: [this.hsla[0], this.hsla[1], this.hsla[2], alpha],
		});
	}

	public toHex(): HexRGBAColorString {
		const [r, g, b, a] = this.rbga;
		if (a === 1) {
			return `#${Color.toHexPart(r)}${Color.toHexPart(g)}${Color.toHexPart(b)}` as HexColorString;
		}
		return `#${Color.toHexPart(r)}${Color.toHexPart(g)}${Color.toHexPart(b)}${Color.toHexPart(Math.round(a * 255))}` as HexRGBAColorString;
	}

	constructor(color: Color);
	constructor(color: HexColorString | HexRGBAColorString);
	constructor(color: { rgba?: [number, number, number, number]; hsla: [number, number, number, number]; } | { rgba: [number, number, number, number]; hsla?: [number, number, number, number]; });
	constructor(color: HexColorString | HexRGBAColorString | Color | { rgba?: [number, number, number, number]; hsla?: [number, number, number, number]; }) {
		if (color instanceof Color) {
			this.rbga = [...color.rbga];
			this.hsla = [...color.hsla];
			return;
		}
		if (typeof color === 'string') {
			this.rbga = Color.hexToRgba(color);
			this.hsla = Color.rgbaToHsla(this.rbga);
			return;
		}
		this.rbga = color.rgba ?? (color.hsla ? Color.hslaToRgba(color.hsla) : [0, 0, 0, 1]);
		this.hsla = color.hsla ?? Color.rgbaToHsla(this.rbga);
	}

	public static hexToRgba(hex: string): [number, number, number, number] {
		const r = parseInt(hex.substring(1, 3), 16);
		const g = parseInt(hex.substring(3, 5), 16);
		const b = parseInt(hex.substring(5, 7), 16);
		const a = hex.length > 7 ? parseInt(hex.substring(7, 9), 16) / 255 : 1;
		return [r, g, b, a];
	}

	public static rgbaToHsla(rgba: readonly [number, number, number, number]): [number, number, number, number] {
		const r = rgba[0] / 255;
		const g = rgba[1] / 255;
		const b = rgba[2] / 255;
		const a = rgba[3];

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return [h, s, l, a];
	}

	public static hueToRgb(p: number, q: number, t: number) {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	}

	public static hslaToRgba(hsla: readonly [number, number, number, number]): [number, number, number, number] {
		const [h, s, l, a] = hsla;

		if (s === 0) {
			const l255 = Math.round(l * 255);
			return [l255, l255, l255, a];
		}

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		return [
			Math.round(Color.hueToRgb(p, q, h + 1 / 3) * 255),
			Math.round(Color.hueToRgb(p, q, h) * 255),
			Math.round(Color.hueToRgb(p, q, h - 1 / 3) * 255),
			a,
		];
	}

	private static toHexPart(value: number) {
		value = _.clamp(value, 0, 255);
		return value.toString(16).padStart(2, '0').substring(0, 2).toUpperCase();
	}
}
