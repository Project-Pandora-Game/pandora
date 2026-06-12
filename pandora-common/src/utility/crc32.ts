/**
 * Calculate CRC-32/ISO-HDLC checksum.
 * @param input - Input to checksum, as bytes
 * @returns Resulting checksum as safe integer
*/
export function Crc32(input: Uint8Array): number {
	/* eslint-disable no-bitwise */
	let crc = 0 ^ -1;
	for (const b of input) {
		let c = (crc ^ b) & 0xff;
		for (let j = 0; j < 8; j++) {
			c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
		}
		crc = (crc >>> 8) ^ c;
	}

	return ((crc ^ -1) >>> 0);
	/* eslint-enable no-bitwise */
}
