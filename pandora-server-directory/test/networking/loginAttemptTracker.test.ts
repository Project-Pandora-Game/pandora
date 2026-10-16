import { describe, expect, it } from '@jest/globals';
import { LoginAttemptTracker } from '../../src/networking/loginAttemptTracker.ts';

describe('LoginAttemptTracker', () => {
	it('requires CAPTCHA only for the username that failed, regardless of case', () => {
		const tracker = new LoginAttemptTracker(60_000, 3);
		tracker.recordFailure('Alice', 0);
		tracker.recordFailure('ALICE', 1);
		tracker.recordFailure('alice', 2);
		expect(tracker.requiresCaptcha('Alice', 3)).toBe(true);
		expect(tracker.requiresCaptcha('Bob', 3)).toBe(false);
		expect(tracker.requiresCaptcha('ALICE', 60_002)).toBe(false);
	});

	it('does not let distinct usernames evict active CAPTCHA requirements', () => {
		const tracker = new LoginAttemptTracker(60_000, 1, 2);
		tracker.recordFailure('alice', 0);
		tracker.recordFailure('bob', 1);
		tracker.recordFailure('charlie', 2);
		expect(tracker.requiresCaptcha('alice', 3)).toBe(true);
		expect(tracker.requiresCaptcha('bob', 3)).toBe(true);
		expect(tracker.requiresCaptcha('charlie', 3)).toBe(true);
		expect(tracker.requiresCaptcha('dave', 3)).toBe(true);
		expect(tracker.requiresCaptcha('dave', 60_002)).toBe(false);
		tracker.recordFailure('dave', 60_003);
		expect(tracker.requiresCaptcha('dave', 60_004)).toBe(true);
	});
});
