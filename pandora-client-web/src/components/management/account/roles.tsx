import { AccountRole, ConfiguredAccountRole, ConfiguredAccountRoleSchema, IAccountRoleManageInfo, IRoleManageInfo, IsAuthorized, ZodMatcher, type AccountId } from 'pandora-common';
import { createContext, ReactElement, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { Button } from '../../common/button/button.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import './roles.scss';

const RoleListContext = createContext({
	id: 0,
	roles: null as null | IAccountRoleManageInfo,
	reload: () => { /** noop */ },
});

const IsConfiguredAccountRole = ZodMatcher(ConfiguredAccountRoleSchema);

export function Roles({ id, roles, reload }: {
	id: AccountId;
	roles: IAccountRoleManageInfo;
	reload: () => void;
}): ReactElement {
	const context = useMemo(() => ({
		id,
		roles,
		reload,
	}), [id, roles, reload]);

	return (
		<RoleListContext.Provider value={ context }>
			<div className='management-roles'>
				<table>
					<thead>
						<tr>
							<th>Role</th>
							<th>Expires</th>
							<th>Granted By</th>
							<th>Granted At</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{ roles && (
							[...Object.entries(roles)].map(([role, data]) => (
								<ManageRoleTr key={ role } id={ id } role={ role as AccountRole } data={ data } />
							))
						) }
					</tbody>
				</table>
				<ManageRoleGrant />
			</div>
		</RoleListContext.Provider>
	);
}

function ManageRoleTr({ role, data }: { id: number; role: AccountRole; data: IRoleManageInfo; }): ReactElement {
	const connector = useDirectoryConnector();
	const { id, reload } = useContext(RoleListContext);

	const [onRevoke] = useAsyncEvent(
		() => connector.awaitResponse('manageSetAccountRole', { id, role: role as ConfiguredAccountRole, expires: 0 }),
		({ result }) => {
			if (result !== 'ok') {
				toast('Failed to revoke role, ' + result, TOAST_OPTIONS_ERROR);
			}
			reload();
		},
	);

	const grantedBy = typeof data.grantedBy === 'string' ? data.grantedBy : `${ data.grantedBy.username } (${ data.grantedBy.id })`;
	return (
		<tr>
			<td>{ role }</td>
			<td>{ data.expires ? new Date(data.expires).toLocaleString() : 'Never' }</td>
			<td>{ grantedBy }</td>
			<td>{ new Date(data.grantedAt).toLocaleString() }</td>
			<td>
				{ IsConfiguredAccountRole(role) && (
					<Button className='slim' onClick={ onRevoke }>Revoke</Button>
				) }
			</td>
		</tr>
	);
}

function ManageRoleGrant(): ReactElement {
	const connector = useDirectoryConnector();
	const { id, roles, reload } = useContext(RoleListContext);
	const [role, setRole] = useState<ConfiguredAccountRole | null>(null);
	const [expires, setExpires] = useState<number | undefined>(undefined);
	const includes = (r: AccountRole) => roles != null && IsAuthorized(roles, r);

	const [onGrant] = useAsyncEvent(
		() => connector.awaitResponse('manageSetAccountRole', { id, role: role as ConfiguredAccountRole, expires }),
		({ result }) => {
			if (result !== 'ok') {
				toast('Failed to grant role, ' + result, TOAST_OPTIONS_ERROR);
			}
			reload();
		},
	);

	return (
		<fieldset className='role-grant'>
			<legend>Grant Role</legend>
			<div className='input-row'>
				<label>Role</label>
				<Select value={ role ?? '' } onChange={ (e) => setRole(e.target.value as ConfiguredAccountRole) }>
					<option value=''>Select a role</option>
					<option value={ 'moderator' } disabled={ includes('moderator') }>Moderator</option>
				</Select>
			</div>
			<div className='input-row'>
				<label>Expires</label>
				<Checkbox checked={ expires !== undefined } onChange={ (checked) => setExpires(checked ? Date.now() : undefined) } />
				{ /* eslint-disable-next-line react/forbid-elements */ }
				<input type='date' value={ expires } onChange={ (e) => setExpires(new Date(e.target.value).getTime()) } readOnly={ expires === undefined } />
			</div>
			<div className='input-row'>
				<Button className='slim' onClick={ onGrant } disabled={ !role || !roles || includes(role) }>Grant</Button>
			</div>
		</fieldset>
	);
}
