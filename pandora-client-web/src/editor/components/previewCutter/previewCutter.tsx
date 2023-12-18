import React from 'react';
import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CharacterSize, GetLogger } from 'pandora-common';
import { Observable, useObservable } from '../../../observable';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { clamp } from 'lodash';
import { Button } from '../../../components/common/button/button';
import { useEvent } from '../../../common/useEvent';
import { ImageExporter } from '../../graphics/export/imageExporter';
import { DownloadAsFile } from '../../../common/downloadHelper';
import { EditorSceneContext, useEditorSceneContext } from '../../graphics/editorScene';
import { InputNumber } from '../../../components/input/numberInput';
import './previewCutter.scss';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';

type PreviewCutterState = Readonly<{
	enabled: boolean;
	size: number;
	centered: boolean;
	position: Readonly<{ x: number; y: number; }>;
}>;

const PREVIEW_CUTTER = new Observable<PreviewCutterState>({
	enabled: false,
	size: 200,
	centered: true,
	position: { x: 0, y: 100 },
});

const PREVIRE_CUTTER_LINE_WIDTH = 2;
const PREVIEW_CUTTER_MIN_SIZE = 50;
const PREVIEW_CUTTER_MAX_SIZE = CharacterSize.HEIGHT / 3 * 4;
const PREVIEW_CUTTER_OUTPUT_SIZE = 256;

export function PreviewCutterRectangle() {
	const state = useObservable(PREVIEW_CUTTER);
	if (!state.enabled) {
		return null;
	}
	return <PreviewCutterRectangleInner { ...state } />;
}

let editorSceneContext: EditorSceneContext | null = null;

function PreviewCutterRectangleInner({
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
			.lineStyle(PREVIRE_CUTTER_LINE_WIDTH, color, 1)
			.drawRect(x - PREVIRE_CUTTER_LINE_WIDTH / 2, y - PREVIRE_CUTTER_LINE_WIDTH / 2, size + PREVIRE_CUTTER_LINE_WIDTH, size + PREVIRE_CUTTER_LINE_WIDTH);
	}, [dragging, x, y, size]);
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
						size: clamp(size + delta, PREVIEW_CUTTER_MIN_SIZE, PREVIEW_CUTTER_MAX_SIZE),
					};
					break;
				case '-':
					PREVIEW_CUTTER.value = {
						...PREVIEW_CUTTER.value,
						size: clamp(size - delta, PREVIEW_CUTTER_MIN_SIZE, PREVIEW_CUTTER_MAX_SIZE),
					};
					break;
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			window.removeEventListener('keydown', handler);
		};
	}, [size]);

	const context = useEditorSceneContext();
	React.useEffect(() => {
		editorSceneContext = context;
		return () => {
			editorSceneContext = null;
		};
	}, [context]);

	return (
		<Graphics
			zIndex={ 0 }
			interactive={ true }
			hitArea={ new PIXI.Rectangle(x, y, size, size) }
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
	const setX = React.useCallback((x: number) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				...PREVIEW_CUTTER.value.position,
				x,
			},
		};
	}, []);
	const setY = React.useCallback((y: number) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				...PREVIEW_CUTTER.value.position,
				y,
			},
		};
	}, []);
	const setSize = React.useCallback((size: number) => {
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
	const createPreviewImage = useEvent(() => {
		const container = editorSceneContext?.contentRef.current;
		if (!container) {
			return;
		}
		const exporter = new ImageExporter();
		exporter.imageCut(
			container,
			{
				x: (state.centered ? ((CharacterSize.WIDTH - state.size) / 2) : state.position.x),
				y: state.position.y,
				width: state.size,
				height: state.size,
			},
			'png',
			{
				width: PREVIEW_CUTTER_OUTPUT_SIZE,
				height: PREVIEW_CUTTER_OUTPUT_SIZE,
			})
			.then((image) => DownloadAsFile(image, 'preview.png'))
			.catch((error) => GetLogger('Editor').error('Error exporting image:', error));
	});
	return (
		<FieldsetToggle legend='Preview Cutter' forceOpen={ state.enabled } onChange={ onChange } className='previewCutter'>
			<div>
				<span>
					<ContextHelpButton>
						<p>
							The preview cutter can be used to quickly create item preview images in the same size and style as the existing ones.<br />
							Here you can define the coordinates of the cut-out rectangle visible in the editor's "Preview"-tab and the size of it.<br />
							The rectangle can be dragged around manually, too.
						</p>
						<p>
							The "center"-toggle overrides the x-value and centers the cut-out rectangle.<br />
							With the button you export the cut-out area in the correct image size of { PREVIEW_CUTTER_OUTPUT_SIZE } x { PREVIEW_CUTTER_OUTPUT_SIZE } pixels.<br />
							The exported image can then manually be copied into your asset's folder and referenced in the `*.asset.ts` file.
						</p>
						<p>
							To be consistent with the existing preview images, you should show the location of the item on a stylized character outline.<br />
							To get such a transparent character body area into the background of your item preview image, do the following:
						</p>
						<p>
							Set all equipped body parts of the default editor character to fully transparent (square button), except "head" and ears".<br />
							Then, expand the body/base item and set the layers "Body", "Arms" and "Arms (mirror)" to half transparent.<br />
							Finally, set the colors of the following layers to the color "Silver" (#C0C0C0):<br />
							<ul>
								<li>body/base - Body</li>
								<li>body/base - Arms</li>
								<li>body/base - Arms (mirror)</li>
								<li>body/head - Layer #1</li>
								<li>body/ears - Layer #1</li>
							</ul>
						</p>
						<p>
							Hint: Most existing assets have a comment in their `*.asset.ts` file about the size and position of the cut-out rectangle used<br />
							to make their preview. That way, you can easily reuse this information for a new similar asset.
						</p>
					</ContextHelpButton>
				</span>
			</div>
			<div>
				<label htmlFor='preview-cutter-x'>X</label>
				<InputNumber id='preview-cutter-x' min={ -state.size } max={ CharacterSize.WIDTH + state.size } value={ state.position.x } onChange={ setX } />
			</div>
			<div>
				<label htmlFor='preview-cutter-y'>Y</label>
				<InputNumber id='preview-cutter-y' min={ -state.size } max={ CharacterSize.HEIGHT + state.size } value={ state.position.y } onChange={ setY } />
			</div>
			<div>
				<label htmlFor='preview-cutter-size'>Size</label>
				<InputNumber id='preview-cutter-size' min={ PREVIEW_CUTTER_MIN_SIZE } max={ PREVIEW_CUTTER_MAX_SIZE } value={ state.size } onChange={ setSize } />
			</div>
			<div>
				<label htmlFor='preview-cutter-centered'>Centered</label>
				<input id='preview-cutter-centered' type='checkbox' checked={ state.centered } onChange={ setCentered } />
			</div>
			<div>
				<Button onClick={ createPreviewImage }>
					Create Preview Image
				</Button>
			</div>
		</FieldsetToggle>
	);
}
