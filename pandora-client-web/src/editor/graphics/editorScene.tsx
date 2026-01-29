import classNames from 'classnames';
import { throttle } from 'lodash-es';
import { CharacterSize, Coordinates, GetLogger, type HexColorString } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { DownloadAsFile } from '../../common/downloadHelper.ts';
import { CommonProps } from '../../common/reactTypes.ts';
import { useEvent } from '../../common/useEvent.ts';
import { Button } from '../../components/common/button/button.tsx';
import { ColorInput } from '../../components/common/colorInput/colorInput.tsx';
import { Container } from '../../graphics/baseComponents/container.ts';
import { Graphics } from '../../graphics/baseComponents/graphics.ts';
import { PixiViewportRef, PixiViewportSetupCallback } from '../../graphics/baseComponents/pixiViewport.tsx';
import { PixiTransitionedContainer } from '../../graphics/common/transitions/transitionedContainer.ts';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene.tsx';
import { UseTextureGetterOverride } from '../../graphics/useTexture.ts';
import { useObservable } from '../../observable.ts';
import { serviceManagerContext } from '../../services/serviceProvider.tsx';
import { useEditor } from '../editorContextProvider.tsx';
import { EditorServiceManagerContext } from '../services/editorServiceProvider.tsx';
import { ResultCharacter } from './character/resultCharacter.tsx';
import { SetupCharacter } from './character/setupCharacter.tsx';
import { EditorSceneContext } from './editorSceneContext.tsx';
import { ImageExporter } from './export/imageExporter.ts';

function EditorColorPicker({ throttle: throttleMs }: { throttle: number; }): ReactElement {
	const editor = useEditor();
	const color = useObservable(editor.backgroundColor);

	const onChange = useEvent((newValue: HexColorString) => {
		editor.setBackgroundColor(newValue);
	});

	const onChangeThrottled = useMemo(() => throttle(onChange, throttleMs), [onChange, throttleMs]);

	return (
		<ColorInput
			initialValue={ color }
			onChange={ onChangeThrottled }
			title='Background color'
			hideTextInput
		/>
	);
}

export function EditorScene({
	id,
	className,
	children,
	coordinateSourceRef,
}: CommonProps & {
	coordinateSourceRef?: PIXI.Container | null;
}): ReactElement {
	const editor = useEditor();
	const contentRef = useRef<PIXI.Container>(null);
	const appRef = useRef<PIXI.Application>(null);

	const sceneContext = useMemo((): EditorSceneContext => ({
		contentRef,
		appRef,
	}), []);

	const backgroundColor = Number.parseInt(useObservable(editor.backgroundColor).substring(1, 7), 16);
	const character = editor.character;

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
			.stroke({ width: 2, color: 0x404040, pixelLine: true });
	}, []);

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport, params) => {
		viewport
			.clampZoom({
				minScale: Math.min(params.height / params.worldHeight, params.width / params.worldWidth) * 0.2,
				maxScale: 10,
			})
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 });
	}, []);

	const viewportRef = useRef<PixiViewportRef>(null);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [serviceManagerContext, EditorServiceManagerContext, UseTextureGetterOverride],
		worldHeight: CharacterSize.HEIGHT,
		worldWidth: CharacterSize.WIDTH,
		backgroundColor,
		onMount(app) {
			appRef.current = app;
		},
		onUnmount() {
			appRef.current = null;
		},
	}), [viewportConfig, backgroundColor]);

	const getCenter = useCallback(() => (viewportRef.current?.getCenter() ?? { x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT / 2 }), []);
	const setAstarget = useCallback(() => {
		editor.getCenter.value = getCenter;
	}, [editor, getCenter]);

	const cleanup = useEvent(() => {
		if (editor.getCenter.value === getCenter) {
			const { x, y } = getCenter();
			editor.getCenter.value = () => ({ x, y });
		}
	});

	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	const exportImage = useCallback(() => {
		if (!contentRef.current || !appRef.current)
			return;
		const exporter = new ImageExporter(appRef.current);
		exporter.imageCut(contentRef.current, {
			x: 0,
			y: 0,
			height: CharacterSize.HEIGHT,
			width: CharacterSize.WIDTH,
		}, 'png')
			.then((result) => DownloadAsFile(result, 'export.png'))
			.catch((error) => GetLogger('Editor').error('Error exporting image:', error));
	}, []);

	const overlay = (
		<>
			<div className='overlay'>
				<Button className='slim iconButton'
					title='Toggle character view'
					onClick={ () => {
						const appearance = character.getAppearance();
						appearance.setView(appearance.getView() === 'front' ? 'back' : 'front');
					} }
				>
					↷
				</Button>
				<Button className='slim iconButton'
					title='Center the view'
					onClick={ () => {
						viewportRef.current?.center();
					} }
				>
					⊙
				</Button>
				<Button className='slim iconButton'
					title='Download as image'
					onClick={ exportImage }
				>
					⤓
				</Button>
				<EditorColorPicker throttle={ 30 } />
			</div>
			<CoordinatesDisplay coordinateSourceRef={ coordinateSourceRef ?? null } pixi={ appRef } />
		</>
	);

	return (
		<GraphicsScene
			id={ id }
			className={ classNames('canvasContainer', className) }
			divChildren={ overlay }
			sceneOptions={ sceneOptions }
			onMouseDown={ setAstarget }
		>
			<Graphics
				draw={ borderDraw }
			/>
			<EditorSceneContext.Provider value={ sceneContext }>
				<Container ref={ contentRef }>
					{ children }
				</Container>
			</EditorSceneContext.Provider>
		</GraphicsScene>
	);
}

function CoordinatesDisplay({ coordinateSourceRef, pixi }: {
	coordinateSourceRef: PIXI.Container | null;
	pixi: Readonly<RefObject<PIXI.Application | null>>;
}): ReactElement | null {
	const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

	useEffect(() => {
		setCoordinates(null);

		if (coordinateSourceRef == null)
			return;

		const onGlobalPointerMove = (e: PIXI.FederatedPointerEvent) => {
			const canvas = pixi.current?.canvas;
			if (canvas == null) {
				setCoordinates(null);
				return;
			}
			const canvasRect = canvas.getBoundingClientRect();
			const validPos = canvasRect.left <= e.clientX && e.clientX < canvasRect.right &&
				canvasRect.top <= e.clientY && e.clientY < canvasRect.bottom;

			if (validPos) {
				const pos = e.getLocalPosition(coordinateSourceRef);
				setCoordinates({ x: Math.round(pos.x), y: Math.round(pos.y) });
			} else {
				setCoordinates(null);
			}
		};

		coordinateSourceRef.addEventListener('globalpointermove', onGlobalPointerMove);

		return () => {
			coordinateSourceRef.removeEventListener('globalpointermove', onGlobalPointerMove);
		};
	}, [coordinateSourceRef, pixi]);

	if (coordinates == null || coordinateSourceRef == null)
		return null;

	return (
		// Pad numbers with "figure space" so they do not move around
		<div className='CoordinatesDisplay font-tabular'>
			{ coordinates.x.toString().padStart(4, '\u2007') }, { coordinates.y.toString().padStart(4, '\u2007') }
		</div>
	);
}

export function EditorSetupScene(): ReactElement {
	const [coordinateSource, setCoordinateSource] = useState<PixiTransitionedContainer | null>(null);

	return (
		<EditorScene coordinateSourceRef={ coordinateSource }>
			<SetupCharacter ref={ setCoordinateSource } eventMode='static' />
		</EditorScene>
	);
}

export function EditorResultScene(): ReactElement {
	const [coordinateSource, setCoordinateSource] = useState<PixiTransitionedContainer | null>(null);

	return (
		<EditorScene coordinateSourceRef={ coordinateSource }>
			<ResultCharacter ref={ setCoordinateSource } eventMode='static' />
		</EditorScene>
	);
}
