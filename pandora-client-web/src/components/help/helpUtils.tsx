import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks';
import { usePlayerData } from '../gameContext/playerContextProvider';

export function useHelpUserName(): string {
	const characterName = usePlayerData()?.name;
	const { displayName } = useAccountSettings();
	const accountName = useCurrentAccount()?.username;

	return characterName || displayName || accountName || 'visitor';
}
