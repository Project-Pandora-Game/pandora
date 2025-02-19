import type { Immutable } from 'immer';

import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { Asset } from '../asset';
import type { IExportOptions } from '../modules/common';
import type { AssetLockProperties, AssetProperties } from '../properties';
import type { IItemLoadContext, IItemValidationContext, ItemBundle } from './base';

import { AssertNever, MemoizeNoArg } from '../../utility/misc';

import { LockAction, LockLogic } from '../../gameLogic/locks/lockLogic';
import { ItemBase, ItemBaseProps } from './_internal';

declare module './_internal' {
	interface InternalItemTypeMap {
		lock: ItemLock;
	}
}

interface ItemLockProps extends ItemBaseProps<'lock'> {
	readonly lockLogic: LockLogic;
}
export class ItemLock extends ItemBase<'lock'> {
	public readonly lockLogic: LockLogic;

	public get hasPassword(): boolean {
		return this.lockLogic.hasPassword;
	}

	protected constructor(props: ItemLockProps, overrideProps: Partial<ItemLockProps> = {}) {
		super(props, overrideProps);
		this.lockLogic = overrideProps.lockLogic ?? props.lockLogic;
	}

	protected override withProps(overrideProps: Partial<ItemLockProps>): ItemLock {
		return new ItemLock(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'lock'>, bundle: ItemBundle, context: IItemLoadContext): ItemLock {
		const lockLogic = LockLogic.loadFromBundle(
			asset.definition.lockSetup,
			bundle.lockData,
			{
				...context,
				logger: context.logger?.prefixMessages(`Lock ${bundle.id}:`),
			},
		);

		return new ItemLock({
			...(ItemBase._parseBundle(asset, bundle, context)),
			lockLogic,
		});
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		return {
			...super.exportToBundle(options),
			lockData: options.clientOnly ? this.lockLogic.exportToClientBundle() : this.lockLogic.exportToServerBundle(),
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
		return this.lockLogic.isLocked();
	}

	public getLockProperties(): AssetLockProperties {
		if (this.isLocked())
			return this.asset.definition.locked ?? {};

		return this.asset.definition.unlocked ?? {};
	}

	public lockAction(context: AppearanceModuleActionContext, action: LockAction): ItemLock | null {
		if (action.action === 'showPassword') {
			// 'blockSelf' has no meaning for showPassword
			return this.showPassword(context);
		}

		const playerRestrictionManager = context.processingContext.getPlayerRestrictionManager();

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = context.targetCharacter != null && context.targetCharacter.character.id === context.processingContext.player.id;
		const properties = this.getLockProperties();

		if (action.password != null && !LockLogic.validatePassword(this.lockLogic.lockSetup, action.password)) {
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

	public lock({ messageHandler, processingContext, reject }: AppearanceModuleActionContext, action: Extract<LockAction, { action: 'lock'; }>): ItemLock | null {
		const result = this.lockLogic.lock(processingContext, action);

		switch (result.result) {
			case 'ok':
				if (this.asset.definition.chat?.actionLock) {
					messageHandler({
						id: 'custom',
						customText: this.asset.definition.chat.actionLock,
					});
				}
				return this.withProps({
					lockLogic: result.newState,
				});

			case 'failed':
				reject({
					type: 'lockInteractionPrevented',
					moduleAction: 'lock',
					reason: result.reason,
					asset: this.asset.id,
					itemName: this.name ?? '',
				});
				return null;

			case 'invalid':
				return null;
		}

		AssertNever(result);
	}

	public unlock({ messageHandler, failure, reject, processingContext }: AppearanceModuleActionContext, action: Extract<LockAction, { action: 'unlock'; }>): ItemLock | null {
		const result = this.lockLogic.unlock(processingContext, action);

		switch (result.result) {
			case 'ok':
				if (this.asset.definition.chat?.actionUnlock) {
					messageHandler({
						id: 'custom',
						customText: this.asset.definition.chat.actionUnlock,
					});
				}
				return this.withProps({
					lockLogic: result.newState,
				});

			case 'failed':
				if (result.reason === 'blockSelf') {
					reject({
						type: 'lockInteractionPrevented',
						moduleAction: 'unlock',
						reason: result.reason,
						asset: this.asset.id,
						itemName: this.name ?? '',
					});
				} else {
					failure({
						type: 'lockInteractionPrevented',
						moduleAction: 'unlock',
						reason: result.reason,
						asset: this.asset.id,
						itemName: this.name ?? '',
					});
				}
				return null;

			case 'invalid':
				return null;
		}

		AssertNever(result);
	}

	public showPassword({ failure, addData, processingContext }: AppearanceModuleActionContext): ItemLock | null {
		const result = this.lockLogic.showPassword(processingContext);

		switch (result.result) {
			case 'ok':
				if (result.password != null) {
					addData({
						moduleAction: 'showPassword',
						password: result.password,
					});
				}
				return this;

			case 'failed':
				failure({
					type: 'lockInteractionPrevented',
					moduleAction: 'showPassword',
					reason: result.reason,
					asset: this.asset.id,
					itemName: this.name ?? '',
				});
				return this;

			case 'invalid':
				return null;
		}

		AssertNever(result);
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
}
