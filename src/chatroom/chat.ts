import { CharacterId, IsCharacterId } from '../character';
import { CreateArrayValidator, CreateMaybeValidator, CreateObjectValidator, CreateOneOfValidator, CreateTupleValidator, CreateUnionValidator, IsString } from '../validation';
import { ChatActionId } from './chatActions';

export type IChatPart = [
	'contents',
	string,
];

export const IsIChatPart = CreateTupleValidator<IChatPart>(
	CreateOneOfValidator('contents'),
	IsString,
);

export type IClientMessageChat = {
	type: 'chat';
	parts: IChatPart[];
	/** Presence of to makes message a whisper */
	to?: CharacterId;
};

export const IsIClientMessageChat = CreateObjectValidator<IClientMessageChat>({
	type: CreateOneOfValidator('chat'),
	parts: CreateArrayValidator<IChatPart>({ validator: IsIChatPart }),
	to: CreateMaybeValidator(IsCharacterId),
});

export type IEmotePart = [
	'contents',
	string,
];

export const IsIEmotePart = CreateTupleValidator<IEmotePart>(
	CreateOneOfValidator('contents'),
	IsString,
);

export type IClientMessageEmote = {
	type: 'emote' | 'me';
	parts: IEmotePart[];
};

export const IsIClientMessageEmote = CreateObjectValidator<IClientMessageEmote>({
	type: CreateOneOfValidator('emote', 'me'),
	parts: CreateArrayValidator<IEmotePart>({ validator: IsIEmotePart }),
});

export type IClientMessage = IClientMessageChat | IClientMessageEmote;

export const IsIClientMessage = CreateUnionValidator<IClientMessage>(IsIClientMessageChat, IsIClientMessageEmote);
export const IsIClientMessageArray = CreateArrayValidator<IClientMessage>({ validator: IsIClientMessage });

export type IChatroomMessageChat = IClientMessageChat & {
	from: CharacterId;
};

export type IChatroomMessageEmote = IClientMessageEmote & {
	from: CharacterId;
};

export type IChatroomMessageAction = {
	type: 'action';
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

export type IChatRoomMessageBase = IChatroomMessageChat | IChatroomMessageEmote | IChatroomMessageAction;
export type IChatRoomMessage = IChatRoomMessageBase & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};
