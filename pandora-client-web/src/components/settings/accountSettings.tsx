import _, { uniq } from 'lodash';
import {
	ACCOUNT_ROLES_CONFIG,
	ACCOUNT_SETTINGS_LIMITED_LIMITS,
	type AccountRole,
	DisplayNameSchema,
	EMPTY,
	FormatTimeInterval,
	GetLogger,
	IDirectoryAccountInfo,
	IsAuthorized,
	TimeSpanMs,
} from 'pandora-common';
import { ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useColorInput } from '../../common/useColorInput';
import { useCurrentTime } from '../../common/useCurrentTime';
import { useEvent } from '../../common/useEvent';
import { useMounted } from '../../common/useMounted';
import { Checkbox } from '../../common/userInteraction/checkbox';
import { TextInput } from '../../common/userInteraction/input/textInput';
import { ConfigShowGitHubIntegration } from '../../config/searchArgs';
import { useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { FormCreateStringValidator } from '../common/form/form';
import { ExternalLink } from '../common/link/externalLink';
import { useConfirmDialog } from '../dialog/dialog';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';

export function AccountSettings(): ReactElement | null {
	const navigate = useNavigate();
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<Button onClick={ () => { // TODO: Integrate better
				navigate(`/profiles/account/${account.id}`, {
					state: {
						back: location.pathname,
					},
				});
			} }>
				Edit your account profile
			</Button>
			<LabelColor account={ account } />
			<DisplayName account={ account } />
			<AccountRoleList account={ account } />
			<GitHubIntegration account={ account } />
		</>
	);
}

function GitHubIntegration({ account }: { account: IDirectoryAccountInfo; }): ReactElement | null {
	if (!useObservable(ConfigShowGitHubIntegration) && account.github == null)
		return null;

	return <GitHubIntegrationInner account={ account } />;
}

function GitHubIntegrationInner({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
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

	const confirm = useConfirmDialog();
	const onUnlink = useEvent(() => {
		if (processing)
			return;

		confirm('Confirm unlinking', 'Are you sure you want to unlink GitHub account?')
			.then((result) => {
				if (result) {
					connection.sendMessage('gitHubUnbind', EMPTY);
				}
			})
			.catch(() => { /** ignore */ });
	});

	if (githubUrl && !account.github) {
		return (
			<fieldset className='github-integration'>
				<legend>GitHub Integration</legend>
				<span>Open this link in your browser to link your GitHub account:</span>
				<br />
				<ExternalLink href={ githubUrl }>{ githubUrl }</ExternalLink>
			</fieldset>
		);
	}

	if (!account.github) {
		return (
			<fieldset className='github-integration'>
				<legend>GitHub Integration</legend>
				<span>Account not linked to GitHub, enter your GitHub username to link it.</span>
				<div className='input-row'>
					<TextInput value={ login } onChange={ setLogin } />
					<Button onClick={ onInitLink } disabled={ login.length === 0 || processing }>Link</Button>
				</div>
			</fieldset>
		);
	}

	return (
		<fieldset className='github-integration'>
			<legend>GitHub Integration</legend>
			<span>Login: { account.github.login }</span>
			<span>Id: { account.github.id }</span>
			<div>
				<Button onClick={ onUnlink }>Unlink</Button>
			</div>
		</fieldset>
	);
}

function AccountRoleList({ account }: { account: IDirectoryAccountInfo; }): ReactElement | null {
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

function AccountRole({ role, data }: { role: AccountRole; data?: { expires?: number; }; }): ReactElement {
	const directory = useDirectoryConnector();
	const visibleRoles = useCurrentAccount()?.settings.visibleRoles || [];
	const visible = visibleRoles.includes(role);

	const onSetVisible = (checked: boolean) => {
		if (checked) {
			directory.awaitResponse('changeSettings', {
				type: 'set',
				settings: { visibleRoles: uniq([...visibleRoles, role]) },
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('changeSettings').error('Failed to update settings:', err);
				});
		} else {
			directory.awaitResponse('changeSettings', {
				type: 'set',
				settings: { visibleRoles: visibleRoles.filter((r) => r !== role) },
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('changeSettings').error('Failed to update settings:', err);
				});
		}
	};

	return (
		<tr>
			<td>{ _.startCase(role) }</td>
			<td>
				<Checkbox checked={ visible } onChange={ onSetVisible } />
			</td>
			<td>{ data ? data.expires ? `${new Date(data.expires).toLocaleString()}` : 'Never' : '-' }</td>
		</tr>
	);
}

function LabelColor({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [color, setColor] = useColorInput(account.settings.labelColor);

	return (
		<fieldset>
			<legend>Name color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } title='Name' />
				<Button
					className='slim'
					onClick={ () => {
						directory.awaitResponse('changeSettings', {
							type: 'set',
							settings: { labelColor: color },
						})
							.catch((err: unknown) => {
								toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
								GetLogger('changeSettings').error('Failed to update settings:', err);
							});
					} }
					disabled={ color === account.settings.labelColor?.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function DisplayName({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const nextAllowedChange = account.settingsCooldowns.displayName ?? 0;
	const current = account.settings.displayName ?? account.username;
	const [name, setName] = useState(current);

	const onSetDisplayName = useEvent(() => {
		if (name === current)
			return;
		if (nextAllowedChange > Date.now()) {
			toast(`You can change your display name again in ${FormatTimeInterval(nextAllowedChange - Date.now())}`, TOAST_OPTIONS_ERROR);
			return;
		}

		const displayNameValidator = FormCreateStringValidator(DisplayNameSchema, 'Display name');
		const result = displayNameValidator(name);
		if (result) {
			toast(result, TOAST_OPTIONS_ERROR);
			return;
		}

		const displayName = account.username === name ? null : name;
		directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: { displayName },
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	});

	const now = useCurrentTime(TimeSpanMs(1, 'seconds'));

	return (
		<fieldset>
			<legend>Display name</legend>
			<div className='input-row'>
				<label>Name</label>
				<TextInput value={ name } onChange={ setName } disabled={ nextAllowedChange > now } />
				<Button className='slim' onClick={ onSetDisplayName } disabled={ name === current || nextAllowedChange > now }>Save</Button>
			</div>
			<div className='input-row'>
				{
					(nextAllowedChange > now) ? (
						<span>Next change available in { FormatTimeInterval(nextAllowedChange - now) }</span>
					) : (
						<span>Display name can be changed only once every { FormatTimeInterval(ACCOUNT_SETTINGS_LIMITED_LIMITS.displayName) }</span>
					)
				}
			</div>
		</fieldset>
	);
}
