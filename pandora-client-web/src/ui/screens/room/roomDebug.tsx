import { ICharacterRoomData, ZodMatcher } from 'pandora-common';
import React, { ReactElement } from 'react';
import z from 'zod';
import { BrowserStorage } from '../../../browserStorage';
import { useEvent } from '../../../common/useEvent';
import { USER_DEBUG } from '../../../config/Environment';
import { useObservable } from '../../../observable';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { useChatRoomCharacters, useChatRoomInfo } from '../../../components/gameContext/gameStateContextProvider';
import { Character, useCharacterData } from '../../../character/character';

const ChatroomDebugConfigSchema = z.object({
	enabled: z.boolean().catch(false),
	roomScalingHelper: z.boolean().catch(false),
	characterDebugOverlay: z.boolean().catch(false),
	deviceDebugOverlay: z.boolean().catch(false),
});

const DEFAULT_DEBUG_CONFIG: z.infer<typeof ChatroomDebugConfigSchema> = {
	enabled: false,
	roomScalingHelper: false,
	characterDebugOverlay: false,
	deviceDebugOverlay: false,
};

export type ChatroomDebugConfig = z.infer<typeof ChatroomDebugConfigSchema> | undefined;

const ChatroomDebugConfigStorage = BrowserStorage.create<ChatroomDebugConfig>('debug-chatroom', undefined, ZodMatcher(ChatroomDebugConfigSchema));

export function useDebugConfig(): ChatroomDebugConfig {
	const chatroomDebugConfig = useObservable(ChatroomDebugConfigStorage);
	return (USER_DEBUG && chatroomDebugConfig?.enabled) ? chatroomDebugConfig : undefined;
}

export function ChatroomDebugConfigView(): ReactElement {
	const chatroomDebugConfig = useObservable(ChatroomDebugConfigStorage) ?? DEFAULT_DEBUG_CONFIG;

	const applyChange = useEvent((change: Partial<z.infer<typeof ChatroomDebugConfigSchema>>) => {
		ChatroomDebugConfigStorage.value = {
			...chatroomDebugConfig,
			...change,
		};
	});

	const setOpen = useEvent((open: boolean) => {
		applyChange({
			enabled: open,
		});
	});

	const roomInfo = useChatRoomInfo();
	const roomCharacters = useChatRoomCharacters();

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
			<h3>Chatroom details</h3>
			{
				(!roomInfo || !roomCharacters) ? <div>Not in a chatroom</div> : (
					<>
						<h4>Characters</h4>
						<div className='flex-col'>
							{ roomCharacters.map((c) => (
								<ChatroomDebugCharacterView key={ c.id } character={ c } />
							)) }
						</div>
					</>
				)
			}
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
