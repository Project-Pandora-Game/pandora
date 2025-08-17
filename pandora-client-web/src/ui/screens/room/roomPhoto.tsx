import { Assert, AssertNever, GetLogger } from 'pandora-common';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useGraphicsTextureResolution } from '../../../assets/assetGraphicsCalculations.ts';
import { DownloadAsFile } from '../../../common/downloadHelper.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { VisionFilterBypass } from '../../../graphics/common/visionFilters.tsx';
import { GRAPHICS_TEXTURE_RESOLUTION_SCALE } from '../../../graphics/graphicsSettings.tsx';
import { RoomGraphics } from '../../../graphics/room/roomScene.tsx';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';
import './roomPhoto.scss';

export interface RoomPhotoDialogProps {
	close: () => void;
}

export function RoomPhotoDialog({ close }: RoomPhotoDialogProps): ReactElement {
	const id = useId();
	const serviceManager = useServiceManager();
	const { globalState, playerState } = usePlayerState();
	const characters = useSpaceCharacters();

	const [quality, setQuality] = useState<'roomSize' | '4K' | '1080p' | '720p' | '360p'>('1080p');
	const [trim, setTrim] = useState<boolean>(true);
	const [showCharacters, setShowCharacters] = useState<boolean>(true);
	const [characterNames, setCharacterNames] = useState<boolean>(false);
	const [noGhost, setNoGhost] = useState<boolean>(true);

	const resultRef = useRef<HTMLDivElement>(null);
	const [result, setResult] = useState<HTMLCanvasElement | null>(null);

	const roomState = useMemo(() => {
		const roomStateInner = globalState.space.getRoom(playerState.currentRoom);
		Assert(roomStateInner != null, 'Room to display not found');
		return roomStateInner;
	}, [globalState.space, playerState]);

	const [roomWidth, roomHeight] = roomState.roomBackground.imageSize;

	const [execute, processing] = useAsyncEvent(async (): Promise<HTMLCanvasElement> => {

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
								characters={ showCharacters ? characters : [] }
								globalState={ globalState }
								room={ roomState }
								showCharacterNames={ characterNames }
							/>
						</Container>
					</VisionFilterBypass>
				</serviceManagerContext.Provider>
			),
			{ x: 0, y: 0, width, height },
			0x000000,
			1,
		);
	}, (resultCanvas) => {
		setResult(resultCanvas);
	}, {
		errorHandler(error) {
			GetLogger('RoomPhotoDialog').error('Error creating photo:', error);
			toast('Error creating photo', TOAST_OPTIONS_ERROR);
		},
	});

	useEffect(() => {
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

	const textureResolution = 1 / GRAPHICS_TEXTURE_RESOLUTION_SCALE[useGraphicsTextureResolution()];

	return (
		<ModalDialog>
			<Row className='RoomPhotoDialogContents'>
				<Column>
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
							</Row>
							<em>Right-click or long-tap the image above to get more options</em>
						</>
					) : null }
				</Column>
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
					<Row alignX='space-between'>
						<Button onClick={ close }>
							Close
						</Button>
						<Button onClick={ execute } disabled={ processing }>
							Take photo!
						</Button>
					</Row>
				</Column>
			</Row>
		</ModalDialog>
	);
}
