import { Muffler } from '../../src/chatroom/muffling';

describe('Muffler', () => {
	describe('muffle()', () => {
		it('should return a processed string', () => {
			const muffler = new Muffler('character name');
			expect(muffler.muffle('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Semper risus in hendrerit gravida. Phasellus egestas tellus rutrum tellus pellentesque eu tincidunt tortor aliquam. Bibendum arcu vitae elementum curabitur vitae. Faucibus scelerisque eleifend donec pretium vulputate sapien.'))
				.not.toEqual('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Semper risus in hendrerit gravida. Phasellus egestas tellus rutrum tellus pellentesque eu tincidunt tortor aliquam. Bibendum arcu vitae elementum curabitur vitae. Faucibus scelerisque eleifend donec pretium vulputate sapien.');

		});

		it('should keep character case in simple situation', () => {
			const muffler = new Muffler('character second name');
			const test = 'The quick brown fox jumps over the lazy dog';
			expect(muffler.muffle(test.toUpperCase()).split('').every((c) => c === c.toUpperCase()));
			expect(muffler.muffle(test.toLowerCase()).split('').every((c) => c === c.toLowerCase()));
		});
	});

});
