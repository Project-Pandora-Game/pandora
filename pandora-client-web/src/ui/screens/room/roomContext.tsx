import type { Immutable } from 'immer';
import { Assert, ICharacterRoomData, ItemId, type CharacterId, type RoomId } from 'pandora-common';
import { createContext, useContext, type FC } from 'react';
import type { Character } from '../../../character/character.ts';
import type { PointLike } from '../../../graphics/common/point.ts';

export type IRoomSceneMode = {
	mode: 'normal';
} | {
	mode: 'moveCharacter';
	characterId: CharacterId;
} | {
	mode: 'poseCharacter';
	characterId: CharacterId;
} | {
	mode: 'moveDevice';
	deviceItemId: ItemId;
} | {
	mode: 'moveItem';
	itemId: ItemId;
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

type IRoomContextMenuItemFocus = {
	type: 'item';
	room: RoomId;
	itemId: ItemId;
	position: Readonly<PointLike>;
};

type IRawContextMenuFocus = {
	type: 'raw';
	component: FC<{ onClose: () => void; }>;
};

export type IRoomContextMenuFocus = IRoomContextMenuCharacterFocus | IRoomContextMenuDeviceFocus | IRoomContextMenuItemFocus | IRawContextMenuFocus;

export type RoomScreenContext = {
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	contextMenuFocus: Readonly<IRoomContextMenuFocus> | null;
	openContextMenu: (target: IRoomContextMenuFocus | null) => void;
};

export const RoomScreenContext = createContext<RoomScreenContext | null>(null);

export function useRoomScreenContext(): RoomScreenContext {
	const context = useContext(RoomScreenContext);
	Assert(context != null, 'Attempt to use RoomScreenContext outside of the context');
	return context;
}
