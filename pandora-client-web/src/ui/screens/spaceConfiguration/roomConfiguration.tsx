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
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type AssetFrameworkSpaceState,
	type CardinalDirection,
	type Coordinates,
} from 'pandora-common';
import { ReactElement, useId, useState, type ReactNode } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextAreaInput } from '../../../common/userInteraction/input/textAreaInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { SpaceRoleSelectInput } from '../../components/commonInputs/spaceRoleSelect.tsx';
import { SelectSettingInput } from '../../components/settings/settingsInputs.tsx';
import { BackgroundSelectDialog } from './backgroundSelect.tsx';
import { RoomConfigurationBackgroundPreview } from './roomConfigurationBackgroundPreview.tsx';
import { RoomExportButton } from './roomExportButton.tsx';
import { RoomSettingsDialog } from './roomSettings.tsx';

export function RoomConfiguration({ isEntryRoom, roomState, spaceState, getCurrentGlobalState, close }: {
	isEntryRoom: boolean;
	roomState: AssetFrameworkRoomState;
	spaceState: AssetFrameworkSpaceState;
	getCurrentGlobalState: () => AssetFrameworkGlobalState;
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
					<RoomExportButton roomState={ roomState } getCurrentGlobalState={ getCurrentGlobalState } />
					<Button
						className='half-slim align-start'
						onClick={ () => setShowRoomSettings(true) }
						badge={ Object.keys(roomState.settings).length || null }
						badgeType='passive'
						badgeTitle='Count of modified settings for this room'
					>
						<img src={ settingIcon } />
						<div>Room settings</div>
					</Button>
				</Row>
				{ showRoomSettings ? (
					<RoomSettingsDialog
						room={ roomState }
						spaceState={ spaceState }
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
						<Row alignY='center' data-tutorial-id='roomName'>
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
						<Column gap='small' data-tutorial-id='roomDescription'>
							<label htmlFor={ id + ':room-description' }>Description ({ (description ?? roomState.description).length }/{ LIMIT_ROOM_DESCRIPTION_LENGTH } characters):</label>
							<TextAreaInput
								id={ id + ':room-description' }
								value={ description ?? roomState.description }
								rows={ 10 }
								maxLength={ LIMIT_ROOM_DESCRIPTION_LENGTH }
								onChange={ setDescription }
							/>
						</Column>
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
