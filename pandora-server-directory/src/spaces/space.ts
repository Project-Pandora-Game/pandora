import { clamp, cloneDeep, pick, uniq } from 'lodash-es';
import { nanoid } from 'nanoid';
import { AccountId, Assert, AssertNever, AsyncSynchronized, CharacterId, ChatActionId, GetLogger, IChatMessageDirectoryAction, IClientDirectoryArgument, LIMIT_JOIN_ME_INVITES, LIMIT_SPACE_BOUND_INVITES, LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS, Logger, SpaceBaseInfo, SpaceDirectoryConfig, SpaceId, SpaceInvite, SpaceInviteCreate, SpaceInviteId, SpaceLeaveReason, SpaceListExtendedInfo, SpaceListInfo, TimeSpanMs, type IShardDirectoryArgument } from 'pandora-common';
import { Account } from '../account/account.ts';
import { Character, CharacterInfo } from '../account/character.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import { Shard } from '../shard/shard.ts';
import { ShardManager } from '../shard/shardManager.ts';

export class Space {
	/** Time when this space was last requested */
	public lastActivity: number = Date.now();

	public readonly id: SpaceId;
	private readonly config: SpaceDirectoryConfig;
	private readonly _owners: Set<AccountId>;
	private _invites: SpaceInvite[];
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

	public get owners(): ReadonlySet<AccountId> {
		return this._owners;
	}

	public get isPublic(): boolean {
		if (this._assignedShard?.type !== 'stable')
			return false;

		switch (this.config.public) {
			case 'locked':
			case 'private':
				return false;
			case 'public-with-admin':
				return this.hasAdminInside(true);
			case 'public-with-anyone':
				return Array.from(this.characters).some((c) => c.isOnline());
		}
		AssertNever(this.config.public);
	}

	private readonly logger: Logger;

	constructor(id: SpaceId, config: SpaceDirectoryConfig, owners: AccountId[], accessId: string, invites: SpaceInvite[]) {
		this.id = id;
		this.config = config;
		this._owners = new Set(owners);
		this._invites = invites;
		this.accessId = accessId;
		this.logger = GetLogger('Space', `[Space ${this.id}]`);

		// Make sure things that should are unique
		this.config.features = uniq(this.config.features);
		this.config.admin = uniq(this.config.admin);
		this.config.banned = this._cleanupBanList(uniq(this.config.banned));
		this.config.allow = this._cleanupAllowList(uniq(this.config.allow));

		this.logger.debug('Loaded');
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
			entryText: this.config.entryText,
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
			await this._assignedShard?.update('spaces');
			// TODO: Make an announcement of the change

			await GetDatabase().updateSpace(this.id, { owners: Array.from(this._owners) }, null);

			ConnectionManagerClient.onSpaceListChange();
		}
		return 'ok';
	}

	@AsyncSynchronized('object')
	public async update(changes: Partial<SpaceDirectoryConfig>, source: CharacterInfo | null): Promise<'ok'> {
		// Ignore if space is invalidated
		if (!this.isValid) {
			return 'ok';
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
			this.config.banned = this._cleanupBanList(uniq(changes.banned));
			await this._removeBannedCharacters(source);
		}
		if (changes.allow) {
			this.config.allow = this._cleanupAllowList(uniq(changes.allow));
		}
		if (changes.public !== undefined) {
			this.config.public = changes.public;
		}
		if (changes.ghostManagement !== undefined) {
			this.config.ghostManagement = cloneDeep(changes.ghostManagement);
		}

		// Features and development fields are intentionally ignored

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

			this._sendUpdatedMessage(source, ...changeList);
		}

		await Promise.all([
			this._assignedShard?.update('spaces'),
			GetDatabase().updateSpace(this.id, { config: cloneDeep(this.config) }, null),
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
	public async adminAction(source: CharacterInfo, action: IClientDirectoryArgument['spaceAdminAction']['action'], targets: number[]): Promise<void> {
		// Ignore if the space is invalidated
		if (!this.isValid) {
			return;
		}
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
		// Ignore those - the requests will fail and once the space is not requestest for a bit, it will be unloaded from the directory too, actually vanishing
	}

	public checkAllowEnter(character: Character, inviteId?: SpaceInviteId, ignore: { characterLimit?: boolean; } = {}): 'ok' | 'spaceFull' | 'noAccess' | 'invalidInvite' {
		// No-one can enter if the space is in an invalid state
		if (!this.isValid) {
			return 'spaceFull';
		}

		// If you are already in this space, then you have rights to enter it
		if (character.space === this)
			return 'ok';

		// If the space is full, you cannot enter it (some checks ignore space being full)
		if (!ignore.characterLimit) {
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
		if (inviteId != null) {
			const invite = this._getValidInvite(character, inviteId);
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

	@AsyncSynchronized('object')
	public async createInvite(source: Character, data: SpaceInviteCreate): Promise<SpaceInvite | 'tooManyInvites' | 'invalidData' | 'requireAdmin'> {
		this._cleanupInvites();

		const now = Date.now();
		const account = source.baseInfo.account;

		switch (data.type) {
			case 'joinMe': {
				if (data.accountId == null)
					return 'invalidData';

				let dropCount = this._invites.filter((i) => i.type === 'joinMe' && i.createdBy.accountId === account.id).length - LIMIT_JOIN_ME_INVITES + 1;
				if (dropCount > 0)
					this._invites = this._invites.filter((i) => i.type !== 'joinMe' || i.createdBy.accountId !== account.id || dropCount-- <= 0);

				data.maxUses = 1;
				data.expires = clamp(data.expires ?? Infinity, now + TimeSpanMs(10, 'minutes'), now + TimeSpanMs(2, 'hours'));
				break;
			}
			case 'spaceBound':
				if (!this.isAdmin(account))
					return 'requireAdmin';
				if (this._invites.filter((i) => i.type === 'spaceBound').length >= LIMIT_SPACE_BOUND_INVITES)
					return 'tooManyInvites';

				if (data.expires)
					data.expires = Math.max(data.expires, now + TimeSpanMs(10, 'minutes'));

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

	/** Returns if this space is visible to the specific account when searching in space search */
	public checkVisibleTo(account: Account): boolean {
		return this.isValid && (this.isPublic || this.isAllowed(account));
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
	public async addCharacter(character: Character, invite?: SpaceInviteId): Promise<void> {
		// Ignore if space is invalidated
		if (!this.isValid) {
			return;
		}

		Assert(character.assignment?.type === 'space-tracking' && character.assignment.space === this);
		Assert(this.trackingCharacters.has(character));
		Assert(!this.characters.has(character));

		if (this.isBanned(character.baseInfo.account)) {
			this.logger.warning(`Refusing to add banned character id ${character.baseInfo.id}`);
			return;
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
			},
		});

		// send entry text, if there is any
		// TODO: Must be changed later to send room and not space specific entry texts
		if (this.config.entryText) {
			this.sendMessage({
				type: 'action',
				sendTo: [character.baseInfo.id],
				id: 'custom',
				customText: this.config.entryText,
			});
		}

		ConnectionManagerClient.onSpaceListChange();
		await Promise.all([
			this._assignedShard?.update('characters'),
			character.baseInfo.updateDirectoryData({ currentSpace: this.id }),
			this._useInvite(character, invite),
		]);
	}

	private async _useInvite(character: Character, id?: SpaceInviteId): Promise<void> {
		const invite = id ? this._getValidInvite(character, id) : undefined;
		if (!invite)
			return;

		invite.uses++;

		this._cleanupInvites();
		await GetDatabase().updateSpace(this.id, { invites: cloneDeep(this._invites) }, null);
	}

	@AsyncSynchronized('object')
	public async removeCharacter(character: Character, reason: SpaceLeaveReason, source: CharacterInfo | null): Promise<void> {
		return await this._removeCharacter(character, reason, source);
	}

	private async _removeCharacter(character: Character, reason: SpaceLeaveReason, source: CharacterInfo | null): Promise<void> {
		// Ignore if the character has already been removed
		if (!this.characters.has(character))
			return;

		Assert(character.assignment?.type === 'space-joined' && character.assignment.space === this);
		Assert(this.trackingCharacters.has(character));

		await character.baseInfo.updateDirectoryData({ currentSpace: null });

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
					character: source?.id ?? character.baseInfo.id,
				},
			});
		}

		await this._assignedShard?.update('characters');
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
		await shard.update('spaces', 'characters');
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

	public readonly pendingMessages: IChatMessageDirectoryAction[] = [];
	private lastMessageTime: number = 0;

	private nextMessageTime(): number {
		let time = Date.now();
		// Make sure the time is unique
		if (time <= this.lastMessageTime) {
			time = this.lastMessageTime + 1;
		}
		return this.lastMessageTime = time;
	}

	public sendMessage(...messages: Omit<IChatMessageDirectoryAction, 'directoryTime'>[]): void {
		const processedMessages = messages.map<IChatMessageDirectoryAction>(
			(msg) => ({
				directoryTime: this.nextMessageTime(),
				...msg,
			}),
		);
		this.pendingMessages.push(...processedMessages);
		this._assignedShard?.update('messages').catch(() => { /* NOOP */ });
	}
}
