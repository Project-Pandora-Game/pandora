import { TypedEventEmitter } from '../src/event.ts';

describe('TypedEventEmitter', () => {
	type MockEvent = {
		event1: number;
		event2: { value: string; };
	};
	const def: MockEvent = {
		event1: 100,
		event2: {
			value: 'mock',
		},
	};
	class MockEventEmitter extends TypedEventEmitter<MockEvent> {
		public emit1() {
			this.emit('event1', def.event1);
		}
		public emit2() {
			this.emit('event2', def.event2);
		}
	}
	let mockEmitter: MockEventEmitter;
	const fn = jest.fn();
	const fnAny = jest.fn();

	beforeEach(() => {
		mockEmitter = new MockEventEmitter();
		mockEmitter.on('event1', fn);
		mockEmitter.on('event2', fn);
		mockEmitter.onAny(fnAny);
	});

	describe('on()', () => {
		it('should return a function', () => {
			expect(typeof mockEmitter.on('event1', fn)).toBe('function');
		});

		it('should return an unsubscribe handler', () => {
			const unsub = jest.fn();
			const handler = mockEmitter.on('event1', unsub);
			mockEmitter.emit1();
			expect(unsub).toHaveBeenLastCalledWith(def.event1);
			handler(); //unsubscribe
			mockEmitter.emit1();
			expect(unsub).toHaveBeenCalledTimes(1);
			expect(unsub).not.toHaveBeenCalledTimes(2);
		});

		it('should register callbacks for a certain event', () => {
			mockEmitter.emit1();
			expect(fn).toHaveBeenLastCalledWith(def.event1);
			mockEmitter.emit2();
			expect(fn).toHaveBeenLastCalledWith(def.event2);
		});
	});
	describe('onAny()', () => {
		it('should return a function', () => {
			expect(typeof mockEmitter.onAny(fnAny)).toBe('function');
		});

		it('should return an unsubscribe handler', () => {
			const unsub = jest.fn();
			const handler = mockEmitter.onAny(unsub);
			mockEmitter.emit1();
			expect(unsub).toHaveBeenLastCalledWith({ event1: def.event1 });
			mockEmitter.emit2();
			expect(unsub).toHaveBeenLastCalledWith({ event2: def.event2 });
			handler(); //unsubscribe
			mockEmitter.emit1();
			mockEmitter.emit2();
			expect(unsub).toHaveBeenCalledTimes(2);
			expect(unsub).not.toHaveBeenCalledTimes(4);
		});

		it('should register callbacks for any defined event', () => {
			mockEmitter.emit1();
			expect(fnAny).toHaveBeenLastCalledWith({ event1: def.event1 });
			mockEmitter.emit2();
			expect(fnAny).toHaveBeenLastCalledWith({ event2: def.event2 });
		});
	});
});
