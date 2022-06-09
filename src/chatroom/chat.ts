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

export type IChatroomMessageChat = IClientMessage & {
	from: CharacterId;
};

export type IChatroomMessageAction = {
	type: 'action' | 'serverMessage';
	/** id to be looked up in message translation database */
	id: ChatActionId;
	data?: {
		/** Used to generate specific dictionary entries, acts as source */
		character?: CharacterId;
		/** Used to generate specific dictionary entries, defaults to `character` */
		targetCharacter?: CharacterId;
	};
	dictionary?: Record<string, string>;
};

export type IChatRoomMessageBase = IChatroomMessageChat | IChatroomMessageAction;
export type IChatRoomMessage = IChatRoomMessageBase & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatroomMessageDirectoryAction = IChatroomMessageAction & {
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: number;
};
