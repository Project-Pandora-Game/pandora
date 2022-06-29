import type { IChatRoomUpdate, IChatRoomMessage, IShardClientArgument } from 'pandora-common';
import type { IChatRoomHandler } from '../../src/components/gameContext/chatRoomContextProvider';

export class ChatRoomHandlerMock implements IChatRoomHandler {
	onUpdate(_data: IChatRoomUpdate): void {
		// noop
	}
	onMessage(_messages: IChatRoomMessage[]): number {
		return 0;
	}
	onStatus(_status: IShardClientArgument['chatRoomStatus']): void {
		// noop
	}
}
