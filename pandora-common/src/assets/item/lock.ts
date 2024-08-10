import type { Immutable } from 'immer';
import { z } from 'zod';

import type { Asset } from '../asset';
import type { IExportOptions } from '../modules/common';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { IItemLoadContext, IItemValidationContext, ItemBundle } from './base';
import type { AssetLockProperties, AssetProperties } from '../properties';
import type { AppearanceValidationResult, AppearanceItems } from '../appearanceValidation';

import { Logger } from '../../logging';
import { AssertNever, AssertNotNullable, MemoizeNoArg } from '../../utility';
import { CharacterIdSchema } from '../../character/characterTypes';

import { ItemBaseProps, ItemBase } from './_internal';

declare module './_internal' {
	interface InternalItemTypeMap {
		lock: ItemLock;
	}
}

export const LockBundleSchema = z.object({
	locked: z.object({
		/** Id of the character that locked the item */
		id: CharacterIdSchema,
		/** Name of the character that locked the item */
		name: z.string(),
		/** Time the item was locked */
		time: z.number(),
	}).optional(),
	hidden: z.discriminatedUnion('side', [
		z.object({
			side: z.literal('server'),
			/** Password used to lock the item */
			password: z.string().optional(),
			/** Id of the character who set the password last time */
			passwordSetBy: CharacterIdSchema.optional(),
		}),
		z.object({
			side: z.literal('client'),
			/** Whether the item has a password */
			hasPassword: z.boolean().optional(),
		}),
	]).optional(),
});
export type LockBundle = z.infer<typeof LockBundleSchema>;

export const ItemLockActionSchema = z.discriminatedUnion('action', [
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
export type IItemLockAction = z.infer<typeof ItemLockActionSchema>;

interface ItemLockProps extends ItemBaseProps<'lock'> {
	readonly lockData: Immutable<LockBundle> | undefined;
}
export class ItemLock extends ItemBase<'lock'> {
	public readonly lockData: Immutable<LockBundle> | undefined;

	public get hasPassword(): boolean {
		switch (this.lockData?.hidden?.side) {
			case 'client':
				return this.lockData.hidden.hasPassword ?? false;
			case 'server':
				return this.lockData.hidden.password != null;
			default:
				return false;
		}
	}

	protected constructor(props: ItemLockProps, overrideProps: Partial<ItemLockProps> = {}) {
		super(props, overrideProps);
		this.lockData = 'lockData' in overrideProps ? overrideProps.lockData : props.lockData;
	}

	protected override withProps(overrideProps: Partial<ItemLockProps>): ItemLock {
		return new ItemLock(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'lock'>, bundle: ItemBundle, context: IItemLoadContext): ItemLock {
		const lockData: LockBundle | undefined = bundle.lockData;
		if (context.doLoadTimeCleanup && lockData?.hidden != null) {
			switch (lockData.hidden.side) {
				case 'client':
					if (asset.definition.password == null && lockData.hidden.hasPassword != null) {
						context.logger?.warning(`Lock ${bundle.id} has hidden password`);
						delete lockData.hidden.hasPassword;
					} else if (asset.definition.password != null && lockData.hidden.hasPassword == null) {
						context.logger?.warning(`Lock ${bundle.id} has no hidden password`);
						delete lockData.locked;
					}
					break;
				case 'server':
					if (lockData.hidden.password != null && !ItemLock._validatePassword(asset, lockData.hidden.password, context.logger?.prefixMessages(`Lock ${bundle.id}`))) {
						delete lockData.hidden.password;
					}
					if (asset.definition.password != null && lockData.hidden?.password == null && lockData.locked != null) {
						context.logger?.warning(`Lock ${bundle.id} is locked but has no hidden password`);
						delete lockData.locked;
					}
					if (lockData.hidden.password == null && lockData.hidden.passwordSetBy != null) {
						context.logger?.warning(`Lock ${bundle.id} has password set by but no password`);
						delete lockData.hidden.passwordSetBy;
					}
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				delete lockData.hidden;
			}
		}

		return new ItemLock({
			...(ItemBase._parseBundle(asset, bundle, context)),
			lockData,
		});
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		if (options.clientOnly && this.lockData?.hidden?.side === 'server') {
			return {
				...super.exportToBundle(options),
				lockData: {
					...this.lockData,
					hidden: {
						side: 'client',
						hasPassword: this.lockData.hidden.password ? true : undefined,
					},
				},
			};
		}
		return {
			...super.exportToBundle(options),
			lockData: this.lockData,
		};
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		if (context.location === 'worn') {
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};
		}

		return { success: true };
	}

	public override getModuleItems(_moduleName: string): AppearanceItems {
		return [];
	}

	public override setModuleItems(_moduleName: string, _items: AppearanceItems): null {
		return null;
	}

	public isLocked(): boolean {
		return this.lockData?.locked != null;
	}

	public getLockProperties(): AssetLockProperties {
		if (this.isLocked())
			return this.asset.definition.locked ?? {};

		return this.asset.definition.unlocked ?? {};
	}

	public lockAction(context: AppearanceModuleActionContext, action: IItemLockAction): ItemLock | null {
		if (action.action === 'showPassword') {
			// 'blockSelf' has no meaning for showPassword
			return this.showPassword(context);
		}

		const playerRestrictionManager = context.processingContext.getPlayerRestrictionManager();

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = context.targetCharacter != null && context.targetCharacter.character.id === context.processingContext.player.id;
		const properties = this.getLockProperties();

		if (action.password != null && !ItemLock._validatePassword(this.asset, action.password)) {
			return null;
		}

		// Locks can prevent interaction from player (unless in force-allow is enabled)
		if (properties.blockSelf && isSelfAction && !playerRestrictionManager.forceAllowItemActions()) {
			context.reject({
				type: 'lockInteractionPrevented',
				moduleAction: action.action,
				reason: 'blockSelf',
				asset: this.asset.id,
				itemName: this.name ?? '',
			});
			return null;
		}

		switch (action.action) {
			case 'lock':
				return this.lock(context, action);
			case 'unlock':
				return this.unlock(context, action);
		}
		AssertNever(action);
	}

	public lock({ messageHandler, processingContext, reject }: AppearanceModuleActionContext, { password }: IItemLockAction & { action: 'lock'; }): ItemLock | null {
		if (this.isLocked())
			return null;

		const rejectMissingPassword = () => {
			reject({
				type: 'lockInteractionPrevented',
				moduleAction: 'lock',
				reason: 'noStoredPassword',
				asset: this.asset.id,
				itemName: this.name ?? '',
			});
			return null;
		};

		let hidden: LockBundle['hidden'] | undefined;
		if (this.asset.definition.password != null && password == null) {
			switch (this.lockData?.hidden?.side) {
				case 'client':
					if (!this.lockData.hidden.hasPassword) {
						return rejectMissingPassword();
					}
					hidden = { side: 'client', hasPassword: true };
					break;
				case 'server':
					if (this.lockData.hidden.password == null || this.lockData.hidden.passwordSetBy == null) {
						return rejectMissingPassword();
					}
					hidden = {
						side: 'server',
						password: this.lockData.hidden.password,
						passwordSetBy: this.lockData.hidden.passwordSetBy,
					};
					break;
				default:
					return rejectMissingPassword();
			}
		} else if (password != null) {
			hidden = {
				side: 'server',
				password,
				passwordSetBy: processingContext.player.id,
			};
		}

		if (this.asset.definition.chat?.actionLock) {
			messageHandler({
				id: 'custom',
				customText: this.asset.definition.chat.actionLock,
			});
		}

		return this.withProps({
			lockData: {
				...this.lockData,
				hidden,
				locked: {
					id: processingContext.player.id,
					name: processingContext.player.name,
					time: Date.now(),
				},
			},
		});
	}

	public unlock({ messageHandler, failure, processingContext }: AppearanceModuleActionContext, { password, clearLastPassword }: IItemLockAction & { action: 'unlock'; }): ItemLock | null {
		const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
		if (!this.isLocked() || this.lockData == null)
			return null;

		if (this.asset.definition.password != null && !playerRestrictionManager.forceAllowItemActions()) {
			if (password == null) {
				return null;
			}
			if (this.lockData.hidden?.side === 'server' && !ItemLock._isEqualPassword(this.asset, this.lockData.hidden.password, password)) {
				failure({
					type: 'lockInteractionPrevented',
					moduleAction: 'unlock',
					reason: 'wrongPassword',
					asset: this.asset.id,
					itemName: this.name ?? '',
				});
			}
		}

		if (this.asset.definition.chat?.actionUnlock) {
			messageHandler({
				id: 'custom',
				customText: this.asset.definition.chat.actionUnlock,
			});
		}

		const lockData: LockBundle = {
			...this.lockData,
			hidden: this.lockData?.hidden ? { ...this.lockData.hidden } : undefined,
			locked: undefined,
		};
		if (clearLastPassword && lockData.hidden) {
			switch (lockData.hidden.side) {
				case 'client':
					delete lockData.hidden.hasPassword;
					break;
				case 'server':
					delete lockData.hidden.password;
					delete lockData.hidden.passwordSetBy;
					break;
			}
			// remove hidden if only it has side
			if (Object.keys(lockData.hidden).length === 1) {
				lockData.hidden = undefined;
			}
		}

		return this.withProps({
			lockData,
		});
	}

	public showPassword({ failure, addData, processingContext }: AppearanceModuleActionContext): ItemLock | null {
		if (!this.isLocked() || this.lockData == null) {
			return null;
		}
		if (this.lockData.hidden?.side !== 'server') {
			return this;
		}

		AssertNotNullable(this.lockData.hidden.password);

		if (this.lockData.hidden.passwordSetBy !== processingContext.player.id) {
			failure({
				type: 'lockInteractionPrevented',
				moduleAction: 'showPassword',
				reason: 'notAllowed',
				asset: this.asset.id,
				itemName: this.name ?? '',
			});
			return this;
		}

		addData({
			moduleAction: 'showPassword',
			password: this.lockData.hidden.password,
		});

		return this;

	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const parentResult = super.getPropertiesParts();

		if (this.isLocked()) {
			return [
				...parentResult,
				{
					blockAddRemove: true,
				},
			];
		}

		return parentResult;
	}

	private static _validatePassword(asset: Asset<'lock'>, password: string, logger?: Logger): boolean {
		const def = asset.definition.password;
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

	private static _isEqualPassword(_asset: Asset<'lock'>, lhs?: string, rhs?: string): boolean {
		if (lhs == null || rhs == null)
			return lhs === rhs;

		// all passwords are case insensitive for now
		return lhs.toLowerCase() === rhs.toLowerCase();
	}
}
