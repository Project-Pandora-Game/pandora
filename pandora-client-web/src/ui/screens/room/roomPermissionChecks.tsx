import type { AppearanceAction } from 'pandora-common';
import {
	useEffect,
	useMemo,
} from 'react';
import { toast } from 'react-toastify';
import { useCharacterRestrictionManager, type Character } from '../../../character/character.ts';
import { useActionSpaceContext, useGameState, useGameStateOptional, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerRestrictionManager, usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue.ts';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useRoomScreenContext } from './roomContext.tsx';
import { DeviceOverlayState } from './roomState.ts';

/**
 * Watches the current device overlay state and exits the construction mode, if any following cases happen:
 * - User changes the space
 * - User stops being an admin
 * - User stops being able to use hands
 */
export function RoomConstructionModeCheckProvider(): null {
	const value = useObservable(DeviceOverlayState);
	const spaceInfo = useSpaceInfo();
	const { player, globalState } = usePlayerState();
	const playerRestrictionManager = usePlayerRestrictionManager();
	const spaceContext = useActionSpaceContext();
	const canUseHands = useCharacterRestrictionManager(player, globalState, spaceContext).canUseHands();

	// To manipulate room devices, player must have appropriate role
	const roomSettings = globalState.space.getEffectiveRoomSettings(playerRestrictionManager.appearance.getCurrentRoom()?.id ?? null);
	const canModifyRoom = playerRestrictionManager.hasSpaceRole(roomSettings.roomDeviceDeploymentMinimumRole);

	useEffect(() => {
		let nextValue = DeviceOverlayState.value;
		if (value.spaceId !== spaceInfo.id) {
			nextValue = {
				...nextValue,
				roomConstructionMode: false,
				spaceId: spaceInfo.id,
			};
		}
		if (canModifyRoom !== value.canModifyRoom) {
			nextValue = {
				...nextValue,
				roomConstructionMode: nextValue.roomConstructionMode && canModifyRoom,
				canModifyRoom,
			};
		}
		if (roomSettings.roomDeviceDeploymentMinimumRole !== value.modifyRequiredRole) {
			nextValue = {
				...nextValue,
				modifyRequiredRole: roomSettings.roomDeviceDeploymentMinimumRole,
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
	}, [value, spaceInfo.id, canModifyRoom, canUseHands, roomSettings.roomDeviceDeploymentMinimumRole]);

	return null;
}

/**
 * Checks if player can move the target character.
 * @param target - The character to be moved. If `null` is used, the check always fails.
 */
export function useCanMoveCharacter(target: Character | null): 'allowed' | 'forbidden' | 'prompt' | null {
	const globalState = useGlobalState(useGameStateOptional());
	const action = useMemo((): AppearanceAction | null => {
		if (target == null || globalState == null)
			return null;

		const targetState = globalState.getCharacterState(target.id);
		if (targetState == null)
			return null;

		return {
			type: 'moveCharacter',
			target: { type: 'character', characterId: target.id },
			moveTo: {
				type: 'normal',
				room: targetState.currentRoom,
				position: [0, 0, 0],
			},
		};
	}, [target, globalState]);
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
	const globalState = useGlobalState(useGameState());

	const moveTarget = (roomSceneMode.mode === 'moveCharacter' ? spaceCharacters.find((c) => c.id === roomSceneMode.characterId) : undefined) ?? null;
	const moveTargetState = moveTarget != null ? globalState.getCharacterState(moveTarget.id) : null;
	const canMoveTarget = useCanMoveCharacter(moveTarget);

	const poseTarget = (roomSceneMode.mode === 'poseCharacter' ? spaceCharacters.find((c) => c.id === roomSceneMode.characterId) : undefined) ?? null;
	const canPoseTarget = useCanPoseCharacter(poseTarget);

	useEffect(() => {
		if (roomSceneMode.mode === 'moveCharacter') {
			if (canMoveTarget === 'forbidden') {
				toast('You cannot move this character.', TOAST_OPTIONS_WARNING);
				setRoomSceneMode({ mode: 'normal' });
			} else if (moveTargetState?.position.following != null && moveTargetState.position.following.followType !== 'leash') {
				toast('Character that is following another character cannot be moved manually.', TOAST_OPTIONS_WARNING);
				setRoomSceneMode({ mode: 'normal' });
			}
		}

		if (roomSceneMode.mode === 'poseCharacter' && canPoseTarget === 'forbidden') {
			toast('You cannot pose this character.', TOAST_OPTIONS_WARNING);
			setRoomSceneMode({ mode: 'normal' });
		}
	}, [roomSceneMode, setRoomSceneMode, canMoveTarget, canPoseTarget, moveTargetState]);

	return null;
}
