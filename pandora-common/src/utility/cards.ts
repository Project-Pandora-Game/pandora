import { z } from 'zod';
import type { CharacterId } from '../character/characterTypes.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ShuffleArray } from './misc.ts';

// Define Suits and Ranks
const suits = [
	'\u2661', //hearts
	'\u2662', //diamonds
	'\u2667', //clubs
	'\u2664', //spades
] as const;
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

// Define allowed values
const SuitSchema = z.enum(suits);
const RankSchema = z.enum(ranks);

// Type definitions
type CardGameSuit = z.infer<typeof SuitSchema>;
type CardGameRank = z.infer<typeof RankSchema>;
type CardArray = CardGameCard[];

// Define CardGameCard class
export class CardGameCard {
	public readonly suit: CardGameSuit;
	public readonly rank: CardGameRank;
	private faceDown: boolean;

	public toString() {
		return `${this.rank}${this.suit}`;
	}

	public reveal() {
		this.faceDown = false;
	}

	public isRevieled() {
		return !this.faceDown;
	}

	constructor(s: CardGameSuit = '\u2661', r: CardGameRank = '2') {
		this.suit = s;
		this.rank = r;
		this.faceDown = true;
	}
}

// Helper functions
function CardArraysToString(...cardGroups: CardArray[]) {
	const cards = cardGroups.flat();
	return cards.length === 0 ? 'nothing' : cards.map((c) => c.toString()).join(', ');
}

// A deck of cards
class CardDeck {
	private deck: CardArray = [];

	private addCard(c: CardGameCard) {
		this.deck.push(c);
	}

	private shuffle() {
		ShuffleArray(this.deck);
	}

	public get cardsLeft() {
		return this.deck.length;
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

// The gambler
class CardPlayer {
	private id: CharacterId;
	private hand: CardArray = [];

	public getId() {
		return this.id;
	}

	public receiveCard(c: CardGameCard, open: boolean = false) {
		if (open) c.reveal();
		this.hand.push(c);
	}

	public getCards(revealed: boolean) {
		const cards = revealed ? this.hand.filter((c) => c.isRevieled()) : this.hand.filter((c) => !c.isRevieled());
		return cards;
	}

	public showHand() {
		this.hand.forEach((c) => c.reveal());
		return CardArraysToString(this.hand);
	}

	constructor(id: CharacterId) {
		this.id = id;
	}
}

// The actual game
export class CardGameGame {
	private deck: CardDeck;
	private dealer: CharacterId;
	private spaceHand: CardArray;
	private players: CardPlayer[];
	private public: boolean;

	public joinGame(c: CharacterId) {
		if (!this.players.some((p) => p.getId() === c)) {
			this.players.push(new CardPlayer(c));
			return true;
		} else {
			return false;
		}
	}

	public leaveGame(c: CharacterId) {
		this.players = this.players.filter((p) => p.getId() !== c);
	}

	public dealTo(n: number, c?: CharacterId, open: boolean = false): CardArray | null {
		if (n > this.deck.cardsLeft) return null;
		//Deal a card either to the room or to a player
		const cards: CardArray = [];
		for (let i = 0; i < n; i++) {
			const card = this.deck.deal();
			if (!card) break; //Cannot happen because of prior check
			cards.push(card);
		}
		if (c) {
			const player = this.players.find((p) => p.getId() === c);
			if (!player) return null;

			cards.forEach((ca) => player.receiveCard(ca, open));
		} else {
			this.spaceHand.push(...cards);
		}
		return cards;
	}

	public revealHand(c: CharacterId) {
		this.players.find((p) => p.getId() === c)?.showHand();
	}

	public checkPlayer(c: CharacterId) {
		return this.players.find((p) => p.getId() === c);
	}

	public getPlayerHand(c: CharacterId, revealedOnly: boolean) {
		const player = this.players.find((p) => p.getId() === c);
		if (!player)
			return 'Nothing';
		return revealedOnly
			? CardArraysToString(player.getCards(true))
			: CardArraysToString(player.getCards(true), player.getCards(false));
	}

	public getPlayerIds() {
		return this.players.map((p) => p.getId());
	}

	public getSpaceHand() {
		return CardArraysToString(this.spaceHand);
	}

	public isDealer(p: CharacterId) {
		return p === this.dealer;
	}

	public getDealerId() {
		return this.dealer;
	}

	public isPublic() {
		return this.public;
	}

	constructor(creator: CharacterId, p: boolean, d?: CardDeck) {
		this.players = [];
		this.spaceHand = [];
		this.public = p;
		if (!d) {
			this.deck = new CardDeck();
			this.deck.create();
		} else {
			this.deck = d;
		}
		this.dealer = creator;
		this.players = [new CardPlayer(this.dealer)];
	}
}

// The commands for the CardGame

export const CardGameActionSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('create'),
		public: z.boolean(),
	}),
	z.object({
		action: z.literal('stop'),
	}),
	z.object({
		action: z.literal('join'),
	}),
	z.object({
		action: z.literal('dealTable'),
		number: z.number().optional().default(1),
	}),
	z.object({
		action: z.literal('dealOpenly'),
		targetId: CharacterIdSchema,
		number: z.number().optional().default(1),
	}),
	z.object({
		action: z.literal('deal'),
		targetId: CharacterIdSchema,
		number: z.number().optional().default(1),
	}),
	z.object({
		action: z.literal('check'),
	}),
	z.object({
		action: z.literal('reveal'),
	}),
	z.object({
		action: z.literal('show'),
	}),
]);

// Validate a plain object and then create a class instance
export const CardGameCardSchema = z.object({
	suit: SuitSchema,
	rank: RankSchema,
}).transform((data) => new CardGameCard(data.suit, data.rank));
