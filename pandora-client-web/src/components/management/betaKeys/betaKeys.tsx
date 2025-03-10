import { clamp } from 'lodash-es';
import { EMPTY, IsAuthorized, type IBetaKeyInfo } from 'pandora-common';
import React, { createContext, ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../common/button/button.tsx';
import { useConfirmDialog } from '../../dialog/dialog.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
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
				<BetaKeyCreate />
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
			</div>
		</BetaKeyListContext.Provider>
	);
}

function BetaKeyRow({ betaKey }: { betaKey: IBetaKeyInfo; }): ReactElement {
	const connector = useDirectoryConnector();
	const { reload } = useContext(BetaKeyListContext);
	const confirm = useConfirmDialog();

	const [onInvalidate] = useAsyncEvent(async () => {
		if (!await confirm('Confirm deletion', 'Are you sure you want to delete this token?'))
			return { result: 'cancelled' };

		return await connector.awaitResponse('manageInvalidateBetaKey', { id: betaKey.id });
	}, ({ result }) => {
		if (result !== 'ok') {
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
				{ betaKey.created.username } ({ betaKey.created.id })
			</td>
			<td>
				{ new Date(betaKey.created.time).toLocaleString() }
			</td>
			<td>
				<Button className='slim' onClick={ onInvalidate }>Delete</Button>
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

	const updateMaxUses = useCallback((newValue: number) => {
		if (newValue === 0 && isAdmin) {
			setMaxUses(undefined);
		} else {
			if (!isNaN(newValue) && newValue >= 1 && (isAdmin || newValue <= 5)) {
				setMaxUses(newValue);
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
				<Checkbox checked={ expires !== undefined } onChange={ (checked) => setExpires(checked ? Date.now() + ONE_DAY : undefined) } disabled={ !isAdmin } />
				{ /* eslint-disable-next-line react/forbid-elements */ }
				<input type='date' value={ expires === undefined ? '' : new Date(expires).toISOString().substring(0, 10) } onChange={ updateExpires } />
			</div>
			<div className='input-row'>
				<label>Max Uses</label>
				<Checkbox checked={ maxUses !== undefined } onChange={ (checked) => setMaxUses(checked ? 1 : undefined) } disabled={ !isAdmin } />
				<NumberInput value={ maxUses === undefined ? 0 : maxUses } onChange={ updateMaxUses } min={ isAdmin ? 0 : 1 } max={ isAdmin ? undefined : 5 } />
			</div>
			<div className='input-row'>
				<Button className='slim' onClick={ onCreate }>Create</Button>
			</div>
		</fieldset>
	);
}
