import { clamp } from 'lodash';
import { EMPTY, IsAuthorized, type IBetaKeyInfo } from 'pandora-common';
import React, { createContext, ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { useAsyncEvent } from '../../../common/useEvent';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast';
import { Button } from '../../common/Button/Button';
import { useCurrentAccount, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import '../shards/shards.scss';

const ONE_DAY = 1000 * 60 * 60 * 24;

const BetaKeyListContext = createContext({
	reload: () => { /** noop */ },
	append: (_key: IBetaKeyInfo) => { /** noop */ },
});

export function BetaKeys(): ReactElement {
	const connector = useDirectoryConnector();
	const [list, setList] = useState<IBetaKeyInfo[]>([]);

	const [reload] = useAsyncEvent(
		() => connector.awaitResponse('manageListBetaKeys', EMPTY),
		({ keys }) => setList(keys),
	);

	const context = useMemo(() => ({
		reload,
		append: (betaKey: IBetaKeyInfo) => {
			setList((old) => [...old, betaKey]);
		},
	}), [reload]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return (
		<BetaKeyListContext.Provider value={ context }>
			<div className='shards'>
				<table>
					<thead>
						<tr>
							<th>Id</th>
							<th>Expires</th>
							<th>Uses</th>
							<th>Created By</th>
							<th>Created At</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{ list.map((item) => (
							<BetaKeyRow key={ item.id } betaKey={ item } />
						)) }
					</tbody>
				</table>
				<BetaKeyCreate />
			</div>
		</BetaKeyListContext.Provider>
	);
}

function BetaKeyRow({ betaKey }: { betaKey: IBetaKeyInfo }): ReactElement {
	const connector = useDirectoryConnector();
	const { reload } = useContext(BetaKeyListContext);

	const [onInvalidate] = useAsyncEvent(async () => {
		if (!confirm('Are you sure you want to delete this token?'))
			return { result: 'cancelled' };

		return await connector.awaitResponse('manageInvalidateBetaKey', { id: betaKey.id });
	}, ({ result }) => {
		if (result !== 'ok')  {
			if (result !== 'cancelled') {
				toast('Failed to delete beta key: ' + result, TOAST_OPTIONS_ERROR);
			}
		} else {
			reload();
		}
	});

	const now = useCurrentTime();

	const valid = (betaKey.expires === undefined || betaKey.expires > now) &&
		(betaKey.maxUses === undefined || betaKey.uses < betaKey.maxUses);

	return (
		<tr className={ valid ? '' : 'invalid' }>
			<td>{ betaKey.id }</td>
			<td>
				{ betaKey.expires === undefined ? 'Never' : new Date(betaKey.expires).toLocaleString() }
			</td>
			<td>{ betaKey.maxUses === undefined ? `${betaKey.uses} / ∞` : `${betaKey.uses} / ${betaKey.maxUses}` }</td>
			<td>
				{betaKey.created.username} ({betaKey.created.id})
			</td>
			<td>
				{new Date(betaKey.created.time).toLocaleString()}
			</td>
			<td>
				<Button className='slim' onClick={ () => void onInvalidate() }>Delete</Button>
			</td>
		</tr>
	);
}

function BetaKeyCreate(): ReactElement {
	const account = useCurrentAccount();
	const isAdmin = account?.roles !== undefined && IsAuthorized(account.roles, 'admin');
	const connector = useDirectoryConnector();
	const [expires, setExpires] = useState<undefined | number>(isAdmin ? undefined : Date.now() + ONE_DAY);
	const [maxUses, setMaxUses] = useState<undefined | number>(isAdmin ? undefined : 1);
	const { append } = useContext(BetaKeyListContext);

	const updateMaxUses = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const value = ev.target.value;
		if (value === '' && isAdmin) {
			setMaxUses(undefined);
		} else {
			const num = parseInt(value, 10);
			if (!isNaN(num) && num >= 1 && (isAdmin || num <= 5)) {
				setMaxUses(num);
			}
		}
	}, [isAdmin]);

	const updateExpires = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const value = ev.target.value;
		if (value === '') {
			setExpires(undefined);
		} else {
			const date = new Date(value).getTime();
			const now = Date.now();
			setExpires(clamp(date, now, isAdmin ? Infinity : (now + ONE_DAY * 7)));
		}
	}, [isAdmin]);

	const [onCreate] = useAsyncEvent(async () => {
		return await connector.awaitResponse('manageCreateBetaKey', {
			expires,
			maxUses,
		});
	}, (data) => {
		if (data.result !== 'ok') {
			toast('Failed to create beta key: ' + data.result, TOAST_OPTIONS_ERROR);
			return;
		}
		const { token, info } = data;
		setExpires(undefined);
		setMaxUses(isAdmin ? undefined : 1);
		append(info);

		navigator.clipboard.writeText(token)
			.then(() => toast('Token copied to clipboard', TOAST_OPTIONS_SUCCESS))
			.catch(() => toast('Failed to copy token to clipboard', TOAST_OPTIONS_ERROR));
	});

	return (
		<fieldset className='shard-create'>
			<legend>Create Beta Key</legend>
			<div className='input-row'>
				<label>Expires</label>
				<input type='checkbox' checked={ expires !== undefined } onChange={ (e) => setExpires(e.target.checked ? Date.now() + ONE_DAY : undefined) } disabled={ !isAdmin } />
				<input type='date' value={ expires === undefined ? '' : new Date(expires).toISOString().substring(0, 10) } onChange={ updateExpires } />
			</div>
			<div className='input-row'>
				<label>Max Uses</label>
				<input type='checkbox' checked={ maxUses !== undefined } onChange={ (e) => setMaxUses(e.target.checked ? 1 : undefined) } disabled={ !isAdmin } />
				<input type='number' value={ maxUses === undefined ? '' : maxUses } onChange={ updateMaxUses } min={ 1 } max={ isAdmin ? undefined : 5 } />
			</div>
			<div className='input-row'>
				<Button className='slim' onClick={ () => void onCreate() }>Create</Button>
			</div>
		</fieldset>
	);
}
