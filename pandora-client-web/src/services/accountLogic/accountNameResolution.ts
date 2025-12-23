import type { AccountId } from 'pandora-common';
import { useCharacterDataOptional } from '../../character/character.ts';
import { useAccountContacts } from '../../components/accountContacts/accountContactContext.ts';
import { useSpaceCharacters } from '../gameLogic/gameStateHooks.ts';
import { useCurrentAccount } from './accountManagerHooks.ts';

export function useResolveAccountName(accountId: AccountId): string | null {
	const currentAccount = useCurrentAccount();

	// Look through contacts
	const contacts = useAccountContacts(null);
	const contact = contacts.find((a) => a.id === accountId);

	// Look through space characters to see if we find character of this account
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.data.accountId === accountId);
	const characterData = useCharacterDataOptional(character ?? null);

	if (accountId === 0) {
		return '[[Pandora]]';
	} else if (currentAccount?.id === accountId) {
		return currentAccount.displayName;
	} else if (contact != null) {
		return contact.displayName;
	} else if (characterData != null) {
		return characterData.accountDisplayName;
	}

	return null;
}
