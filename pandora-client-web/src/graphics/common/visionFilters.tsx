import { clamp } from 'lodash-es';
import {
	AssertNever,
	ICharacterRoomData,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { createContext, useCallback, useContext, useMemo, type ReactElement } from 'react';
import { Character, useCharacterData, useCharacterRestrictionManager } from '../../character/character.ts';
import { useActionSpaceContext } from '../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../components/gameContext/playerContextProvider.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import type { ChildrenProps } from '../../common/reactTypes.ts';

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

export function useCharacterDisplayFilters(character: Character<ICharacterRoomData>): PIXI.Filter[] {
	const {
		onlineStatus,
	} = useCharacterData(character);

	const { interfaceChatroomOfflineCharacterFilter } = useAccountSettings();
	const bypass = useContext(VisionFilterBypassContext);

	const onlineFilters = useMemo(() => [], []);

	const offlineFilters = useMemo(() => {
		if (interfaceChatroomOfflineCharacterFilter === 'none') {
			return [];
		} else if (interfaceChatroomOfflineCharacterFilter === 'icon') {
			return [];
		} else if (interfaceChatroomOfflineCharacterFilter === 'darken') {
			const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			colorFilter.brightness(0.4, true);
			return [colorFilter];
		} else if (interfaceChatroomOfflineCharacterFilter === 'ghost') {
			const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			colorFilter.brightness(0.4, true);
			const alphaFilter = new PIXI.AlphaFilter({ alpha: 0.8, resolution: 'inherit' });
			return [colorFilter, alphaFilter];
		}
		AssertNever(interfaceChatroomOfflineCharacterFilter);
	}, [interfaceChatroomOfflineCharacterFilter]);

	return (onlineStatus !== 'offline' || bypass != null) ? onlineFilters : offlineFilters;
}
