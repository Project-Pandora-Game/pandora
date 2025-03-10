import type { Immutable } from 'immer';
import { Assert, AssertNever, AssertNotNullable, ICharacterRoomData, ItemId, ItemRoomDevice, type CharacterId } from 'pandora-common';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Character } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import type { PointLike } from '../../../graphics/graphicsCharacter.tsx';
import { CharacterContextMenu } from '../../../graphics/room/contextMenus/characterContextMenu.tsx';
import { DeviceContextMenu } from '../../../graphics/room/contextMenus/deviceContextMenu.tsx';
import { useIsRoomConstructionModeEnabled } from '../../../graphics/room/roomDevice.tsx';
import { useProvideTutorialFlag } from '../../tutorial/tutorialSystem/tutorialExternalConditions.tsx';
import { RoomItemDialogsProviderEnabler } from './roomItemDialog.tsx';
import { RoomScreenSceneModeCheckProvider } from './roomPermissionChecks.tsx';

export type IRoomSceneMode = {
	mode: 'normal';
} | {
	mode: 'moveCharacter' | 'poseCharacter';
	characterId: CharacterId;
} | {
	mode: 'moveDevice';
	deviceItemId: ItemId;
};

export type IRoomContextMenuFocus = {
	type: 'character';
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
} | {
	type: 'device';
	deviceItemId: ItemId;
	position: Readonly<PointLike>;
};

type RoomScreenContext = {
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	contextMenuFocus: Readonly<IRoomContextMenuFocus> | null;
	openContextMenu: (target: Character<ICharacterRoomData> | ItemRoomDevice | null, position: Readonly<PointLike> | null) => void;
};

export const roomScreenContext = createContext<RoomScreenContext | null>(null);

export function useRoomScreenContext(): RoomScreenContext {
	const context = useContext(roomScreenContext);
	Assert(context != null, 'Attempt to use RoomScreenContext outside of the context');
	return context;
}

export function RoomScreenContextProvider({ children }: ChildrenProps): ReactNode {
	const player = usePlayer();
	AssertNotNullable(player);

	const [contextMenuFocus, setContextMenuFocus] = useState<Readonly<IRoomContextMenuFocus> | null>(null);

	const [roomSceneMode, setRoomSceneMode] = useState<Immutable<IRoomSceneMode>>({ mode: 'normal' });

	// Stop device movement on room construction mode disable
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	useEffect(() => {
		if (!roomConstructionMode && roomSceneMode.mode === 'moveDevice') {
			setRoomSceneMode({ mode: 'normal' });
		}
	}, [roomConstructionMode, roomSceneMode]);

	const openContextMenu = useCallback<RoomScreenContext['openContextMenu']>((target, position) => {
		if (!target || !position) {
			setContextMenuFocus(null);
		} else if (target instanceof Character) {
			setContextMenuFocus({
				type: 'character',
				character: target,
				position,
			});
		} else if (target instanceof ItemRoomDevice) {
			setContextMenuFocus({
				type: 'device',
				deviceItemId: target.id,
				position,
			});
		} else {
			AssertNever(target);
		}
	}, []);

	const closeContextMenu = useCallback(() => {
		setContextMenuFocus(null);
	}, []);

	const context = useMemo((): RoomScreenContext => ({
		contextMenuFocus,
		openContextMenu,
		roomSceneMode,
		setRoomSceneMode,
	}), [contextMenuFocus, openContextMenu, roomSceneMode]);

	useProvideTutorialFlag('roomSceneContextMenuFocus', contextMenuFocus);
	useProvideTutorialFlag('roomSceneMode', roomSceneMode);

	return (
		<roomScreenContext.Provider value={ context }>
			<WardrobeActionContextProvider player={ player }>
				<RoomScreenSceneModeCheckProvider />
				<RoomItemDialogsProviderEnabler />
				{ children }
				{
				contextMenuFocus?.type === 'character' ? (
					<CharacterContextMenu
						character={ contextMenuFocus.character }
						position={ contextMenuFocus.position }
						onClose={ closeContextMenu }
					/>
				) : null
				}
				{
				contextMenuFocus?.type === 'device' ? (
					<DeviceContextMenu
						deviceItemId={ contextMenuFocus.deviceItemId }
						position={ contextMenuFocus.position }
						onClose={ closeContextMenu }
					/>
				) : null
				}
			</WardrobeActionContextProvider>
		</roomScreenContext.Provider>
	);
}
