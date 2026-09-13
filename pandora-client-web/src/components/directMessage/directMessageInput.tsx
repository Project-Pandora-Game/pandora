import { Immutable } from 'immer';
import { GetLogger, ZodTransformReadonly, type CharacterId, type ChatCharacterStatus } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, type RefObject } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import { BrowserStorage } from '../../browserStorage.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { ChatInputTextArea, type ChatInputHistoryDriver, type ChatInputMessageDriver, type ChatInputRestoreDriver } from '../../ui/components/chat/chatInputTextArea.tsx';
import { useDirectMessageCommandContext } from './directMessageCommandContext.tsx';

const DirectMessageInputSaveSchema = z.object({
	input: z.string(),
	history: z.string().array().transform(ZodTransformReadonly),
});
type DirectMessageInputSave = z.infer<typeof DirectMessageInputSaveSchema>;

export const DirectMessageInputSaveStorage = BrowserStorage.createSession<Immutable<Partial<Record<string, DirectMessageInputSave>>>>('directMessage.inputSave', {}, z.partialRecord(z.string(), DirectMessageInputSaveSchema.optional()));
/** How many last sent messages are remembered in the session storage _per chat_ */
const INPUT_HISTORY_MAX_LENGTH = 16;

export function DirectMessageInput({ chatId, messagesDiv, scrollMessagesView, ref }: {
	/** Arbitrary chat id to tell chats apart. Right now simply account id, but could be expanded in the future. */
	chatId: string;
	messagesDiv: RefObject<HTMLDivElement | null>;
	scrollMessagesView: (forceScroll: boolean) => void;
	ref: React.ForwardedRef<HTMLTextAreaElement>;
}): ReactElement | null {
	const commandInvokeContext = useDirectMessageCommandContext(true);
	const chat = commandInvokeContext.chat;
	const info = useObservable(chat.displayInfo);

	const inputHistory = useMemo((): ChatInputHistoryDriver => ({
		get(index) {
			const inputSave = DirectMessageInputSaveStorage.value;
			const inputSaveData = Object.hasOwn(inputSave, chatId) ? inputSave[chatId] : undefined;
			return inputSaveData?.history[index];
		},
		insert(index, value) {
			DirectMessageInputSaveStorage.produceImmer((d) => {
				const dSaveData = (d[chatId] ??= { input: '', history: [] });
				dSaveData.history.splice(index, 0, value);
				if (dSaveData.history.length > INPUT_HISTORY_MAX_LENGTH) {
					dSaveData.history.splice(INPUT_HISTORY_MAX_LENGTH, dSaveData.history.length - INPUT_HISTORY_MAX_LENGTH);
				}
			});
		},
		size() {
			const inputSave = DirectMessageInputSaveStorage.value;
			const inputSaveData = Object.hasOwn(inputSave, chatId) ? inputSave[chatId] : undefined;
			return inputSaveData?.history.length ?? 0;
		},
	}), [chatId]);

	const inputRestoreDriver = useMemo((): ChatInputRestoreDriver => ({
		get() {
			const inputRestore = DirectMessageInputSaveStorage.value;
			const inputRestoreData = Object.hasOwn(inputRestore, chatId) ? inputRestore[chatId] : undefined;
			return inputRestoreData?.input ?? '';
		},
		set(value) {
			DirectMessageInputSaveStorage.produceImmer((d) => {
				const dSaveData = (d[chatId] ??= { input: '', history: [] });
				dSaveData.input = value;
			});
		},
	}), [chatId]);

	const messageSender = useMemo((): ChatInputMessageDriver => ({
		sendMessage(message, option) {
			commandInvokeContext.sendMessage(message, option?.editing)
				.catch((e) => {
					toast(`Failed to send message: ${String(e)}`, TOAST_OPTIONS_ERROR);
					GetLogger('DirectMessage').error('Failed to send message:', e);
				});
		},
		deleteMessage(_deleteId) {
			// TODO: Support message editing in DMs
		},
		getMessageEdit(_id) {
			// TODO: Support message editing in DMs
			return undefined;
		},
		getMessageEditTimeout(_id) {
			// TODO: Support message editing in DMs
			return undefined;
		},
		getLastMessageEdit() {
			// TODO: Support message editing in DMs
			return undefined;
		},
	}), [commandInvokeContext]);

	const setPlayerStatus = useCallback((_status: ChatCharacterStatus, _targets?: readonly CharacterId[]): void => {
		// TODO: Support typing status in DMs
	}, []);

	return (
		<ChatInputTextArea
			messagesDiv={ messagesDiv }
			scrollMessagesView={ scrollMessagesView }
			inputHistory={ inputHistory }
			inputRestore={ inputRestoreDriver }
			messageSender={ messageSender }
			setPlayerStatus={ setPlayerStatus }
			placeholder={ `> Send message to ${info.displayName ?? '[Loading ...]'} (${chat.id}) or use a /command` }
			ref={ ref }
		/>
	);
}
