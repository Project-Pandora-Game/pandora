import { Draft } from 'immer';
import { AssertNotNullable, CloneDeepMutable, ICharacterRoomData, RoomBackgroundCalibrationDataSchema } from 'pandora-common';
import { ReactElement } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../../../browserStorage.ts';
import { Character, useCharacterData } from '../../../character/character.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/index.tsx';
import { useCharacterState, useGameState, useGlobalState, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { USER_DEBUG } from '../../../config/Environment.ts';
import { useObservable } from '../../../observable.ts';

const ChatroomDebugConfigSchema = z.object({
	enabled: z.boolean().catch(false),
	roomScalingHelper: z.boolean().catch(false),
	roomScalingHelperData: RoomBackgroundCalibrationDataSchema.omit({ imageSize: true }).nullable(),
	characterDebugOverlay: z.boolean().catch(false),
	deviceDebugOverlay: z.boolean().catch(false),
});

const DEFAULT_DEBUG_CONFIG: z.infer<typeof ChatroomDebugConfigSchema> = {
	enabled: false,
	roomScalingHelper: false,
	roomScalingHelperData: null,
	characterDebugOverlay: false,
	deviceDebugOverlay: false,
};

export type ChatroomDebugConfig = z.infer<typeof ChatroomDebugConfigSchema> | undefined;

const ChatroomDebugConfigStorage = BrowserStorage.create<ChatroomDebugConfig>('debug-chatroom', undefined, ChatroomDebugConfigSchema);

export function useDebugConfig(): ChatroomDebugConfig {
	const chatroomDebugConfig = useObservable(ChatroomDebugConfigStorage);
	return (USER_DEBUG && chatroomDebugConfig?.enabled) ? chatroomDebugConfig : undefined;
}

export function ChatroomDebugConfigView(): ReactElement {
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const spaceConfig = useObservable(gameState.currentSpace).config;
	const roomBackground = globalState.room.roomBackground;

	const chatroomDebugConfig = useObservable(ChatroomDebugConfigStorage) ?? DEFAULT_DEBUG_CONFIG;

	const applyChange = useEvent((change: Partial<z.infer<typeof ChatroomDebugConfigSchema>> | ((value: Draft<z.infer<typeof ChatroomDebugConfigSchema>>) => undefined)) => {
		if (typeof change === 'function') {
			ChatroomDebugConfigStorage.produceImmer(change);
		} else {
			ChatroomDebugConfigStorage.value = {
				...chatroomDebugConfig,
				...change,
			};
		}
	});

	const setOpen = useEvent((open: boolean) => {
		applyChange({
			enabled: open,
		});
	});

	const characters = useSpaceCharacters();

	return (
		<FieldsetToggle legend='[DEV] Debug options' forceOpen={ chatroomDebugConfig.enabled } onChange={ setOpen }>
			<div>
				<label htmlFor='chatroom-debug-room-scaling-helper'>Show scaling helper line </label>
				<Checkbox
					id='chatroom-debug-room-scaling-helper'
					checked={ chatroomDebugConfig.roomScalingHelper }
					onChange={ (newValue) => {
						applyChange({
							roomScalingHelper: newValue,
						});
					} }
				/>
			</div>
			<fieldset>
				<Row alignY='center'>
					<span>Custom calibration </span>
					<Checkbox
						checked={ chatroomDebugConfig.roomScalingHelperData != null && spaceConfig.features.includes('development') }
						onChange={ (newValue) => {
							if (newValue) {
								const renderedAreaWidth = Math.floor(roomBackground.floorArea[0] / roomBackground.areaCoverage);
								const baseScale = Math.round(100 * roomBackground.imageSize[0] / renderedAreaWidth) / 100;
								const areaDepthRatio = Math.round(100 * roomBackground.floorArea[1] / renderedAreaWidth) / 100;

								applyChange({
									roomScalingHelperData: {
										baseScale,
										areaDepthRatio,
										areaCoverage: roomBackground.areaCoverage,
										ceiling: Math.floor(roomBackground.ceiling * baseScale),
										cameraCenterOffset: CloneDeepMutable(roomBackground.cameraCenterOffset),
										fov: roomBackground.cameraFov,
									},
								});
							} else {
								applyChange({
									roomScalingHelperData: null,
								});
							}
						} }
						disabled={ !spaceConfig.features.includes('development') }
					/>
				</Row>
				{
					chatroomDebugConfig.roomScalingHelperData != null && spaceConfig.features.includes('development') ? (
						<>
							<Row alignY='center'>
								<span>Image size</span>
								<NumberInput
									value={ roomBackground.imageSize[0] }
									disabled
								/>
								<NumberInput
									value={ roomBackground.imageSize[1] }
									disabled
								/>
							</Row>
							<Row alignY='center'>
								<span>Camera center offset</span>
								<NumberInput
									value={ chatroomDebugConfig.roomScalingHelperData.cameraCenterOffset[0] }
									onChange={ (newValue) => {
										applyChange((draft) => {
											AssertNotNullable(draft.roomScalingHelperData);
											draft.roomScalingHelperData.cameraCenterOffset[0] = newValue;
										});
									} }
								/>
								<NumberInput
									value={ chatroomDebugConfig.roomScalingHelperData.cameraCenterOffset[1] }
									onChange={ (newValue) => {
										applyChange((draft) => {
											AssertNotNullable(draft.roomScalingHelperData);
											draft.roomScalingHelperData.cameraCenterOffset[1] = newValue;
										});
									} }
								/>
							</Row>
							<Row alignY='center'>
								<span>Area coverage</span>
								<NumberInput
									rangeSlider
									className='flex-1'
									min={ 0.01 }
									max={ 2 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.areaCoverage }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.areaCoverage = newValue;
											});
										}
									} }
								/>
								<NumberInput
									min={ 0.01 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.areaCoverage }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.areaCoverage = newValue;
											});
										}
									} }
								/>
							</Row>
							<Row alignY='center'>
								<span>Ceiling</span>
								<NumberInput
									rangeSlider
									className='flex-1'
									min={ 0 }
									max={ 4 * roomBackground.imageSize[1] }
									step={ 1 }
									value={ chatroomDebugConfig.roomScalingHelperData.ceiling }
									onChange={ (newValue) => {
										applyChange((draft) => {
											AssertNotNullable(draft.roomScalingHelperData);
											draft.roomScalingHelperData.ceiling = newValue;
										});
									} }
								/>
								<NumberInput
									min={ 0 }
									step={ 1 }
									value={ chatroomDebugConfig.roomScalingHelperData.ceiling }
									onChange={ (newValue) => {
										applyChange((draft) => {
											AssertNotNullable(draft.roomScalingHelperData);
											draft.roomScalingHelperData.ceiling = newValue;
										});
									} }
								/>
							</Row>
							<Row alignY='center'>
								<span>Area depth ratio</span>
								<NumberInput
									rangeSlider
									className='flex-1'
									min={ 0.01 }
									max={ 20 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.areaDepthRatio }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.areaDepthRatio = newValue;
											});
										}
									} }
								/>
								<NumberInput
									min={ 0.01 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.areaDepthRatio }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.areaDepthRatio = newValue;
											});
										}
									} }
								/>
							</Row>
							<Row alignY='center'>
								<span>Base scale</span>
								<NumberInput
									rangeSlider
									className='flex-1'
									min={ 0.01 }
									max={ 10 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.baseScale }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.baseScale = newValue;
											});
										}
									} }
								/>
								<NumberInput
									min={ 0.01 }
									step={ 0.01 }
									value={ chatroomDebugConfig.roomScalingHelperData.baseScale }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.baseScale = newValue;
											});
										}
									} }
								/>
							</Row>
							<Row alignY='center'>
								<span>FOV</span>
								<NumberInput
									rangeSlider
									className='flex-1'
									min={ 0.1 }
									max={ 135 }
									step={ 0.1 }
									value={ chatroomDebugConfig.roomScalingHelperData.fov }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.fov = newValue;
											});
										}
									} }
								/>
								<NumberInput
									min={ 0.1 }
									max={ 135 }
									step={ 0.1 }
									value={ chatroomDebugConfig.roomScalingHelperData.fov }
									onChange={ (newValue) => {
										if (Number.isFinite(newValue) && newValue > 0) {
											applyChange((draft) => {
												AssertNotNullable(draft.roomScalingHelperData);
												draft.roomScalingHelperData.fov = newValue;
											});
										}
									} }
								/>
							</Row>
						</>
					) : null
				}
			</fieldset>
			<div>
				<label htmlFor='chatroom-debug-character-overlay'>Show character debug overlay </label>
				<Checkbox
					id='chatroom-debug-character-overlay'
					checked={ chatroomDebugConfig.characterDebugOverlay }
					onChange={ (newValue) => {
						applyChange({
							characterDebugOverlay: newValue,
						});
					} }
				/>
			</div>
			<div>
				<label htmlFor='chatroom-debug-device-overlay'>Show chatroom device debug overlay </label>
				<Checkbox
					id='chatroom-debug-device-overlay'
					checked={ chatroomDebugConfig.deviceDebugOverlay }
					onChange={ (newValue) => {
						applyChange({
							deviceDebugOverlay: newValue,
						});
					} }
				/>
			</div>
			<h3>Space details</h3>
			<h4>Characters</h4>
			<div className='flex-col'>
				{ characters.map((c) => (
					<ChatroomDebugCharacterView key={ c.id } character={ c } />
				)) }
			</div>
		</FieldsetToggle>
	);
}

function ChatroomDebugCharacterView({
	character,
}: {
	character: Character<ICharacterRoomData>;
}): ReactElement {
	const characterData = useCharacterData(character);
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const playerState = useCharacterState(globalState, characterData.id);

	return (
		<Column padding='small' gap='none'>
			<span>Name: { characterData.name }</span>
			<span>Character ID: { characterData.id }</span>
			<span>Account ID: { characterData.accountId }</span>
			<span>Position: { JSON.stringify(playerState?.position) }</span>
		</Column>
	);
}
