import * as z from 'zod';
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
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

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

	/**
	 * @returns Formatted String representing a card
	 */
	public toString() {
		return `${this.rank}${this.suit}`;
	}

	/**
	 * Change the state of a card, so that it is listed as "revealed"
	 */
	public reveal() {
		this.faceDown = false;
	}

	/**
	 * @returns Return the state of a card (face-up, face-down)
	 */
	public isRevealed() {
		return !this.faceDown;
	}

	/**
	 * Creates an instance of CardGameCard.
	 * @param s - Suit of a card
	 * @param r - Rank of a card
	 */
	constructor(s: CardGameSuit, r: CardGameRank) {
		this.suit = s;
		this.rank = r;
		this.faceDown = true;
	}
}

/**
 * Helper function.
 * Creates a string of given card arrays
 * @param cardGroups - The card arrays that need to be formatted
 * @returns A String, repesenting the cards
 */
export function CardArraysToString(...cardGroups: CardArray[]) {
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

	/**
	 * @returns Returns how many cards are left in the deck
	 */
	public get cardsLeft() {
		return this.deck.length;
	}

	/**
	 * Cretae a new shuffled deck of cards
	 */
	public create() {
		for (const suit of suits) {
			for (const rank of ranks) {
				this.addCard(new CardGameCard(suit, rank));
			}
		}
		this.shuffle();
	}

	/**
	 * @returns Returns the next card from the top of the deck or undefined, if the deck is empty
	 */
	public deal() {
		//
		return this.deck.length > 0 ? this.deck.pop() : undefined;
	}

	/**
	 * Creates an instance of CardDeck.
	 * @param cards - An optional deck of cards. If left out a deck of 52 cards will be created
	 */
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

	/**
	 * @returns Returns the player's id
	 */
	public getId() {
		return this.id;
	}

	/**
	 * Store a card that is dealt either face up or face down
	 * @param c - The cartd to add to the player's hand
	 * @param open - Defines wether the card is dealt openly (true) or not (false)
	 */
	public receiveCard(c: CardGameCard, open: boolean = false) {
		if (open) c.reveal();
		this.hand.push(c);
	}

	/**
	 * @param revealed - Defines if the function should return the revealed cards (true) or the hidden ones (false)
	 * @returns Returns an array of cards. Either all reveiled or all hidden cards
	 */
	public getCards(revealed: boolean) {
		const cards = revealed ? this.hand.filter((c) => c.isRevealed()) : this.hand.filter((c) => !c.isRevealed());
		return cards;
	}

	/**
	 * @returns Returns an array of all cards the player currently holds and sets their status to 'reveiled'
	 */
	public showHand() {
		this.hand.forEach((c) => c.reveal());
		return CardArraysToString(this.hand);
	}

	/**
	 * Creates an instance of CardPlayer.
	 * @param id - The ID of the player that should be created
	 */
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

	/**
	 * Add a player to the game, if they didn't join already
	 * @param c - The ID of the player that should be added to the game
	 * @returns true if the player has been added or false in the other case
	 */
	public joinGame(c: CharacterId) {
		if (!this.players.some((p) => p.getId() === c)) {
			this.players.push(new CardPlayer(c));
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Remove a player from the list of players
	 * @param c - The ID of the player that needs to be removed
	 */
	public leaveGame(c: CharacterId) {
		this.players = this.players.filter((p) => p.getId() !== c);
	}

	/**
	 * Deal a number of cards, either to a player or to the current space (c == null)
	 * A card can be dealt either open or face down
	 * @param n - How many cards should be dealt
	 * @param c - The ID of the player who should receive the cards. If omitted the cards are dealt openly to the table
	 * @param open - Wether or not the cards should be dealt openly (true) or face-down (false, default)
	 * @returns An array of the dealt cards or null, if the deck did not have enough cards for the request
	 */
	public dealTo(n: number, c?: CharacterId, open: boolean = false): CardArray | null {
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

	/**
	 * Make a player show their current cards
	 * @param c - ID of the player who should show their hand
	 */
	public revealHand(c: CharacterId) {
		this.players.find((p) => p.getId() === c)?.showHand();
	}

	/**
	 * Check, if the given player is part of the game
	 * @param c - The ID of the player who should be checked
	 * @returns True, if the player is part of the game, false, if not
	 */
	public isPlayer(c: CharacterId) {
		return this.players.find((p) => p.getId() === c);
	}

	/**
	 * Get the cards, a player is holding. Either all cards or only those
	 * that have been revealed previously
	 * @param c - The ID od the player
	 * @param revealedOnly - get only the already revealed cards (true) or all (false)
	 * @returns A formatted list of cards
	 */
	public getPlayerHand(c: CharacterId, revealedOnly: boolean) {
		const player = this.players.find((p) => p.getId() === c);
		if (!player)
			return 'Nothing';
		return revealedOnly
			? CardArraysToString(player.getCards(true))
			: CardArraysToString(player.getCards(true), player.getCards(false));
	}

	/**
	 * @returns Returns an array of all current players
	 */
	public getPlayerIds() {
		return this.players.map((p) => p.getId());
	}

	/**
	 * @returns Returns a formatted string of the cards that are on the table
	 */
	public getSpaceHand() {
		return CardArraysToString(this.spaceHand);
	}

	/**
	 * Checks, if the current player is the game's dealer
	 * @param p - The player to check
	 * @returns True if the given player is the game's dealer, false, if not
	 */
	public isDealer(p: CharacterId) {
		return p === this.dealer;
	}

	/**
	 * @returns The game's dealer ID
	 */
	public getDealerId() {
		return this.dealer;
	}

	/**
	 * @returns True, if the game is public, false, if not
	 */
	public isPublic() {
		return this.public;
	}

	/**
	 * Creates a game, sets the game to be either public or private and
	 * can also take a preset deck of cards (currently used for testing only atm)
	 * @param dealer - ID of the player who will be the game's host
	 * @param p - True, if the game should be public, false otherwise
	 * @param d - An optional deck of cards. Used mainly for testing
	 */
	constructor(dealer: CharacterId, p: boolean, d?: CardDeck) {
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
