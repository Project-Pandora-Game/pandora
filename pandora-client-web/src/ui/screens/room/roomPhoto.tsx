import { Assert, AssertNever, CharacterId, CharacterSize, GetLogger, type AssetFrameworkCharacterState, type AssetFrameworkGlobalState, type AssetFrameworkRoomState, type ICharacterRoomData, type ServiceProvider } from 'pandora-common';
import { Filter } from 'pixi.js';
import { Suspense, use, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useGraphicsTextureResolution } from '../../../assets/assetGraphicsCalculations.ts';
import type { Character } from '../../../character/character.ts';
import { DownloadAsFile } from '../../../common/downloadHelper.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useFriendStatus } from '../../../components/accountContacts/accountContactContext.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { usePlayerVisionFilters, VisionFilterBypass } from '../../../graphics/common/visionFilters.tsx';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter.tsx';
import { GRAPHICS_TEXTURE_RESOLUTION_SCALE, type GraphicsSettings } from '../../../graphics/graphicsSettings.tsx';
import { MASK_SIZE } from '../../../graphics/layers/graphicsLayerAlphaImageMesh.tsx';
import { RoomGraphics } from '../../../graphics/room/roomScene.tsx';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import type { ClientServices } from '../../../services/clientServices.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';
import { ShareButton } from '../../components/common/shareButton.tsx';
import { SortSpaceCharacters } from './roomControls.tsx';
import './roomPhoto.scss';

export async function CreateRoomPhoto({ quality, trim, serviceManager, noGhost, characters, globalState, roomState, characterNames }: {
	roomState: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
	quality: 'roomSize' | '4K' | '1080p' | '720p' | '360p';
	trim: boolean;
	serviceManager: ServiceProvider<ClientServices>;
	noGhost: boolean;
	characters: readonly Character<ICharacterRoomData>[];
	characterNames: boolean;
}): Promise<HTMLCanvasElement> {
	const [roomWidth, roomHeight] = roomState.roomBackground.imageSize;

	let width: number;
	let height: number;
	switch (quality) {
		case 'roomSize':
			width = roomWidth;
			height = roomHeight;
			break;
		case '4K':
			width = 3840;
			height = 2160;
			break;
		case '1080p':
			width = 1920;
			height = 1080;
			break;
		case '720p':
			width = 1280;
			height = 720;
			break;
		case '360p':
			width = 640;
			height = 360;
			break;
		default:
			AssertNever(quality);
	}

	const scale = Math.min(width / roomWidth, height / roomHeight);
	if (trim) {
		width = scale * roomWidth;
		height = scale * roomHeight;
	}

	const offsetX = (width - scale * roomWidth) / 2;
	const offsetY = (height - scale * roomHeight) / 2;

	return await RenderGraphicsTreeInBackground(
		(
			<serviceManagerContext.Provider value={ serviceManager }>
				<VisionFilterBypass setting={ noGhost ? 'no-ghost' : null }>
					<Container
						x={ offsetX }
						y={ offsetY }
						scale={ scale }
					>
						<RoomGraphics
							characters={ characters }
							globalState={ globalState }
							room={ roomState }
							showCharacterNames={ characterNames } />
					</Container>
				</VisionFilterBypass>
			</serviceManagerContext.Provider>
		),
		{ x: 0, y: 0, width, height },
		0x000000,
		1,
	);
}

export async function CreateCharacterPhoto(
	characterState: AssetFrameworkCharacterState,
	extraArea: boolean,
	quality: Exclude<GraphicsSettings['textureResolution'], 'auto'>,
	serviceManager: ServiceProvider<ClientServices>,
	filters: readonly Filter[],
): Promise<HTMLCanvasElement> {
	let width: number = extraArea ? MASK_SIZE.width : CharacterSize.WIDTH;
	let height: number = extraArea ? MASK_SIZE.height : CharacterSize.HEIGHT;

	width /= GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality];
	height /= GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality];

	const offsetX = extraArea ? MASK_SIZE.x : 0;
	const offsetY = extraArea ? MASK_SIZE.y : 0;

	return await RenderGraphicsTreeInBackground(
		(
			<serviceManagerContext.Provider value={ serviceManager }>
				<VisionFilterBypass setting='no-ghost'>
					<Container
						x={ offsetX / GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality] }
						y={ offsetY / GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality] }
						scale={ 1 / GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality] }
					>
						<GraphicsCharacter
							characterState={ characterState }
							filters={ filters.slice() } />
					</Container>
				</VisionFilterBypass>
			</serviceManagerContext.Provider>
		),
		{ x: 0, y: 0, width, height },
		0x000000,
		0,
	);
}

export interface RoomPhotoDialogProps {
	close: () => void;
}

export function RoomPhotoDialog({ close }: RoomPhotoDialogProps): ReactElement {
	const id = useId();
	const characters = useSpaceCharacters();
	const friends = useFriendStatus();
	const sortedCharacters = useMemo(() => SortSpaceCharacters(characters, friends), [characters, friends]);

	const [result, setResult] = useState<HTMLCanvasElement | null>(null);
	const resultRef = useRef<HTMLDivElement>(null);

	const [target, setTarget] = useState<'room' | CharacterId>('room');
	const targetCharacter = target !== 'room' ? characters.find((c) => c.id === target) : undefined;

	useLayoutEffect(() => {
		const resultDiv = resultRef.current;

		if (resultDiv == null || result == null)
			return;

		resultDiv.appendChild(result);
		return () => {
			resultDiv.removeChild(result);
		};
	}, [result]);

	const exportImage = useCallback(() => {
		if (!result)
			return;

		new Promise<void>((resolve, reject) => {
			result.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				const time = new Date();
				const timestring = time.getFullYear().toString() +
				'-' + (time.getMonth() + 1).toString().padStart(2, '0') +
				'-' + time.getDate().toString().padStart(2, '0') +
				' ' + time.getHours().toString().padStart(2, '0') +
				'.' + time.getMinutes().toString().padStart(2, '0');
				DownloadAsFile(blob, `Pandora photo ${timestring}.png`);
				resolve();
			}, 'image/png');
		})
			.catch((error) => {
				GetLogger('RoomPhotoDialog').error('Error downloading photo:', error);
				toast('Error downloading photo', TOAST_OPTIONS_ERROR);
			});
	}, [result]);

	const resultBlob = useMemo(() => {
		if (!result)
			return null;

		return new Promise<Blob>((resolve, reject) => {
			result.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				resolve(blob);
			}, 'image/png');
		});
	}, [result]);

	return (
		<ModalDialog>
			<Column alignX='center'>
				<Row className='RoomPhotoDialogContents'>
					<Column>
						{ result != null ? (
							<Row wrap>
								<Button slim onClick={ () => {
									setResult(null);
								} }>
									◄ Back
								</Button>
							</Row>
						) : null }
						<div
							ref={ resultRef }
							className={ result != null ? 'result' : 'result empty' }
						/>
						{ result != null ? (
							<>
								<Row wrap>
									<Button onClick={ exportImage }>
										<u>⇣</u> Download
									</Button>
									<Suspense fallback={ null }>
										{ resultBlob != null ? (
											<PhotoShareButton image={ resultBlob } />
										) : null }
									</Suspense>
								</Row>
								<em>Right-click or long-tap the image above to get more options</em>
							</>
						) : null }
					</Column>
					{ /* Keep the controls below in tree even if not shown, to let them keep their selected settings */ }
					<Column>
						{ result == null ? (
							<Row alignY='center'>
								<label htmlFor={ id + '-target' }>Photo of:</label>
								<Select id={ id + '-target' } className='flex-1' value={ target } onChange={ (e) => setTarget(e.target.value as typeof target) }>
									<option value='room'>Current room</option>
									{ sortedCharacters.map((c) => (
										<option key={ c.id } value={ c.id }>{ c.name } ({ c.id })</option>
									)) }
								</Select>
							</Row>
						) : null }
						<RoomPhotoDialogRoomControls
							show={ result == null && target === 'room' }
							setPhoto={ setResult }
						/>
						<RoomPhotoDialogCharacterControls
							character={ (result == null && targetCharacter != null) ? targetCharacter : null }
							setPhoto={ setResult }
						/>
					</Column>
				</Row>
				<Button onClick={ close }>
					Close
				</Button>
			</Column>
		</ModalDialog>
	);
}

function PhotoShareButton({ image }: { image: Promise<Blob>; }): ReactElement {
	const resolvedImage = use(image);

	const shareData = useMemo((): ShareData => {
		const time = new Date();
		const timestring = time.getFullYear().toString() +
				'-' + (time.getMonth() + 1).toString().padStart(2, '0') +
				'-' + time.getDate().toString().padStart(2, '0') +
				' ' + time.getHours().toString().padStart(2, '0') +
				'.' + time.getMinutes().toString().padStart(2, '0');

		return {
			files: [
				new File([resolvedImage], `Pandora photo ${timestring}.png`, { type: resolvedImage.type }),
			],
		};
	}, [resolvedImage]);

	return (
		<ShareButton shareData={ shareData } />
	);
}

function RoomPhotoDialogRoomControls({ show, setPhoto }: {
	show: boolean;
	setPhoto: (photo: HTMLCanvasElement) => void;
}): ReactElement | null {
	const id = useId();
	const serviceManager = useServiceManager();
	const { globalState, playerState } = usePlayerState();
	const characters = useSpaceCharacters();

	const [quality, setQuality] = useState<'roomSize' | '4K' | '1080p' | '720p' | '360p'>('1080p');
	const [trim, setTrim] = useState<boolean>(true);
	const [showCharacters, setShowCharacters] = useState<boolean>(true);
	const [characterNames, setCharacterNames] = useState<boolean>(false);
	const [noGhost, setNoGhost] = useState<boolean>(true);

	const roomState = useMemo(() => {
		const roomStateInner = globalState.space.getRoom(playerState.currentRoom);
		Assert(roomStateInner != null, 'Room to display not found');
		return roomStateInner;
	}, [globalState.space, playerState]);

	const [roomWidth, roomHeight] = roomState.roomBackground.imageSize;

	const [execute, processing] = useAsyncEvent(async (): Promise<HTMLCanvasElement> => {
		return await CreateRoomPhoto({
			roomState,
			globalState,
			quality,
			trim,
			serviceManager,
			noGhost,
			characters: showCharacters ? characters : [],
			characterNames,
		});
	}, (resultCanvas) => {
		setPhoto(resultCanvas);
	}, {
		errorHandler(error) {
			GetLogger('RoomPhotoDialog').error('Error creating photo:', error);
			toast('Error creating photo', TOAST_OPTIONS_ERROR);
		},
	});

	const textureResolution = 1 / GRAPHICS_TEXTURE_RESOLUTION_SCALE[useGraphicsTextureResolution()];

	if (!show)
		return null;

	return (
		<Column>
			<Row alignY='center'>
				<label htmlFor={ id + '-quality' }>Quality:</label>
				<Select id={ id + '-quality' } className='flex-1' value={ quality } onChange={ (e) => setQuality(e.target.value as typeof quality) }>
					<option value='roomSize'>Based on room's size ({ roomWidth }×{ roomHeight })</option>
					<option value='4K'>4K (3840×2160)</option>
					<option value='1080p'>FullHD (1920×1080)</option>
					<option value='720p'>HD (1280×720)</option>
					<option value='360p'>360p (640×360)</option>
				</Select>
			</Row>
			<Row alignY='center'>
				<Checkbox id={ id + '-trim' } checked={ trim } onChange={ setTrim } />
				<label htmlFor={ id + '-trim' }>Trim empty space from image</label>
			</Row>
			<fieldset>
				<legend>Characters</legend>
				<Column>
					<Row alignY='center'>
						<Checkbox id={ id + '-showCharacters' } checked={ showCharacters } onChange={ setShowCharacters } />
						<label htmlFor={ id + '-showCharacters' }>Show characters</label>
					</Row>
					<Row alignY='center'>
						<Checkbox id={ id + '-characterNames' } checked={ characterNames } onChange={ setCharacterNames } disabled={ !showCharacters } />
						<label htmlFor={ id + '-characterNames' }>Show character names</label>
					</Row>
					<Row alignY='center'>
						<Checkbox id={ id + '-noGhost' } checked={ noGhost } onChange={ setNoGhost } disabled={ !showCharacters } />
						<label htmlFor={ id + '-noGhost' }>Display offline characters normally</label>
					</Row>
				</Column>
			</fieldset>
			{ (
				((quality === 'roomSize' || quality === '4K') && textureResolution < 1) ||
				((quality === '1080p') && textureResolution < 0.5)
			) ? (
				<div className='warning-box'>
					You are currently using lower texture resolution than what is optimal for creating an image of selected quality.<br />
					We recommend either lowering the selected quality, or selecting higher "Texture resolution" in Settings → Graphics → Quality.
				</div>
			) : null }
			<span className='flex-1' />
			<Row alignX='end'>
				<Button onClick={ execute } disabled={ processing }>
					Take photo!
				</Button>
			</Row>
		</Column>
	);
}

function RoomPhotoDialogCharacterControls({ character, setPhoto }: {
	character: Character | null;
	setPhoto: (photo: HTMLCanvasElement) => void;
}): ReactElement | null {
	const id = useId();
	const serviceManager = useServiceManager();
	const { globalState } = usePlayerState();
	const textureResolution = useGraphicsTextureResolution();

	const [quality, setQuality] = useState<'1' | '0.5' | '0.25'>(textureResolution);
	const [extraArea, setExtraArea] = useState<boolean>(false);

	const characterState = character != null ? globalState.getCharacterState(character.id) : null;
	const filters = usePlayerVisionFilters(character != null && character.isPlayer());

	const [execute, processing] = useAsyncEvent(async (): Promise<HTMLCanvasElement | null> => {
		if (characterState == null) {
			toast('Character not found', TOAST_OPTIONS_ERROR);
			return null;
		}

		return CreateCharacterPhoto(characterState, extraArea, quality, serviceManager, filters);
	}, (resultCanvas) => {
		if (resultCanvas != null) {
			setPhoto(resultCanvas);
		}
	}, {
		errorHandler(error) {
			GetLogger('RoomPhotoDialog').error('Error creating photo:', error);
			toast('Error creating photo', TOAST_OPTIONS_ERROR);
		},
	});

	if (character == null)
		return null;

	return (
		<Column>
			<Row alignY='center'>
				<label htmlFor={ id + '-quality' }>Quality:</label>
				<Select id={ id + '-quality' } className='flex-1' value={ quality } onChange={ (e) => setQuality(e.target.value as typeof quality) }>
					<option value='1'>Full</option>
					<option value='0.5'>50%</option>
					<option value='0.25'>25%</option>
				</Select>
			</Row>
			<Row alignY='center'>
				<Checkbox id={ id + '-extra-area' } checked={ extraArea } onChange={ setExtraArea } />
				<label htmlFor={ id + '-extra-area' }>Capture wide photo (useful if character's pose reaches past normal photo size)</label>
			</Row>
			{ (GRAPHICS_TEXTURE_RESOLUTION_SCALE[quality] < GRAPHICS_TEXTURE_RESOLUTION_SCALE[textureResolution]) ? (
				<div className='warning-box'>
					You are currently using lower texture resolution than what is optimal for creating an image of selected quality.<br />
					We recommend either lowering the selected quality, or selecting higher "Texture resolution" in Settings → Graphics → Quality.
				</div>
			) : null }
			<span className='flex-1' />
			<Row alignX='end'>
				<Button onClick={ execute } disabled={ processing }>
					Take photo!
				</Button>
			</Row>
		</Column>
	);
}
