import { ChatParser, LineParser, SegmentParser } from '../../../src/ui/components/chat/chatParser.ts';

describe('LineParser', () => {
	const mockLineParser = new LineParser();
	describe('parse()', () => {
		it('should return [] when passed empty string', () => {
			expect(mockLineParser.parse('', true))
				.toStrictEqual([]);
			expect(mockLineParser.parse('', false))
				.toStrictEqual([]);
		});
		it('should parse chat', () => {
			expect(mockLineParser.parse('foo', true))
				.toStrictEqual([['chat', 'foo']]);
			expect(mockLineParser.parse('foo', false))
				.toStrictEqual([['chat', 'foo']]);
		});

		it('should parse me', () => {
			expect(mockLineParser.parse('*hi there*', true))
				.toStrictEqual([['me', 'hi there']]);
		});

		it('should parse emote', () => {
			expect(mockLineParser.parse('**emoting**', true))
				.toStrictEqual([['emote', 'emoting']]);
		});

		it('should parse ooc', () => {
			expect(mockLineParser.parse('(( OOC talk ))', true))
				.toStrictEqual([['ooc', 'OOC talk']]);
			expect(mockLineParser.parse('(( OOC talk ))', false))
				.toStrictEqual([['ooc', 'OOC talk']]);
		});

		it('should handle escape - \\', () => {
			expect(mockLineParser.parse('\\*hi there*', true))
				.toStrictEqual([['chat', '*hi there*']]);
		});

		it('should handle new line cases', () => {
			expect(mockLineParser.parse('Do emotes on new lines work?\n*checks whether they do', true))
				.toStrictEqual([
					['chat', 'Do emotes on new lines work?'],
					['me', 'checks whether they do'],
				]);

			expect(mockLineParser.parse('Do emotes on new lines work?\n**checks whether they do', true))
				.toStrictEqual([
					['chat', 'Do emotes on new lines work?'],
					['emote', 'checks whether they do'],
				]);
		});
	});
});

describe('SegmentParser', () => {
	const mockSegmentParser = new SegmentParser();

	describe('parse()', () => {
		it('should return [] when passed empty', () => {
			expect(mockSegmentParser.parse(''))
				.toStrictEqual([]);
		});

		it('should parse text into normal segments', () => {
			expect(mockSegmentParser.parse('testing')).toStrictEqual([['normal', 'testing']]);
		});

		it('should parse text into bold segments', () => {
			expect(mockSegmentParser.parse('__bold__')).toStrictEqual([['bold', 'bold']]);
		});

		it('should parse text into italic segments', () => {
			expect(mockSegmentParser.parse('_italic_')).toStrictEqual([['italic', 'italic']]);
		});

		it('should parse complex sentence into italic, bold, and normal segments', () => {
			expect(mockSegmentParser.parse('hi there, I am __bold__ and very _leany_'))
				.toStrictEqual([
					['normal', 'hi there, I am '],
					['bold', 'bold'],
					['normal', ' and very '],
					['italic', 'leany'],
				]);
		});
	});
});

describe('ChatParser', () => {
	describe('parse()', () => {
		it('should parse me', () => {
			expect(ChatParser.parse('*waves*')).toStrictEqual([{
				type: 'me',
				parts: [['normal', 'waves']],
			}]);
		});

		it('should parse ooc', () => {
			expect(ChatParser.parse('((ooc talk))'))
				.toStrictEqual([{
					type: 'ooc',
					parts: [['normal', 'ooc talk']],
					to: undefined,
				}]);

			expect(ChatParser.parse('((ooc talk))', ['c123321']))
				.toStrictEqual([{
					type: 'ooc',
					parts: [['normal', 'ooc talk']],
					to: ['c123321'],
				}]);
		});
	});

	describe('parseStyle()', () => {
		it('should parse into normal, bold, italic segments', () => {
			expect(ChatParser.parseStyle('hi there, I am __bold__ and very _leany_'))
				.toStrictEqual([
					['normal', 'hi there, I am '],
					['bold', 'bold'],
					['normal', ' and very '],
					['italic', 'leany'],
				]);
		});
	});
});
