import { IShardTokenInfo, EMPTY, IsAuthorized, IShardTokenType } from 'pandora-common';
import React, { createContext, ReactElement, useState, useMemo, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { useAsyncEvent } from '../../../common/useEvent';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast';
import { Button } from '../../common/button/button';
import { Select } from '../../common/select/select';
import { useCurrentAccount, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import './shards.scss';

const ShardListContext = createContext({
	reload: () => { /** noop */ },
	append: (_shard: IShardTokenInfo) => { /** noop */ },
});

export function Shards(): ReactElement {
	const connector = useDirectoryConnector();
	const [list, setList] = useState<IShardTokenInfo[]>([]);

	const [reload] = useAsyncEvent(
		() => connector.awaitResponse('manageListShardTokens', EMPTY),
		({ info }) => setList(info),
	);

	const context = useMemo(() => ({
		reload,
		append: (shard: IShardTokenInfo) => {
			setList((old) => [...old, shard]);
		},
	}), [reload]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return (
		<ShardListContext.Provider value={ context }>
			<div className='shards'>
				<table>
					<thead>
						<tr>
							<th>Id</th>
							<th>Type</th>
							<th>Expires</th>
							<th>Created By</th>
							<th>Created At</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{ list.map((item) => (
							<ShardRow key={ item.id } shard={ item } />
						)) }
					</tbody>
				</table>
				<ShardCreate />
			</div>
		</ShardListContext.Provider>
	);
}

function ShardRow({ shard }: { shard: IShardTokenInfo }): ReactElement {
	const connector = useDirectoryConnector();
	const { reload } = useContext(ShardListContext);

	const [onInvalidate] = useAsyncEvent(async () => {
		if (!confirm('Are you sure you want to delete this token?'))
			return { result: 'cancelled' };

		return await connector.awaitResponse('manageInvalidateShardToken', { id: shard.id });
	}, ({ result }) => {
		if (result !== 'ok')  {
			if (result !== 'cancelled') {
				toast('Failed to delete shard token: ' + result, TOAST_OPTIONS_ERROR);
			}
		} else {
			reload();
		}
	});

	const now = useCurrentTime();

	const valid = (shard.expires === undefined || shard.expires > now);

	return (
		<tr className={ valid ? '' : 'invalid' }>
			<td>{ shard.id }</td>
			<td>
				{ shard.type }
			</td>
			<td>
				{ shard.expires === undefined ? 'Never' : new Date(shard.expires).toLocaleString() }
			</td>
			<td>
				{ shard.created.username } ({ shard.created.id })
			</td>
			<td>
				{ new Date(shard.created.time).toLocaleString() }
			</td>
			<td>
				<Button className='slim' onClick={ () => void onInvalidate() }>Delete</Button>
			</td>
		</tr>
	);
}

function ShardCreate(): ReactElement {
	const account = useCurrentAccount();
	const isAdmin = account?.roles !== undefined && IsAuthorized(account.roles, 'admin');
	const connector = useDirectoryConnector();
	const [type, setType] = useState<IShardTokenType>('testing');
	const [expires, setExpires] = useState<undefined | number>(undefined);
	const { append } = useContext(ShardListContext);

	const [onCreate] = useAsyncEvent(
		() => connector.awaitResponse('manageCreateShardToken', {
			type,
			expires,
		}),
		(data) => {
			if (data.result !== 'ok') {
				toast('Failed to create shard token: ' + data.result, TOAST_OPTIONS_ERROR);
				return;
			}
			const { info, token } = data;
			setType('testing');
			setExpires(undefined);
			append(info);

			navigator.clipboard.writeText(token)
				.then(() => toast('Token copied to clipboard', TOAST_OPTIONS_SUCCESS))
				.catch(() => toast('Failed to copy token to clipboard', TOAST_OPTIONS_ERROR));
		},
	);

	return (
		<fieldset className='shard-create'>
			<legend>Create Shard Token</legend>
			<div className='input-row'>
				<label>Production</label>
				<Select value={ type } onChange={ (e) => setType(e.target.value as IShardTokenType) }>
					{ isAdmin ? (
						<>
							<option key='stable' value='stable'>Stable</option>
							<option key='beta' value='beta'>Testing</option>
						</>
					) : null }
					<option value='testing'>Testing</option>
					<option value='development'>Development</option>
				</Select>
			</div>
			<div className='input-row'>
				<label>Expires</label>
				<input type='checkbox' checked={ expires !== undefined } onChange={ (e) => setExpires(e.target.checked ? Date.now() : undefined) } />
				<input type='date' value={ expires === undefined ? '' : new Date(expires).toISOString().substring(0, 10) } onChange={ (e) => setExpires(e.target.value === '' ? undefined : new Date(e.target.value).getTime()) } />
			</div>
			<div className='input-row'>
				<Button className='slim' onClick={ () => void onCreate() }>Create</Button>
			</div>
		</fieldset>
	);
}
