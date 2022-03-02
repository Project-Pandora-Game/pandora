import { IShardDirectoryMessageHandler, IShardDirectoryBase, MessageHandler, IShardDirectoryPromiseResult, IShardDirectoryUnconfirmedArgument, IShardDirectoryNormalResult, IsString, IsCharacterId, BadMessageError } from 'pandora-common';
import { Shard as Validation } from 'pandora-common/dist/networking/validation/directory';
import type { IConnectionShard } from './common';
import { GetDatabase } from '../database/databaseProvider';
import { accountManager } from '../account/accountManager';

export default new class ConnectionManagerShard {
	private readonly _shards: Map<string, IConnectionShard> = new Map();
	readonly messageHandler: IShardDirectoryMessageHandler<IConnectionShard>;

	constructor() {
		this.messageHandler = new MessageHandler<IShardDirectoryBase, IConnectionShard>({
			getCharacter: this.handleGetCharacter.bind(this),
			setCharacter: this.handleSetCharacter.bind(this),
			sendInfo: this.handleSendInfo.bind(this),
			createCharacter: this.createCharacter.bind(this),
		}, {
			characterDisconnected: this.handleCharacterDisconnected.bind(this),
		});
	}

	public getShard(id: string): IConnectionShard | null {
		return this._shards.get(id) || null;
	}

	public getRandomShard(): IConnectionShard | null {
		if (this._shards.size === 0)
			return null;

		const shards = [...this._shards.values()];
		return shards[Math.floor(Math.random() * shards.length)];
	}

	public onDisconnect(shard: IConnectionShard): void {
		this._shards.delete(shard.id);
	}

	private async handleSendInfo(args: IShardDirectoryUnconfirmedArgument['sendInfo'], shard: IConnectionShard): IShardDirectoryPromiseResult['sendInfo'] {
		if (!Validation.sendInfo(args))
			throw new BadMessageError();

		const known = this._shards.has(shard.id);

		const { invalidate } = await shard.updateInfo(args, !known);
		this._shards.set(shard.id, shard);

		return ({
			shardId: shard.id,
			invalidate,
		});
	}

	private handleCharacterDisconnected({ id }: IShardDirectoryUnconfirmedArgument['characterDisconnected'], shard: IConnectionShard): IShardDirectoryPromiseResult['characterDisconnected'] {
		if (!IsCharacterId(id) || !shard.characters.has(id))
			throw new BadMessageError();

		shard.removeCharacter(id);

		return Promise.resolve();
	}

	private async createCharacter({ id }: IShardDirectoryUnconfirmedArgument['createCharacter'], shard: IConnectionShard): IShardDirectoryPromiseResult['createCharacter'] {
		const accountId = IsCharacterId(id) && shard.characters.get(id);
		if (!accountId)
			throw new BadMessageError();

		const account = await accountManager.loadAccountById(accountId);
		if (!account)
			throw new BadMessageError();

		const char = await account.finishCharacterCreation(id);
		if (!char)
			throw new BadMessageError();

		return char;
	}

	private async handleGetCharacter({ id, accessId }: IShardDirectoryUnconfirmedArgument['getCharacter'], shard: IConnectionShard): IShardDirectoryPromiseResult['getCharacter'] {
		if (!IsCharacterId(id) || !IsString(accessId) || !shard.characters.has(id))
			throw new BadMessageError();

		return await GetDatabase().getCharacter(id, accessId) as IShardDirectoryNormalResult['getCharacter'];
	}

	private async handleSetCharacter(args: IShardDirectoryUnconfirmedArgument['setCharacter'], shard: IConnectionShard): IShardDirectoryPromiseResult['setCharacter'] {
		if (!Validation.setCharacter(args) || CheckSetCharacterKeys(args) || !shard.characters.has(args.id))
			throw new BadMessageError();

		if (Object.keys(args).length > 2 && !await GetDatabase().setCharacter(args))
			return { result: 'invalidAccessId' };

		return { result: 'success' };
	}
};

const CheckSetCharacterKeys = (obj: Record<string, unknown>) => !['inCreation', 'accountId', 'created'].some((key) => key in obj);
