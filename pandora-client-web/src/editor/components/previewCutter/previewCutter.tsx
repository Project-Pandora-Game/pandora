import React from 'react';
import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CharacterSize } from 'pandora-common';
import { Observable, useObservable } from '../../../observable';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Row } from '../../../components/common/container/container';
import { clamp } from 'lodash';
import { Button } from '../../../components/common/button/button';

type PreviewCutterState = Readonly<{
	enabled: boolean;
	lineWidth: number;
	size: number;
	centered: boolean;
	position: Readonly<{ x: number; y: number; }>;
}>;

const PREVIEW_CUTTER = new Observable<PreviewCutterState>({
	enabled: false,
	lineWidth: 2,
	size: 100,
	centered: true,
	position: { x: 0, y: 100 },
});

const PREVIEW_CUTTER_MIN_SIZE = 50;

export function PreviewCutterRectangle() {
	const state = useObservable(PREVIEW_CUTTER);
	if (!state.enabled) {
		return null;
	}
	return <PreviewCutterRectangleInner { ...state } />;
}

function PreviewCutterRectangleInner({
	lineWidth,
	size,
	centered,
	position,
}: PreviewCutterState) {
	const [dragging, setDragging] = React.useState(false);
	const graphic = React.useRef<PIXI.Graphics>(null);
	const x = centered ? ((CharacterSize.WIDTH - size) / 2) : position.x;
	const y = position.y;

	const draw = React.useCallback((g: PIXI.Graphics) => {
		const color = dragging ? 0x00ff00 : 0x333333;
		g
			.clear()
			.lineStyle(lineWidth, color, 1)
			.drawRect(x, y - lineWidth / 2, size, size);
	}, [lineWidth, dragging, x, y, size]);
	const onPointerDown = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		ev.stopPropagation();
		setDragging(true);
	}, []);
	const onPointerUp = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		ev.stopPropagation();
		setDragging(false);
	}, []);
	const onPointerMove = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		if (!dragging || !graphic.current) {
			return;
		}
		ev.stopPropagation();
		const dragPointerEnd = ev.getLocalPosition(graphic.current.parent);
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				x: clamp(Math.round(dragPointerEnd.x - (size / 2)), 0, CharacterSize.WIDTH),
				y: clamp(Math.round(dragPointerEnd.y - (size / 2)), 0, CharacterSize.HEIGHT),
			},
		};
	}, [size, dragging]);
	React.useEffect(() => {
		const handler = (ev: KeyboardEvent) => {
			ev.stopPropagation();
			const delta = ev.shiftKey ? 10 : 1;
			switch (ev.key) {
				case '+':
					PREVIEW_CUTTER.value = {
						...PREVIEW_CUTTER.value,
						size: clamp(size + delta, 10, CharacterSize.HEIGHT),
					};
					break;
				case '-':
					PREVIEW_CUTTER.value = {
						...PREVIEW_CUTTER.value,
						size: clamp(size - delta, 10, CharacterSize.HEIGHT),
					};
					break;
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			window.removeEventListener('keydown', handler);
		};
	}, [size]);

	return (
		<Graphics
			zIndex={ 0 }
			interactive={ true }
			hitArea={ new PIXI.Rectangle(x, y - lineWidth / 2, size, size) }
			draw={ draw }
			ref={ graphic }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
			onpointermove={ onPointerMove }
		/>
	);
}

export function PreviewCutter() {
	const state = useObservable(PREVIEW_CUTTER);
	const onChange = React.useCallback((enabled: boolean) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			enabled,
		};
	}, []);
	const setX = React.useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const x = parseInt(ev.target.value, 10);
		if (x < 0 || x > CharacterSize.WIDTH) {
			return;
		}
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				...PREVIEW_CUTTER.value.position,
				x,
			},
		};
	}, []);
	const setY = React.useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const y = parseInt(ev.target.value, 10);
		if (y < 0 || y > CharacterSize.HEIGHT) {
			return;
		}
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				...PREVIEW_CUTTER.value.position,
				y,
			},
		};
	}, []);
	const setSize = React.useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const size = parseInt(ev.target.value, 10);
		if (size < PREVIEW_CUTTER_MIN_SIZE || size > CharacterSize.HEIGHT) {
			return;
		}
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			size,
		};
	}, []);
	const setCentered = React.useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			centered: ev.target.checked,
		};
	}, []);
	return (
		<FieldsetToggle legend='Preview Cutter' forceOpen={ state.enabled } onChange={ onChange }>
			<Row>
				<label htmlFor='preview-cutter-x'>X</label>
				<input id='preview-cutter-x' type='number' value={ state.position.x } onChange={ setX } />
			</Row>
			<Row>
				<label htmlFor='preview-cutter-y'>Y</label>
				<input id='preview-cutter-y' type='number' value={ state.position.y } onChange={ setY } />
			</Row>
			<Row>
				<label htmlFor='preview-cutter-size'>Size</label>
				<input id='preview-cutter-size' type='number' value={ state.size } onChange={ setSize } />
			</Row>
			<Row>
				<label htmlFor='preview-cutter-centered'>Centered</label>
				<input id='preview-cutter-centered' type='checkbox' checked={ state.centered } onChange={ setCentered } />
			</Row>
			<Row>
				<Button>
					Create Preview Image
				</Button>
			</Row>
		</FieldsetToggle>
	);
}
