import { AccountRole, GetLogger, IAccountRoleInfo, IAccountRoleManageInfo, IRoleManageInfo, IsAuthorized } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import type { Account } from './account';
import { AUTO_ADMIN_ACCOUNTS } from '../config';

import _ from 'lodash';

const logger = GetLogger('AccountRoles');

export class AccountRoles {
	private readonly _account: Account;
	/** Roles saved persistently into database */
	private _roles: IAccountRoleManageInfo;
	/** Roles created temporarily during this session, they are not saved, but have priority */
	private _roleOverrides: IAccountRoleManageInfo = {};

	constructor(account: Account, roles?: IAccountRoleManageInfo) {
		this._account = account;
		this._roles = roles ?? {};
		this._devSetRoles();
		this._cleanup();
	}

	public isAuthorized(role: AccountRole): boolean {
		this._cleanup();
		return IsAuthorized({
			...this._roles,
			...this._roleOverrides,
		}, role);
	}

	public getAdminInfo(): Readonly<IAccountRoleManageInfo> {
		this._cleanup();
		return _.cloneDeep({
			...this._roles,
			...this._roleOverrides,
		});
	}

	public getSelfInfo(): IAccountRoleInfo | undefined {
		this._cleanup();
		const result: IAccountRoleInfo = {};
		for (const [key, value] of Object.entries({
			...this._roles,
			...this._roleOverrides,
		})) {
			result[key as AccountRole] = {
				expires: value.expires,
			};
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private _devSetRoles(): void {
		if (AUTO_ADMIN_ACCOUNTS.includes(this._account.id)) {
			this._roleOverrides.admin = {
				expires: undefined,
				grantedBy: { id: 0, username: '[[Pandora]]' },
				grantedAt: Date.now(),
			};
		}
	}

	public async setRole(granter: Account, role: AccountRole, expires?: number): Promise<void> {
		this._roles[role] = {
			expires: expires ?? undefined,
			grantedBy: { id: granter.id, username: granter.username },
			grantedAt: Date.now(),
		};
		const granted = (expires === undefined || expires > Date.now()) ? 'granted' : 'revoked';
		logger.info(`${granter.username} (${granter.id}) ${granted} ${role} role to ${this._account.username} (${this._account.id})`);
		this._cleanup();
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	public async setGitHubStatus(status: GitHubInfo['role'] = 'none'): Promise<void> {
		delete this._roles.admin;
		delete this._roles.developer;
		delete this._roles.contributor;
		const info: IRoleManageInfo = { grantedBy: 'GitHub', grantedAt: Date.now() };
		switch (status) {
			case 'admin':
				this._roles.admin = info;
				logger.info(`${this._account.username} (${this._account.id}) granted admin role by GitHub`);
				break;
			case 'member':
				this._roles.developer = info;
				logger.info(`${this._account.username} (${this._account.id}) granted developer role by GitHub`);
				break;
			case 'collaborator':
				this._roles.contributor = info;
				logger.info(`${this._account.username} (${this._account.id}) granted contributor role by GitHub`);
				break;
			case 'none':
				logger.info(`${this._account.username} (${this._account.id}) revoked all roles by GitHub`);
				break;
			default:
				break;
		}
		this._cleanup();
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	private _cleanup(): void {
		const now = Date.now();
		for (const [key, value] of Object.entries(this._roles)) {
			if (value.expires !== undefined && value.expires < now) {
				delete this._roles[key as AccountRole];
			}
		}
	}

	private async _updateDatabase(): Promise<void> {
		return await GetDatabase().setAccountRoles(this._account.id, Object.keys(this._roles).length > 0 ? this._roles : undefined);
	}
}
