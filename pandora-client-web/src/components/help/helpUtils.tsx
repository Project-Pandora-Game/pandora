import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';

export function useHelpUserName(): string {
	const characterName = usePlayerData()?.name;
	const { displayName } = useAccountSettings();
	const accountName = useCurrentAccount()?.username;

	return characterName || displayName || accountName || 'visitor';
}
