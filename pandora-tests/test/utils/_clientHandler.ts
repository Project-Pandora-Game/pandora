import type { Page } from '@playwright/test';
import { ScreenHandlerAuth } from './screen_interactions/auth.ts';
import { ScreenHandlerCharacterSelect } from './screen_interactions/characterSelect.ts';
import { ScreenHandlerEula } from './screen_interactions/eula.ts';
import { ScreenHandlerRoom } from './screen_interactions/room.ts';
import { ScreenHandlerRoomChat } from './screen_interactions/roomChat.ts';
import { ScreenHandlerToasts } from './screen_interactions/toasts.ts';
import { ScreenHandlerTutorial } from './screen_interactions/tutorial.ts';

export class ClientHandler {
	public readonly page: Page;

	public get eula(): ScreenHandlerEula {
		return new ScreenHandlerEula(this.page, this);
	}

	public get auth(): ScreenHandlerAuth {
		return new ScreenHandlerAuth(this.page, this);
	}

	public get toasts(): ScreenHandlerToasts {
		return new ScreenHandlerToasts(this.page, this);
	}

	public get tutorial(): ScreenHandlerTutorial {
		return new ScreenHandlerTutorial(this.page, this);
	}

	public get characterSelect(): ScreenHandlerCharacterSelect {
		return new ScreenHandlerCharacterSelect(this.page, this);
	}

	public get room(): ScreenHandlerRoom {
		return new ScreenHandlerRoom(this.page, this);
	}

	public get roomChat(): ScreenHandlerRoomChat {
		return new ScreenHandlerRoomChat(this.page, this);
	}

	constructor(page: Page) {
		this.page = page;
	}
}

const ClientHandlerCache = new WeakMap<Page, ClientHandler>();

export function GetClientHandler(page: Page): ClientHandler {
	let handler: ClientHandler | undefined = ClientHandlerCache.get(page);
	if (handler === undefined) {
		handler = new ClientHandler(page);
		ClientHandlerCache.set(page, handler);
	}

	return handler;
}
