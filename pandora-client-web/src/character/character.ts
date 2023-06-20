import { TypedEventEmitter, CharacterAppearance, BoneState, CharacterView, GetLogger, ICharacterPublicData, Item, Logger, CharacterRestrictionsManager, ActionRoomContext, ItemPath, SafemodeData, CharacterId, CharacterArmsPose, AppearanceItems, WearableAssetType, AssetFrameworkCharacterState, Assert } from 'pandora-common';
import { useMemo, useSyncExternalStore } from 'react';
import type { PlayerCharacter } from './player';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';

export type AppearanceContainer<T extends ICharacterPublicData = ICharacterPublicData> = {
	readonly type: 'character';
	readonly id: CharacterId;
	readonly name: string;
	readonly data: Readonly<T>;
	isPlayer(): boolean;
	getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance;
	getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext | null): CharacterRestrictionsManager;
};

export class Character<T extends ICharacterPublicData = ICharacterPublicData> extends TypedEventEmitter<CharacterEvents<T>> implements AppearanceContainer<T> {
	public readonly type = 'character';

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
		this.logger.verbose('Loaded');
	}

	public isPlayer(): this is PlayerCharacter {
		return false;
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}

	public getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance {
		Assert(state.id === this.id);
		return new CharacterAppearance(state, () => this.data);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext | null): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}
}

type CharacterEvents<T extends ICharacterPublicData> = {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterPublicData>(character: Character<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterAppearance(characterState: AssetFrameworkCharacterState, character: Character): CharacterAppearance {
	return useMemo(() => character.getAppearance(characterState), [characterState, character]);
}

export function useCharacterAppearanceItems(characterState: AssetFrameworkCharacterState): AppearanceItems<WearableAssetType> {
	return characterState.items;
}

export function useCharacterAppearanceItem(characterState: AssetFrameworkCharacterState, path: ItemPath | null | undefined): Item | undefined {
	const items = useCharacterAppearanceItems(characterState);

	return useMemo(() => (items && path) ? EvalItemPath(items, path) : undefined, [items, path]);
}

export function useCharacterAppearancePose(characterState: AssetFrameworkCharacterState): readonly BoneState[] {
	return useMemo(() => Array.from(characterState.pose.values()), [characterState.pose]);
}

export function useCharacterAppearanceArmsPose(characterState: AssetFrameworkCharacterState): CharacterArmsPose {
	return characterState.arms;
}

export function useCharacterAppearanceView(characterState: AssetFrameworkCharacterState): CharacterView {
	return characterState.view;
}

export function useCharacterSafemode(characterState: AssetFrameworkCharacterState): Readonly<SafemodeData> | null {
	return characterState.safemode ?? null;
}
