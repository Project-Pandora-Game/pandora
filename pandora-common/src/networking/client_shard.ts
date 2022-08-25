import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult, DefineSocketInterface } from './helpers';
import type { MessageHandler } from './message_handler';
import { CharacterDataCreateSchema, CharacterIdSchema, CharacterPublicSettingsSchema } from '../character';
import { AppearanceActionSchema } from '../assets';
import { ClientMessageSchema, ChatRoomStatusSchema } from '../chatroom/chat';
import { ChatRoomDirectoryConfigSchema } from '../chatroom/room';
import { z } from 'zod';

/** Client->Shard handlers */
export const ClientShardInSchema = z.object({
	finishCharacterCreation: CharacterDataCreateSchema,
	chatRoomMessage: z.object({
		messages: z.array(ClientMessageSchema),
		id: z.number().min(0),
		editId: z.number().min(0).optional(),
	}),
	chatRoomStatus: z.object({
		status: ChatRoomStatusSchema,
		target: CharacterIdSchema.optional(),
	}),
	chatRoomMessageAck: z.object({
		lastTime: z.number().min(0),
	}),
	chatRoomCharacterMove: z.object({
		id: CharacterIdSchema.optional(),
		position: ChatRoomDirectoryConfigSchema.shape.size,
	}),
	appearanceAction: AppearanceActionSchema,
	updateSettings: CharacterPublicSettingsSchema.partial(),
});

export type IClientShardIn = z.infer<typeof ClientShardInSchema>;

export type IClientShardOut = {
	finishCharacterCreation: { result: 'ok' | 'failed'; };
};

export type IClientShardBase = DefineSocketInterface<IClientShardIn, IClientShardOut>;
export type IClientShard = SocketInterface<IClientShardBase>;
export type IClientShardArgument = RecordOnly<SocketInterfaceArgs<IClientShardBase>>;
export type IClientShardUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<IClientShardBase>;
export type IClientShardResult = SocketInterfaceResult<IClientShardBase>;
export type IClientShardPromiseResult = SocketInterfacePromiseResult<IClientShardBase>;
export type IClientShardNormalResult = SocketInterfaceNormalResult<IClientShardBase>;
export type IClientShardResponseHandler = SocketInterfaceResponseHandler<IClientShardBase>;
export type IClientShardOneshotHandler = SocketInterfaceOneshotHandler<IClientShardBase>;
export type IClientShardMessageHandler<Context> = MessageHandler<IClientShardBase, Context>;
