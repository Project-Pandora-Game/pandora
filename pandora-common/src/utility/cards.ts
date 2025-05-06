import { z } from 'zod';
import type { CharacterId } from '../character/characterTypes.ts';

// Define Suits and Ranks
const suits = [
	'\u2661', //hearts
	'\u2662', //diamonds
	'\u2667', //clubs
	'\u2664', //spades
] as const;
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

// Define CardGameCard class
export class CardGameCard {
	public readonly suit: string;
	public readonly rank: string;

	public toString() {
		return `${this.rank}${this.suit}`;
	}

	constructor(s?: string, r?: string) {
		this.suit = s ? s : '\u2665';
		this.rank = r ? r : '2';
	}
}

class CardArray extends Array<CardGameCard> {
	public override toString(): string {
		return `[ ${this.map((card) => card.toString()).join(', ')} ]`;
	}
}

// A deck of cards

class CardDeck {
	private deck: CardArray = [];

	private addCard(c: CardGameCard) {
		this.deck.push(c);
	}

	private shuffle() {
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}

	public create() {
		for (const suit of suits) {
			for (const rank of ranks) {
				this.addCard(new CardGameCard(suit, rank));
			}
		}
		this.shuffle();
	}

	public deal() {
		return this.deck.length > 0 ? this.deck.pop() : undefined;
	}

	constructor(cards?: CardGameCard[]) {
		if (cards) {
			for (const card of cards)
				this.addCard(card);
		}
	}
}

class CardPlayer {
	private id: CharacterId;
	private hand: CardArray = [];

	public getId() {
		return this.id;
	}

	public receiveCard(c: CardGameCard) {
		this.hand.push(c);
	}

	public showHand() {
		return this.hand.toString();
	}

	constructor(id: CharacterId) {
		this.id = id;
	}
}

export class CardGameGame {
	private deck: CardDeck;
	private dealer: CharacterId;
	private spaceHand: CardArray;
	private players: CardPlayer[];

	public joinGame(c: CharacterId) {
		if (!this.players.some((p) => p.getId() === c)) {
			this.players.push(new CardPlayer(c));
			return true;
		} else {
			return false;
		}
	}

	public dealTo(c?: CharacterId) {
		//Deal a card either to the room or to a player
		if (c) {
			const player = this.players.find((p) => p.getId() === c);
			if (player) {
				const card = this.deck.deal();
				if (card)
					player.receiveCard(card);
				return card;
			} else {
				return null;
			}
		} else {
			const card = this.deck.deal();
			if (card)
				this.spaceHand.push(card);
			return card;
		}
	}

	public getPlayerHand(c: CharacterId) {
		const player = this.players.find((p) => p.getId() === c);
		if (player) {
			return player.showHand();
		} else {
			return 'Nothing';
		}
	}

	public getPlayerIds() {
		return this.players.map((p) => p.getId());
	}

	public getSpaceHand() {
		return this.spaceHand.toString();
	}

	public isDealer(p: CharacterId) {
		return p === this.dealer;
	}

	public getDealerId() {
		return this.dealer;
	}

	constructor(creator: CharacterId, d?: CardDeck) {
		this.players = [];
		this.spaceHand = [];
		if (!d) {
			this.deck = new CardDeck();
			this.deck.create();
		} else {
			this.deck = d;
		}
		this.dealer = creator;
		this.players.push(new CardPlayer(this.dealer)); // No need to check, as we know the list of players is empty
	}
}

// Zod stuff

// Define allowed values
const SuitSchema = z.enum(suits);
const RankSchema = z.enum(ranks);

// Validate a plain object and then create a class instance
export const CardGameCardSchema = z.object({
	suit: SuitSchema,
	rank: RankSchema,
}).transform((data) => new CardGameCard(data.suit, data.rank));

/*
export const CardGameCardDeckSchema = z.array(CardGameCardSchema).transform((cards) => {
	const deck = new CardDeck(cards);
	return deck;
});
*/
