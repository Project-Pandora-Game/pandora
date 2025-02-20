import { freeze, produce, type Immutable } from 'immer';
import { z } from 'zod';
import type { IItemLoadContext } from '../../assets/item/base';
import type { CharacterRestrictionsManager } from '../../character/restrictionsManager';
import type { Logger } from '../../logging';
import { Assert, AssertNever, AssertNotNullable, CloneDeepMutable } from '../../utility/misc';
import type { AppearanceActionContext } from '../actionLogic/appearanceActions';
import type { LockDataBundle } from './lockData';
import type { LockSetup } from './lockSetup';

export const LockActionSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('lock'),
		password: z.string().optional(),
	}),
	z.object({
		action: z.literal('unlock'),
		password: z.string().optional(),
		clearLastPassword: z.boolean().optional(),
	}),
	z.object({
		action: z.literal('showPassword'),
	}),
]);
export type LockAction = z.infer<typeof LockActionSchema>;

export type LockActionLockResult = {
	result: 'ok';
	newState: LockLogic;
} | {
	result: 'failed';
	reason: 'blockSelf' | 'noStoredPassword';
} | {
	result: 'invalid';
};

export type LockActionUnlockResult = {
	result: 'ok';
	newState: LockLogic;
} | {
	result: 'failed';
	reason: 'blockSelf' | 'wrongPassword';
} | {
	result: 'invalid';
};

export type LockActionShowPasswordResult = {
	result: 'ok';
	password: string | null;
} | {
	result: 'failed';
	reason: 'notAllowed';
} | {
	result: 'invalid';
};

export interface LockActionContext {
	/** The character doing the action. */
	player: CharacterRestrictionsManager;
	/** Whether the character doing the action is targetting a lock somewhere on themselves. */
	isSelfAction: boolean;
	/** In which context is the action being executed. */
	executionContext: AppearanceActionContext['executionContext'];
}

export class LockLogic {
	public readonly lockSetup: Immutable<LockSetup>;
	public readonly lockData: Immutable<LockDataBundle>;

	protected constructor(lockSetup: Immutable<LockSetup>, lockData: Immutable<LockDataBundle>) {
		this.lockSetup = lockSetup;
		this.lockData = lockData;
	}

	public get hasPassword(): boolean {
		switch (this.lockData.hidden?.side) {
			case 'client':
				return this.lockData.hidden.hasPassword ?? false;
			case 'server':
				return this.lockData.hidden.password != null;
			default:
				return false;
		}
	}

	public get blocksSelfActions(): boolean {
		switch (this.lockSetup.blockSelf) {
			case undefined:
			case false:
				return false;
			case 'locked':
				return this.isLocked();
			case 'always':
				return true;
		}
		AssertNever(this.lockSetup.blockSelf);
	}

	public exportToClientBundle(): LockDataBundle {
		if (this.lockData.hidden?.side === 'server') {
			return {
				...this.lockData,
				hidden: {
					side: 'client',
					hasPassword: this.lockData.hidden.password ? true : undefined,
				},
			};
		}
		return this.lockData;
	}

	public exportToServerBundle(): LockDataBundle {
		return this.lockData;
	}

	public isLocked(): boolean {
		return this.lockData.locked != null;
	}

	public lock({ player, executionContext, isSelfAction }: LockActionContext, { password }: Extract<LockAction, { action: 'lock'; }>): LockActionLockResult {
		if (this.isLocked())
			return { result: 'invalid' };

		// Locks can prevent interaction from player (unless in force-allow is enabled)
		if (this.blocksSelfActions && isSelfAction && !player.forceAllowItemActions()) {
			return {
				result: 'failed',
				reason: 'blockSelf',
			};
		}

		let hidden: LockDataBundle['hidden'] | undefined;
		if (this.lockSetup.password != null && password == null) {
			switch (this.lockData?.hidden?.side) {
				case 'client':
					if (!this.lockData.hidden.hasPassword && executionContext !== 'clientOnlyVerify') {
						return {
							result: 'failed',
							reason: 'noStoredPassword',
						};
					}
					hidden = { side: 'client', hasPassword: true };
					break;
				case 'server':
					if (this.lockData.hidden.password == null || this.lockData.hidden.passwordSetBy == null) {
						return {
							result: 'failed',
							reason: 'noStoredPassword',
						};
					}
					hidden = {
						side: 'server',
						password: this.lockData.hidden.password,
						passwordSetBy: this.lockData.hidden.passwordSetBy,
					};
					break;
				default:
					return {
						result: 'failed',
						reason: 'noStoredPassword',
					};
			}
		} else if (password != null) {
			hidden = {
				side: 'server',
				password,
				passwordSetBy: player.appearance.id,
			};
		}

		const lockData: Immutable<LockDataBundle> = produce(this.lockData, (data) => {
			data.hidden = hidden;
			data.locked = {
				id: player.appearance.id,
				name: player.appearance.character.name,
				time: Date.now(),
			};
		});

		return {
			result: 'ok',
			newState: new LockLogic(this.lockSetup, lockData),
		};
	}

	public unlock({ player, executionContext, isSelfAction }: LockActionContext, { password, clearLastPassword }: Extract<LockAction, { action: 'unlock'; }>): LockActionUnlockResult {
		if (!this.isLocked() || this.lockData == null)
			return { result: 'invalid' };

		// Locks can prevent interaction from player (unless in force-allow is enabled)
		if (this.blocksSelfActions && isSelfAction && !player.forceAllowItemActions()) {
			return {
				result: 'failed',
				reason: 'blockSelf',
			};
		}

		if (this.lockSetup.password != null && !player.forceAllowItemActions() && executionContext === 'act') {
			if (this.lockData.hidden?.side === 'server' && !LockLogic._isEqualPassword(this.lockSetup, this.lockData.hidden.password, password)) {
				return {
					result: 'failed',
					reason: 'wrongPassword',
				};
			}
		}

		const lockData: Immutable<LockDataBundle> = produce(this.lockData, (data) => {
			delete data.locked;

			if (clearLastPassword && data.hidden) {
				switch (data.hidden.side) {
					case 'client':
						delete data.hidden.hasPassword;
						break;
					case 'server':
						delete data.hidden.password;
						delete data.hidden.passwordSetBy;
						break;
				}
				// remove hidden if only it has side
				if (Object.keys(data.hidden).length === 1) {
					delete data.hidden;
				}
			}
		});

		return {
			result: 'ok',
			newState: new LockLogic(this.lockSetup, lockData),
		};
	}

	public showPassword({ player }: LockActionContext): LockActionShowPasswordResult {
		if (!this.isLocked() || this.lockData == null) {
			return { result: 'invalid' };
		}
		if (this.lockData.hidden?.side !== 'server') {
			// Partial success on client side - checks pass, but there is no password to show
			return {
				result: 'ok',
				password: null,
			};
		}

		AssertNotNullable(this.lockData.hidden.password);

		if (this.lockData.hidden.passwordSetBy !== player.appearance.id) {
			return {
				result: 'failed',
				reason: 'notAllowed',
			};
		}

		return {
			result: 'ok',
			password: this.lockData.hidden.password,
		};

	}

	public static loadFromBundle(lockSetup: Immutable<LockSetup>, bundle: Immutable<LockDataBundle> | undefined = {}, context: IItemLoadContext): LockLogic {
		freeze(lockSetup, true);
		freeze(bundle, true);
		// Load-time cleanup logic
		if (context.doLoadTimeCleanup && bundle?.hidden != null) {
			const lockData = CloneDeepMutable(bundle);
			Assert(lockData?.hidden != null);
			switch (lockData.hidden.side) {
				case 'client':
					if (lockSetup.password == null && lockData.hidden.hasPassword != null) {
						context.logger?.warning(`Lock without password has hidden password`);
						delete lockData.hidden.hasPassword;
					} else if (lockSetup.password != null && lockData.hidden.hasPassword == null) {
						context.logger?.warning(`Lock with password has no hidden password`);
						delete lockData.locked;
					}
					break;
				case 'server':
					if (lockData.hidden.password != null && !LockLogic.validatePassword(lockSetup, lockData.hidden.password, context.logger)) {
						delete lockData.hidden.password;
					}
					if (lockSetup.password != null && lockData.hidden?.password == null && lockData.locked != null) {
						context.logger?.warning(`Lock is locked but has no hidden password`);
						delete lockData.locked;
					}
					if (lockData.hidden.password == null && lockData.hidden.passwordSetBy != null) {
						context.logger?.warning(`Lock has password set by but no password`);
						delete lockData.hidden.passwordSetBy;
					}
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				delete lockData.hidden;
			}

			bundle = freeze(lockData, true);
		}

		return new LockLogic(lockSetup, bundle);
	}

	private static _isEqualPassword(_lockSetup: Immutable<LockSetup>, lhs?: string, rhs?: string): boolean {
		if (lhs == null || rhs == null)
			return lhs === rhs;

		// all passwords are case insensitive for now
		return lhs.toLowerCase() === rhs.toLowerCase();
	}

	public static validatePassword(lockSetup: Immutable<LockSetup>, password: string, logger?: Logger): boolean {
		const def = lockSetup.password;
		if (def == null) {
			logger?.warning(`has a hidden password but the asset does not define a password`);
			return false;
		}
		if (typeof def.length === 'number') {
			if (password.length !== def.length) {
				logger?.warning(`has a hidden password longer than the asset's password length`);
				return false;
			}
		} else if (password.length < def.length[0] || password.length > def.length[1]) {
			logger?.warning(`has a hidden password outside of the asset's password length range`);
			return false;
		}
		switch (def.format) {
			case 'numeric':
				if (/[^0-9]/.exec(password)) {
					logger?.warning(`has a hidden password that is not numeric`);
					return false;
				}
				break;
			case 'letters':
				if (/[^a-zA-Z]/.exec(password)) {
					logger?.warning(`has a hidden password that is not letters`);
					return false;
				}
				break;
			case 'alphanumeric':
				if (/[^a-zA-Z0-9]/.exec(password)) {
					logger?.warning(`has a hidden password that is not alphanumeric`);
					return false;
				}
				break;
			case 'text':
				break;
			default:
				AssertNever(def.format);
		}
		return true;
	}
}
