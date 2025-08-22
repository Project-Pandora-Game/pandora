import { Immutable } from 'immer';
import {
	RoomBackgroundData,
	RoomProjectionResolver,
} from 'pandora-common';
import { useMemo } from 'react';

export function useRoomViewProjection(roomBackground: Immutable<RoomBackgroundData>): RoomProjectionResolver {
	return useMemo((): RoomProjectionResolver => {
		return new RoomProjectionResolver(roomBackground);
	}, [roomBackground]);
}
