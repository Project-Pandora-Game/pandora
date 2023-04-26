import { CharacterAppearance, AppearanceChangeType, BoneState, CharacterView, GetLogger, ICharacterPublicData, Item, Logger, CharacterRestrictionsManager, ActionRoomContext, ItemPath, SafemodeData, CharacterId, CharacterArmsPose, AppearanceItems, WearableAssetType } from 'pandora-common';
import { useSyncExternalStore } from 'react';
import { GetCurrentAssetManager } from '../assets/assetManager';
import { ITypedEventEmitter, TypedEventEmitter } from '../event';
import type { PlayerCharacter } from './player';

export type AppearanceEvents = {
	'appearanceUpdate': AppearanceChangeType[];
};

export type AppearanceContainer = ITypedEventEmitter<AppearanceEvents> & {
	readonly type: 'character';
	readonly appearance: CharacterAppearance;
	readonly id: CharacterId;
	readonly name: string;
	getRestrictionManager(roomContext: ActionRoomContext | null): CharacterRestrictionsManager;
};

export class Character<T extends ICharacterPublicData = ICharacterPublicData> extends TypedEventEmitter<CharacterEvents<T>> implements AppearanceContainer {
	public readonly type = 'character';

	public readonly appearance: CharacterAppearance;

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	protected readonly logger: Logger;

	protected _data: T;
	public get data(): Readonly<T> {
		return this._data;
	}

	constructor(data: T, logger?: Logger) {
		super();
		this.logger = logger ?? GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;
		this.appearance = new CharacterAppearance(GetCurrentAssetManager(), () => this.data, (changes) => this.emit('appearanceUpdate', changes));
		this.appearance.importFromBundle(data.appearance, this.logger.prefixMessages('Appearance load:'));
		this.logger.verbose('Loaded');
	}

	public isPlayer(): this is PlayerCharacter {
		return false;
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		if (data.appearance) {
			this.appearance.importFromBundle(data.appearance, this.logger.prefixMessages('Appearance load:'), GetCurrentAssetManager());
		}
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}

	public getRestrictionManager(roomContext: ActionRoomContext | null): CharacterRestrictionsManager {
		return this.appearance.getRestrictionManager(roomContext);
	}
}

type CharacterEvents<T extends ICharacterPublicData> = AppearanceEvents & {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterPublicData>(character: Character<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterAppearanceItem(character: AppearanceContainer, item: ItemPath | null | undefined): Item | undefined {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('items')) {
				onChange();
			}
		});
	}, () => item ? character.appearance.getItem(item) : undefined);
}

export function useCharacterAppearanceItems(character: AppearanceContainer): AppearanceItems<WearableAssetType> {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('items')) {
				onChange();
			}
		});
	}, () => character.appearance.getAllItems());
}

export function useCharacterAppearancePose(character: AppearanceContainer): readonly BoneState[] {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('pose')) {
				onChange();
			}
		});
	}, () => character.appearance.getFullPose());
}

export function useCharacterAppearanceArmsPose(character: AppearanceContainer): CharacterArmsPose {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('pose')) {
				onChange();
			}
		});
	}, () => character.appearance.getArmsPose());
}

export function useCharacterAppearanceView(character: AppearanceContainer): CharacterView {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('pose')) {
				onChange();
			}
		});
	}, () => character.appearance.getView());
}

export function useCharacterSafemode(character: AppearanceContainer): Readonly<SafemodeData> | null {
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('safemode')) {
				onChange();
			}
		});
	}, () => character.appearance.getSafemode());
}
