/* eslint-disable no-bitwise */

/**
 * Class for working with large amount of individual bits.
 */
export class BitField {
	/** The internal storage of the bitfield. */
	public readonly buffer: Uint8Array;

	/** The number of bits in the bitfield. */
	public get length(): number {
		return 8 * this.buffer.length;
	}

	/**
	 * Constructs a BitField
	 *
	 * @param bitSize - Minimum capacity (in bits) for the created bitfield. Might be rounded up.
	 */
	constructor(bitSize: number);
	/**
	 * Constructs a BitField.
	 *
	 * @param data - Buffer to use as the BitField's buffer.
	 */
	constructor(data: Uint8Array);
	constructor(data: number | Uint8Array) {
		this.buffer = typeof data === 'number' ? new Uint8Array(Math.ceil(data / 8)) : data;
	}

	/**
	 * Get a bit
	 *
	 * @param i - Index of the bit to get
	 * @returns Whether the bit is set
	 */
	public get(i: number): boolean {
		return (this.buffer[i >> 3] & (1 << (i % 8))) !== 0;
	}

	/**
	 * Set or clear a bit
	 *
	 * @param i - Index of the bit to manipulate
	 * @param value - Whether to set (`true`) or clear (`false`) the bit
	 */
	public set(i: number, value: boolean): void {
		if (value) {
			this.buffer[i >> 3] |= (1 << (i % 8));
		} else {
			this.buffer[i >> 3] &= ~(1 << (i % 8));
		}
	}
}
