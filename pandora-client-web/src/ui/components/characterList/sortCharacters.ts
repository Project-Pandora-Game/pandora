import type { IAccountFriendStatus } from 'pandora-common';
import type { Character } from '../../../character/character.ts';

export function SortSpaceCharacters(characters: readonly Character[], friends: readonly IAccountFriendStatus[]): Character[] {
	const enum CharOrder {
		PLAYER,
		ONLINE_FRIEND,
		ONLINE,
		FRIEND,
		OFFLINE,
	}

	const player = characters.find((c) => c.isPlayer());

	const getCharOrder = (character: Character) => {
		const isPlayer = character.isPlayer();
		const isSameAccount = character.data.accountId === player?.data.accountId;
		const isOnline = character.data.onlineStatus !== 'offline';
		const isFriend = friends.some((friend) => friend.id === character.data.accountId);

		if (isPlayer)
			return CharOrder.PLAYER;

		if (isOnline && (isFriend || isSameAccount))
			return CharOrder.ONLINE_FRIEND;

		if (isOnline)
			return CharOrder.ONLINE;

		if (isFriend || isSameAccount)
			return CharOrder.FRIEND;

		return CharOrder.OFFLINE;
	};

	const charactersSortFunction = (character1: Character, character2: Character) => {
		const order = getCharOrder(character1) - getCharOrder(character2);
		if (order !== 0)
			return order;

		return character1.name.localeCompare(character2.name);
	};

	return characters.toSorted(charactersSortFunction);
}
