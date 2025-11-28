import { clamp } from 'lodash-es';
import {
	AssertNever,
	EMPTY_ARRAY,
	ICharacterRoomData,
	type CharacterHideSetting,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { createContext, useCallback, useContext, useMemo, type ReactElement } from 'react';
import { Character, useCharacterData, useCharacterRestrictionManager } from '../../character/character.ts';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { useAccountContacts } from '../../components/accountContacts/accountContactContext.ts';
import { useActionSpaceContext } from '../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../components/gameContext/playerContextProvider.tsx';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { CharacterTemporaryHiding } from '../../ui/screens/room/roomState.ts';

export type VisionFilterBypass = null | 'no-ghost' | 'bypass';
const VisionFilterBypassContext = createContext<VisionFilterBypass>(null);

export function VisionFilterBypass({ children, setting }: ChildrenProps & { setting: VisionFilterBypass; }): ReactElement {
	return (
		<VisionFilterBypassContext.Provider value={ setting }>
			{ children }
		</VisionFilterBypassContext.Provider>
	);
}

export function usePlayerVisionFiltersFactory(targetIsPlayer: boolean): () => readonly PIXI.Filter[] {
	const { player, globalState } = usePlayerState();
	const spaceContext = useActionSpaceContext();
	const restrictionManager = useCharacterRestrictionManager(player, globalState, spaceContext);
	const blindness = restrictionManager.getBlindness();
	const blurines = clamp(restrictionManager.getEffects().blurVision, 0, 16);
	const bypass = useContext(VisionFilterBypassContext);

	return useCallback((): PIXI.Filter[] => {
		if (targetIsPlayer || bypass === 'bypass')
			return [];
		const filters: PIXI.Filter[] = [];

		if (blindness > 0) {
			const filter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			filter.brightness(1 - blindness / 10, false);
			filters.push(filter);
		}

		if (blurines > 0) {
			const log = Math.ceil(Math.log2(blurines)) || 0;
			const filter = new PIXI.BlurFilter({
				resolution: 'inherit',
				strength: blurines,
				quality: log + 1,
				kernelSize: 5 + 2 * log,
			});
			filters.push(filter);
		}

		return filters;
	}, [blindness, blurines, targetIsPlayer, bypass]);
}

export function usePlayerVisionFilters(targetIsPlayer: boolean): readonly PIXI.Filter[] {
	const factory = usePlayerVisionFiltersFactory(targetIsPlayer);
	return useMemo(factory, [factory]);
}

type CharacterDisplayStyle = CharacterHideSetting | 'darken';
export function useCharacterDisplayStyle(character: Character<ICharacterRoomData>): CharacterDisplayStyle {
	const {
		accountId,
		onlineStatus,
	} = useCharacterData(character);
	const blockedAccounts = useAccountContacts('blocked');

	const { interfaceChatroomOfflineCharacterFilter, interfaceChatroomBlockedCharacterFilter } = useAccountSettings();
	const characterHiding = useObservable(CharacterTemporaryHiding);
	const bypass = useContext(VisionFilterBypassContext);

	const online = onlineStatus !== 'offline' || bypass != null;
	const isBlocked = blockedAccounts.some((a) => a.id === accountId);

	const displayStyle = characterHiding[character.id] ?? (
		(isBlocked && interfaceChatroomBlockedCharacterFilter !== 'normal') ? interfaceChatroomBlockedCharacterFilter :
		!online ? interfaceChatroomOfflineCharacterFilter :
		'normal'
	);

	// offline "icon" is handled by `RoomCharacterLabel` only
	return displayStyle === 'icon' ? 'normal' : displayStyle;
}

export function useCharacterDisplayFilters(displayStyle: CharacterDisplayStyle): readonly PIXI.Filter[] {
	return useMemo((): readonly PIXI.Filter[] => {
		switch (displayStyle) {
			case 'normal':
				return EMPTY_ARRAY;
			case 'darken': {
				const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
				colorFilter.brightness(0.4, true);
				return [colorFilter];
			}
			case 'ghost': {
				const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
				colorFilter.brightness(0.4, true);
				const alphaFilter = new PIXI.AlphaFilter({ alpha: 0.8, resolution: 'inherit' });
				return [colorFilter, alphaFilter];
			}
			case 'silhouette': {
				const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
				colorFilter.brightness(0, true);
				const alphaFilter = new PIXI.AlphaFilter({ alpha: 0.25, resolution: 'inherit' });
				return [colorFilter, alphaFilter];
			}
			case 'name-only':
			case 'hidden': {
				return [new PIXI.AlphaFilter({ alpha: 0 })];
			}
		}
		AssertNever(displayStyle);
	}, [displayStyle]);
}
