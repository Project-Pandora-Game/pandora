import { AccountRole, ACCOUNT_ROLES_CONFIG, GetLogger, IAccountRoleInfo, IAccountRoleManageInfo, IsAuthorized } from 'pandora-common';
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
		granter.roles._log(`${granted} ${role} role to ${this._account.username} (${this._account.id})`);
		this._cleanup();
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	public async setGitHubStatus(status: GitHubInfo['role'] = 'none', teams: NonNullable<GitHubInfo['teams']> = []): Promise<void> {
		const founder = teams.includes('beta-access');
		let allowFounder = false;
		switch (status) {
			case 'admin':
				this._updateGitHubRole('admin');
				allowFounder = true;
				break;
			case 'member':
				if (teams.includes('lead-developers'))
					this._updateGitHubRole('lead-developer');
				else if (teams.includes('developers'))
					this._updateGitHubRole('developer');
				else if (!founder)
					logger.warning(`${this._account.username} (${this._account.id}) is a GitHub member but not in developers team`);
				/**
				 * should be founder only, if not founder, then it's a mistake
				 *   as any founder who contributed should be in developers team
				 *   and any new member should also be in developers team
				 *
				 * no special role is granted
				 */

				allowFounder = true;
				break;
			case 'collaborator':
				this._updateGitHubRole('contributor');
				break;
			case 'none': {
				let revoked = false;
				for (const [key, value] of Object.entries(this._roles)) {
					if (value.grantedBy === 'GitHub') {
						delete this._roles[key as AccountRole];
						revoked = true;
					}
				}
				if (revoked) {
					this._log(`revoked all roles by GitHub`);
				}
				break;
			}
			default:
				break;
		}
		if (founder && allowFounder) {
			this._updateGitHubRole('founder');
		} else if (this._roles.founder) {
			delete this._roles.founder;
			this._log(`revoked founder role by GitHub`);
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
		for (const role of Object.keys(this._roles)) {
			for (const implied of ACCOUNT_ROLES_CONFIG[role as AccountRole].implies ?? []) {
				if (this._roles[implied]) {
					delete this._roles[implied];
					this._log(`revoked ${implied} role since it was implied by ${role}`);
				}
			}
		}
	}

	private _updateGitHubRole(role: AccountRole): void {
		const original = this._roles[role];
		if (original === undefined || original.grantedBy !== 'GitHub') {
			this._roles[role] = {
				grantedBy: 'GitHub',
				grantedAt: Date.now(),
			};
			this._log(`granted all ${role} by GitHub`);
		}
		for (const [key, value] of Object.entries(this._roles)) {
			if (key === role || value.grantedBy !== 'GitHub')
				continue;

			if (ACCOUNT_ROLES_CONFIG[key as AccountRole].implies?.includes(role)) {
				delete this._roles[key as AccountRole];
				this._log(`overridden ${key} role by GitHub`);
			}
		}
	}

	private _log(content: string) {
		logger.info(`${this._account.username} (${this._account.id}) ${content}`);
	}

	private async _updateDatabase(): Promise<void> {
		return await GetDatabase().setAccountRoles(this._account.id, Object.keys(this._roles).length > 0 ? this._roles : undefined);
	}
}
