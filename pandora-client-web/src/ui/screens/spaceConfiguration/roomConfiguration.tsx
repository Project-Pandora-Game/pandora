import classNames from 'classnames';
import { produce, type Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	CARDINAL_DIRECTION_NAMES,
	CardinalDirectionSchema,
	CloneDeepMutable,
	KnownObject,
	LIMIT_ROOM_DESCRIPTION_LENGTH,
	LIMIT_ROOM_NAME_LENGTH,
	ParseNotNullable,
	RoomDescriptionSchema,
	RoomLinkNodeConfig,
	RoomLinkNodeConfigSchema,
	RoomNameSchema,
	RoomTemplateSchema,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type CardinalDirection,
	type Coordinates,
	type RoomBackgroundData,
} from 'pandora-common';
import { ReactElement, useId, useMemo, useState, type ReactNode } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import exportIcon from '../../../assets/icons/export.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextAreaInput } from '../../../common/userInteraction/input/textAreaInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, DivContainer, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { ExportDialog, type ExportDialogTarget } from '../../../components/exportImport/exportDialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { SelectSettingInput } from '../../../components/settings/helpers/settingsInputs.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { UseTextureGetterOverride } from '../../../graphics/useTexture.ts';
import { useDevicePixelRatio } from '../../../services/screenResolution/screenResolutionHooks.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';
import { SpaceRoleSelectInput } from '../../components/commonInputs/spaceRoleSelect.tsx';
import { CreateRoomPhoto } from '../room/roomPhoto.tsx';
import { BackgroundSelectDialog } from './backgroundSelect.tsx';
import { RoomSettingsDialog } from './roomSettings.tsx';

export function RoomConfiguration({ isEntryRoom, roomState, globalState, close }: {
	isEntryRoom: boolean;
	roomState: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
	close: () => void;
}): ReactElement {
	const id = useId();
	const [showBackgrounds, setShowBackgrounds] = useState(false);
	const [showRoomSettings, setShowRoomSettings] = useState(false);

	const [name, setName] = useState<string | null>(null);
	const nameValueError = name != null ? FormCreateStringValidator(RoomNameSchema.def.in.max(LIMIT_ROOM_NAME_LENGTH), 'value')(name) : undefined;
	const [description, setDescription] = useState<string | null>(null);
	const descriptionValueError = description != null ? FormCreateStringValidator(RoomDescriptionSchema.def.in.max(LIMIT_ROOM_DESCRIPTION_LENGTH), 'value')(description) : undefined;
	const [positionChange, setPositionChange] = useState<Immutable<Coordinates> | null>(null);
	const [directionChange, setDirectionChange] = useState<CardinalDirection | null>(null);

	return (
		<fieldset className='roomConfiguration fit-x'>
			<legend>Room "{ roomState.name || roomState.id }"</legend>
			{ showBackgrounds && <BackgroundSelectDialog
				hide={ () => setShowBackgrounds(false) }
				room={ roomState.id }
				current={ roomState.roomGeometryConfig }
			/> }
			<Column>
				<Row padding='medium' wrap>
					<GameLogicActionButton action={ {
						type: 'spaceRoomLayout',
						subaction: {
							type: 'reorderRoomList',
							id: roomState.id,
							shift: -1,
						},
					} }>
						▲ Reorder higher
					</GameLogicActionButton>
					<GameLogicActionButton action={ {
						type: 'spaceRoomLayout',
						subaction: {
							type: 'reorderRoomList',
							id: roomState.id,
							shift: 1,
						},
					} }>
						▼ Reorder lower
					</GameLogicActionButton>
					<GameLogicActionButton
						action={ {
							type: 'spaceRoomLayout',
							subaction: {
								type: 'deleteRoom',
								id: roomState.id,
							},
						} }
						onExecute={ close }
					>
						<img src={ deleteIcon } alt='Delete action' /> Delete this room
					</GameLogicActionButton>
					<RoomExportButton roomState={ roomState } globalState={ globalState } />
					<Button
						className='half-slim align-start'
						onClick={ () => setShowRoomSettings(true) }
					>
						<img src={ settingIcon } />
						<div>Room settings</div>
					</Button>
				</Row>
				{ showRoomSettings ? (
					<RoomSettingsDialog
						room={ roomState }
						globalState={ globalState }
						close={ () => {
							setShowRoomSettings(false);
						} }
					/>
				) : null }
				{
					isEntryRoom ? (
						<span>Newly joining characters appear in this room</span>
					) : null
				}
				<Row>
					<Column className='flex-1'>
						<Row alignY='center'>
							<label htmlFor={ id + ':room-name' }>Room name</label>
							<TextInput
								id={ id + ':room-name' }
								className='flex-1'
								value={ name ?? roomState.name }
								onChange={ setName }
							/>
						</Row>
						{ nameValueError ? (
							<FormError error={ nameValueError } />
						) : null }
						<label htmlFor={ id + ':room-description' }>Description ({ (description ?? roomState.description).length }/{ LIMIT_ROOM_DESCRIPTION_LENGTH } characters):</label>
						<TextAreaInput
							id={ id + ':room-description' }
							value={ description ?? roomState.description }
							rows={ 10 }
							maxLength={ LIMIT_ROOM_DESCRIPTION_LENGTH }
							onChange={ setDescription }
						/>
						{ descriptionValueError ? (
							<FormError error={ descriptionValueError } />
						) : null }
					</Column>
					<GameLogicActionButton
						action={ {
							type: 'roomConfigure',
							roomId: roomState.id,
							name: name ?? undefined,
							description: description ?? undefined,
						} }
						disabled={ (name == null || name === roomState.name) && (description == null || description === roomState.description) ||
							nameValueError !== undefined || descriptionValueError !== undefined }
					>
						Save
					</GameLogicActionButton>
				</Row>
				<Row alignY='center' alignX='space-evenly'>
					<Button
						onClick={ () => setShowBackgrounds(true) }
					>
						Select a background
					</Button>
					<RoomConfigurationBackgroundPreview
						background={ roomState.roomBackground }
						previewSize={ 384 }
					/>
				</Row>
				<Row>
					<Column className='flex-1'>
						<Row alignY='center'>
							<label>Room position</label>
							<NumberInput
								className='zero-width flex-1'
								value={ (positionChange ?? roomState.position)?.x }
								onChange={ (x) => {
									setPositionChange({
										...(positionChange ?? roomState.position),
										x,
									});
								} }
							/>
							<NumberInput
								className='zero-width flex-1'
								value={ (positionChange ?? roomState.position)?.y }
								onChange={ (y) => {
									setPositionChange({
										...(positionChange ?? roomState.position),
										y,
									});
								} }
							/>
						</Row>
						<Row alignY='center'>
							<label htmlFor={ id + ':room-name' }>Far wall direction</label>
							<Select
								className='flex-1'
								value={ directionChange ?? roomState.direction }
								onChange={ (ev) => {
									const value = ev.target.value;
									setDirectionChange(CardinalDirectionSchema.parse(value));
								} }
							>
								{
									CardinalDirectionSchema.options.map((d) => (
										<option key={ d } value={ d }>{ CARDINAL_DIRECTION_NAMES[d] }</option>
									))
								}
							</Select>
						</Row>
					</Column>
					<GameLogicActionButton
						action={ {
							type: 'spaceRoomLayout',
							subaction: {
								type: 'moveRoom',
								id: roomState.id,
								position: CloneDeepMutable(positionChange ?? roomState.position),
								direction: CloneDeepMutable(directionChange ?? roomState.direction),
							},
						} }
						disabled={ (positionChange == null || isEqual(positionChange, roomState.position)) &&
							(directionChange == null || directionChange === roomState.direction) }
					>
						Move
					</GameLogicActionButton>
				</Row>
				<fieldset>
					<legend>Paths to other rooms</legend>
					<Column overflowX='auto'>
						<table>
							<thead>
								<tr>
									<th>Direction</th>
									<th>Enabled</th>
									<th>Position</th>
									<th>Can be used by</th>
									<th>
										<Row alignX='center' alignY='center'>
											<span>Character view</span>
											<ContextHelpButton>
												<p>
													If set to anything other than "Keep", any character walking through this path will either turn around,
													or have their view set to this value.<br />
													This is particularly useful when connecting rooms with different orientation.
												</p>
											</ContextHelpButton>
										</Row>
									</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								<RoomConfigurationRoomLink direction='far' roomState={ roomState } />
								<RoomConfigurationRoomLink direction='right' roomState={ roomState } />
								<RoomConfigurationRoomLink direction='near' roomState={ roomState } />
								<RoomConfigurationRoomLink direction='left' roomState={ roomState } />
							</tbody>
						</table>
					</Column>
				</fieldset>
			</Column>
		</fieldset>
	);
}

export function RoomConfigurationBackgroundPreview({ background, previewSize, className }: {
	background: Immutable<RoomBackgroundData> | null;
	previewSize: number;
	className?: string;
}): ReactElement | null {
	const dpr = useDevicePixelRatio();

	if (background == null) {
		return null;
	}

	const previewScale = Math.min(previewSize / background.imageSize[0], previewSize / background.imageSize[1]);
	const previewSizeX = Math.ceil(previewScale * background.imageSize[0]);
	const previewSizeY = Math.ceil(previewScale * background.imageSize[1]);

	return (
		<DivContainer className={ classNames('RoomConfigurationBackgroundPreview', className) }>
			<GraphicsSceneBackgroundRenderer
				renderArea={ { x: 0, y: 0, width: previewSizeX, height: previewSizeY } }
				resolution={ dpr }
				backgroundColor={ 0x000000 }
				backgroundAlpha={ 0 }
				forwardContexts={ [serviceManagerContext, UseTextureGetterOverride] }
			>
				<Container
					scale={ { x: previewScale, y: previewScale } }
					x={ (previewSizeX - previewScale * background.imageSize[0]) / 2 }
					y={ (previewSizeY - previewScale * background.imageSize[1]) / 2 }
				>
					<GraphicsBackground
						background={ background }
					/>
				</Container>
			</GraphicsSceneBackgroundRenderer>
		</DivContainer>
	);
}

const ROOM_INTERNAL_DIRECTION_NAMES: Readonly<Record<keyof AssetFrameworkRoomState['roomLinkNodes'], string>> = {
	far: 'Far',
	right: 'Right',
	near: 'Near',
	left: 'Left',
};

function RoomConfigurationRoomLink({ direction, roomState }: {
	direction: keyof AssetFrameworkRoomState['roomLinkNodes'];
	roomState: AssetFrameworkRoomState;
}): ReactNode {
	const config = roomState.roomLinkNodes[direction];
	const [cardinalDirection, data] = ParseNotNullable(KnownObject.entries(roomState.roomLinkData).find(([,d]) => d.internalDirection === direction));
	const [changedConfig, setChangedConfig] = useState<Immutable<RoomLinkNodeConfig> | null>(null);

	return (
		<tr>
			<td>{ ROOM_INTERNAL_DIRECTION_NAMES[direction] } → { CARDINAL_DIRECTION_NAMES[cardinalDirection] }:</td>
			<td>
				<Checkbox
					checked={ !(changedConfig ?? config).disabled }
					onChange={ (newValue) => {
						setChangedConfig((v) => produce(v ?? config, (d) => {
							d.disabled = !newValue;
						}));
					} }
				/>
			</td>
			<td>
				<Row>
					<Column>
						<Row alignY='center'>
							<label>X:</label>
							<NumberInput
								className='flex-1'
								value={ (changedConfig ?? config).position?.[0] ?? data.position[0] }
								onChange={ (newValue) => {
									setChangedConfig((v) => produce(v ?? config, (d) => {
										d.position ??= CloneDeepMutable(data.position);
										d.position[0] = newValue;
									}));
								} }
							/>
						</Row>
						<Row alignY='center'>
							<label>Y:</label>
							<NumberInput
								className='flex-1'
								value={ (changedConfig ?? config).position?.[1] ?? data.position[1] }
								onChange={ (newValue) => {
									setChangedConfig((v) => produce(v ?? config, (d) => {
										d.position ??= CloneDeepMutable(data.position);
										d.position[1] = newValue;
									}));
								} }
							/>
						</Row>
					</Column>
					<Button
						slim
						onClick={ () => {
							setChangedConfig((v) => produce(v ?? config, (d) => {
								d.position = null;
							}));
						} }
						disabled={ (changedConfig ?? config).position == null }
					>
						↺
					</Button>
				</Row>
			</td>
			<td>
				<SpaceRoleSelectInput
					driver={ {
						currentValue: (changedConfig ?? config).useMinimumRole,
						defaultValue: 'everyone',
						onChange(newValue) {
							setChangedConfig((v) => produce(v ?? config, (d) => {
								d.useMinimumRole = newValue;
							}));
						},
						onReset() {
							setChangedConfig((v) => produce(v ?? config, (d) => {
								delete d.useMinimumRole;
							}));
						},
					} }
					label={ null }
					noWrapper
					cumulative
				/>
			</td>
			<td>
				<SelectSettingInput<RoomLinkNodeConfig['targetView'] & {}>
					driver={ {
						currentValue: (changedConfig ?? config).targetView,
						defaultValue: 'keep',
						onChange(newValue) {
							setChangedConfig((v) => produce(v ?? config, (d) => {
								d.targetView = newValue;
							}));
						},
						onReset() {
							setChangedConfig((v) => produce(v ?? config, (d) => {
								delete d.targetView;
							}));
						},
					} }
					label={ null }
					noWrapper
					schema={ RoomLinkNodeConfigSchema.shape.targetView.unwrap().unwrap() }
					stringify={ {
						'keep': 'Keep',
						'turn-around': 'Turn around',
						'front': 'Turn forward',
						'back': 'Turn backward',
					} }
				/>
			</td>
			<td>
				<GameLogicActionButton
					action={ {
						type: 'roomConfigure',
						roomId: roomState.id,
						roomLinkNodes: {
							[direction]: changedConfig ?? undefined,
						},
					} }
					disabled={ changedConfig == null || isEqual(config, changedConfig) }
				>
					Save
				</GameLogicActionButton>
			</td>
		</tr>
	);
}

function RoomExportButton({ roomState, globalState }: {
	roomState: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const serviceManager = useServiceManager();
	const [showExportDialog, setShowExportDialog] = useState(false);
	const roomTemplate = useMemo(() => roomState.exportToTemplate({ includeAllItems: true }), [roomState]);

	const exportExtra = useMemo(async () => {
		const previewCanvas = await CreateRoomPhoto({
			roomState,
			globalState,
			serviceManager,
			quality: '720p',
			trim: true,
			noGhost: true,
			characters: [],
			characterNames: false,
		});

		const previewBlob = await new Promise<Blob>((resolve, reject) => {
			previewCanvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				resolve(blob);
			}, 'image/jpeg', 0.8);
		}).catch(() => new Promise<Blob>((resolve, reject) => {
			previewCanvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				resolve(blob);
			}, 'image/png');
		}));

		const preview: ExportDialogTarget = {
			content: previewBlob,
			suffix: `-preview.${ previewBlob.type.split('/').at(-1) }`,
			type: previewBlob.type,
		};

		return [preview];
	}, [globalState, roomState, serviceManager]);

	return (
		<>
			<button
				className='wardrobeActionButton allowed'
				onClick={ () => {
					setShowExportDialog(true);
				} }
			>
				<img src={ exportIcon } alt='Export room' />&nbsp;Export
			</button>
			{
				showExportDialog ? (
					<ExportDialog
						title={ 'room template' + (roomTemplate.name ? ` "${ roomTemplate.name }"` : '') }
						exportType='RoomTemplate'
						exportVersion={ 1 }
						dataSchema={ RoomTemplateSchema }
						data={ roomTemplate }
						extraData={ exportExtra }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}
