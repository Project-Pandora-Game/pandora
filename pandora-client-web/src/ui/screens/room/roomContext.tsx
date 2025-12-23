import type { Immutable } from 'immer';
import { Assert, ICharacterRoomData, ItemId, type CharacterId, type RoomId } from 'pandora-common';
import { createContext, useContext } from 'react';
import type { Character } from '../../../character/character.ts';
import type { PointLike } from '../../../graphics/common/point.ts';

export type IRoomSceneMode = {
	mode: 'normal';
} | {
	mode: 'moveCharacter' | 'poseCharacter';
	characterId: CharacterId;
} | {
	mode: 'moveDevice';
	deviceItemId: ItemId;
};

type IRoomContextMenuCharacterFocus = {
	type: 'character';
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
};

type IRoomContextMenuDeviceFocus = {
	type: 'device';
	room: RoomId;
	deviceItemId: ItemId;
	position: Readonly<PointLike>;
};

export type IRoomContextMenuFocus = IRoomContextMenuCharacterFocus | IRoomContextMenuDeviceFocus;

export type RoomScreenContext = {
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	contextMenuFocus: Readonly<IRoomContextMenuFocus> | null;
	openContextMenu: (target: Omit<IRoomContextMenuCharacterFocus, 'position'> | Omit<IRoomContextMenuDeviceFocus, 'position'> | null, position: Readonly<PointLike> | null) => void;
};

export const RoomScreenContext = createContext<RoomScreenContext | null>(null);

export function useRoomScreenContext(): RoomScreenContext {
	const context = useContext(RoomScreenContext);
	Assert(context != null, 'Attempt to use RoomScreenContext outside of the context');
	return context;
}
