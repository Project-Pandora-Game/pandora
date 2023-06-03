import { z } from 'zod';
import _ from 'lodash';
import { Immutable } from 'immer';
import { ItemInteractionType } from '../../character';
import type { AppearanceActionContext } from '../appearanceActions';
import type { ActionMessageTemplateHandler } from '../appearanceTypes';
import type { AppearanceValidationResult, AppearanceItems } from '../appearanceValidation';
import type { Asset } from '../asset';
import type { AssetManager, SecretManager } from '../assetManager';
import type { AssetDefinitionExtraArgs, AssetType } from '../definitions';
import type { ConditionOperator } from '../graphics/graphics';
import type { IItemLoadContext, IItemLocationDescriptor } from '../item';
import type { AssetProperties } from '../properties';
import type { IAssetModuleDefinition, IItemModule, IModuleConfigCommon, IModuleItemDataCommon } from './common';
import { AssertNever } from '../../utility';

const TYPE = 'encrypted' as const;
type ModuleType = typeof TYPE;

const DUMMY_ENCRYPTED_PREFIX = '__dummy__';

export interface IModuleConfigEncrypted<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends IModuleConfigCommon<ModuleType> {
	active?: AssetProperties<A>;
	activateMessage?: string;
	deactivateMessage?: string;
	modifyMessage?: string;
}

export interface IModuleItemDataEncrypted extends IModuleItemDataCommon<ModuleType> {
	encrypted?: string;
}

const ModuleItemDataEncryptedScheme = z.object({
	type: z.literal(TYPE),
	encrypted: z.string().optional(),
});
export const ItemModuleEncryptedActionSchema = z.object({
	moduleType: z.literal(TYPE),
	action: z.discriminatedUnion('moduleAction', [
		z.object({
			moduleAction: z.literal('activate'),
			secret: z.string(),
		}),
		z.object({
			moduleAction: z.literal('deactivate'),
			oldSecret: z.string(),
		}),
		z.object({
			moduleAction: z.literal('modify'),
			secret: z.string(),
			oldSecret: z.string(),
		}),
	]),
});
type ItemModuleEncryptedAction = z.infer<typeof ItemModuleEncryptedActionSchema>;
export type ItemModuleEncryptedActionType = ItemModuleEncryptedAction['action']['moduleAction'];

export class EncryptedModuleDefinition implements IAssetModuleDefinition<ModuleType> {
	public parseData(_asset: Asset<AssetType>, _moduleName: string, _config: IModuleConfigEncrypted, data: unknown, assetManager: AssetManager): IModuleItemDataEncrypted {
		const parsed = ModuleItemDataEncryptedScheme.safeParse(data);
		if (!parsed.success || !parsed.data.encrypted) {
			return { type: TYPE };
		}
		if (assetManager.secretManager && !assetManager.secretManager.isValid(parsed.data.encrypted)) {
			return { type: TYPE };
		}
		return parsed.data;
	}

	public loadModule(_asset: Asset<AssetType>, _moduleName: string, config: IModuleConfigEncrypted, data: IModuleItemDataEncrypted, context: IItemLoadContext): ItemModuleEncrypted {
		return new ItemModuleEncrypted(config, data, context);
	}

	public getStaticAttributes(config: IModuleConfigEncrypted): ReadonlySet<string> {
		const result = new Set<string>();
		config.active?.attributes?.forEach((a) => result.add(a));
		return result;
	}
}

export class ItemModuleEncrypted implements IItemModule<ModuleType>{
	public readonly type = TYPE;
	public readonly config: IModuleConfigEncrypted;
	public readonly interactionType = ItemInteractionType.MODIFY;
	public readonly data: Immutable<IModuleItemDataEncrypted>;
	private readonly assetManager: AssetManager;
	private readonly secretManager?: SecretManager;
	private readonly _decrypted?: string;

	constructor(config: IModuleConfigEncrypted, data: IModuleItemDataEncrypted, context: IItemLoadContext) {
		this.config = config;
		this.data = data;
		this.assetManager = context.assetManager;
		this.secretManager = context.assetManager.secretManager;
		this._decrypted = this._getDecrypt(data.encrypted);
	}

	public exportData(): IModuleItemDataEncrypted {
		return _.cloneDeep(this.data);
	}

	public validate(_location: IItemLocationDescriptor): AppearanceValidationResult {
		return { success: true };
	}

	public getProperties(): AssetProperties<AssetDefinitionExtraArgs> {
		return {};
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(_context: AppearanceActionContext, { action }: ItemModuleEncryptedAction, messageHandler: ActionMessageTemplateHandler): ItemModuleEncrypted | null {
		let message: string | undefined;
		let data: IModuleItemDataEncrypted;
		switch (action.moduleAction) {
			case 'activate':
				if (this.data.encrypted != null) return null;
				message = this.config.activateMessage;
				data = {
					...this.data,
					encrypted: this._generateEncrypted(action.secret),
				};
				break;
			case 'deactivate':
				if (this.data.encrypted == null) return null;
				if (!this._validateSecret(action.oldSecret)) return null;
				message = this.config.deactivateMessage;
				data = { type: TYPE };
				break;
			case 'modify':
				if (this.data.encrypted == null) return null;
				if (!this._validateSecret(action.oldSecret)) return null;
				message = this.config.modifyMessage;
				data = {
					...this.data,
					encrypted: this._generateEncrypted(action.secret),
				};
				break;
			default:
				AssertNever(action);
		}
		if (message)
			messageHandler({ id: 'custom', customText: message });

		return new ItemModuleEncrypted(this.config, data, { assetManager: this.assetManager, doLoadTimeCleanup: false });
	}

	public readonly contentsPhysicallyEquipped = true;

	public getContents(): AppearanceItems {
		return [];
	}

	public setContents(_items: AppearanceItems): ItemModuleEncrypted | null {
		return null;
	}

	private _validateSecret(secret: string): boolean {
		if (this.secretManager == null) {
			if (this.data.encrypted == null)
				return false;
			if (this.data.encrypted.startsWith(DUMMY_ENCRYPTED_PREFIX))
				return this._decrypted === secret;

			return true;
		}
		return this._decrypted != null && this.secretManager.verify(this._decrypted, secret);
	}

	private _generateEncrypted(secret: string): string {
		if (this.secretManager == null)
			return DUMMY_ENCRYPTED_PREFIX + secret;

		const hash = this.secretManager.hash(secret);
		return this.secretManager.encrypt(hash);
	}

	private _getDecrypt(encrypted?: string): string | undefined {
		if (encrypted == null)
			return undefined;

		if (this.secretManager == null) {
			if (!encrypted.startsWith(DUMMY_ENCRYPTED_PREFIX))
				return undefined;

			return encrypted.substring(DUMMY_ENCRYPTED_PREFIX.length);
		}

		return this.secretManager.decrypt(encrypted);
	}
}
