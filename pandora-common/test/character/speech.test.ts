import { HearingImpairment, HearingImpairmentSettings, Muffler, MuffleSettings } from '../../src/character/speech';

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

describe('HearingImpairment', () => {
	describe('distort()', () => {
		let hearingImpairment: HearingImpairment;
		const config: HearingImpairmentSettings = {
			distortion: 3,
			frequencyLoss: 3,
			vowelLoss: 3,
			middleLoss: 3,
		};

		beforeEach(() => {
			hearingImpairment = new HearingImpairment('salt', config);
		});

		it('should return a processed string', () => {
			const test = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Semper risus in hendrerit gravida. Phasellus egestas tellus rutrum tellus pellentesque eu tincidunt tortor aliquam. Bibendum arcu vitae elementum curabitur vitae. Faucibus scelerisque eleifend donec pretium vulputate sapien.';
			expect(hearingImpairment.distort(test))
				.not.toEqual(test);

		});

		it('should keep character case in simple situation', () => {
			const test = 'The quick brown fox jumps over the lazy dog';
			expect(hearingImpairment.distort(test.toUpperCase()).split('').every((c) => c === c.toUpperCase()));
			expect(hearingImpairment.distort(test.toLowerCase()).split('').every((c) => c === c.toLowerCase()));
		});

		it('should be word consistent', () => {
			const test1 = 'The quick brown fox jumps over the lazy dog';
			const test2 = 'The quick brown fox jumps over the lazy dog, so she does!';
			expect(hearingImpairment.distort(test1)).toBe(hearingImpairment.distort(test1));
			expect(hearingImpairment.distort(test2).includes(hearingImpairment.distort(test1)));

		});

		it('should keep punctuations', () => {
			expect(hearingImpairment.distort('Hello!').includes('!')).toBeTruthy();
			expect(hearingImpairment.distort('I\'m batman').includes('\'')).toBeTruthy();
			expect(hearingImpairment.distort('How are you?').includes('?')).toBeTruthy();
			expect(hearingImpairment.distort('Nice to meet you.').includes('.')).toBeTruthy();
			expect(hearingImpairment.distort('What a nice day, let\'s go swimming').includes(',')).toBeTruthy();
		});

		it('should not affect new line and tabs', () => {
			expect(hearingImpairment.distort('\n\n\n')).toBe('\n\n\n');
			expect(hearingImpairment.distort('\t\t\t')).toBe('\t\t\t');
		});

		it('should not affect common emotes', () => {
			expect(hearingImpairment.distort('<3 :3 \t :0 >.< \t ^^ ^-^ .-.')).toBe('<3 :3 \t :0 >.< \t ^^ ^-^ .-.');
		});

		it('should be consistent even with \\n\\t', () => {
			expect(hearingImpairment.distort('\n\thello\n\t\t').trim()).toBe(hearingImpairment.distort('hello'));
		});
	});
});
