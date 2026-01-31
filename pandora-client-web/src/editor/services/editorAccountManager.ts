import { freeze, type Immutable } from 'immer';
import {
	GetLogger,
	IDirectoryAccountInfo,
	Service,
	type CharacterId,
	type IDirectoryCharacterAssignmentInfo,
	type Satisfies,
	type SecondFactorData,
	type SecondFactorResponse,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { toast } from 'react-toastify';
import { GIT_DESCRIBE } from '../../config/Environment.ts';
import type { LoginResponse } from '../../networking/directoryConnector.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import type { IAccountManager } from '../../services/accountLogic/accountManager.ts';
import type { EditorServices } from './editorServices.ts';

type EditorAccountManagerServiceConfig = Satisfies<{
	dependencies: Pick<EditorServices, 'editor'>;
	events: {
		logout: undefined;
		accountChanged: { account: IDirectoryAccountInfo | null; character: Immutable<IDirectoryCharacterAssignmentInfo> | null; };
	};
}, ServiceConfigBase>;

class EditorAccountManager extends Service<EditorAccountManagerServiceConfig> implements IAccountManager {
	private readonly logger = GetLogger('AccountManager');

	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);
	private readonly _currentCharacter = new Observable<Immutable<IDirectoryCharacterAssignmentInfo> | null>(null);
	private readonly _lastSelectedCharacter = new Observable<CharacterId | undefined>(undefined);

	public get currentAccount(): ReadonlyObservable<IDirectoryAccountInfo | null> {
		return this._currentAccount;
	}

	public get currentCharacter(): ReadonlyObservable<Immutable<IDirectoryCharacterAssignmentInfo> | null> {
		return this._currentCharacter;
	}

	public get lastSelectedCharacter(): ReadonlyObservable<CharacterId | undefined> {
		return this._lastSelectedCharacter;
	}

	public secondFactorHandler: ((response: SecondFactorResponse) => Promise<SecondFactorData | null>) | null = null;

	public async login(): Promise<LoginResponse> {
		return Promise.reject(new Error('Login is not suppored inside Editor'));
	}

	public logout(): void {
		throw new Error('Logout is not suppored inside Editor');
	}

	protected override serviceInit(): void {
		this.serviceDeps.editor.editor.subscribe((editor) => {
			if (editor != null) {
				const account = freeze<IDirectoryAccountInfo>({
					id: editor.character.data.accountId,
					username: editor.character.data.accountDisplayName,
					displayName: editor.character.data.accountDisplayName,
					created: editor.created,
					roles: {
						admin: {},
					},
					spaceOwnershipLimit: 1,
					settings: {},
					settingsCooldowns: {},
				}, true);
				const character = freeze<IDirectoryCharacterAssignmentInfo>({
					characterId: editor.character.id,
					shardConnection: {
						secret: 'editor',
						id: 'editor',
						publicURL: 'editor://editor',
						features: ['development'],
						version: GIT_DESCRIBE || 'unknown',
					},
				}, true);

				this._currentAccount.value = account;
				this._currentCharacter.value = character;
				this._lastSelectedCharacter.value = character.characterId;
				this.emit('accountChanged', { account, character });
			} else {
				this._currentAccount.value = null;
				this._currentCharacter.value = null;
				this._lastSelectedCharacter.value = undefined;
				this.emit('accountChanged', { account: null, character: null });
			}
		}, true);
	}

	public connectToCharacter(): Promise<boolean> {
		return Promise.reject(new Error('Character changes are not suppored inside Editor'));
	}

	public disconnectFromCharacter(): void {
		toast('Character changes are not suppored inside Editor', TOAST_OPTIONS_ERROR);
	}
}

export const EditorAccountManagerServiceProvider: ServiceProviderDefinition<EditorServices, 'accountManager', EditorAccountManagerServiceConfig> = {
	name: 'accountManager',
	ctor: EditorAccountManager,
	dependencies: {
		editor: true,
	},
};
