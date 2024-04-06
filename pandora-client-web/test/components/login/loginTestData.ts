export const INVALID_USERNAMES = Object.freeze([
	'f',
	'fo',
	'abcdefghijklmnopqrstuvwxyz0123456',
	'_',
	'-',
	'0',
	'00',
	'--',
	'__',
	'abc/123',
	'abc!',
	'test@test.com',
	'$$$',
	'100%',
	'^^^',
	'***',
	'(((',
	')))',
	'test~',
	'|||',
	',,,',
	'...',
	'user name',
	' aaa',
	'bbb ',
]);

export const INVALID_DISPLAY_NAMES = Object.freeze([
	...INVALID_USERNAMES // Reuse list of invalid usernames
		.filter((u) => !u.includes(' ')), // But display names can have spaces
]);

export const INVALID_LENGTH_TOKENS = Object.freeze([
	'1',
	'12',
	'123',
	'1234',
	'12345',
]);

export const INVALID_FORMAT_TOKENS = Object.freeze([
	'abcdef',
	'######',
	'dddddd',
	'I23456',
]);

/*
 * Emails are in user-event friendly format - brace characters []{} have been repeated
 * See https://testing-library.com/docs/user-event/keyboard
 */
export const INVALID_EMAILS = Object.freeze([
	'plainaddress',
	'A@b@c@domain.com',
	'#@%^%#$@#$@#.com',
	'@example.com',
	'Joe Smith <email@example.com>',
	'email.example.com',
	'email@example@example.com',
	'.email@example.com',
	'email.@example.com',
	'email..email@example.com',
	'あいうえお@example.com',
	'email@example.com (Joe Smith)',
	'email@example',
	'email@-example.com',
	'email@example..com',
	'Abc..123@example.com',
	'a”b(c)d,e:f;gi[[j\\k]]l@domain.com',
	'“(),:;<>[[\\]]@example.com',
	'just"not"right@example.com',
	'this\\ is"really"not\\allowed@example.com',
	'abc is”not\\valid@domain.com',
]);
