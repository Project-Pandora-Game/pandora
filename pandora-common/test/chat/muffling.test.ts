import { Muffler, MuffleSettings } from '../../src/chat/muffling';

describe('Muffler', () => {
	describe('muffle()', () => {
		let muffler: Muffler;
		const config: MuffleSettings = {
			lipsTouch: 3,
			jawMove: 3,
			throatBreath: 3,
			tongueRoof: 3,
			mouthBreath: 3,
			coherency: 3,
			stimulus: 3,
		};
		beforeEach(() => {
			muffler = new Muffler('salt', config);
		});

		it('should return a processed string', () => {
			const test = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Semper risus in hendrerit gravida. Phasellus egestas tellus rutrum tellus pellentesque eu tincidunt tortor aliquam. Bibendum arcu vitae elementum curabitur vitae. Faucibus scelerisque eleifend donec pretium vulputate sapien.';
			expect(muffler.muffle(test))
				.not.toEqual(test);

		});

		it('should keep character case in simple situation', () => {
			const test = 'The quick brown fox jumps over the lazy dog';
			expect(muffler.muffle(test.toUpperCase()).split('').every((c) => c === c.toUpperCase()));
			expect(muffler.muffle(test.toLowerCase()).split('').every((c) => c === c.toLowerCase()));
		});

		it('should be word consistent', () => {
			const test1 = 'The quick brown fox jumps over the lazy dog';
			const test2 = 'The quick brown fox jumps over the lazy dog, so she does!';
			expect(muffler.muffle(test1)).toBe(muffler.muffle(test1));
			expect(muffler.muffle(test2).includes(muffler.muffle(test1)));

		});

		it('should keep punctuations', () => {
			expect(muffler.muffle('Hello!').includes('!')).toBeTruthy();
			expect(muffler.muffle('I\'m batman').includes('\'')).toBeTruthy();
			expect(muffler.muffle('How are you?').includes('?')).toBeTruthy();
			expect(muffler.muffle('Nice to meet you.').includes('.')).toBeTruthy();
			expect(muffler.muffle('What a nice day, let\'s go swimming').includes(',')).toBeTruthy();
		});

		it('should not affect new line and tabs', () => {
			expect(muffler.muffle('\n\n\n')).toBe('\n\n\n');
			expect(muffler.muffle('\t\t\t')).toBe('\t\t\t');
		});

		it('should not affect common emotes', () => {
			expect(muffler.muffle('<3 :3 \t :0 >.< \t ^^ ^-^ .-.')).toBe('<3 :3 \t :0 >.< \t ^^ ^-^ .-.');
		});

		it('should be consistent even with \\n\\t', () => {
			expect(muffler.muffle('\n\thello\n\t\t').trim()).toBe(muffler.muffle('hello'));
		});
	});
});
