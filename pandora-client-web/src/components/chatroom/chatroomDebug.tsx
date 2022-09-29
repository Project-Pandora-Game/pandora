import { ZodMatcher } from 'pandora-common';
import React, { ReactElement } from 'react';
import z from 'zod';
import { BrowserStorage } from '../../browserStorage';
import { useEvent } from '../../common/useEvent';
import { USER_DEBUG } from '../../config/Environment';
import { useObservable } from '../../observable';
import { FieldsetToggle } from '../common/fieldsetToggle';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';

const ChatroomDebugConfigSchema = z.object({
	enabled: z.boolean(),
	roomScalingHelper: z.boolean(),
});

const DEFAULT_DEBUG_CONFIG: z.infer<typeof ChatroomDebugConfigSchema> = {
	enabled: false,
	roomScalingHelper: false,
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

	const roomData = useChatRoomData();

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
			<h3>Chatroom details</h3>
			{
				!roomData ? <div>Not in a chatroom</div> : (
					<>
						<h4>Characters</h4>
						<div className='flex-col'>
							{ roomData.characters.map((c) => (
								<>
									<span>Name: { c.name }</span>
									<span>Character ID: { c.id }</span>
									<span>Account ID: { c.accountId }</span>
									<span>Position: { `[${c.position[0]}, ${c.position[1]}]` }</span>
									<br />
								</>
							)) }
						</div>
					</>
				)
			}
		</FieldsetToggle>
	);
}
