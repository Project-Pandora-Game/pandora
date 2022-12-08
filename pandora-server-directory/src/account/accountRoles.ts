import { AccountRole, GetLogger, IAccountRoleInfo, IAccountRoleManageInfo, IRoleManageInfo, IsAuthorized } from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider';
import type { Account } from './account';

import _ from 'lodash';
import { AUTO_ADMIN_FIRST_USER } from '../config';

const logger = GetLogger('AccountRoles');

export class AccountRoles {
	private readonly _account: Account;
	private _roles?: IAccountRoleManageInfo;

	constructor(account: Account, roles?: IAccountRoleManageInfo) {
		this._account = account;
		this._roles = roles;
	}

	public isAuthorized(role: AccountRole): boolean {
		this._cleanup();
		return this._roles ? IsAuthorized(this._roles, role) : false;
	}

	public getAdminInfo(): Readonly<IAccountRoleManageInfo> {
		this._cleanup();
		return _.cloneDeep(this._roles ?? {});
	}

	public getSelfInfo(): IAccountRoleInfo | undefined {
		if (!this._roles) {
			return undefined;
		}
		this._cleanup();
		const result: IAccountRoleInfo = {};
		for (const [key, value] of Object.entries(this._roles)) {
			result[key as AccountRole] = {
				expires: value.expires,
			};
		}
		return result;
	}

	public async devSetRole(role: AccountRole): Promise<void> {
		if (!AUTO_ADMIN_FIRST_USER) {
			return;
		}
		this._roles ??= {};
		this._roles[role] ??= {
			expires: undefined,
			grantedBy: { id: 0, username: '[[Pandora]]' },
			grantedAt: Date.now(),
		};
		this._cleanup();
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	public async setRole(granter: Account, role: AccountRole, expires?: number): Promise<void> {
		this._roles ??= {};
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
		if (!this._roles) {
			if (status === 'none') {
				this._account.onAccountInfoChange();
				return;
			}
			this._roles = {};
		} else {
			this._cleanup();
		}
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
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	private _cleanup(): void {
		if (!this._roles) {
			return;
		}
		const now = Date.now();
		for (const [key, value] of Object.entries(this._roles)) {
			if (value.expires !== undefined && value.expires < now) {
				delete this._roles[key as AccountRole];
			}
		}
	}

	private async _updateDatabase(): Promise<void> {
		if (this._roles && Object.keys(this._roles).length === 0) {
			this._roles = undefined;
		}
		return await GetDatabase().setAccountRoles(this._account.id, this._roles);
	}
}
