import { z } from 'zod';

// Define Suits and Ranks
const suits = [
	'\u2661', //hearts
	'\u2662', //diamonds
	'\u2667', //clubs
	'\u2664', //spades
];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Define Card Type
export class Card {
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

export class CardArray extends Array<Card> {
	public override toString(): string {
		return `[ ${this.map((card) => card.toString()).join(', ')} ]`;
	}
}

// Define allowed values
const SuitSchema = z.enum(['u2665', 'u2666', 'u2663', 'u2660']);
const RankSchema = z.enum(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);

// Validate a plain object and then create a class instance
export const CardSchema = z.object({
	suit: SuitSchema,
	rank: RankSchema,
}).transform((data) => new Card(data.suit, data.rank));

export class CardDeck {
	private deck: Card[] = [];

	private addCard(c: Card) {
		this.deck.push(c);
	}

	public create() {
		for (const suit of suits) {
			for (const rank of ranks) {
				this.addCard(new Card(suit, rank));
			}
		}
		// Shuffle
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}

	public deal() {
		return this.deck.length > 0 ? this.deck.pop() : null;
	}

	constructor(cards?: Card[]) {
		if (cards) {
			for (const card of cards)
				this.addCard(card);
		}
	}
}

export const CardDeckSchema = z.array(CardSchema).transform((cards) => {
	const deck = new CardDeck(cards);
	return deck;
});
