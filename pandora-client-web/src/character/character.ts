import { Appearance, AppearanceChangeType, APPEARANCE_BUNDLE_DEFAULT, BoneState, CharacterRestrictionsManager, GetLogger, ICharacterPublicData, Item, Logger } from 'pandora-common';
import { useMemo, useSyncExternalStore } from 'react';
import { GetAssetManager } from '../assets/assetManager';
import { useAppearanceActionRoomContext } from '../components/gameContext/chatRoomContextProvider';
import { ITypedEventEmitter, TypedEventEmitter } from '../event';
import type { PlayerCharacter } from './player';

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

	public isPlayer(): this is PlayerCharacter {
		return false;
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

export function useCharacterRestrictionsManager<T>(character: Character, use: (manager: CharacterRestrictionsManager) => T): T {
	const roomContext = useAppearanceActionRoomContext();
	const manager = useMemo(() => new CharacterRestrictionsManager(character.data.id, character.appearance, roomContext), [character]);
	return useSyncExternalStore((onChange) => {
		return character.on('appearanceUpdate', (changed) => {
			if (changed.includes('items')) {
				onChange();
			}
		});
	}, () => use(manager));
}
