import { AssertNotNullable, CloneDeepMutable, ICharacterRoomData, ResolveBackground, RoomBackgroundCalibrationData, RoomBackgroundCalibrationDataSchema } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import z from 'zod';
import { BrowserStorage } from '../../../browserStorage';
import { useEvent } from '../../../common/useEvent';
import { USER_DEBUG } from '../../../config/Environment';
import { useObservable } from '../../../observable';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { useGameState, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider';
import { Character, useCharacterData } from '../../../character/character';
import { Row } from '../../../components/common/container/container';
import { Draft } from 'immer';
import { useAssetManager } from '../../../assets/assetManager';

const ChatroomDebugConfigSchema = z.object({
	enabled: z.boolean().catch(false),
	roomScalingHelper: z.boolean().catch(false),
	roomScalingHelperData: RoomBackgroundCalibrationDataSchema.omit({ imageSize: true }).nullable(),
	characterDebugOverlay: z.boolean().catch(false),
	deviceDebugOverlay: z.boolean().catch(false),
});

const DEFAULT_CALIBRATION_DATA: Omit<RoomBackgroundCalibrationData, 'imageSize'> = {
	cameraCenterOffset: [0, 0],
	areaCoverage: 1,
	ceiling: 0,
	areaDepthRatio: 1,
	baseScale: 1,
	fov: 80,
};

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
	const assetManager = useAssetManager();
	const gameState = useGameState();
	const spaceConfig = useObservable(gameState.currentSpace).config;
	const roomBackground = useMemo(() => ResolveBackground(assetManager, spaceConfig.background), [assetManager, spaceConfig.background]);

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
				<label htmlFor='chatroom-debug-room-scaling-helper'>Show scaling helper line</label>
				<input
					id='chatroom-debug-room-scaling-helper'
					type='checkbox'
					checked={ chatroomDebugConfig.roomScalingHelper }
					onChange={ (e) => {
						applyChange({
							roomScalingHelper: e.target.checked,
						});
					} }
				/>
			</div>
			{
				chatroomDebugConfig.roomScalingHelper ? (
					<fieldset>
						<Row alignY='center'>
							<span>Custom calibration</span>
							<input type='checkbox' checked={ chatroomDebugConfig.roomScalingHelperData != null } onChange={ (e) => {
								applyChange({
									roomScalingHelperData: e.target.checked ? CloneDeepMutable(DEFAULT_CALIBRATION_DATA) : null,
								});
							} } />
						</Row>
						{
							chatroomDebugConfig.roomScalingHelperData != null ? (
								<>
									<Row alignY='center'>
										<span>Image size</span>
										<input
											type='number'
											value={ roomBackground.imageSize[0] }
											disabled
										/>
										<input
											type='number'
											value={ roomBackground.imageSize[1] }
											disabled
										/>
									</Row>
									<Row alignY='center'>
										<span>Camera center offset</span>
										<input
											type='number'
											value={ chatroomDebugConfig.roomScalingHelperData.cameraCenterOffset[0] }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.cameraCenterOffset[0] = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											value={ chatroomDebugConfig.roomScalingHelperData.cameraCenterOffset[1] }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.cameraCenterOffset[1] = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
									<Row alignY='center'>
										<span>Area coverage</span>
										<input
											type='range'
											className='flex-1'
											min={ 0.01 }
											max={ 2 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.areaCoverage }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.areaCoverage = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											min={ 0.01 }
											max={ 2 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.areaCoverage }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.areaCoverage = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
									<Row alignY='center'>
										<span>Ceiling</span>
										<input
											type='range'
											className='flex-1'
											min={ 0 }
											max={ 4 * roomBackground.imageSize[1] }
											step={ 1 }
											value={ chatroomDebugConfig.roomScalingHelperData.ceiling }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.ceiling = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											min={ 0 }
											step={ 1 }
											value={ chatroomDebugConfig.roomScalingHelperData.ceiling }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.ceiling = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
									<Row alignY='center'>
										<span>Area depth ratio</span>
										<input
											type='range'
											className='flex-1'
											min={ 0.01 }
											max={ 20 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.areaDepthRatio }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.areaDepthRatio = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											min={ 0.01 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.areaDepthRatio }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.areaDepthRatio = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
									<Row alignY='center'>
										<span>Base scale</span>
										<input
											type='range'
											className='flex-1'
											min={ 0.01 }
											max={ 10 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.baseScale }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.baseScale = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											min={ 0.01 }
											step={ 0.01 }
											value={ chatroomDebugConfig.roomScalingHelperData.baseScale }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.baseScale = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
									<Row alignY='center'>
										<span>FOV</span>
										<input
											type='range'
											className='flex-1'
											min={ 0.1 }
											max={ 135 }
											step={ 0.1 }
											value={ chatroomDebugConfig.roomScalingHelperData.fov }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.fov = e.target.valueAsNumber;
												});
											} }
										/>
										<input
											type='number'
											min={ 0.1 }
											max={ 135 }
											step={ 0.1 }
											value={ chatroomDebugConfig.roomScalingHelperData.fov }
											onChange={ (e) => {
												applyChange((draft) => {
													AssertNotNullable(draft.roomScalingHelperData);
													draft.roomScalingHelperData.fov = e.target.valueAsNumber;
												});
											} }
										/>
									</Row>
								</>
							) : null
						}
					</fieldset>
				) : null
			}
			<div>
				<label htmlFor='chatroom-debug-character-overlay'>Show character debug overlay</label>
				<input
					id='chatroom-debug-character-overlay'
					type='checkbox'
					checked={ chatroomDebugConfig.characterDebugOverlay }
					onChange={ (e) => {
						applyChange({
							characterDebugOverlay: e.target.checked,
						});
					} }
				/>
			</div>
			<div>
				<label htmlFor='chatroom-debug-device-overlay'>Show chatroom device debug overlay</label>
				<input
					id='chatroom-debug-device-overlay'
					type='checkbox'
					checked={ chatroomDebugConfig.deviceDebugOverlay }
					onChange={ (e) => {
						applyChange({
							deviceDebugOverlay: e.target.checked,
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

	return (
		<>
			<span>Name: { characterData.name }</span>
			<span>Character ID: { characterData.id }</span>
			<span>Account ID: { characterData.accountId }</span>
			<span>Position: { `[${characterData.position[0]}, ${characterData.position[1]}]` }</span>
			<br />
		</>
	);
}
