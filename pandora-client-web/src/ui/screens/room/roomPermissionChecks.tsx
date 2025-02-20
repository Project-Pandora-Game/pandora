import type { AppearanceAction } from 'pandora-common';
import {
	useEffect,
	useMemo,
} from 'react';
import { toast } from 'react-toastify';
import { useCharacterRestrictionManager, type Character } from '../../../character/character';
import { IsSpaceAdmin, useActionSpaceContext, useCharacterRestrictionsManager, useCharacterState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue';
import { DeviceOverlayState } from '../../../graphics/room/roomDevice';
import { useObservable } from '../../../observable';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks';
import { useRoomScreenContext } from './roomContext';

/**
 * Watches the current device overlay state and exits the construction mode, if any following cases happen:
 * - User changes the space
 * - User stops being an admin
 * - User stops being able to use hands
 */
export function useRoomConstructionModeCheckProvider(): void {
	const value = useObservable(DeviceOverlayState);
	const currentAccount = useCurrentAccount();
	const spaceInfo = useSpaceInfo();
	const isPlayerAdmin = IsSpaceAdmin(spaceInfo.config, currentAccount);
	const { player, globalState } = usePlayerState();
	const spaceContext = useActionSpaceContext();
	const canUseHands = useCharacterRestrictionManager(player, globalState, spaceContext).canUseHands();

	useEffect(() => {
		let nextValue = DeviceOverlayState.value;
		if (value.spaceId !== spaceInfo.id) {
			nextValue = {
				...nextValue,
				roomConstructionMode: false,
				spaceId: spaceInfo.id,
			};
		}
		if (isPlayerAdmin !== value.isPlayerAdmin) {
			nextValue = {
				...nextValue,
				roomConstructionMode: nextValue.roomConstructionMode && isPlayerAdmin,
				isPlayerAdmin,
			};
		}
		if (canUseHands !== value.canUseHands) {
			nextValue = {
				...nextValue,
				roomConstructionMode: nextValue.roomConstructionMode && canUseHands,
				canUseHands,
			};
		}
		DeviceOverlayState.value = nextValue;
	}, [value, spaceInfo.id, isPlayerAdmin, canUseHands]);
}

/**
 * Checks if player can move the target character.
 * @param target - The character to be moved. If `null` is used, the check always fails.
 */
export function useCanMoveCharacter(target: Character | null): boolean {
	const { player, globalState } = usePlayerState();
	const currentAccount = useCurrentAccount();
	const spaceInfo = useSpaceInfo();
	const isPlayerAdmin = IsSpaceAdmin(spaceInfo.config, currentAccount);

	const targetState = useCharacterState(globalState, target?.id ?? null);

	const playerHasBlockedMovement = useCharacterRestrictionsManager(globalState, player, (manager) => manager.getEffects().blockRoomMovement);

	// See Space.updateCharacterPosition on shard for server-side version of this.
	return useMemo((): boolean => {
		if (target == null || targetState == null)
			return false;

		// Characters in a room device cannot be used
		if (targetState.getRoomDeviceWearablePart() != null)
			return false;

		// If moving self, must not be restricted by items
		if (target.id === player.id) {
			if (playerHasBlockedMovement)
				return false;
		}

		// Only admin can move other characters
		if (target.id !== player.id && !isPlayerAdmin) {
			return false;
		}

		return true;
	}, [isPlayerAdmin, player, playerHasBlockedMovement, target, targetState]);
}

/**
 * Checks if player can pose the target character.
 * @param target - The character to be pose. If `null` is used, the check always fails.
 * @returns `allowed` if allowed, `forbidden` if not allowed and permission cannot be requested, `prompt` if posing will result in a prompt. Returns `null` if check didn't complete yet
 */
export function useCanPoseCharacter(target: Character | null): 'allowed' | 'forbidden' | 'prompt' | null {
	const action = useMemo((): AppearanceAction | null => target != null ? ({
		type: 'pose',
		target: target.id,
	}) : null, [target]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });

	return useMemo((): 'allowed' | 'forbidden' | 'prompt' | null => {
		if (target == null)
			return 'forbidden';

		if (checkResult == null)
			return null;

		if (checkResult.valid)
			return 'allowed';

		if (checkResult.prompt != null)
			return 'prompt';

		return 'forbidden';
	}, [checkResult, target]);
}

export function RoomScreenSceneModeCheckProvider(): null {
	const {
		roomSceneMode,
		setRoomSceneMode,
	} = useRoomScreenContext();
	const spaceCharacters = useSpaceCharacters();

	const moveTarget = (roomSceneMode.mode === 'moveCharacter' ? spaceCharacters.find((c) => c.id === roomSceneMode.characterId) : undefined) ?? null;
	const canMoveTarget = useCanMoveCharacter(moveTarget);

	const poseTarget = (roomSceneMode.mode === 'poseCharacter' ? spaceCharacters.find((c) => c.id === roomSceneMode.characterId) : undefined) ?? null;
	const canPoseTarget = useCanPoseCharacter(poseTarget);

	useEffect(() => {
		if (roomSceneMode.mode === 'moveCharacter' && !canMoveTarget) {
			toast('You cannot move this character.', TOAST_OPTIONS_WARNING);
			setRoomSceneMode({ mode: 'normal' });
		}

		if (roomSceneMode.mode === 'poseCharacter' && canPoseTarget === 'forbidden') {
			toast('You cannot pose this character.', TOAST_OPTIONS_WARNING);
			setRoomSceneMode({ mode: 'normal' });
		}
	}, [roomSceneMode, setRoomSceneMode, canMoveTarget, canPoseTarget]);

	return null;
}
