import type { Immutable } from 'immer';
import { CHARACTER_SETTINGS_DEFAULT, CharacterSize, GetLogger, type AssetFrameworkCharacterState, type CharacterSettings, type Rectangle, type ServiceProvider } from 'pandora-common';
import type { GraphicsContext } from 'pixi.js';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import profileIcon from '../../../assets/icons/profile.svg';
import { useCharacterDataOptional } from '../../../character/character.ts';
import { useAsyncEvent, useEvent } from '../../../common/useEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { GetDirectoryUrl, useAuthTokenHeader } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { useCharacterSettingDriver } from '../../../components/settings/helpers/characterSettings.tsx';
import { NumberSettingInput, ToggleSettingInput, useSubsettingDriver } from '../../../components/settings/helpers/settingsInputs.tsx';
import { Graphics } from '../../../graphics/baseComponents/graphics.ts';
import { type PointLike } from '../../../graphics/common/point.ts';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { UseTextureGetterOverride } from '../../../graphics/useTexture.ts';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import type { ClientServices } from '../../../services/clientServices.ts';
import { useGameStateOptional, useGlobalState } from '../../../services/gameLogic/gameStateHooks.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';

const CHARACTER_PREVIEW_SIZE = 64;
const PREVIEW_PREVIEW_BORDER = 32;
const PREVIEW_AREA_SIZE_MIN = 20;
const PREVIEW_AREA_SIZE_MAX = Math.floor(Math.min(CharacterSize.WIDTH, CharacterSize.HEIGHT) / 2);
const PREVIEW_AUTOGENERATE_TIMER = 10 * 60_000; // 10m

export function CharacterPreviewGenerationButton(): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<>
			<Button
				onClick={ () => {
					setShowDialog(true);
				} }
			>
				<img src={ profileIcon } />Set character preview icon
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

async function CreateAndSaveCharacterPreview(
	characterState: AssetFrameworkCharacterState,
	settings: Immutable<CharacterSettings['previewGeneration']>,
	serviceManager: ServiceProvider<ClientServices>,
	authToken: string,
): Promise<void> {
	const { areaSize, areaYOffset } = settings;
	const scale = CHARACTER_PREVIEW_SIZE / (2 * areaSize);

	const preview = await RenderGraphicsTreeInBackground(
		(
			<serviceManagerContext.Provider value={ serviceManager }>
				<GraphicsCharacter
					position={ { x: CHARACTER_PREVIEW_SIZE / 2, y: CHARACTER_PREVIEW_SIZE / 2 } }
					pivot={ { x: (CharacterSize.WIDTH / 2), y: areaYOffset } }
					scale={ { x: scale, y: scale } }
					characterState={ characterState.produceWithPose({ view: 'front' }, true) }
				/>
			</serviceManagerContext.Provider>
		),
		{
			x: 0,
			y: 0,
			width: CHARACTER_PREVIEW_SIZE,
			height: CHARACTER_PREVIEW_SIZE,
		},
		0,
		0,
	);

	await new Promise<void>((resolve, reject) => {
		preview.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Canvas.toBlob failed!'));
				return;
			}

			fetch(new URL(`pandora/character/${encodeURIComponent(characterState.id)}/preview`, GetDirectoryUrl()), {
				method: 'PUT',
				body: blob,
				headers: {
					Authorization: authToken,
				},
				mode: 'cors',
			})
				.then((result) => {
					if (result.ok) {
						resolve();
					} else {
						reject(new Error(`Error saving preview: ${result.status} ${result.statusText}`));
					}
				}, reject);
		}, 'image/png');
	});
}

export function CharacterPreviewDialog({ close }: {
	close: () => void;
}): ReactElement {
	const serviceManager = useServiceManager();
	const auth = useAuthTokenHeader();
	const { playerState } = usePlayerState();

	const settingsDriver = useCharacterSettingDriver('previewGeneration');
	const automaticDriver = useSubsettingDriver(settingsDriver, 'auto');
	const areaSizeDriver = useSubsettingDriver(settingsDriver, 'areaSize');
	const areaYOffsetDriver = useSubsettingDriver(settingsDriver, 'areaYOffset');

	const previewAreaRadius = areaSizeDriver.currentValue ?? areaSizeDriver.defaultValue;
	const previewYOffset = areaYOffsetDriver.currentValue ?? areaYOffsetDriver.defaultValue;

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

		await CreateAndSaveCharacterPreview(playerState, settingsDriver.currentValue ?? settingsDriver.defaultValue, serviceManager, auth);
		toast('Preview successfully updated', TOAST_OPTIONS_SUCCESS);
		close();
	}, null, {
		errorHandler(error) {
			GetLogger('CharacterPreviewDialog').error('Error updating preview:', error);
			toast('Error updating preview', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<ModalDialog>
			<Row gap='small'>
				<Column>
					<GraphicsSceneBackgroundRenderer
						renderArea={ canvasSize }
						resolution={ 1 }
						forwardContexts={ useMemo(() => [serviceManagerContext, UseTextureGetterOverride], []) }
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
				<Column gap='medium' padding='small'>
					<NumberSettingInput
						label='Zoom'
						driver={ areaSizeDriver }
						min={ PREVIEW_AREA_SIZE_MIN }
						max={ PREVIEW_AREA_SIZE_MAX }
						step={ 1 }
						withSlider
						disabled={ processing }
					/>
					<NumberSettingInput
						label='Camera height'
						driver={ areaYOffsetDriver }
						min={ 0 }
						max={ CharacterSize.HEIGHT }
						step={ 1 }
						withSlider
						disabled={ processing }
					/>
					<ToggleSettingInput
						label='Regularly update preview automatically'
						driver={ automaticDriver }
					/>
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

export function CharacterPreviewAutogenerationService(): null {
	const serviceManager = useServiceManager();
	const auth = useAuthTokenHeader();

	const gameState = useGameStateOptional();
	const player = gameState?.player;
	const globalState = useGlobalState(gameState);
	const playerState = player != null ? globalState?.characters.get(player.id) : undefined;

	const playerData = useCharacterDataOptional(player ?? null);

	const previewGeneration = playerData?.settings.previewGeneration ?? CHARACTER_SETTINGS_DEFAULT.previewGeneration;
	const enablePreviewGeneration = playerData != null && !!auth && previewGeneration.auto && !playerData.inCreation;

	const lastUpdateRef = useRef<AssetFrameworkCharacterState>(null);

	const updatePreview = useEvent(() => {
		if (!auth || playerState == null)
			return;

		if (lastUpdateRef.current === playerState)
			return;

		CreateAndSaveCharacterPreview(playerState, previewGeneration, serviceManager, auth)
			.then(() => {
				lastUpdateRef.current = playerState;
				GetLogger('CharacterPreviewAutogenerationService')
					.verbose('Updated character preview in the background');
			})
			.catch((err) => {
				GetLogger('CharacterPreviewAutogenerationService')
					.error('Failed to update character preview in background:', err);
			});
	});

	useEffect(() => {
		const id = player?.id;
		if (!enablePreviewGeneration || id == null)
			return;

		// Check whether the character has a preview and if not generate one immediately
		fetch(new URL(`pandora/character/${encodeURIComponent(id)}/preview`, GetDirectoryUrl()), {
			headers: {
				Authorization: auth,
			},
		})
			.then((result) => {
				if (result.status === 404) {
					// No preview for this character yet, generate it
					updatePreview();
				}
			})
			.catch(() => {
				// Ignore
			});

		const interval = setInterval(updatePreview, PREVIEW_AUTOGENERATE_TIMER);
		return () => {
			clearInterval(interval);
		};
	}, [updatePreview, auth, player?.id, enablePreviewGeneration]);

	return null;
}
