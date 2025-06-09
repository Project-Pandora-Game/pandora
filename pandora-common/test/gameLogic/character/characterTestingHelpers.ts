import { freeze, type Immutable } from 'immer';
import { GameLogicCharacterClient, Logger, type AccountId, type CharacterId, type GameLogicCharacter, type ICharacterRoomData } from '../../../src/index.ts';

export function TestCreateGameLogicCharacter(accountId: AccountId, id: CharacterId): GameLogicCharacter {
	// Create a client character as that is much simpler to make
	const CHARACTER_DATA: Immutable<ICharacterRoomData> = {
		id,
		accountId,
		accountDisplayName: `Test${accountId}`,
		name: `Test${id.toUpperCase()}`,
		profileDescription: '',
		assetPreferences: {
			assets: {},
			attributes: {},
		},
		publicSettings: {},
		onlineStatus: 'online',
	};
	freeze(CHARACTER_DATA, true);

	return new GameLogicCharacterClient(
		() => CHARACTER_DATA,
		new Logger('TestCreateGameLogicCharacter', '', {
			printTime: false,
			timeLocale: undefined,
			onFatal: [],
			logOutputs: [],
		}),
	);
}
