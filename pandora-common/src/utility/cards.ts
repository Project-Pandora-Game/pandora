import { z } from 'zod';
import type { CharacterId } from '../character/characterTypes.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ShuffleArray, Assert } from './misc.ts';

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
		// Change the state of a card, so that it is listed as "revealed"
		this.faceDown = false;
	}

	public isReveiled() {
		// Return the state of a card
		return !this.faceDown;
	}

	constructor(s: CardGameSuit, r: CardGameRank) {
		this.suit = s;
		this.rank = r;
		this.faceDown = true;
	}
}

// Helper functions
export function CardArraysToString(...cardGroups: CardArray[]) {
	//Creates a string out of given card arrays
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
		// How many cards are left in the deck
		return this.deck.length;
	}

	public create() {
		// Cretae a new shuffled deck of cards
		for (const suit of suits) {
			for (const rank of ranks) {
				this.addCard(new CardGameCard(suit, rank));
			}
		}
		this.shuffle();
	}

	public deal() {
		// Returns the next card from the top of the deck
		return this.deck.length > 0 ? this.deck.pop() : undefined;
	}

	constructor(cards?: CardGameCard[]) {
		// Parameter used solely for debugging puposes
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
		// Returns the player's id
		return this.id;
	}

	public receiveCard(c: CardGameCard, open: boolean = false) {
		// Store a card that is dealt either face up or face down
		if (open) c.reveal();
		this.hand.push(c);
	}

	public getCards(revealed: boolean) {
		// Returns an array of cards. Either all reveiled or all hidden cards
		const cards = revealed ? this.hand.filter((c) => c.isReveiled()) : this.hand.filter((c) => !c.isReveiled());
		return cards;
	}

	public showHand() {
		// Returns an array of all cards the player currently holds and sets their status to 'reveiled'
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
		// Add a player to the game, if they didn't join already
		if (!this.players.some((p) => p.getId() === c)) {
			this.players.push(new CardPlayer(c));
			return true;
		} else {
			return false;
		}
	}

	public leaveGame(c: CharacterId) {
		// Remove a player from the list of players
		this.players = this.players.filter((p) => p.getId() !== c);
	}

	public dealTo(n: number, c?: CharacterId, open: boolean = false): CardArray | null {
		// Deal a number of cards, either to a player or to the current space (c == null)
		// A card can be dealt either open or face down

		if (n > this.deck.cardsLeft) return null;
		//Deal a card either to the room or to a player
		const cards: CardArray = [];
		for (let i = 0; i < n; i++) {
			const card = this.deck.deal();
			Assert(card);
			cards.push(card);
		}
		if (c) {
			// Deal cards to player
			const player = this.players.find((p) => p.getId() === c);
			if (!player) return null;

			cards.forEach((ca) => player.receiveCard(ca, open));
		} else {
			this.spaceHand.push(...cards);
		}
		return cards;
	}

	public revealHand(c: CharacterId) {
		// Make a player show their current cards
		this.players.find((p) => p.getId() === c)?.showHand();
	}

	public isPlayer(c: CharacterId) {
		// Check, if the given player is part of the game
		return this.players.find((p) => p.getId() === c);
	}

	public getPlayerHand(c: CharacterId, revealedOnly: boolean) {
		// Get the cards, a player is holding. Either all cards or only those
		// that have been revealed previously
		const player = this.players.find((p) => p.getId() === c);
		if (!player)
			return 'Nothing';
		return revealedOnly
			? CardArraysToString(player.getCards(true))
			: CardArraysToString(player.getCards(true), player.getCards(false));
	}

	public getPlayerIds() {
		// Returns a list of all current players
		return this.players.map((p) => p.getId());
	}

	public getSpaceHand() {
		// Returns the cards that are on the table
		return CardArraysToString(this.spaceHand);
	}

	public isDealer(p: CharacterId) {
		// Checks, if the current player is the game's dealer
		return p === this.dealer;
	}

	public getDealerId() {
		// Get the game's dealer ID
		return this.dealer;
	}

	public isPublic() {
		// True, if it's a public game
		return this.public;
	}

	constructor(dealer: CharacterId, p: boolean, d?: CardDeck) {
		// Creates a game, sets the game to be either public or private and
		// can also take a preset deck of cards (currently used for testing only atm)
		this.players = [];
		this.spaceHand = [];
		this.public = p;

		if (!d) {
			this.deck = new CardDeck();
			this.deck.create();
		} else {
			this.deck = d;
		}
		this.dealer = dealer;
		this.players = [new CardPlayer(this.dealer)];
	}
}

// The commands for the CardGame

export const CardGameActionSchema = z.discriminatedUnion('action', [
	z.object({
		// Create the game, private or public
		action: z.literal('create'),
		public: z.boolean(),
	}),
	z.object({
		// Abort a running game
		action: z.literal('stop'),
	}),
	z.object({
		// Join a running game
		action: z.literal('join'),
	}),
	z.object({
		// Deal a number of cards openly to the table
		action: z.literal('dealTable'),
		number: z.number().int().positive().optional(),
	}),
	z.object({
		// Deal a number of cards openly to a player
		action: z.literal('dealOpenly'),
		targetId: CharacterIdSchema,
		number: z.number().int().positive().optional(),
	}),
	z.object({
		// Deal a number of cards hidden to a player
		action: z.literal('deal'),
		targetId: CharacterIdSchema,
		number: z.number().int().positive().optional(),
	}),
	z.object({
		// Check the current status of the game:
		// - The player's hand
		// - Cards on the table
		// - Revealed cards of other players
		action: z.literal('check'),
	}),
	z.object({
		// End the game and reveal all player's hands
		action: z.literal('reveal'),
	}),
	z.object({
		// Show your current hand
		action: z.literal('show'),
	}),
]);

// Validate a plain object and then create a class instance
export const CardGameCardSchema = z.object({
	suit: SuitSchema,
	rank: RankSchema,
}).transform((data) => new CardGameCard(data.suit, data.rank));
