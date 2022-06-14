import { CharacterId, IsCharacterId } from '../character';
import { CreateArrayValidator, CreateMaybeValidator, CreateObjectValidator, CreateOneOfValidator, CreateTupleValidator, CreateUnionValidator, IsString } from '../validation';
import { ChatActionId } from './chatActions';

export type IChatModifier = 'normal' | 'bold' | 'italic';

export const IsChatModifier = CreateOneOfValidator<IChatModifier>('normal', 'bold', 'italic');

export type IChatSegment = [IChatModifier, string];

export const IsChatSegment = CreateTupleValidator<IChatSegment>(IsChatModifier, IsString);

export type IChatType = 'chat' | 'me' | 'emote' | 'ooc';

export type IClientMessage = {
	type: 'me' | 'emote';
	parts: IChatSegment[];
} | {
	type: 'chat' | 'ooc';
	parts: IChatSegment[];
	to?: CharacterId;
};

export const IsIClientMessage = CreateUnionValidator<IClientMessage>(
	CreateObjectValidator({
		type: CreateOneOfValidator('me', 'emote'),
		parts: CreateArrayValidator({ validator: IsChatSegment }),
	}),
	CreateObjectValidator({
		type: CreateOneOfValidator('ooc', 'chat'),
		parts: CreateArrayValidator({ validator: IsChatSegment }),
		to: CreateMaybeValidator(IsCharacterId),
	}),
);

export const IsIClientMessageArray = CreateArrayValidator<IClientMessage>({ validator: IsIClientMessage });

export type IChatRoomMessageChatCharacter = { id: CharacterId, name: string; labelColor: string; };
export type IChatRoomMessageChat = Omit<IClientMessage, 'from' | 'to'> & {
	id: number;
	insertId?: number;
} & ({
	type: 'me' | 'emote';
	from: IChatRoomMessageChatCharacter;
} | {
	type: 'chat' | 'ooc';
	from: IChatRoomMessageChatCharacter;
	to?: IChatRoomMessageChatCharacter;
});

export type IChatRoomMessageDeleted = {
	type: 'deleted';
	id: number;
	from: CharacterId;
};

export type IChatRoomMessageActionCharacter = { id: CharacterId, name: string; pronoun: string; };
export type IChatRoomMessageAction = {
	type: 'action' | 'serverMessage';
	/** id to be looked up in message translation database */
	id: ChatActionId;
	data?: {
		/** Used to generate specific dictionary entries, acts as source */
		character?: IChatRoomMessageActionCharacter;
		/** Used to generate specific dictionary entries, defaults to `character` */
		targetCharacter?: IChatRoomMessageActionCharacter;
	};
	dictionary?: Record<string, string>;
};

export type IChatRoomMessageBase = IChatRoomMessageChat | IChatRoomMessageAction | IChatRoomMessageDeleted;
export type IChatRoomMessage = IChatRoomMessageBase & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatRoomMessageDirectoryAction = Omit<IChatRoomMessageAction, 'data'> & {
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: number;
	data?: {
		character?: CharacterId;
		targetCharacter?: CharacterId;
	};
};

export type IChatRoomStatus = 'none' | 'typing' | 'whisper' | 'afk';

export const IsChatRoomStatus = CreateOneOfValidator<IChatRoomStatus>('none', 'typing', 'whisper', 'afk');
