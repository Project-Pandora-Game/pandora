import { CharacterSize, GetLogger, type Rectangle } from 'pandora-common';
import type { GraphicsContext } from 'pixi.js';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import profileIcon from '../../../assets/icons/profile.svg';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { GetDirectoryUrl, useAuthTokenHeader } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { GraphicsCharacter, type PointLike } from '../../../graphics/graphicsCharacter.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';

const CHARACTER_PREVIEW_SIZE = 64;
const PREVIEW_PREVIEW_BORDER = 32;
const PREVIEW_AREA_SIZE_MIN = 20;
const PREVIEW_AREA_SIZE_MAX = Math.floor(Math.min(CharacterSize.WIDTH, CharacterSize.HEIGHT) / 2);
const PREVIEW_AREA_SIZE_DEFAULT = 128;
const PREVIEW_Y_OFFSET_DEFAULT = 310;

export function CharacterPreviewGenerationButton(): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<>
			<Button
				onClick={ () => {
					setShowDialog(true);
				} }
			>
				<img src={ profileIcon } />Character preview
			</Button>
			{
				showDialog ? (
					<CharacterPreviewDialog
						close={ () => {
							setShowDialog(false);
						} }
					/>
				) : null
			}
		</>
	);
}

export function CharacterPreviewDialog({ close }: {
	close: () => void;
}): ReactElement {
	const serviceManager = useServiceManager();
	const auth = useAuthTokenHeader();
	const { playerState } = usePlayerState();

	const [previewAreaRadius, setPreviewAreaRadius] = useState(PREVIEW_AREA_SIZE_DEFAULT);
	const [previewYOffset, setPreviewYOffset] = useState(PREVIEW_Y_OFFSET_DEFAULT);

	const scale = CHARACTER_PREVIEW_SIZE / (2 * previewAreaRadius);

	const canvasSize = useMemo((): Rectangle => ({
		x: 0,
		y: 0,
		width: CHARACTER_PREVIEW_SIZE + 2 * PREVIEW_PREVIEW_BORDER,
		height: CHARACTER_PREVIEW_SIZE + 2 * PREVIEW_PREVIEW_BORDER,
	}), []);

	const borderGraphicsDraw = useCallback((ctx: GraphicsContext) => {
		const bottomRight = CHARACTER_PREVIEW_SIZE + 2 * PREVIEW_PREVIEW_BORDER;

		ctx
			.setFillStyle({ color: 0x000000, alpha: 0.6 })
			.poly([
				0, 0,
				bottomRight, 0,
				PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE, PREVIEW_PREVIEW_BORDER,
				PREVIEW_PREVIEW_BORDER, PREVIEW_PREVIEW_BORDER,
			], true)
			.fill()
			.poly([
				bottomRight, 0,
				bottomRight, bottomRight,
				PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE, PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE,
				PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE, PREVIEW_PREVIEW_BORDER,
			], true)
			.fill()
			.poly([
				bottomRight, bottomRight,
				0, bottomRight,
				PREVIEW_PREVIEW_BORDER, PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE,
				PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE, PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE,
			], true)
			.fill()
			.poly([
				0, bottomRight,
				0, 0,
				PREVIEW_PREVIEW_BORDER, PREVIEW_PREVIEW_BORDER,
				PREVIEW_PREVIEW_BORDER, PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE,
			], true)
			.fill()
			.rect(PREVIEW_PREVIEW_BORDER, PREVIEW_PREVIEW_BORDER, CHARACTER_PREVIEW_SIZE, CHARACTER_PREVIEW_SIZE)
			.stroke({ color: 0xffffff, width: 2 });
	}, []);

	const [createPreview, processing] = useAsyncEvent(async () => {
		if (!auth)
			return;

		const preview = await RenderGraphicsTreeInBackground(
			(
				<serviceManagerContext.Provider value={ serviceManager }>
					<GraphicsCharacter
						position={ { x: CHARACTER_PREVIEW_SIZE / 2, y: CHARACTER_PREVIEW_SIZE / 2 } }
						pivot={ { x: (CharacterSize.WIDTH / 2), y: previewYOffset } }
						scale={ { x: scale, y: scale } }
						characterState={ playerState.produceWithPose({ view: 'front' }, true) }
					/>
				</serviceManagerContext.Provider>
			),
			{
				x: 0,
				y: 0,
				width: CHARACTER_PREVIEW_SIZE,
				height: CHARACTER_PREVIEW_SIZE,
			},
			0xffffff,
		);

		await new Promise<void>((resolve, reject) => {
			preview.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				fetch(new URL(`pandora/character/${encodeURIComponent(playerState.id)}/preview`, GetDirectoryUrl()), {
					method: 'PUT',
					body: blob,
					headers: {
						Authorization: auth,
					},
					mode: 'cors',
				})
					.then((result) => {
						resolve();
						if (result.ok) {
							toast('Preview successfully updated', TOAST_OPTIONS_SUCCESS);
							close();
						} else {
							GetLogger('CharacterPreviewDialog').error('Error saving preview:', result.status, result.statusText);
							toast('Error saving preview', TOAST_OPTIONS_ERROR);
						}
					}, reject);
			}, 'image/png');
		});
	}, null, {
		errorHandler(error) {
			GetLogger('CharacterPreviewDialog').error('Error creating preview:', error);
			toast('Error creating preview', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<ModalDialog>
			<Row gap='small'>
				<Column>
					<GraphicsSceneBackgroundRenderer
						renderArea={ canvasSize }
						resolution={ 1 }
						forwardContexts={ useMemo(() => [serviceManagerContext], []) }
						backgroundColor={ 0xffffff }
					>
						<GraphicsCharacter
							position={ useMemo((): PointLike => ({ x: PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE / 2, y: PREVIEW_PREVIEW_BORDER + CHARACTER_PREVIEW_SIZE / 2 }), []) }
							pivot={ useMemo((): PointLike => ({ x: (CharacterSize.WIDTH / 2), y: previewYOffset }), [previewYOffset]) }
							scale={ useMemo((): PointLike => ({ x: scale, y: scale }), [scale]) }
							characterState={ useMemo(() => playerState.produceWithPose({ view: 'front' }, true), [playerState]) }
						/>
						<Graphics
							draw={ borderGraphicsDraw }
						/>
					</GraphicsSceneBackgroundRenderer>
				</Column>
				<Column gap='small' padding='small'>
					<fieldset>
						<legend>Zoom</legend>
						<Row alignY='center' gap='medium'>
							<NumberInput
								aria-label='Zoom'
								className='flex-6 zero-width'
								rangeSlider
								min={ PREVIEW_AREA_SIZE_MIN }
								max={ PREVIEW_AREA_SIZE_MAX }
								step={ 1 }
								value={ previewAreaRadius }
								onChange={ setPreviewAreaRadius }
								disabled={ processing }
							/>
							<NumberInput
								aria-label='Zoom'
								className='flex-grow-1 value'
								min={ PREVIEW_AREA_SIZE_MIN }
								max={ PREVIEW_AREA_SIZE_MAX }
								step={ 1 }
								value={ previewAreaRadius }
								onChange={ setPreviewAreaRadius }
								disabled={ processing }
							/>
						</Row>
					</fieldset>
					<fieldset>
						<legend>Camera height</legend>
						<Row alignY='center' gap='medium'>
							<NumberInput
								aria-label='Camera height'
								className='flex-6 zero-width'
								rangeSlider
								min={ 0 }
								max={ CharacterSize.HEIGHT }
								step={ 1 }
								value={ previewYOffset }
								onChange={ setPreviewYOffset }
								disabled={ processing }
							/>
							<NumberInput
								aria-label='Camera height'
								className='flex-grow-1 value'
								min={ 0 }
								max={ CharacterSize.HEIGHT }
								step={ 1 }
								value={ previewYOffset }
								onChange={ setPreviewYOffset }
								disabled={ processing }
							/>
						</Row>
					</fieldset>
					<div className='flex-1' />
					<Row alignX='space-between'>
						<Button
							onClick={ close }
						>
							Close
						</Button>
						<Button
							disabled={ processing }
							onClick={ createPreview }
						>
							Take photo
						</Button>
					</Row>
				</Column>
			</Row>
		</ModalDialog>
	);
}
