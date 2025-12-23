import { clamp } from 'lodash-es';
import { CharacterSize, GetLogger } from 'pandora-common';
import * as PIXI from 'pixi.js';
import React from 'react';
import { DownloadAsFile } from '../../../common/downloadHelper.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/index.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { Observable, useObservable } from '../../../observable.ts';
import { useEditorSceneContext, type EditorSceneContext } from '../../graphics/editorSceneContext.tsx';
import { ImageExporter } from '../../graphics/export/imageExporter.ts';
import './previewCutter.scss';

const PREVIEW_CUTTER_LINE_WIDTH = 2;
const PREVIEW_CUTTER_MIN_SIZE = 50;
const PREVIEW_CUTTER_MAX_SIZE = CharacterSize.HEIGHT / 3 * 4;
const PREVIEW_CUTTER_OUTPUT_SIZE = 256;
const PREVIEW_CUTTER_CENTERED_X = CharacterSize.WIDTH / 2;

type PreviewCutterState = Readonly<{
	enabled: boolean;
	overrideLayers: boolean;
	size: number;
	centered: boolean;
	position: Readonly<{ x: number; y: number; }>;
}>;

const PREVIEW_CUTTER = new Observable<PreviewCutterState>({
	enabled: false,
	overrideLayers: true,
	size: 200,
	centered: true,
	position: { x: PREVIEW_CUTTER_CENTERED_X - 100, y: CharacterSize.HEIGHT / 2 - 100 },
});

export function PreviewCutterRectangle() {
	const state = useObservable(PREVIEW_CUTTER);
	if (!state.enabled) {
		return null;
	}
	return <PreviewCutterRectangleInner { ...state } />;
}

export function usePreviewCutterEnabled(): boolean {
	return useObservable(PREVIEW_CUTTER).enabled;
}
export function usePreviewCutterOverridesEnabled(): boolean {
	const state = useObservable(PREVIEW_CUTTER);
	return state.enabled && state.overrideLayers;
}

let editorSceneContext: EditorSceneContext | null = null;

function PreviewCutterRectangleInner({
	size,
	centered,
	position,
}: PreviewCutterState) {
	const [dragging, setDragging] = React.useState(false);
	const graphic = React.useRef<PIXI.Graphics>(null);
	const x = centered ? (PREVIEW_CUTTER_CENTERED_X - size / 2) : position.x;
	const y = position.y;

	const draw = React.useCallback((g: PIXI.GraphicsContext) => {
		const color = dragging ? 0x00ff00 : 0x333333;
		g
			.rect(
				- (PREVIEW_CUTTER_LINE_WIDTH / 2),
				- (PREVIEW_CUTTER_LINE_WIDTH / 2),
				size + PREVIEW_CUTTER_LINE_WIDTH,
				size + PREVIEW_CUTTER_LINE_WIDTH,
			)
			.stroke({ width: PREVIEW_CUTTER_LINE_WIDTH, color, alpha: 1, pixelLine: true });
	}, [dragging, size]);
	const onPointerDown = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		ev.stopPropagation();
		setDragging(true);
	}, []);
	const onPointerUp = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		ev.stopPropagation();
		setDragging(false);
	}, []);
	const onPointerMove = React.useCallback((ev: PIXI.FederatedPointerEvent) => {
		if (!dragging || !graphic.current?.parent)
			return;

		ev.stopPropagation();
		const dragPointerEnd = ev.getLocalPosition(graphic.current.parent);
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			position: {
				x: PREVIEW_CUTTER.value.centered ? PREVIEW_CUTTER_CENTERED_X : clamp(Math.round(dragPointerEnd.x - (size / 2)), 0, CharacterSize.WIDTH),
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
			hitArea={ new PIXI.Rectangle(0, 0, size, size) }
			x={ x }
			y={ y }
			interactive={ true }
			draw={ draw }
			ref={ graphic }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
			onglobalpointermove={ onPointerMove }
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
	const setCentered = React.useCallback((newValue: boolean) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			centered: newValue,
		};
	}, []);
	const setOverrideLayers = React.useCallback((newValue: boolean) => {
		PREVIEW_CUTTER.value = {
			...PREVIEW_CUTTER.value,
			overrideLayers: newValue,
		};
	}, []);
	const createPreviewImage = useEvent(() => {
		const container = editorSceneContext?.contentRef.current;
		const app = editorSceneContext?.appRef.current;
		if (!container || !app) {
			return;
		}
		const exporter = new ImageExporter(app);
		exporter.imageCut(
			container,
			{
				x: state.centered ? (PREVIEW_CUTTER_CENTERED_X - state.size / 2) : state.position.x,
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

	const legend = (
		<>
			Preview Cutter
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
					To get such a specially configured character body into the background of your item preview image,<br />
					the checkbox "Automatically configure layers" is pre-selected.
				</p>
				<p>
					What does this toggle do? It hides most of the base body layers and for the remaining ones it sets their color to "#535759".<br />
					Note, that body parts such as eyes or mouth are not automatically hidden, because it can make sense for them to be used in previews in rare cases.<br />
					If your preview covers the character head, please consider whether you want those to be included. Otherwise, please hide them manually.
				</p>
				<p>
					Hint: Most existing assets have a comment in their `*.asset.ts` file about the size and position of the cut-out rectangle used<br />
					to make their preview. That way, you can easily reuse this information for a new similar asset.
				</p>
			</ContextHelpButton>
		</>
	);

	return (
		<FieldsetToggle legend={ legend } forceOpen={ state.enabled } onChange={ onChange } className='previewCutter'>
			<div>
				<label htmlFor='preview-cutter-size'>Size</label>
				<NumberInput id='preview-cutter-size' min={ PREVIEW_CUTTER_MIN_SIZE } max={ PREVIEW_CUTTER_MAX_SIZE } value={ state.size } step={ 2 } onChange={ setSize } />
			</div>
			{
				!state.centered ? (
					<div>
						<label htmlFor='preview-cutter-x'>X</label>
						<NumberInput id='preview-cutter-x' min={ -state.size } max={ CharacterSize.WIDTH + state.size } value={ state.position.x } onChange={ setX } />
					</div>
				) : null
			}
			<div>
				<label htmlFor='preview-cutter-y'>Y</label>
				<NumberInput id='preview-cutter-y' min={ -state.size } max={ CharacterSize.HEIGHT + state.size } value={ state.position.y } onChange={ setY } />
			</div>
			<div>
				<label htmlFor='preview-cutter-centered'>Centered</label>
				<Checkbox id='preview-cutter-centered' checked={ state.centered } onChange={ setCentered } />
			</div>
			<div>
				<label htmlFor='preview-cutter-overrides'>Automatically configure layers</label>
				<Checkbox id='preview-cutter-overrides' checked={ state.overrideLayers } onChange={ setOverrideLayers } />
			</div>
			<div>
				<Button onClick={ createPreviewImage }>
					Create Preview Image
				</Button>
			</div>
		</FieldsetToggle>
	);
}
