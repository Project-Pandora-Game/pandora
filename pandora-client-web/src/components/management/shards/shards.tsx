import { EMPTY, IsAuthorized, IShardTokenConnectInfo, IShardTokenType } from 'pandora-common';
import { createContext, ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { useAsyncEvent } from '../../../common/useEvent';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { Select } from '../../../common/userInteraction/select/select';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks';
import { Button } from '../../common/button/button';
import { useConfirmDialog } from '../../dialog/dialog';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import './shards.scss';

const ShardListContext = createContext({
	reload: () => { /** noop */ },
	append: (_shard: IShardTokenConnectInfo) => { /** noop */ },
});

export function Shards(): ReactElement {
	const connector = useDirectoryConnector();
	const [list, setList] = useState<IShardTokenConnectInfo[]>([]);

	const [reload] = useAsyncEvent(
		() => connector.awaitResponse('manageListShardTokens', EMPTY),
		({ info }) => setList(info),
	);

	const context = useMemo(() => ({
		reload,
		append: (shard: IShardTokenConnectInfo) => {
			setList((old) => [...old, shard]);
		},
	}), [reload]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return (
		<ShardListContext.Provider value={ context }>
			<div className='shards'>
				<ShardCreate />
				<table>
					<thead>
						<tr>
							<th>Id</th>
							<th>Type</th>
							<th>Expires</th>
							<th>Created By</th>
							<th>Created At</th>
							<th>Connected</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{ list.map((item) => (
							<ShardRow key={ item.id } shard={ item } />
						)) }
					</tbody>
				</table>
			</div>
		</ShardListContext.Provider>
	);
}

function ShardRow({ shard }: { shard: IShardTokenConnectInfo; }): ReactElement {
	const connector = useDirectoryConnector();
	const { reload } = useContext(ShardListContext);
	const confirm = useConfirmDialog();

	const [onInvalidate] = useAsyncEvent(async () => {
		if (!await confirm('Confirm deletion', 'Are you sure you want to delete this token?'))
			return { result: 'cancelled' };

		return await connector.awaitResponse('manageInvalidateShardToken', { id: shard.id });
	}, ({ result }) => {
		if (result !== 'ok') {
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
				{ shard.connected ? new Date(shard.connected).toLocaleString() : 'No' }
			</td>
			<td>
				<Button className='slim' onClick={ onInvalidate }>Delete</Button>
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
				<Checkbox checked={ expires !== undefined } onChange={ (checked) => setExpires(checked ? Date.now() : undefined) } />
				{ /* eslint-disable-next-line react/forbid-elements */ }
				<input type='date' value={ expires === undefined ? '' : new Date(expires).toISOString().substring(0, 10) } onChange={ (e) => setExpires(e.target.value === '' ? undefined : new Date(e.target.value).getTime()) } />
			</div>
			<div className='input-row'>
				<Button className='slim' onClick={ onCreate }>Create</Button>
			</div>
		</fieldset>
	);
}
