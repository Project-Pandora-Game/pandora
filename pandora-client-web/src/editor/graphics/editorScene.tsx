import { Container, Graphics } from '@pixi/react';
import classNames from 'classnames';
import _ from 'lodash';
import { AssertNotNullable, CharacterSize, GetLogger, HexColorStringSchema } from 'pandora-common';
import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { AssetGraphicsResolverOverrideContext, type AssetGraphicsResolverOverride } from '../../assets/assetGraphicsCalculations';
import { DownloadAsFile } from '../../common/downloadHelper';
import { CommonProps } from '../../common/reactTypes';
import { useEvent } from '../../common/useEvent';
import { Button } from '../../components/common/button/button';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { PixiViewportRef, PixiViewportSetupCallback } from '../../graphics/pixiViewport';
import { useObservable } from '../../observable';
import { EditorContext, useEditor } from '../editorContextProvider';
import { ResultCharacter, SetupCharacter } from './character';
import { ImageExporter } from './export/imageExporter';

function EditorColorPicker({ throttle }: { throttle: number; }): ReactElement {
	const editor = useEditor();
	const color = useObservable(editor.backgroundColor);

	const onChange = useEvent((ev: React.ChangeEvent<HTMLInputElement>) => {
		editor.setBackgroundColor(HexColorStringSchema.parse(ev.target.value));
	});

	const onChangeThrottled = useMemo(() => _.throttle(onChange, throttle), [onChange, throttle]);

	return (
		<input type='color' value={ color } onChange={ onChangeThrottled } />
	);
}

export type EditorSceneContext = {
	contentRef: React.RefObject<PIXI.Container>;
};

const EditorSceneContext = React.createContext<EditorSceneContext | null>(null);

export function EditorScene({
	id,
	className,
	children,
}: CommonProps): ReactElement {
	const editor = useEditor();
	const contentRef = useRef<PIXI.Container>(null);

	const sceneContext = useMemo((): EditorSceneContext => ({
		contentRef,
	}), []);
	const graphicsOverridesContext = useMemo((): AssetGraphicsResolverOverride => ({
		pointTemplates: editor.modifiedPointTemplates,
	}), [editor]);

	const backgroundColor = Number.parseInt(useObservable(editor.backgroundColor).substring(1, 7), 16);
	const character = editor.character;

	const borderDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.lineStyle(2, 0x404040)
			.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
	}, []);

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport) => {
		viewport
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 });
	}, []);

	const viewportRef = useRef<PixiViewportRef>(null);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [EditorContext],
		worldHeight: CharacterSize.HEIGHT,
		worldWidth: CharacterSize.WIDTH,
		backgroundColor,
		createPrivatePixiInstance: true,
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
		if (!contentRef.current)
			return;
		const exporter = new ImageExporter();
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
				<u>⇣</u>
			</Button>
			<EditorColorPicker throttle={ 30 } />
		</div>
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
				zIndex={ 2 }
				draw={ borderDraw }
			/>
			<EditorSceneContext.Provider value={ sceneContext }>
				<AssetGraphicsResolverOverrideContext.Provider value={ graphicsOverridesContext }>
					<Container zIndex={ 10 } ref={ contentRef }>
						{ children }
					</Container>
				</AssetGraphicsResolverOverrideContext.Provider>
			</EditorSceneContext.Provider>
		</GraphicsScene>
	);
}

export function EditorSetupScene(): ReactElement {
	return (
		<EditorScene>
			<SetupCharacter />
		</EditorScene>
	);
}

export function EditorResultScene(): ReactElement {
	return (
		<EditorScene>
			<ResultCharacter />
		</EditorScene>
	);
}

export function useEditorSceneContext(): EditorSceneContext {
	const context = React.useContext(EditorSceneContext);
	AssertNotNullable(context);
	return context;
}
