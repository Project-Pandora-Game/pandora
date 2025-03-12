import { noop } from 'lodash-es';
import { AccountId, AccountIdSchema, AssertNever, GetLogger } from 'pandora-common';
import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { KeyExchange } from '../../crypto/keyExchange.ts';
import { useObservable } from '../../observable.ts';
import { useRoutingParentPath } from '../../routing/routingUtils.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import type { DirectMessageCryptoState } from '../../services/accountLogic/directMessages/directMessageManager.ts';
import { NotificationSource, useNotificationSuppressed } from '../../services/notificationHandler.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { Sleep } from '../../utility.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { DirectMessage } from '../directMessage/directMessage.tsx';
import './directMessages.scss';

export function DirectMessages(): React.ReactElement {
	const { pathnameBase } = useRoutingParentPath();

	return (
		<Routes>
			<Route index element={ <DirectMessagesInner /> } />
			<Route path=':accountId' element={ <DirectMessagesInner /> } />
			<Route path='*' element={ <Navigate to={ pathnameBase } replace /> } />
		</Routes>
	);
}

function DirectMessagesInner(): ReactElement {
	const directMessageManager = useService('directMessageManager');
	const [filter, setFilter] = React.useState('');
	const chats = useObservable(directMessageManager.chats);
	const cryptoState = useObservable(directMessageManager.cryptoState);

	const { accountId } = useParams();
	const selected = useMemo((): AccountId | null => {
		if (typeof accountId !== 'string' || !/^[0-9]+$/.test(accountId))
			return null;

		const parsed = AccountIdSchema.safeParse(Number.parseInt(accountId));
		return parsed.success ? parsed.data : null;
	}, [accountId]);

	const navigate = useNavigate();
	const select = useCallback((account: AccountId): void => {
		navigate(`/contacts/dm/${account}`);
	}, [navigate]);

	const flt = React.useDeferredValue(filter.toLowerCase().trim());
	const filtered = useMemo((): readonly DirectMessageChat[] => {
		const arr = flt.split(/\s+/).filter((s) => s.length > 0);
		return chats
			.filter((chat) => {
				const displayName = chat.displayInfo.value.displayName;
				// Auto-include selected chats
				return chat.id === selected ||
					// If all search parts match
					arr.every((s) => (
						// Either the id
						chat.id.toString().includes(s) ||
						// Or lower-case display name (if it is available)
						(displayName != null && displayName.toLocaleLowerCase().includes(s))
					));
			});
	}, [chats, selected, flt]);

	// If this menu is visible, then suppress and clear DM notifications.
	// TODO: It would be better to only suppress those from the `selected` chat.
	useNotificationSuppressed(NotificationSource.DIRECT_MESSAGE);

	return (
		<div className='direct-messages'>
			<Column className='direct-messages__list' gap='none'>
				<TextInput value={ filter } onChange={ setFilter } placeholder='Filter' />
				<Scrollable tag='ul'>
					{ filtered.map((c) => <DirectMessageInfo key={ c.id } chat={ c } selected={ c.id === selected } select={ select } />) }
				</Scrollable>
				<OpenConversation select={ select } />
			</Column>
			{
				(cryptoState !== 'ready') ? (
					<DirectMessageCryptoWarning state={ cryptoState } />
				) :
				(selected != null) ? (
					<DirectMessage accountId={ selected } key={ selected } />
				) : null
			}
		</div>
	);
}

function DirectMessageCryptoWarning({ state }: {
	state: Exclude<DirectMessageCryptoState, 'ready'>;
}): ReactElement {
	let content: ReactElement | null;

	if (state === 'notLoaded') {
		// This is very unlikely to actually happen.
		// There should have always been an attempt to autoload, which either succeeds or fails.
		content = (
			<>
				<span>Loading...</span>
				<span>If you see this message for longer time, please refresh the page.</span>
			</>
		);
	} else if (state === 'noPassword') {
		// This is very unlikely to actually happen (unless someone plays with localstorage manually)
		content = (
			<>
				<span>Error: No decryption password</span>
				<span>Please log out and login again.</span>
			</>
		);
	} else if (state === 'generateError') {
		// This shouldn't happen except for network lapse or faulty/unaccessible subtleCrypto
		content = <DirectMessageCryptoWarningGenerateError />;
	} else if (state === 'loadError') {
		content = <DirectMessageCryptoWarningLoadError />;
	} else {
		AssertNever(state);
	}

	return (
		<Column className='direct-message-crypto-dialog overflow-auto' alignX='center' alignY='center'>
			<Column className='dialog-content' padding='medium'>
				{ content }
			</Column>
		</Column>
	);
}

function DirectMessageCryptoWarningGenerateError(): ReactElement {
	const directMessageManager = useService('directMessageManager');

	const [generate, processing] = useAsyncEvent(async () => {
		// Sleep a short while to make it look like something happened, even if it fails immediately
		// This lets the error disappear and reappear again.
		await Sleep(400);
		await directMessageManager.regenerateKey();
	}, noop);

	return (
		<>
			<span>Error: Failed to generate cryptographic key for your direct messages.</span>
			<Button onClick={ generate }>Retry</Button>
			{
				processing ? (
					<span>Generating key...</span>
				) : null
			}
		</>
	);
}

function DirectMessageCryptoWarningLoadError(): ReactElement {
	const account = useCurrentAccount();
	const directMessageManager = useService('directMessageManager');

	const [unlockUsername, setUnlockUsername] = useState(account?.username ?? '');
	const [unlockPassword, setUnlockPassword] = useState('');
	const [unlockResult, setUnlockResult] = useState<undefined | 'error' | 'selftestFailed'>(undefined);

	const [unlock, processing] = useAsyncEvent(async () => {
		const key = account?.cryptoKey;
		if (key == null)
			return;

		setUnlockResult(undefined);
		// Sleep a short while to make it look like something happened, even if it fails immediately
		// This lets the error disappear and reappear again.
		await Sleep(400);

		const wrapPassword = await KeyExchange.generateKeyPassword(unlockUsername, unlockPassword);
		const result = await directMessageManager.loadKey(key, wrapPassword);

		if (result !== 'ok') {
			// Try old likely variants automatically
			const variants: [string, string][] = [
				[unlockUsername, unlockPassword],
				[unlockUsername.toLowerCase(), unlockPassword],
				[unlockUsername.toUpperCase(), unlockPassword],
			];
			for (const [u, p] of variants) {
				const oldPassword = await KeyExchange.generateKeyPasswordOld(u, p);
				const oldResult = await directMessageManager.loadKey(key, oldPassword);
				// If successful, force re-sync to the server
				if (oldResult === 'ok') {
					await directMessageManager.updateSavedKey();
					return;
				}
			}
		}

		// Return original result, not the old variant retries
		return result;
	}, (result) => {
		setUnlockResult(result === 'ok' ? undefined : result);
	}, {
		errorHandler: (error) => {
			GetLogger('DirectMessageCryptoWarningLoadError').error('Error attempting unlock:', error);
			setUnlockResult('error');
		},
	});

	return (
		<>
			<span>Your DM cryptographic key is currently locked.</span>
			<span>Enter username and password below to unlock it.</span>
			<hr />
			<label>Username (<strong>case sensitive</strong> for old key formats)</label>
			<TextInput
				value={ unlockUsername }
				onChange={ setUnlockUsername }
			/>
			<label>Password</label>
			<TextInput
				password
				value={ unlockPassword }
				onChange={ setUnlockPassword }
			/>
			<Button
				onClick={ unlock }
			>
				Unlock
			</Button>
			{
				unlockResult != null ? (
					<span>Failed to unlock the key.<br />Most likely caused by invalid username and/or password.</span>
				) : null
			}
			{
				processing ? (
					<span>Unlocking...</span>
				) : null
			}
		</>
	);
}

function DirectMessageInfo({ chat, selected, select }: { chat: DirectMessageChat; selected: boolean; select: (id: AccountId) => void; }): React.ReactElement {
	const { displayName, hasUnread } = useObservable(chat.displayInfo);
	const show = useCallback(() => {
		select(chat.id);
	}, [chat, select]);

	return (
		<Button onClick={ show } theme={ selected ? 'defaultActive' : 'default' }>
			{ displayName ?? '[Loading ...]' } ({ chat.id })
			{ hasUnread ? <span className='unreadIndicator'>!</span> : undefined }
		</Button>
	);
}

function OpenConversation({ select }: { select: (id: AccountId) => void; }): React.ReactElement {
	const directMessageManager = useService('directMessageManager');
	const accountId = useCurrentAccount()?.id;
	const [value, setValue] = useState('');

	const onClick = React.useCallback(() => {
		const parsed = parseInt(value, 10);
		if (Number.isInteger(parsed) && parsed > 0 && parsed !== accountId) {
			const chat = directMessageManager.getChat(parsed);
			select(chat.id);
		}
	}, [accountId, directMessageManager, select, value]);
	const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			onClick();
		}
	}, [onClick]);

	return (
		<Row gap='none'>
			<TextInput inputMode='numeric' pattern='\d*' value={ value } onChange={ setValue } onKeyDown={ onKeyDown } placeholder='Account ID' />
			<Button className='slim' onClick={ onClick }>Start</Button>
		</Row>
	);
}
