import type { Immutable } from 'immer';
import { clamp, cloneDeep, pick, uniq } from 'lodash-es';
import { nanoid } from 'nanoid';
import { AccountId, Assert, AssertNever, AsyncSynchronized, CharacterId, ChatActionId, GetLogger, IClientDirectoryArgument, KnownObject, LIMIT_JOIN_ME_INVITE_MAX_VALIDITY, LIMIT_JOIN_ME_INVITES, LIMIT_SPACE_BOUND_INVITES, LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS, Logger, SPACE_ACTIVITY_SCORE_DECAY, SpaceActivityGetNextInterval, SpaceBaseInfo, SpaceDirectoryConfig, SpaceId, SpaceInvite, SpaceInviteCreate, SpaceInviteId, SpaceLeaveReason, SpaceListExtendedInfo, SpaceListInfo, SpaceSwitchResolveCharacterStatusToClientStatus, type ChatMessageDirectoryAction, type IClientDirectoryPromiseResult, type IShardDirectoryArgument, type SpaceActivitySavedData, type SpaceDirectoryData, type SpaceSwitchCommand, type SpaceSwitchShardStatusUpdate, type SpaceSwitchStatus } from 'pandora-common';
import { Account } from '../account/account.ts';
import { Character, CharacterInfo } from '../account/character.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import { Shard } from '../shard/shard.ts';
import { ShardManager } from '../shard/shardManager.ts';
import { SpaceManager } from './spaceManager.ts';
import { SpaceSwitchCoordinator } from './spaceSwitch.ts';

export class Space {
	/** Time when this space was last requested */
	public lastActivity: number = Date.now();

	public readonly id: SpaceId;
	private readonly config: SpaceDirectoryConfig;
	private readonly _owners: Set<AccountId>;
	private readonly _ownerInvites: Set<AccountId>;
	private readonly _spaceSwitchStatus: SpaceSwitchStatus[] = [];
	private _invites: SpaceInvite[];
	private _activity: SpaceActivitySavedData;
	private _deletionPending = false;

	public get isValid(): boolean {
		return !this._deletionPending;
	}

	private _assignedShard: Shard | null = null;
	public get assignedShard(): Shard | null {
		return this._assignedShard;
	}

	public accessId: string;

	public get name(): string {
		return this.config.name;
	}

	public get ownerInvites(): ReadonlySet<AccountId> {
		return this._ownerInvites;
	}

	public get spaceSwitchStatus(): Immutable<SpaceSwitchStatus[]> {
		return this._spaceSwitchStatus;
	}

	public get invites(): Immutable<SpaceInvite[]> {
		return this._invites;
	}

	public get owners(): ReadonlySet<AccountId> {
		return this._owners;
	}

	public get isPublic(): boolean {
		switch (this.config.public) {
			case 'locked':
			case 'private':
				return false;
			case 'public-with-admin':
				return this.hasAdminInside(true);
			case 'public-with-anyone':
				return true;
		}
		AssertNever(this.config.public);
	}

	private readonly logger: Logger;

	constructor({ id, config, owners, ownerInvites, accessId, invites, activity }: SpaceDirectoryData) {
		this.id = id;
		this.config = config;
		this._owners = new Set(owners);
		this._ownerInvites = new Set(ownerInvites);
		this._invites = invites;
		this._activity = activity;
		this.accessId = accessId;
		this.logger = GetLogger('Space', `[Space ${this.id}]`);

		// Make sure things that should are unique
		this.config.features = uniq(this.config.features);
		this._cleanupLists();

		this.logger.debug('Loaded');
	}

	private _cleanupLists(): void {
		this.config.admin = uniq(this.config.admin).filter((id) => !this._owners.has(id));
		this.config.banned = this._cleanupBanList(uniq(this.config.banned));
		this.config.allow = this._cleanupAllowList(uniq(this.config.allow));

		for (const oi of this._ownerInvites) {
			if (!this.config.admin.includes(oi))
				this._ownerInvites.delete(oi);
		}
	}

	private _cleanupBanList(list: AccountId[]): AccountId[] {
		return list.filter((id) => !this.config.admin.includes(id) && !this._owners.has(id));
	}

	private _cleanupAllowList(list: AccountId[]): AccountId[] {
		return list.filter((id) => !this.config.admin.includes(id) && !this._owners.has(id) && !this.config.banned.includes(id));
	}

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	public isInUse(): boolean {
		// Check if the space is currently loaded
		if (this._assignedShard != null)
			return true;

		// Check if there is any character that wants this space loaded
		for (const character of this.trackingCharacters) {
			if (character.isOnline())
				return true;
		}

		return false;
	}

	/** List of characters tracking this spaces's shard assignment */
	public readonly trackingCharacters: Set<Character> = new Set();
	/** List of characters inside the space */
	public readonly characters: Set<Character> = new Set();

	public get characterCount(): number {
		return this.characters.size;
	}

	public getBaseInfo(): SpaceBaseInfo {
		return ({
			name: this.config.name,
			description: this.config.description,
			public: this.config.public,
			maxUsers: this.config.maxUsers,
		});
	}

	/**
	 * Get basic info about this space to be displayed in the space list when searching for spaces.
	 * @param queryingAccount - The account for which to return info for
	 * @param accountFriends - Queryset of the account's friends, for resolving extra data
	 * @returns The basic list info
	 */
	public getListInfo(queryingAccount: Account, accountFriends: ReadonlySet<AccountId>): SpaceListInfo {
		const canSeeExtendedInfo = this.checkExtendedInfoVisibleTo(queryingAccount);

		let onlineCharacters = 0;
		let hasFriend: boolean | undefined = canSeeExtendedInfo ? false : undefined;
		for (const character of this.characters) {
			if (character.isOnline()) {
				onlineCharacters++;

				if (canSeeExtendedInfo && !hasFriend && accountFriends.has(character.baseInfo.account.id)) {
					hasFriend = true;
				}
			}
		}

		return ({
			...this.getBaseInfo(),
			id: this.id,
			onlineCharacters,
			totalCharacters: this.characterCount,
			isOwner: this.isOwner(queryingAccount),
			hasFriend,
			owners: Array.from(this._owners),
		});
	}

	public getListExtendedInfo(queryingAccount: Account, accountFriends: ReadonlySet<AccountId>): SpaceListExtendedInfo {
		return ({
			...this.getListInfo(queryingAccount, accountFriends),
			...pick(this.config, ['features', 'admin']),
			isAdmin: this.isAdmin(queryingAccount),
			isAllowed: this.isAllowed(queryingAccount),
			characters: Array.from(this.characters).map((c): SpaceListExtendedInfo['characters'][number] => ({
				id: c.baseInfo.id,
				accountId: c.baseInfo.account.id,
				name: c.baseInfo.data.name,
				isOnline: c.isOnline(),
				isAdmin: this.isAdmin(c.baseInfo.account),
			})),
		});
	}

	public getConfig(): SpaceDirectoryConfig {
		return this.config;
	}

	@AsyncSynchronized('object')
	public async dropSelfRole(accountId: AccountId, role: 'admin' | 'allowlisted'): Promise<'ok' | 'failed' | 'notFound'> {
		// Bail out if space is invalidated
		if (!this.isValid)
			return 'failed';

		if (role === 'admin') {
			if (!this.config.admin.includes(accountId))
				return 'ok';

			this.config.admin = this.config.admin.filter((a) => a !== accountId);
		} else if (role === 'allowlisted') {
			if (!this.config.allow.includes(accountId))
				return 'ok';

			this.config.allow = this.config.allow.filter((a) => a !== accountId);
		} else {
			AssertNever(role);
		}

		this._cleanupLists();
		await this._removeBannedCharacters(null);

		await Promise.all([
			this._assignedShard?.update('spaces'),
			GetDatabase().updateSpace(this.id, {
				config: cloneDeep(this.config),
				ownerInvites: Array.from(this._ownerInvites),
			}, null),
		]);

		ConnectionManagerClient.onSpaceListChange();
		return 'ok';
	}

	// TODO: This might be better synchronized, but we need to avoid deadlock if the space gets deleted during this
	public async removeOwner(accountId: AccountId): Promise<'ok' | 'notAnOwner'> {
		// Ignore if space is invalidated
		if (!this.isValid) {
			return 'ok';
		}
		// No action if target is already not an owner
		if (!this._owners.has(accountId)) {
			return 'notAnOwner';
		}
		// Owners get demoted to admins
		this._owners.delete(accountId);
		if (!this.config.admin.includes(accountId)) {
			this.config.admin.push(accountId);
		}

		if (this._owners.size === 0) {
			this.logger.info(`Removed owner ${accountId}, no owners left - deleting`);
			// Space without owners gets destroyed
			await this.delete();
		} else {
			this.logger.info(`Removed owner ${accountId}`);
			// Space with remaining owners only propagates the change to shard and clients
			await Promise.all([
				this._assignedShard?.update('spaces'),
				GetDatabase().updateSpace(this.id, {
					owners: Array.from(this._owners),
					config: cloneDeep(this.config),
				}, null),
			]);
			// TODO: Make an announcement of the change

			ConnectionManagerClient.onSpaceListChange();
		}
		return 'ok';
	}

	@AsyncSynchronized('object')
	public async inviteOwner(target: AccountId, source: Account): Promise<'ok' | 'failed' | 'notAnOwner' | 'targetNotAdmin' | 'targetNotAllowed'> {
		if (!this.isValid)
			return 'failed';
		if (!this.isOwner(source))
			return 'notAnOwner';

		// If already invited or an owner, NOOP
		if (this._ownerInvites.has(target) || this._owners.has(target))
			return 'ok';

		// Target needs to already be an admin
		if (!this.config.admin.includes(target))
			return 'targetNotAdmin';

		// Target needs to be in space or an contact to avoid spam
		if (!Array.from(this.characters).some((c) => c.baseInfo.account.id === target) &&
			!(await source.contacts.getFriendsIds()).has(target)
		) {
			return 'targetNotAllowed';
		}

		// Success: Add the invite and update everyone about it
		this._ownerInvites.add(target);
		this._cleanupLists();

		await Promise.all([
			this._assignedShard?.update('spaces'),
			GetDatabase().updateSpace(this.id, {
				config: cloneDeep(this.config),
				ownerInvites: Array.from(this._ownerInvites),
			}, null),
		]);

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async inviteOwnerCancel(target: AccountId, source: Account): Promise<'ok' | 'failed' | 'notAnOwner' | 'inviteNotFound'> {
		if (!this.isValid)
			return 'failed';
		// Owner can cancel invites and anyone can cancel their own
		if (!this.isOwner(source) && target !== source.id)
			return 'notAnOwner';
		if (!this._ownerInvites.has(target))
			return 'inviteNotFound';

		// Success: Remove the invite and update everyone about it
		this._ownerInvites.delete(target);
		this._cleanupLists();

		await Promise.all([
			this._assignedShard?.update('spaces'),
			GetDatabase().updateSpace(this.id, {
				config: cloneDeep(this.config),
				ownerInvites: Array.from(this._ownerInvites),
			}, null),
		]);

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async inviteOwnerAccept(account: Account): Promise<'ok' | 'failed' | 'inviteNotFound' | 'spaceOwnershipLimitReached'> {
		if (!this.isValid)
			return 'failed';
		if (this.isOwner(account))
			return 'ok';
		if (!this._ownerInvites.has(account.id))
			return 'inviteNotFound';

		// Check the target can take on another space
		const ownedSpaces = await GetDatabase().getSpacesWithOwner(account.id);
		if (ownedSpaces.length + 1 > account.spaceOwnershipLimit)
			return 'spaceOwnershipLimitReached';

		// Success: Turn the invite into full ownership
		this._owners.add(account.id);
		this._ownerInvites.delete(account.id);
		this._cleanupLists();

		await GetDatabase().updateSpace(this.id, {
			config: cloneDeep(this.config),
			owners: Array.from(this._owners),
			ownerInvites: Array.from(this._ownerInvites),
		}, null);

		await this._assignedShard?.update('spaces');

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async update(changes: Partial<SpaceDirectoryConfig>, source: CharacterInfo | null): Promise<'ok' | 'failed' | 'targetNotAllowed'> {
		// Bail out if space is invalidated
		if (!this.isValid)
			return 'failed';

		// If there is a source, there are additional requirements
		if (source != null) {
			// Admins and allowed users cannot be added unless in the space already, or in their contacts
			if (changes.admin || changes.allow) {
				const friends = await source.account.contacts.getFriendsIds();

				if (changes.admin && changes.admin.some((a) => (
					!this.config.admin.includes(a) && // Ignore existing admins
					!this.config.allow.includes(a) && // Allow promote from allow-listed
					!Array.from(this.characters).some((c) => c.baseInfo.account.id === a) && // Allow if present in the space
					!friends.has(a) // Allow contacts
				))) {
					return 'targetNotAllowed';
				}

				if (changes.allow && changes.allow.some((a) => (
					!this.config.allow.includes(a) && // Ignore existing allow-listed
					!this.config.admin.includes(a) && // Allow demote from admin
					!Array.from(this.characters).some((c) => c.baseInfo.account.id === a) && // Allow if present in the space
					!friends.has(a) // Allow contacts
				))) {
					return 'targetNotAllowed';
				}
			}
		}

		if (changes.name) {
			this.config.name = changes.name;
		}
		if (changes.description !== undefined) {
			this.config.description = changes.description;
		}
		if (changes.entryText !== undefined) {
			this.config.entryText = changes.entryText;
		}
		if (changes.maxUsers !== undefined) {
			this.config.maxUsers = changes.maxUsers;
		}
		if (changes.admin) {
			this.config.admin = uniq(changes.admin);
		}
		if (changes.banned) {
			this.config.banned = uniq(changes.banned);
		}
		if (changes.allow) {
			this.config.allow = uniq(changes.allow);
		}
		if (changes.admin || changes.banned || changes.allow) {
			this._cleanupLists();
			await this._removeBannedCharacters(source);
		}
		if (changes.public !== undefined) {
			this.config.public = changes.public;
		}
		if (changes.ghostManagement !== undefined) {
			this.config.ghostManagement = cloneDeep(changes.ghostManagement);
		}
		if (changes.development !== undefined && this.config.features.includes('development') && (source == null || source.account.roles.isAuthorized('developer'))) {
			this.config.development = changes.development;
		}

		// Features are intentionally ignored

		// Send message about the space being updated
		if (source) {
			const changeList: string[] = [];
			if (changes.name)
				changeList.push(`name to '${changes.name}'`);
			if (changes.maxUsers !== undefined)
				changeList.push(`character limit to '${changes.maxUsers}'`);
			if (changes.public !== undefined) {
				const NAME_MAP: Record<typeof this.config.public, string> = {
					'locked': 'private (locked)',
					'private': 'private',
					'public-with-admin': 'public (while an admin is present)',
					'public-with-anyone': 'public',
				};
				changeList.push(`visibility to '${NAME_MAP[this.config.public]}'`);
			}
			if (changes.description !== undefined)
				changeList.push('description');
			if (changes.admin)
				changeList.push('admins');
			if (changes.banned)
				changeList.push('ban list');
			if (changes.allow)
				changeList.push('allow list');
			if (changes.ghostManagement !== undefined)
				changeList.push('offline character management settings');
			if (changes.development !== undefined && this.config.features.includes('development') && (source == null || source.account.roles.isAuthorized('developer')))
				changeList.push('development settings');

			this._sendUpdatedMessage(source, ...changeList);
		}

		await Promise.all([
			this._assignedShard?.update('spaces'),
			GetDatabase().updateSpace(this.id, {
				config: cloneDeep(this.config),
				ownerInvites: Array.from(this._ownerInvites),
			}, null),
		]);

		ConnectionManagerClient.onSpaceListChange();
		return 'ok';
	}

	private _sendUpdatedMessage(source: CharacterInfo, ...changeList: string[]) {
		if (changeList.length >= 2) {
			this.sendMessage({
				type: 'serverMessage',
				id: 'spaceUpdatedMultiple',
				data: {
					character: source.id,
				},
				dictionary: {
					COUNT: `${changeList.length}`,
					CHANGES: changeList.map((l) => ` \u2022 ${l}`).join('\n'),
				},
			});
		} else if (changeList.length === 1) {
			this.sendMessage({
				type: 'serverMessage',
				id: 'spaceUpdatedSingle',
				data: {
					character: source.id,
				},
				dictionary: {
					CHANGE: changeList[0],
				},
			});
		}
	}

	@AsyncSynchronized('object')
	public async adminAction(source: CharacterInfo, action: IClientDirectoryArgument['spaceAdminAction']['action'], targets: number[]): Promise<'ok' | 'failed' | 'targetNotAllowed'> {
		// Ignore if the space is invalidated
		if (!this.isValid)
			return 'failed';

		targets = uniq(targets);
		let updated = false;
		switch (action) {
			case 'kick':
				targets = this._cleanupBanList(targets);
				for (const character of this.characters) {
					if (!targets.includes(character.baseInfo.account.id))
						continue;

					updated = true;
					await this._removeCharacter(character, 'kick', source);
				}
				break;
			case 'ban': {
				targets = this._cleanupBanList(targets);
				const oldSize = this.config.banned.length;
				this.config.banned = uniq([...this.config.banned, ...targets]);
				this.config.allow = this.config.allow.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.banned.length;
				if (updated) {
					await this._removeBannedCharacters(source);
					this._sendUpdatedMessage(source, 'ban list');
				}
				break;
			}
			case 'unban': {
				const oldSize = this.config.banned.length;
				this.config.banned = this.config.banned.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.banned.length;
				if (updated)
					this._sendUpdatedMessage(source, 'ban list');

				break;
			}
			case 'allow': {
				targets = this._cleanupAllowList(targets);
				// Allow-listed users cannot be added unless in the space already, or in their contacts
				const friends = await source.account.contacts.getFriendsIds();

				if (targets.some((a) => (
					!this.config.allow.includes(a) && // Ignore existing allow-listed
					!Array.from(this.characters).some((c) => c.baseInfo.account.id === a) && // Allow if present in the space
					!friends.has(a) // Allow contacts
				))) {
					return 'targetNotAllowed';
				}

				const oldSize = this.config.allow.length;
				this.config.allow = uniq([...this.config.allow, ...targets]);
				updated = oldSize !== this.config.allow.length;
				if (updated)
					this._sendUpdatedMessage(source, 'allow list');

				break;
			}
			case 'disallow': {
				const oldSize = this.config.allow.length;
				this.config.allow = this.config.allow.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.allow.length;
				if (updated)
					this._sendUpdatedMessage(source, 'allow list');

				break;
			}
			case 'promote': {
				// Admins cannot be added unless in the space already, or in their contacts
				const friends = await source.account.contacts.getFriendsIds();

				if (targets.some((a) => (
					!this.config.admin.includes(a) && // Ignore existing admins
					!this.config.allow.includes(a) && // Allow promote from allow-listed
					!Array.from(this.characters).some((c) => c.baseInfo.account.id === a) && // Allow if present in the space
					!friends.has(a) // Allow contacts
				))) {
					return 'targetNotAllowed';
				}

				const oldSize = this.config.admin.length;
				this.config.admin = uniq([...this.config.admin, ...targets]);
				updated = oldSize !== this.config.admin.length;
				if (updated)
					this._sendUpdatedMessage(source, 'admins');

				break;
			}
			case 'demote': {
				const oldSize = this.config.admin.length;
				this.config.admin = this.config.admin.filter((id) => !targets.includes(id));
				updated = oldSize !== this.config.admin.length;
				if (updated)
					this._sendUpdatedMessage(source, 'admins');

				break;
			}
			default:
				AssertNever(action);
		}

		if (updated) {
			ConnectionManagerClient.onSpaceListChange();
			await Promise.all([
				this._assignedShard?.update('spaces'),
				GetDatabase().updateSpace(this.id, { config: cloneDeep(this.config) }, null),
			]);
		}

		return 'ok';
	}

	@AsyncSynchronized('object')
	public async automodAction(target: CharacterId, action: IShardDirectoryArgument['characterAutomod']['action'], _reason: IShardDirectoryArgument['characterAutomod']['reason']): Promise<void> {
		// Ignore if the space is invalidated
		if (!this.isValid) {
			return;
		}
		// Find the targetted character
		const character = Array.from(this.characters).find((c) => c.baseInfo.id === target);
		if (character == null)
			return;

		let updated = false;
		switch (action) {
			case 'kick':
				updated = true;
				await this._removeCharacter(character, 'automodKick', null);
				break;
			default:
				AssertNever(action);
		}
		if (updated) {
			ConnectionManagerClient.onSpaceListChange();
			await this._assignedShard?.update('spaces');
		}
	}

	/**
	 * Mark this space as pending for deletion and delete it from the database.
	 * This removes all characters currently inside, unloads the space from shards and marks it as pending for deletion so it gets unloaded as soon as possible.
	 */
	@AsyncSynchronized('object')
	public async delete(): Promise<void> {
		this._deletionPending = true;
		this.logger.debug('Marked for deletion');
		// Be nice and notify people that this space is no longer joinable
		ConnectionManagerClient.onSpaceListChange();
		// Kick all characters
		for (const character of Array.from(this.characters.values())) {
			await this._removeCharacter(character, 'destroy', null);
		}
		// Manually disconnect
		const result = await this._setShard(null);
		Assert(result);
		Assert(this._assignedShard == null);
		Assert(this.characters.size === 0);
		// Finally delete the space from the database
		await GetDatabase().deleteSpace(this.id);
		// Note, that at this point there could still be pending connections or characters tracking it
		// Ignore those - the requests will fail and once the space is not requestesd for a bit, it will be unloaded from the directory too, actually vanishing
	}

	public checkAllowEnter(character: Character, opts: { inviteId?: SpaceInviteId; assumeValidInvite?: boolean; ignoreCharacterLimit?: boolean; } = {}): 'ok' | 'spaceFull' | 'noAccess' | 'invalidInvite' {
		// No-one can enter if the space is in an invalid state
		if (!this.isValid) {
			return 'spaceFull';
		}

		// If you are already in this space, then you have rights to enter it
		if (character.space === this)
			return 'ok';

		// If the space is full, you cannot enter it (some checks ignore space being full)
		if (!opts.ignoreCharacterLimit) {
			let maxUsers = this.config.maxUsers;
			if (this.isOwner(character.baseInfo.account)) {
				maxUsers += LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS;
			}
			if (this.characterCount >= maxUsers)
				return 'spaceFull';
		}

		// If you are an owner or admin, you can enter the space (owner implies admin)
		if (this.isAdmin(character.baseInfo.account))
			return 'ok';

		// If you are banned, you cannot enter the space
		if (this.isBanned(character.baseInfo.account))
			return 'noAccess';

		// If you are on the allow list, you can enter the space unless it is locked
		if (this.isAllowed(character.baseInfo.account) && this.config.public !== 'locked')
			return 'ok';

		// If the space is public, you can enter it
		if (this.isPublic)
			return 'ok';

		// If invite is presented, check it
		if (opts.assumeValidInvite) {
			return 'ok';
		} else if (opts.inviteId != null) {
			const invite = this._getValidInvite(character, opts.inviteId);
			// The invite must exist
			if (!invite)
				return 'invalidInvite';
			// "Join-me" invite has more restrictions
			if (invite.type === 'joinMe') {
				const creator = [...this.characters].find((c) => c.baseInfo.id === invite.createdBy.characterId);
				// Creator of "Join-me" invite needs to be present inside
				if (!creator?.isOnline())
					return 'invalidInvite';
				// If the room is not marked as public, then only admins can invite inside
				const isPublic = (this.config.public === 'public-with-admin' || this.config.public === 'public-with-anyone');
				if (!isPublic && !this.isAdmin(creator.baseInfo.account))
					return 'invalidInvite';
			} else if (invite.type === 'spaceBound') {
				// If the space is locked, persistent invitations are temporarily blocked
				// (we consider them of same level as allow-listed users)
				if (this.config.public === 'locked')
					return 'invalidInvite';
			} else {
				AssertNever(invite.type);
			}
			return 'ok';
		}

		// Otherwise you cannot enter
		return 'noAccess';
	}

	private _cleanupInvites(): boolean {
		const size = this._invites.length;
		this._invites = this._invites.filter((i) => this._isValidInvite(i));
		return size !== this._invites.length;
	}

	private _getValidInvite(character: Character, id: SpaceInviteId): SpaceInvite | undefined {
		const invite = this._invites.find((i) => i.id === id);
		if (!invite || !this._isValidInvite(invite))
			return undefined;
		if (!this._isAllowedToUseInvite(character, invite))
			return undefined;

		return invite;
	}

	private _isValidInvite(invite: SpaceInvite): boolean {
		if (invite.expires != null && invite.expires < Date.now())
			return false;
		if (invite.maxUses != null && invite.uses >= invite.maxUses)
			return false;
		if (invite.type === 'joinMe' && [...this.characters].every((c) => c.baseInfo.id !== invite.createdBy.characterId))
			return false;

		return true;
	}

	private _isAllowedToUseInvite(character: Character, invite: SpaceInvite): boolean {
		// Author can use the invite (mainly used for letting them see info about the invite)
		if (invite.createdBy.accountId === character.baseInfo.account.id)
			return true;
		// If filtered to a specific account, check it
		if (invite.accountId != null && invite.accountId !== character.baseInfo.account.id)
			return false;
		// If filtered to a specific character, check it
		if (invite.characterId != null && invite.characterId !== character.baseInfo.id)
			return false;

		return true;
	}

	public getInvite(character: Character, id?: SpaceInviteId): SpaceInvite | undefined {
		if (!id)
			return undefined;

		return cloneDeep(this._getValidInvite(character, id));
	}

	public getInvites(source: Character): SpaceInvite[] {
		this._cleanupInvites();

		if (this.isAdmin(source.baseInfo.account))
			return cloneDeep(this._invites);

		return cloneDeep(this._invites.filter((i) => i.createdBy.accountId === source.baseInfo.account.id));
	}

	@AsyncSynchronized('object')
	public async deleteInvite(source: Character, id: SpaceInviteId): Promise<boolean> {
		const index = this._invites.findIndex((i) => i.id === id);
		if (index < 0)
			return false;
		if (!this.isAdmin(source.baseInfo.account) && this._invites[index].createdBy.accountId !== source.baseInfo.account.id)
			return false;

		this._invites.splice(index, 1);
		this._cleanupInvites();
		await GetDatabase().updateSpace(this.id, { invites: cloneDeep(this._invites) }, null);
		return true;
	}

	public canCreateInvite(source: Character, inviteType: SpaceInvite['type']): 'ok' | 'requireAdmin' | 'tooManyInvites' {
		const account = source.baseInfo.account;

		switch (inviteType) {
			case 'joinMe': {
				// If the room is not marked as public, then only admins can invite inside
				const isPublic = (this.config.public === 'public-with-admin' || this.config.public === 'public-with-anyone');
				if (!isPublic && !this.isAdmin(account))
					return 'requireAdmin';

				return 'ok';
			}
			case 'spaceBound':
				if (!this.isAdmin(account))
					return 'requireAdmin';
				if (this._invites.filter((i) => i.type === 'spaceBound').length >= LIMIT_SPACE_BOUND_INVITES)
					return 'tooManyInvites';

				return 'ok';
		}
		AssertNever(inviteType);
	}

	@AsyncSynchronized('object')
	public async createInvite(source: Character, data: SpaceInviteCreate): Promise<SpaceInvite | 'tooManyInvites' | 'invalidData' | 'requireAdmin'> {
		this._cleanupInvites();

		const now = Date.now();
		const account = source.baseInfo.account;
		const canCreate = this.canCreateInvite(source, data.type);
		if (canCreate !== 'ok')
			return canCreate;

		switch (data.type) {
			case 'joinMe': {
				if (data.accountId == null)
					return 'invalidData';

				let dropCount = this._invites.filter((i) => i.type === 'joinMe' && i.createdBy.accountId === account.id).length - LIMIT_JOIN_ME_INVITES + 1;
				if (dropCount > 0)
					this._invites = this._invites.filter((i) => i.type !== 'joinMe' || i.createdBy.accountId !== account.id || dropCount-- <= 0);

				data.maxUses = 1;
				data.expires = clamp(data.expires ?? Infinity, now, now + LIMIT_JOIN_ME_INVITE_MAX_VALIDITY);
				break;
			}
			case 'spaceBound':
				if (data.expires)
					data.expires = Math.max(data.expires, now);

				break;
			default:
				AssertNever(data.type);
		}

		let id: SpaceInviteId = `i_${nanoid()}`;
		while (this._invites.some((i) => i.id === id)) {
			id = `i_${nanoid()}`;
		}

		const invite: SpaceInvite = {
			...data,
			id,
			uses: 0,
			createdBy: {
				accountId: account.id,
				characterId: source.baseInfo.id,
			},
		};

		this._invites.push(invite);
		await GetDatabase().updateSpace(this.id, { invites: cloneDeep(this._invites) }, null);
		return invite;
	}

	/** Returns if this space is visible to the specific account when searching in space listing */
	public checkVisibleTo(account: Account): boolean {
		if (!this.isValid)
			return false;

		// Public spaces are only shown in active space listing, if there is some character online
		if (this.isPublic && Array.from(this.characters).some((c) => c.isOnline()))
			return true;

		if (this.isAllowed(account))
			return true;

		return false;
	}

	/** Returns if this space's extended info should be visible to the specified account */
	public checkExtendedInfoVisibleTo(account: Account): boolean {
		// Deny if space isn't in a valid state or the account is banned
		if (!this.isValid || this.isBanned(account))
			return false;

		// Allow if there already is some character of this account inside this space (they can see it anyway)
		if (Array.from(account.characters.values()).some((c) => c.loadedCharacter?.space === this))
			return true;

		// Owners and admins can see the info at all times
		if (this.isAdmin(account))
			return true;

		// Allow-listed users can see it unless it is locked
		if (this.isAllowed(account) && this.config.public !== 'locked')
			return true;

		// If the space is public, anyone can see the details
		if (this.isPublic)
			return true;

		// Otherwise no details for you! (can still be overriden through invite if the character checking can enter)
		return false;
	}

	public isOwner(account: Account): boolean {
		return this._owners.has(account.id);
	}

	public isAdmin(account: Account): boolean {
		if (this.isOwner(account))
			return true;

		if (this.config.admin.includes(account.id))
			return true;

		if (this.config.development?.autoAdmin && account.roles.isAuthorized('developer'))
			return true;

		return false;
	}

	public isBanned(account: Account): boolean {
		if (this.isAdmin(account))
			return false;

		if (this.config.banned.includes(account.id))
			return true;

		return false;
	}

	public isAllowed(account: Account): boolean {
		if (this.isAdmin(account))
			return true;
		if (this.isBanned(account))
			return false;
		if (this.config.allow.includes(account.id))
			return true;

		return false;
	}

	public hasAdminInside(requireOnline: boolean): boolean {
		for (const c of this.characters) {
			if (requireOnline && !c.isOnline())
				continue;

			if (this.isAdmin(c.baseInfo.account)) {
				return true;
			}
		}
		return false;
	}

	@AsyncSynchronized('object')
	public async addCharacter(character: Character, invite?: SpaceInviteId): Promise<boolean> {
		// Ignore if space is invalidated
		if (!this.isValid) {
			return false;
		}

		Assert(character.assignment?.type === 'space-tracking' && character.assignment.space === this);
		Assert(this.trackingCharacters.has(character));
		Assert(!this.characters.has(character));

		if (this.isBanned(character.baseInfo.account)) {
			this.logger.warning(`Refusing to add banned character id ${character.baseInfo.id}`);
			return false;
		}

		this.logger.debug(`Character ${character.baseInfo.id} entered`);
		this.characters.add(character);
		character.assignment = {
			type: 'space-joined',
			space: this,
		};

		// Report the enter
		this.sendMessage({
			type: 'serverMessage',
			id: 'characterEntered',
			data: {
				character: character.baseInfo.id,
				account: character.baseInfo.account.getChatDescriptor(),
			},
		});

		// send entry text, if there is any
		if (this.config.entryText) {
			this.sendMessage({
				type: 'action',
				id: 'spaceEntryText',
				sendTo: [character.baseInfo.id],
				dictionary: {
					SPACE_ENTRY_TEXT: this.config.entryText,
				},
			});
		}

		this.updateActivityData();
		ConnectionManagerClient.onSpaceListChange();
		await Promise.all([
			this._assignedShard?.update('characters'),
			character.baseInfo.updateDirectoryData({ currentSpace: this.id }),
			this._useInvite(character, invite),
		]);

		return true;
	}

	private async _useInvite(character: Character, id?: SpaceInviteId): Promise<void> {
		const invite = id ? this._getValidInvite(character, id) : undefined;
		if (!invite)
			return;

		invite.uses++;

		this._cleanupInvites();
		await GetDatabase().updateSpace(this.id, { invites: cloneDeep(this._invites) }, null);
	}

	/**
	 * Remove a character from this space. This function can be called from anywhere safely.
	 * @param character - The character to remove. If the character is not in this space, this function is a NOOP
	 * @param reason - Why is the character being removed.
	 * @param source - Who is removing the character. Usually the character itself, but in case of moderator actions the character that did it.
	 * In case of automatic actions or errors, this can be `null` to signify it is being done by Pandora itself.
	 * @param processAssignmentUpdate - An optional hook that is called right after character is removed from the space (but before data is synced to the Shard),
	 * to allow performing atomic changes to assignment without observable intermediate states. This should generally be used only by the {@link Character} class.
	 * @returns Promise of removal. When this fulfills the character is no longer in the space.
	 */
	@AsyncSynchronized('object')
	public async removeCharacter(character: Character, reason: SpaceLeaveReason, source: CharacterInfo | null, processAssignmentUpdate?: () => void): Promise<void> {
		return await this._removeCharacter(character, reason, source, processAssignmentUpdate);
	}

	/**
	 * Remove a character from this space. This function expects synchronization on the space object.
	 * @param character - The character to remove. If the character is not in this space, this function is a NOOP
	 * @param reason - Why is the character being removed.
	 * @param source - Who is removing the character. Usually the character itself, but in case of moderator actions the character that did it.
	 * In case of automatic actions or errors, this can be `null` to signify it is being done by Pandora itself.
	 * @param processAssignmentUpdate - An optional hook that is called right after character is removed from the space (but before data is synced to the Shard),
	 * to allow performing atomic changes to assignment without observable intermediate states. This should generally be used only by the {@link Character} class.
	 * @returns Promise of removal. When this fulfills the character is no longer in the space.
	 */
	private async _removeCharacter(character: Character, reason: SpaceLeaveReason, source: CharacterInfo | null, processAssignmentUpdate?: () => void): Promise<void> {
		// Ignore if the character has already been removed
		if (!this.characters.has(character))
			return;

		Assert(character.assignment?.type === 'space-joined' && character.assignment.space === this);
		Assert(this.trackingCharacters.has(character));

		await character.baseInfo.updateDirectoryData({ currentSpace: null });

		// Update space activity right before removal, so this character still counts as active at the last moment
		this.updateActivityData();

		this.logger.debug(`Character ${character.baseInfo.id} removed (${reason})`);
		this.characters.delete(character);
		const invitesChanged = this._cleanupInvites();
		character.assignment = {
			type: 'space-tracking',
			space: this,
		};
		// Make sure to un-track the character too, sending them on the same shard the space was on before
		// (even if that was no shard; could happen if space is deleted without being loaded)
		this.trackingCharacters.delete(character);
		character.assignment = this._assignedShard == null ? null : {
			type: 'shard',
			shard: this._assignedShard,
		};
		// Run assignment hook. Shard update **must** be triggered after this is run.
		processAssignmentUpdate?.();

		// Report the leave
		let action: ChatActionId | undefined;
		if (reason === 'leave') {
			action = 'characterLeft';
		} else if (reason === 'disconnect') {
			action = 'characterDisconnected';
		} else if (reason === 'kick') {
			action = 'characterKicked';
		} else if (reason === 'ban') {
			action = 'characterBanned';
		} else if (reason === 'error') {
			action = 'characterDisconnected';
		} else if (reason === 'destroy') {
			// Do not report space being destroyed, everyone is removed anyway
		} else if (reason === 'automodKick') {
			action = 'characterAutoKicked';
		} else {
			AssertNever(reason);
		}
		if (action) {
			this.sendMessage({
				type: 'serverMessage',
				id: action,
				data: {
					targetCharacter: character.baseInfo.id,
					accountTarget: character.baseInfo.account.getChatDescriptor(),
					character: source?.id ?? character.baseInfo.id,
					account: (source ?? character.baseInfo).account.getChatDescriptor(),
				},
			});
		}

		this._cleanupSpaceSwitchStatus();
		await this._assignedShard?.update('characters', 'spaces');
		ConnectionManagerClient.onSpaceListChange();

		if (invitesChanged)
			await GetDatabase().updateSpace(this.id, { invites: cloneDeep(this._invites) }, null);
	}

	/**
	 * Triggered when client reconnects to a character that is already in a space
	 * @param character The character that reconnected
	 */
	public characterReconnected(character: Character): void {
		Assert(this.characters.has(character));

		this.sendMessage({
			type: 'serverMessage',
			id: 'characterReconnected',
			data: {
				character: character.baseInfo.id,
				account: character.baseInfo.account.getChatDescriptor(),
			},
		});
	}

	public characterDisconnected(character: Character): void {
		Assert(this.characters.has(character));

		this.sendMessage({
			type: 'serverMessage',
			id: 'characterDisconnected',
			data: {
				character: character.baseInfo.id,
				account: character.baseInfo.account.getChatDescriptor(),
			},
		});
	}

	private async _removeBannedCharacters(source: CharacterInfo | null): Promise<void> {
		for (const character of this.characters.values()) {
			if (this.isBanned(character.baseInfo.account)) {
				await this._removeCharacter(character, 'ban', source);
			}
		}
	}

	public async generateAccessId(): Promise<boolean> {
		const result = await GetDatabase().setSpaceAccessId(this.id);
		if (result == null)
			return false;
		this.accessId = result;
		return true;
	}

	@AsyncSynchronized('object')
	public async connect(): Promise<'noShardFound' | 'failed' | Shard> {
		// Ignore if space is invalidated
		if (!this.isValid) {
			return 'failed';
		}
		let shard: Shard | null = this._assignedShard;
		if (shard == null) {
			if (this.config.features.includes('development') && this.config.development?.shardId) {
				shard = ShardManager.getShard(this.config.development.shardId);
			} else {
				shard = ShardManager.getRandomShard();
			}
		}
		if (shard == null) {
			return 'noShardFound';
		}
		return (await this._setShard(shard)) ? shard : 'failed';
	}

	@AsyncSynchronized('object')
	public async disconnect(): Promise<void> {
		const result = await this._setShard(null);
		Assert(result);
		// Clear pending action messages when the space gets disconnected (this is not triggered on simple reassignment)
		this.pendingMessages.length = 0;
	}

	/**
	 * Called when Shard reports an error related to the space (e.g. crash during load).
	 * In that case force the space to unload so it doesn't break more things and remove all online characters from it,
	 * allowing them to continue using Pandora if the space is in a persistently errored state.
	 */
	@AsyncSynchronized('object')
	public async onError(): Promise<void> {
		this.logger.error('Space onError triggered');

		// Disconnect from shard first
		const result = await this._setShard(null);
		Assert(result);
		// Clear pending action messages when the space gets disconnected (this is not triggered on simple reassignment)
		this.pendingMessages.length = 0;
		// Remove all online characters (we can keep offline ones safely, as those won't trigger load)
		for (const character of Array.from(this.characters)) {
			if (character.isOnline()) {
				await this._removeCharacter(character, 'error', null);
			}
		}
	}

	@AsyncSynchronized('object')
	public shardReconnect(shard: Shard, accessId: string, characterAccessIds: ReadonlyMap<CharacterId, string>): Promise<void> {
		this.touch();
		if (!this.isValid || this.isInUse() || this.accessId !== accessId)
			return Promise.resolve();

		Assert(this._assignedShard == null);

		// Restore character access IDs
		for (const character of this.characters) {
			const characterAccessId = characterAccessIds.get(character.baseInfo.id);
			if (!characterAccessId) {
				this.logger.warning(`Missing connected character access id while reconnecting hard for ${character.baseInfo.id}`);
			} else {
				character.accessId = characterAccessId;
			}
		}

		// We are ready to connect to shard, but check again if we can to avoid race conditions
		if (!shard.allowConnect()) {
			this.logger.warning('Shard rejects connections during reconnect');
			return Promise.resolve();
		}

		// Actually assign to the shard
		Assert(this._assignedShard == null);

		this._assignedShard = shard;
		shard.spaces.set(this.id, this);
		for (const character of this.trackingCharacters) {
			Assert(character.assignment?.type === 'space-tracking' || character.assignment?.type === 'space-joined');
			Assert(character.assignment.space === this);
			shard.characters.set(character.baseInfo.id, character);
		}
		for (const character of this.trackingCharacters) {
			Assert(character.assignment?.type === 'space-tracking' || character.assignment?.type === 'space-joined');
			Assert(character.assignment.space === this);
			character.assignedClient?.sendConnectionStateUpdate();
		}

		this.logger.debug('Re-connected to shard', shard.id);
		ConnectionManagerClient.onSpaceListChange();

		return Promise.resolve();
	}

	private async _setShard(shard: Shard | null): Promise<boolean> {
		this.touch();

		if (this._assignedShard === shard)
			return true;

		// If we are on a wrong shard, we leave it
		if (this._assignedShard != null) {
			const oldShard = this._assignedShard;
			this._assignedShard = null;

			for (const character of this.trackingCharacters) {
				Assert(character.assignment?.type === 'space-tracking' || character.assignment?.type === 'space-joined');
				Assert(character.assignment.space === this);
				character.assignedClient?.sendConnectionStateUpdate();
				Assert(oldShard.characters.get(character.baseInfo.id) === character);
				oldShard.characters.delete(character.baseInfo.id);
			}
			Assert(oldShard.spaces.get(this.id) === this);
			oldShard.spaces.delete(this.id);

			await oldShard.update('spaces', 'characters');

			this.logger.debug('Disconnected from shard');
		}

		// If we are not connecting to a shard, this is enough
		if (shard == null)
			return true;

		// Generate new access id for new shard
		const accessIdSuccess = await this.generateAccessId();
		if (!accessIdSuccess)
			return false;

		// Generate new access id for all tracking characters
		const characterAccessIdSuccess = await Promise.all(
			Array.from(this.trackingCharacters.values())
				.map((character) => character.generateAccessId()),
		);
		if (characterAccessIdSuccess.includes(false))
			return false;

		// We are ready to connect to shard, but check again if we can to avoid race conditions
		if (!shard.allowConnect())
			return false;

		// Actually assign to the shard
		Assert(this._assignedShard == null);

		this._assignedShard = shard;
		shard.spaces.set(this.id, this);
		for (const character of this.trackingCharacters) {
			Assert(character.assignment?.type === 'space-tracking' || character.assignment?.type === 'space-joined');
			Assert(character.assignment.space === this);
			shard.characters.set(character.baseInfo.id, character);
		}
		await shard.update('spaces', 'characters', this.pendingMessages.length > 0 ? 'messages' : null);
		for (const character of this.trackingCharacters) {
			Assert(character.assignment?.type === 'space-tracking' || character.assignment?.type === 'space-joined');
			Assert(character.assignment.space === this);
			character.assignedClient?.sendConnectionStateUpdate();
		}

		this.logger.debug('Connected to shard', shard.id);
		ConnectionManagerClient.onSpaceListChange();

		return true;
	}

	@AsyncSynchronized('object')
	public async cleanupIfEmpty(): Promise<void> {
		// Check if there is any character that wants this space loaded
		for (const character of this.trackingCharacters) {
			if (character.isOnline())
				return;
		}

		// Disconnect the space from a shard
		const result = await this._setShard(null);
		Assert(result);
		// Clear pending action messages when the space gets disconnected
		this.pendingMessages.length = 0;
	}

	public readonly pendingMessages: ChatMessageDirectoryAction[] = [];
	private lastMessageTime: number = 0;

	private nextMessageTime(): number {
		let time = Date.now();
		// Make sure the time is unique
		if (time <= this.lastMessageTime) {
			time = this.lastMessageTime + 1;
		}
		return this.lastMessageTime = time;
	}

	public sendMessage(...messages: Omit<ChatMessageDirectoryAction, 'directoryTime'>[]): void {
		const processedMessages = messages.map((msg): ChatMessageDirectoryAction => ({
			directoryTime: this.nextMessageTime(),
			...msg,
		}));
		this.pendingMessages.push(...processedMessages);
		this._assignedShard?.update('messages').catch(() => { /* NOOP */ });
	}

	public updateActivityData(interval?: number, forceUpdate: boolean = false): void {
		this.syncActivityData(interval, forceUpdate)
			.catch((err) => {
				this.logger.error('Error syncing activity data:', err);
			});
	}

	public async syncActivityData(interval?: number, forceUpdate: boolean = false): Promise<void> {
		interval ??= SpaceActivityGetNextInterval(Date.now());

		let changed = false;
		// Make sure to keep this logic in sync with `PandoraDatabase::spaceMassUpdateActivityScores`!
		if (this._activity.currentIntervalEnd < interval) {
			this._activity.score *= SPACE_ACTIVITY_SCORE_DECAY;
			this._activity.currentIntervalScore = 0;
			this._activity.currentIntervalEnd = interval;
			changed = true;
		}

		const activeAccounts = new Set(Array.from(this.characters).filter((c) => c.isOnline()).map((c) => c.baseInfo.account.id)).size;
		if (activeAccounts > 0) {
			this._activity.lastActive = Date.now();
		}

		if (activeAccounts > this._activity.currentIntervalScore) {
			this._activity.score += (activeAccounts - this._activity.currentIntervalScore);
			this._activity.currentIntervalScore = activeAccounts;
			changed = true;
		}

		if (changed || forceUpdate) {
			await this._syncActivityData();
		}
	}

	@AsyncSynchronized('object')
	private async _syncActivityData(): Promise<void> {
		await GetDatabase().updateSpace(this.id, { activity: cloneDeep(this._activity) }, null);
	}

	/**
	 * Starts a space switch group
	 */
	@AsyncSynchronized('object')
	public async spaceSwitchStart(initiator: Character, invitedCharacterIds: CharacterId[], targetSpace: Space): IClientDirectoryPromiseResult['spaceSwitchStart'] {
		if (!this.characters.has(initiator))
			return { result: 'failed' };

		if (this._spaceSwitchStatus.some((s) => s.initiator === initiator.baseInfo.id)) {
			return { result: 'pendingSwitchExists' };
		}
		const invitedCharacters = Array.from(this.characters).filter((c) => c === initiator || invitedCharacterIds.includes(c.baseInfo.id));

		if (invitedCharacterIds.some((id) => !invitedCharacters.some((c) => c.baseInfo.id === id))) {
			return { result: 'notFound' };
		}

		// Check that we can switch to the target space
		if (targetSpace.checkAllowEnter(initiator, { ignoreCharacterLimit: true }) !== 'ok')
			return { result: 'noAccess', problematicCharacter: initiator.baseInfo.id };

		// Check that characters can join the target space, with or without invitation (this also handles invited character being banned)
		const canInvite = targetSpace.canCreateInvite(initiator, 'joinMe') === 'ok';
		const noAccessCharacter = invitedCharacters.find((c) => targetSpace.checkAllowEnter(c, { ignoreCharacterLimit: true, assumeValidInvite: canInvite }) !== 'ok');
		if (noAccessCharacter != null)
			return { result: 'noAccess', problematicCharacter: noAccessCharacter.baseInfo.id };

		// Check that we are allowed to move each character, otherwise reject altogether
		const switchStatus: SpaceSwitchStatus = {
			initiator: initiator.baseInfo.id,
			targetSpace: targetSpace.id,
			characters: {},
		};
		const shard = this.assignedShard;
		if (shard == null)
			return { result: 'failed' };

		let precheckError = false;

		try {
			await Promise.all(invitedCharacters.map(async (c) => {
				const result = await shard.shardConnection?.awaitResponse('spaceSwitchPermissionCheck', { actor: initiator.baseInfo.id, target: c.baseInfo.id });
				if (result == null || result.result === 'notFound') {
					// Fold notFound here, as we check it before already, so it is transient - re-run should result in proper notFound above.
					precheckError = true;
				} else if (result.result === 'ok') {
					switchStatus.characters[c.baseInfo.id] = {
						accepted: result.permission === 'accept' || result.permission === 'accept-enforce',
						permission: result.permission,
						restriction: null,
					};
				} else {
					AssertNever(result);
				}
			}));
		} catch (e) {
			this.logger.warning('Error checking space switch start character statuses:', e);
			return { result: 'failed' };
		}

		if (precheckError || invitedCharacters.some((c) => !Object.hasOwn(switchStatus.characters, c.baseInfo.id)))
			return { result: 'failed' };

		const notAllowedCharacter = KnownObject.entries(switchStatus.characters).find(([, s]) => s.permission === 'rejected');
		if (notAllowedCharacter != null)
			return { result: 'notAllowed', problematicCharacter: notAllowedCharacter[0] };

		this._spaceSwitchStatus.push(switchStatus);
		this._cleanupSpaceSwitchStatus();
		await this._assignedShard?.update('spaces');

		return { result: 'ok' };
	}

	/**
	 * Performs a command on space switch group
	 */
	@AsyncSynchronized('object')
	public async spaceSwitchCommand(character: Character, initiator: CharacterId, command: SpaceSwitchCommand): Promise<'ok' | 'failed' | 'notFound' | 'notAllowed' | 'restricted'> {
		if (!this.characters.has(character))
			return 'failed';

		const status = this._spaceSwitchStatus.find((s) => s.initiator === initiator);
		if (status == null || !Object.hasOwn(status.characters, character.baseInfo.id))
			return 'notFound';

		if (command.command === 'abort') {
			if (character.baseInfo.id !== status.initiator)
				return 'notAllowed';

			const index = this._spaceSwitchStatus.indexOf(status);
			Assert(index >= 0);
			this._spaceSwitchStatus.splice(index, 1);
			this._cleanupSpaceSwitchStatus();
			await this._assignedShard?.update('spaces');

			return 'ok';
		} else if (command.command === 'removeCharacter') {
			if (character.baseInfo.id !== status.initiator)
				return 'notAllowed';
			// Cannot remove initiator (use abort instead)
			if (command.character === status.initiator)
				return 'failed';

			delete status.characters[command.character];

			this._cleanupSpaceSwitchStatus();
			await this._assignedShard?.update('spaces');

			return 'ok';
		} else if (command.command === 'setAccepted') {
			// Cannot update initiator (use abort instead)
			if (character.baseInfo.id === status.initiator)
				return 'failed';

			const characterStatus = status.characters[character.baseInfo.id];
			if (characterStatus.permission == null)
				return 'failed'; // No data - transient failure
			if (characterStatus.permission === 'rejected')
				return 'ok'; // Silently fail if rejected
			if (characterStatus.permission === 'accept-enforce' && !command.accepted)
				return 'restricted'; // Cannot un-accepted if enforced

			characterStatus.accepted = command.accepted;
			this._cleanupSpaceSwitchStatus();
			await this._assignedShard?.update('spaces');

			return 'ok';
		} else if (command.command === 'reject') {
			// Cannot remove initiator (use abort instead)
			if (character.baseInfo.id === status.initiator)
				return 'failed';

			const characterStatus = status.characters[character.baseInfo.id];
			if (characterStatus.permission == null)
				return 'failed'; // No data - transient failure
			if (characterStatus.permission === 'accept-enforce')
				return 'restricted'; // Cannot reject if enforced

			delete status.characters[character.baseInfo.id];
			this._cleanupSpaceSwitchStatus();
			await this._assignedShard?.update('spaces');

			return 'ok';
		}

		AssertNever(command);
	}

	/**
	 * Actually do a prepared space switch
	 */
	@AsyncSynchronized('object')
	public async spaceSwitchGo(character: Character): Promise<SpaceSwitchCoordinator | 'notFound' | 'failed' | 'notReady'> {
		if (!this.characters.has(character))
			return 'failed';

		const status = this._spaceSwitchStatus.find((s) => s.initiator === character.baseInfo.id);
		if (status == null || !Object.hasOwn(status.characters, character.baseInfo.id))
			return 'notFound';

		// Check that everyone is ready
		if (Object.values(status.characters).some((c) => SpaceSwitchResolveCharacterStatusToClientStatus(c) !== 'ready'))
			return 'notReady';

		const characters = Array.from(this.characters).filter((c) => Object.hasOwn(status.characters, c.baseInfo.id));
		const initiator = characters.find((c) => c.baseInfo.id === status.initiator);

		if (initiator == null)
			return 'failed';

		const targetSpace = await SpaceManager.loadSpace(status.targetSpace);

		if (targetSpace == null)
			return 'notFound';

		return new SpaceSwitchCoordinator(characters, initiator, this, targetSpace);
	}

	/**
	 * Updates space switch group with data from shard
	 */
	@AsyncSynchronized('object')
	public async spaceSwitchShardUpdate(update: SpaceSwitchShardStatusUpdate): Promise<void> {
		const status = this._spaceSwitchStatus.find((s) => s.initiator === update.initiator);

		if (status != null) {
			for (const [characterId, characterUpdate] of KnownObject.entries(update.characters)) {
				if (Object.hasOwn(status.characters, characterId)) {
					const characterStatus = status.characters[characterId];
					characterStatus.permission = characterUpdate.permission;
					characterStatus.restriction = characterUpdate.restriction;

					// Set accept status if forced by permission
					if (characterStatus.permission === 'rejected') {
						characterStatus.accepted = false;
					} else if (characterStatus.permission === 'accept-enforce') {
						characterStatus.accepted = true;
					}
				}
			}
		}

		this._cleanupSpaceSwitchStatus();
		await this._assignedShard?.update('spaces');
	}

	private _cleanupSpaceSwitchStatus(): void {
		for (let i = this._spaceSwitchStatus.length - 1; i >= 0; i--) {
			const status = this._spaceSwitchStatus[i];
			const currentCharacters = Array.from(this.characters);

			const initiatorCharacter = currentCharacters.find((c) => c.baseInfo.id === status.initiator);
			if (initiatorCharacter == null ||
				!Object.hasOwn(status.characters, status.initiator) ||
				status.characters[status.initiator].permission !== 'accept-enforce'
			) {
				this._spaceSwitchStatus.splice(i, 1);
				continue;
			}
			for (const characterId of KnownObject.keys(status.characters)) {
				if (!currentCharacters.some((c) => c.baseInfo.id === characterId)) {
					delete status.characters[characterId];
				}
			}
		}
	}
}
