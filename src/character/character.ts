import { Appearance, AppearanceChangeType, APPEARANCE_BUNDLE_DEFAULT, BoneState, GetLogger, ICharacterPublicData, Item, Logger } from 'pandora-common';
import { useSyncExternalStore } from 'react';
import { GetAssetManager } from '../assets/assetManager';
import { ITypedEventEmitter, TypedEventEmitter } from '../event';

export type AppearanceEvents = {
	'appearanceUpdate': AppearanceChangeType[];
};

export type AppearanceContainer = ITypedEventEmitter<AppearanceEvents> & {
	appearance: Appearance;
};

export class Character<T extends ICharacterPublicData = ICharacterPublicData> extends TypedEventEmitter<CharacterEvents<T>> implements AppearanceContainer {
	public appearance: Appearance;

	protected readonly logger: Logger;

	protected _data: T;
	public get data(): Readonly<T> {
		return this._data;
	}

	constructor(data: T, logger?: Logger) {
		super();
		this.logger = logger ?? GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;
		this.appearance = new Appearance(GetAssetManager(), (changes) => this.emit('appearanceUpdate', changes));
		this.appearance.importFromBundle(data.appearance ?? APPEARANCE_BUNDLE_DEFAULT, this.logger.prefixMessages('Appearance load:'));
		this.logger.verbose('Loaded');
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		if (data.appearance) {
			this.appearance.importFromBundle(data.appearance ?? APPEARANCE_BUNDLE_DEFAULT, this.logger.prefixMessages('Appearance load:'), GetAssetManager());
		}
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}
}

type CharacterEvents<T extends ICharacterPublicData> = AppearanceEvents & {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterPublicData>(character: Character<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterAppearanceItems(character: AppearanceContainer): readonly Item[] {
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
