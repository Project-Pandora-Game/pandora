import { z } from 'zod';
import type { CharacterId } from '../character/characterTypes.ts';
import type { SpaceId } from '../space/index.ts';
import { ZodCast, type HexColorString } from '../validation.ts';
import type { AccountId } from './account.ts';

export type IAccountContact = {
	/** Account id of the other account */
	id: AccountId;
	/** Account name of the other account */
	displayName: string;
	/** Time the contact was updated */
	time: number;
	/** Type of contact */
	type: 'friend' | 'pending' | 'incoming' | 'blocked';
};

export type IAccountFriendStatus = {
	/** Account id of the friend */
	id: AccountId;
	/** The current label color of the account */
	labelColor: HexColorString;
	/** If the friend is online */
	online: boolean;
	/** List of online characters the friend has */
	characters?: {
		id: CharacterId;
		name: string;
		space: SpaceId | null;
	}[];
};

export const AccountContactsInitDataSchema = z.object({
	contacts: ZodCast<IAccountContact>().array(),
	friends: ZodCast<IAccountFriendStatus>().array(),
});
export type AccountContactsInitData = z.infer<typeof AccountContactsInitDataSchema>;

export const AccountContactsUpdateDataSchema = z.object({
	contact: ZodCast<IAccountContact | { id: AccountId; type: 'none'; }>().optional(),
	friendStatus: ZodCast<IAccountFriendStatus | { id: AccountId; online: 'delete'; }>(),
});
export type AccountContactsUpdateData = z.infer<typeof AccountContactsUpdateDataSchema>;
