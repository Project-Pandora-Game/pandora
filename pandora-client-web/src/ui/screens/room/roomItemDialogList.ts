import type { ItemId } from 'pandora-common';
import { Observable } from '../../../observable';

export interface RoomItemDialogDefinition {
	itemId: ItemId;
	pinned: boolean;
}

export const RoomItemDialogs = new Observable<readonly Readonly<RoomItemDialogDefinition>[]>([]);
export const RoomItemDialogsShouldShow = new Observable<number>(0);

export function OpenRoomItemDialog(itemId: ItemId): void {
	const currentDialog = RoomItemDialogs.value.findIndex((d) => d.itemId === itemId);
	RoomItemDialogs.produceImmer((d) => {
		if (currentDialog >= 0) {
			// If we already have a dialog, only move it to the end
			const removed = d.splice(currentDialog, 1);
			d.push(...removed);
		} else {
			d.push({
				itemId,
				pinned: false,
			});
		}
	});
}
