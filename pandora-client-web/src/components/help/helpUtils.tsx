import { useCurrentAccount } from '../gameContext/directoryConnectorContextProvider';
import { usePlayerData } from '../gameContext/playerContextProvider';

export function useHelpUserName(): string {
	const characterName = usePlayerData()?.name;
	const accountName = useCurrentAccount()?.username;

	return characterName ?? accountName ?? 'visitor';
}
