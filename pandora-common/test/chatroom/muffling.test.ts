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
			// eslint-disable-next-line no-console
			console.log(muffler.muffle(test));
		});

		it('should be word consistent', () => {
			const muffler = new Muffler('character second name');
			const test1 = 'The quick brown fox jumps over the lazy dog';
			const test2 = 'The quick brown fox jumps over the lazy dog, so she does!';
			expect(muffler.muffle(test1)).toBe(muffler.muffle(test1));
			expect(muffler.muffle(test2).includes(muffler.muffle(test1)));

		});

		it('should keep punctuations', () => {
			const muffler = new Muffler('character second name ewqlkhrql;kwehrkjq');
			expect(muffler.muffle('Hello!').includes('!')).toBeTruthy();
			expect(muffler.muffle('I\'m batman').includes('\'')).toBeTruthy();
			expect(muffler.muffle('How are you?').includes('?')).toBeTruthy();
			expect(muffler.muffle('Nice to meet you.').includes('.')).toBeTruthy();
			expect(muffler.muffle('What a nice day, let\'s go swimming').includes(',')).toBeTruthy();
		});

		it('should not affect new line and tabs', () => {
			const muffler = new Muffler('character second ewrwqaa ewqlkhrqq');
			expect(muffler.muffle('\n\n\n')).toBe('\n\n\n');
			expect(muffler.muffle('\t\t\t')).toBe('\t\t\t');
		});

		it('should not affect common emotes', () => {
			const muffler = new Muffler('character second ewrwqaa ewqlkhrqq');
			expect(muffler.muffle('<3 :3 \t :0 >.< \t ^^ ^-^ .-.')).toBe('<3 :3 \t :0 >.< \t ^^ ^-^ .-.');
		});
	});

});
