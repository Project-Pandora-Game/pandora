import { cloneDeep } from 'lodash-es';
import { ACCOUNT_ROLES_CONFIG, AccountRole, GetLogger, IAccountRoleInfo, IAccountRoleManageInfo, IsAuthorized, Logger } from 'pandora-common';
import { ENV } from '../config.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { GitHubInfo } from '../database/databaseStructure.ts';
import type { Account } from './account.ts';
import type { ActorRoles } from './actorIdentity.ts';
const { AUTO_ADMIN_ACCOUNTS } = ENV;

const logger = GetLogger('AccountRoles');

export class AccountRoles implements ActorRoles {
	private readonly _account: Account;
	private readonly _logger: Logger;
	/** Roles saved persistently into database */
	private _roles: IAccountRoleManageInfo;
	/** Roles created temporarily during this session, they are not saved, but have priority */
	private _roleOverrides: IAccountRoleManageInfo = {};

	constructor(account: Account, roles?: IAccountRoleManageInfo) {
		this._account = account;
		this._logger = logger.prefixMessages(`${this._account.username} (${this._account.id})`);
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
		return cloneDeep({
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
		granter.roles._logger.info(`${granted} ${role} role to ${this._account.username} (${this._account.id})`);
		this._cleanup();
		this._account.onAccountInfoChange();
		await this._updateDatabase();
	}

	public async setGitHubStatus(status: GitHubInfo['role'] = 'none', teams: NonNullable<GitHubInfo['teams']> = []): Promise<void> {
		switch (status) {
			case 'admin':
				this._updateGitHubRole('admin');
				break;
			case 'member':
				if (teams.includes('lead-developers'))
					this._updateGitHubRole('lead-developer');
				else if (teams.includes('developers'))
					this._updateGitHubRole('developer');

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
					this._logger.info(`revoked all roles by GitHub`);
				}
				break;
			}
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
		for (const role of Object.keys(this._roles)) {
			for (const implied of ACCOUNT_ROLES_CONFIG[role as AccountRole].implies ?? []) {
				if (this._roles[implied]) {
					delete this._roles[implied];
					this._logger.info(`revoked ${implied} role since it was implied by ${role}`);
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
			this._logger.info(`granted role ${role} by GitHub`);
		}
		for (const [key, value] of Object.entries(this._roles)) {
			if (key === role || value.grantedBy !== 'GitHub')
				continue;

			if (ACCOUNT_ROLES_CONFIG[key as AccountRole].implies?.includes(role)) {
				delete this._roles[key as AccountRole];
				this._logger.info(`overridden ${key} role by GitHub`);
			}
		}
	}

	private async _updateDatabase(): Promise<void> {
		await GetDatabase().updateAccountData(this._account.id, {
			roles: this._roles,
		});
	}
}
