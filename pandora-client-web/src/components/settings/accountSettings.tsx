import React, { ReactElement, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { AccountRole, ACCOUNT_ROLES_CONFIG, EMPTY, IDirectoryAccountInfo, IsAuthorized } from 'pandora-common';
import { useEvent } from '../../common/useEvent';
import { useMounted } from '../../common/useMounted';
import { Button } from '../common/button/button';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { uniq } from 'lodash';
import { ColorInput, useColorInput } from '../common/colorInput/colorInput';

export function AccountSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<GitHubIntegration account={ account } />
			<AccountRoleList account={ account } />
			<LabelColor account={ account } />
		</>
	);
}

function GitHubIntegration({ account }: { account: IDirectoryAccountInfo }): ReactElement {
	const [login, setLogin] = useState('');
	const [githubUrl, setUrl] = useState('');
	const mounted = useMounted();
	const [processing, setProcessing] = useState(false);
	const connection = useDirectoryConnector();

	const onInitLink = useEvent(() => {
		if (processing)
			return;

		setProcessing(true);

		connection.awaitResponse('gitHubBind', { login })
			.then(({ url }) => {
				if (!mounted.current)
					return;

				setLogin('');
				setProcessing(false);
				setUrl(url);
				if (!url)
					toast('GitHun integration is not enabled by the server', TOAST_OPTIONS_ERROR);
			})
			.catch(() => {
				if (!mounted.current)
					return;

				setLogin('');
				setProcessing(false);
				setUrl('');
				toast('Failed to bind GitHub account', TOAST_OPTIONS_ERROR);
			});
	});

	const onUnlink = useEvent(() => {
		if (processing)
			return;

		if (confirm('Are you sure you want to unlink GitHub account?'))
			connection.sendMessage('gitHubUnbind', EMPTY);
	});

	if (githubUrl && !account.github)  {
		return (
			<fieldset className='github-integration'>
				<legend>GitHub Integration</legend>
				<span>Open this link in your browser to link your GitHub account:</span>
				<br />
				<a href={ githubUrl } target='_blank' rel='noopener noreferrer'>{githubUrl}</a>
			</fieldset>
		);
	}

	if (!account.github) {
		return (
			<fieldset className='github-integration'>
				<legend>GitHub Integration</legend>
				<span>Account not linked to GitHub, enter your GitHub username to link it.</span>
				<div className='input-row'>
					<input type='text' value={ login } onChange={ (e) => setLogin(e.target.value) } />
					<Button onClick={ onInitLink } disabled={ login.length === 0 || processing }>Link</Button>
				</div>
			</fieldset>
		);
	}

	return (
		<fieldset className='github-integration'>
			<legend>GitHub Integration</legend>
			<span>Login: {account.github.login}</span>
			<span>Id: {account.github.id}</span>
			<div>
				<Button onClick={ onUnlink }>Unlink</Button>
			</div>
		</fieldset>
	);
}

function AccountRoleList({ account }: { account: IDirectoryAccountInfo }): ReactElement | null {
	const elements = useMemo(() => {
		if (!account.roles)
			return [];

		return [...Object.keys(ACCOUNT_ROLES_CONFIG)]
			.filter((role) => IsAuthorized(account.roles || {}, role as AccountRole))
			.map((role) => <AccountRole key={ role } role={ role as AccountRole } data={ account.roles?.[role as AccountRole] } />);
	}, [account.roles]);

	if (elements.length === 0)
		return null;

	return (
		<fieldset className='account-roles'>
			<legend>Account Roles</legend>
			<table>
				<thead>
					<tr>
						<th>Role</th>
						<th>Visible</th>
						<th>Expires</th>
					</tr>
				</thead>
				<tbody>
					{ elements }
				</tbody>
			</table>
		</fieldset>
	);
}

function AccountRole({ role, data }: { role: AccountRole, data?: { expires?: number } }): ReactElement {
	const connector = useDirectoryConnector();
	const visibleRoles = useCurrentAccount()?.settings.visibleRoles || [];
	const visible = visibleRoles.includes(role);

	const onSetVisible = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.checked) {
			connector.sendMessage('changeSettings', { visibleRoles: uniq([...visibleRoles, role]) });
		} else {
			connector.sendMessage('changeSettings', { visibleRoles: visibleRoles.filter((r) => r !== role) });
		}
	};

	return (
		<tr>
			<td>{ role }</td>
			<td>
				<input type='checkbox' checked={ visible } onChange={ onSetVisible } />
			</td>
			<td>{ data ? data.expires ? `${new Date(data.expires).toLocaleString()}` : 'Never' : '-' }</td>
		</tr>
	);
}

function LabelColor({ account }: { account: IDirectoryAccountInfo }): ReactElement {
	const directory = useDirectoryConnector();
	const [color, setColor] = useColorInput(account.settings.labelColor);

	return (
		<fieldset>
			<legend>Name color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } />
				<Button
					className='slim'
					onClick={ () => directory?.sendMessage('changeSettings', { labelColor: color }) }
					disabled={ color === account.settings.labelColor?.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}
