import type { Immutable } from 'immer';

import { ItemInteractionType } from '../../character/restrictionTypes.ts';
import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { IExportOptions } from '../modules/common.ts';
import type { AssetProperties } from '../properties.ts';
import type { IItemLoadContext, IItemValidationContext, ItemBundle } from './base.ts';
import type { AppearanceItems } from './items.ts';

import { AssertNever, MemoizeNoArg } from '../../utility/misc.ts';

import { LockAction, LockLogic } from '../../gameLogic/locks/lockLogic.ts';
import { ItemBase, ItemBaseProps } from './_internal.ts';

declare module './_internal.ts' {
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

	public lockAction(context: AppearanceModuleActionContext, action: LockAction): ItemLock | null {
		switch (action.action) {
			case 'lock':
				return this.lock(context, action);
			case 'unlock':
				return this.unlock(context, action);
			case 'showPassword':
				return this.showPassword(context);
			case 'updateFingerprint':
				return this.updateFingerprint(context, action);
		}
		AssertNever(action);
	}

	public lock({ messageHandler, addProblem, processingContext, target, module }: AppearanceModuleActionContext, action: Extract<LockAction, { action: 'lock'; }>): ItemLock | null {
		const player = processingContext.getPlayerRestrictionManager();
		// Locking the lock modifies it
		player.checkUseItemDirect(processingContext, target, module, this, ItemInteractionType.MODIFY);

		const result = this.lockLogic.lock({
			player,
			isSelfAction: target.type === 'character' && target.character.id === player.appearance.id,
			executionContext: processingContext.executionContext,
		}, action);

		switch (result.result) {
			case 'ok':
				messageHandler({
					id: 'lockLock',
				});
				return this.withProps({
					lockLogic: result.newState,
				});

			case 'failed':
				addProblem({
					type: 'lockInteractionPrevented',
					moduleAction: 'lock',
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

	public unlock({ messageHandler, addProblem, processingContext, target, module }: AppearanceModuleActionContext, action: Extract<LockAction, { action: 'unlock'; }>): ItemLock | null {
		const player = processingContext.getPlayerRestrictionManager();
		// Unlocking the lock modifies it
		player.checkUseItemDirect(processingContext, target, module, this, ItemInteractionType.MODIFY);

		const result = this.lockLogic.unlock({
			player,
			isSelfAction: target.type === 'character' && target.character.id === player.appearance.id,
			executionContext: processingContext.executionContext,
		}, action);

		switch (result.result) {
			case 'ok':
				messageHandler({
					id: 'lockUnlock',
				});
				return this.withProps({
					lockLogic: result.newState,
				});

			case 'failed':
				addProblem({
					type: 'lockInteractionPrevented',
					moduleAction: 'unlock',
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

	public showPassword({ addProblem, addData, processingContext, target, module }: AppearanceModuleActionContext): ItemLock | null {
		const player = processingContext.getPlayerRestrictionManager();
		// Showing password requires permission access to the lock
		player.checkUseItemDirect(processingContext, target, module, this, ItemInteractionType.ACCESS_ONLY);

		const result = this.lockLogic.showPassword({
			player,
			isSelfAction: target.type === 'character' && target.character.id === player.appearance.id,
			executionContext: processingContext.executionContext,
		});

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
				addProblem({
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

	public updateFingerprint({ messageHandler, addProblem, processingContext, target, module }: AppearanceModuleActionContext, action: Extract<LockAction, { action: 'updateFingerprint'; }>): ItemLock | null {
		const player = processingContext.getPlayerRestrictionManager();
		// Updating the registered fingerprints on the lock modifies it
		player.checkUseItemDirect(processingContext, target, module, this, ItemInteractionType.MODIFY);

		const result = this.lockLogic.updateFingerprint(action);

		switch (result.result) {
			case 'ok':
				messageHandler({
					id: 'lockUpdateFingerprint',
				});
				return this.withProps({
					lockLogic: result.newState,
				});

			case 'failed':
				addProblem({
					type: 'lockInteractionPrevented',
					moduleAction: 'updateFingerprint',
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
