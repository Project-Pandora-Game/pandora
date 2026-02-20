import { maxBy } from 'lodash-es';
import { Assert, CreateManuallyResolvedPromise, GetLogger, LIMIT_SPACE_MAX_CHARACTER_NUMBER, type ManuallyResolvedPromise } from 'pandora-common';
import { Character } from '../account/character.ts';
import type { Space } from './space.ts';

export type SpaceSwitchCoordinatorSwitchStage = 'syncLock' | 'enterPrecheck' | 'beforeLeave' | 'left' | 'beforeEnter';
export type SpaceSwitchCoordinatorError = 'failed' | 'spaceFull' | 'noAccess' | 'notReady';

const SWITCH_ERROR_PRIORITY: Record<SpaceSwitchCoordinatorError, number> = {
	failed: 0,
	spaceFull: 1,
	noAccess: 2,
	notReady: 3,
};

type SyncStageData = {
	stage: SpaceSwitchCoordinatorSwitchStage;
	syncPromise: ManuallyResolvedPromise<void>;
	waitingCharacters: Set<Character>;
	complete: () => void;
};

export class SpaceSwitchCoordinator {
	public readonly characters: readonly Character[];
	public readonly initiator: Character;
	public readonly originalSpace: Space;
	public readonly newSpace: Space;

	private _assumeInvite: boolean = false;
	public get assumeInvite(): boolean {
		return this._assumeInvite;
	}

	private _ignoreCharacterLimit: boolean = false;
	public get ignoreCharacterLimit(): boolean {
		return this._ignoreCharacterLimit;
	}

	private _canceled: boolean = false;
	public get canceled(): boolean {
		return this._canceled;
	}

	private _errors = new Set<SpaceSwitchCoordinatorError>();

	private _syncStage: SyncStageData | null = null;
	private readonly logger = GetLogger('SpaceSwitchCoordinator');

	constructor(characters: Character[], initiator: Character, originalSpace: Space, newSpace: Space) {
		Assert(characters.includes(initiator));

		this.characters = characters;
		this.initiator = initiator;
		this.originalSpace = originalSpace;
		this.newSpace = newSpace;
	}

	public async run(): Promise<'ok' | SpaceSwitchCoordinatorError> {
		Assert(this._syncStage === null);
		try {
			// Check if we can assume invitation and if we can ignore character limit
			const initiatorAllowEnter = this.newSpace.checkAllowEnter(this.initiator);
			if (initiatorAllowEnter !== 'ok') {
				if (initiatorAllowEnter === 'invalidInvite')
					return 'failed';
				return initiatorAllowEnter;
			}

			this._assumeInvite = this.newSpace.canCreateInvite(this.initiator, 'joinMe') === 'ok';
			// Ignore character limit if initiator is admin - convenience as they could change it after joining
			this._ignoreCharacterLimit = this.newSpace.isAdmin(this.initiator.baseInfo.account);

			const unfinishedCharacters = new Set(this.characters);

			// Start sync
			const syncPromise = new Promise<void>((resolve) => {
				this._doStage('syncLock', unfinishedCharacters, () => {
					this._doStage('enterPrecheck', unfinishedCharacters, () => {
						this._doStage('beforeLeave', unfinishedCharacters, () => {
							// Do final check for being able to fit all characters into target space
							const maxUsers = this.ignoreCharacterLimit ? LIMIT_SPACE_MAX_CHARACTER_NUMBER : this.newSpace.getConfig().maxUsers;
							if (this.newSpace.characterCount + unfinishedCharacters.size > maxUsers) {
								this._addError('spaceFull');
								resolve();
								return;
							}

							this._doStage('left', unfinishedCharacters, () => {
								this._doStage('beforeEnter', unfinishedCharacters, resolve, resolve);
							}, resolve);
						}, resolve);
					}, resolve);
				}, resolve);
			});

			// When sync is ready, start individual joins
			const switchResolution = Promise.allSettled(this.characters.map((c) => c.switchSpace(this.newSpace, undefined, this)
				.then((result) => {
					unfinishedCharacters.delete(c);
					if (result !== 'ok') {
						if (result === 'invalidInvite') {
							// WTF?
							this._addError('failed');
						} else if (result === 'inRoomDevice' || result === 'restricted') {
							this._addError('notReady');
						} else {
							this._addError(result);
						}
					} else {
						this._stageMarkCharacter(c);
					}
				}, (err) => {
					unfinishedCharacters.delete(c);
					this.logger.error('Error during character switch run:', err);
					this._addError('failed');
				}),
			));

			// Await all of it to catch any possible issues
			await Promise.all([
				switchResolution,
				syncPromise,
			]);
		} catch (err) {
			this.logger.error('Error during run:', err);
			this._addError('failed');
			return 'failed';
		}

		const error = maxBy(Array.from(this._errors), (e) => SWITCH_ERROR_PRIORITY[e]);

		if (error != null)
			return error;
		if (this.canceled)
			return 'failed';

		return 'ok';
	}

	public switchSynchronize(character: Character, stage: SpaceSwitchCoordinatorSwitchStage): Promise<void> {
		if (this.canceled)
			return Promise.resolve();

		if (this._syncStage == null || this._syncStage?.stage !== stage) {
			this.logger.error('Character entered synchronization at wrong stage:', stage, 'vs', this._syncStage?.stage);
			this._addError('failed');

			return Promise.resolve();
		}

		const promise = this._syncStage.syncPromise.promise;
		this._stageMarkCharacter(character);
		return promise;
	}

	private _doStage(stage: SpaceSwitchCoordinatorSwitchStage, characters: ReadonlySet<Character>, onSuccess: () => void, onError: () => void) {
		Assert(this._syncStage === null);
		const syncStage: SyncStageData = {
			stage,
			syncPromise: CreateManuallyResolvedPromise<void>(),
			complete: () => {
				Assert(this._syncStage === syncStage);
				this._syncStage = null;

				if (this.canceled) {
					onError();
				} else {
					onSuccess();
				}

				// Unblock everything waiting on barrier
				syncStage.syncPromise.resolve();
			},
			waitingCharacters: new Set(characters),
		};

		this._syncStage = syncStage;
	}

	private _addError(cause: SpaceSwitchCoordinatorError) {
		this._errors.add(cause);
		this._canceled = true;

		this._syncStage?.complete();
		Assert(this._syncStage == null);
	}

	private _stageMarkCharacter(character: Character): void {
		const syncStage = this._syncStage;
		if (syncStage != null) {
			syncStage.waitingCharacters.delete(character);
			if (syncStage.waitingCharacters.size === 0) {
				syncStage.complete();
			}
		}
	}
}
