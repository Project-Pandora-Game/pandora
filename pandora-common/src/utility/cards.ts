// Define Suits and Ranks
const suits = ['\u2665', //hearts
	'\u2666', //diamonds
	'\u2663', //clubs
	'\u2660']; //spades
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Define Card Type
export class Card {
	public readonly suit: string;
	public readonly rank: string;

	constructor(s: string, r: string) {
		this.suit = s;
		this.rank = r;
	}
}

export class CardDeck {
	private deck: Card[] = [];

	private addCard(c: Card) {
		this.deck.push(c);
	}

	public deal() {
		return this.deck.length > 0 ? this.deck.pop() : null;
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
}

