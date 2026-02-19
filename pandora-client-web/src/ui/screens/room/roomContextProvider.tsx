import type { Immutable } from 'immer';
import { AssertNever, AssertNotNullable } from 'pandora-common';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { CharacterContextMenu } from '../../../graphics/room/contextMenus/characterContextMenu.tsx';
import { DeviceContextMenu } from '../../../graphics/room/contextMenus/deviceContextMenu.tsx';
import { ItemContextMenu } from '../../../graphics/room/contextMenus/itemContextMenu.tsx';
import { useProvideTutorialFlag } from '../../tutorial/tutorialSystem/tutorialExternalConditions.tsx';
import { SpaceSwitchDialogProvider } from '../spaceJoin/spaceSwitchDialog.tsx';
import { IRoomContextMenuFocus, IRoomSceneMode, RoomScreenContext } from './roomContext.tsx';
import { RoomItemDialogsProviderEnabler } from './roomItemDialog.tsx';
import { RoomConstructionModeCheckProvider, RoomScreenSceneModeCheckProvider } from './roomPermissionChecks.tsx';
import { useIsRoomConstructionModeEnabled } from './roomState.ts';

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

	const openContextMenu = useCallback<RoomScreenContext['openContextMenu']>((target) => {
		setContextMenuFocus(target);
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
		<RoomScreenContext.Provider value={ context }>
			<WardrobeActionContextProvider player={ player }>
				<RoomScreenSceneModeCheckProvider />
				<RoomConstructionModeCheckProvider />
				<RoomItemDialogsProviderEnabler />
				<SpaceSwitchDialogProvider />
				{ children }
				{ contextMenuFocus == null ? (
					null
				) : contextMenuFocus.type === 'character' ? (
					<CharacterContextMenu
						character={ contextMenuFocus.character }
						position={ contextMenuFocus.position }
						onClose={ closeContextMenu }
					/>
				) : contextMenuFocus.type === 'device' ? (
					<DeviceContextMenu
						room={ contextMenuFocus.room }
						deviceItemId={ contextMenuFocus.deviceItemId }
						position={ contextMenuFocus.position }
						onClose={ closeContextMenu }
					/>
				) : contextMenuFocus.type === 'item' ? (
					<ItemContextMenu
						room={ contextMenuFocus.room }
						itemId={ contextMenuFocus.itemId }
						position={ contextMenuFocus.position }
						onClose={ closeContextMenu }
					/>
				) : contextMenuFocus.type === 'raw' ? (
					<contextMenuFocus.component
						onClose={ closeContextMenu }
					/>
				) : AssertNever(contextMenuFocus) }
			</WardrobeActionContextProvider>
		</RoomScreenContext.Provider>
	);
}
