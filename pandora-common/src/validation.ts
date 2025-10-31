import { enableMapSet } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { LIMIT_ACCOUNT_NAME_LENGTH, LIMIT_CHARACTER_NAME_LENGTH, LIMIT_CHARACTER_NAME_MIN_LENGTH, LIMIT_MAIL_LENGTH } from './inputLimits.ts';
import { Assert, AssertNever } from './utility/misc.ts';

enableMapSet();

export function ZodTemplateString<T extends string>(validator: z.ZodString, regex: RegExp): z.ZodType<T> & z.ZodString {
	return validator.regex(regex) as unknown as z.ZodType<T> & z.ZodString;
}

/**
 * Wraps a ZodLiteral schema in a transform that returns the schema's string instance instead of the parsed one. The result will seemingly not change.
 *
 * Although they are identical strings, they are represented by pointers to JS engine data structures.
 * Most modern engines do string interning on source and have pointer-based string comparison fast path, so this will speed up comparison to any strings present in code.
 * @param baseSchema The schema to wrap
 * @returns Schema wrapped with the interning effect
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ZodWrapInternString<const T extends z.ZodLiteral<any>>(baseSchema: T): z.ZodPipe<T, z.ZodTransform<z.core.output<T>, z.core.output<T>>> {
	return baseSchema.transform<z.core.output<T>>((v): z.core.output<T> => {
		for (const internedValue of baseSchema.values) {
			if (v === internedValue) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return internedValue as typeof v;
			}
		}
		AssertNever(v as never);
	});
}

/** ZodString .trim method doesn't do actual validation, we need to use regex */
export const ZodTrimedRegex = /^(([^\s].*[^\s])|[^\s]*)$/s;

export const ZodBase64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function ZodMatcher<T extends z.ZodType>(validator: T, passthrough?: true): (val: unknown) => val is z.infer<T> {
	if (!passthrough && validator instanceof z.ZodObject) {
		validator = validator.strict() as unknown as T;
	}
	return (val: unknown): val is z.infer<T> => {
		const parseResult = validator.safeParse(val);
		return parseResult.success && isEqual(val, parseResult.data);
	};
}

export function ZodArrayWithInvalidDrop<ZodShape extends z.ZodType>(shape: ZodShape, preCheck: z.ZodType = z.unknown(), maxLength?: number) {
	return z.array(preCheck).transform((values) => {
		const res: z.output<ZodShape>[] = [];
		for (const value of values) {
			const parsed = shape.safeParse(value);
			if (parsed.success) {
				res.push(parsed.data);
			}
		}

		if (maxLength != null && res.length > maxLength)
			return res.slice(0, maxLength);

		return res;
	});
}

/**
 * Creates a transformer for Zod schemas that truncates a string or array to a specified maximum length.
 *
 * The function is intended to be used as a `.transform()` method in Zod schemas. It can be applied to
 * both string and array types. When used on a string, it truncates the string to the specified length
 * if it exceeds that length. When used on an array, it limits the array to the specified number of elements.
 *
 * @param {number} maxLength - The maximum length to which the string or array should be truncated.
 *                             Must be a positive number.
 * @returns A transformer function that takes a value (string or array) and context, and returns
 *          the value truncated to the specified maxLength.
 *
 * @example
 * // For a string schema
 * z.string().transform(ZodTruncate(42));
 *
 * // For an array schema
 * z.array(z.unknown()).transform(ZodTruncate(69));
 */
export function ZodTruncate<Output extends string | unknown[]>(maxLength: number): (value: Output, _ctx: z.RefinementCtx) => Output {
	Assert(maxLength > 0, 'maxLength must be a positive number');
	return (value) => value.slice(0, maxLength) as Output;
}

export const SCHEME_OVERRIDE = Symbol('SCHEME_OVERRIDE');

export interface ZodOverridableType<Output, Input = Output> extends z.ZodType<Output, Input> {
	[SCHEME_OVERRIDE]: ((attachedValidation: ((arg: Output, ctx: z.RefinementCtx) => void)) => void);
}

export function ZodOverridable<Output, Input = Output>(schema: z.ZodType<Output, Input>): ZodOverridableType<Output, Input> {
	let attachedValidation: ((arg: Output, ctx: z.RefinementCtx) => void) | undefined;
	const refined = schema.superRefine((arg, ctx) => attachedValidation?.(arg, ctx)) as ZodOverridableType<Output, Input>;
	refined[SCHEME_OVERRIDE] = (fn) => attachedValidation = fn;
	return refined;
}

/**
 * Checks whether given array includes the element, working as a guard
 * @param array - The array to check in
 * @param element - Element to find
 */
export function ArrayIncludesGuard<T extends string | number | boolean | null | undefined>(array: readonly T[], element: unknown): element is T {
	return array.includes(element as T);
}

/**
 * Takes a const record with arbitrary keys, where each value is object with same keys.
 * Keeps the outer keys and replaces the objects by the value of specific key.
 * @param key - Name of the inner key
 * @param value - The outer object
 * @example
 * RecordUnpackSubobjectProperties('innerKey1', {
 *    aaa: {
 *        innerKey1: 'a1',
 *        innerKey2: 'a2',
 *    },
 *    bbb: {
 *        innerKey1: 'b1',
 *        innerKey2: 'b2',
 *    },
 * })
 * // ->
 * {
 *    aaa: 'a1',
 *    bbb: 'b1',
 * }
 */
export function RecordUnpackSubobjectProperties<const T extends string, const V extends Readonly<Record<string, Readonly<Record<T, unknown>>>>>(key: T, value: V): {
	[key in keyof V]: V[key][T];
} {
	// @ts-expect-error: Created to match in loop
	const result: {
		[key in keyof V]: V[key][T];
	} = {};

	for (const k of (Object.keys(value) as (keyof V)[])) {
		result[k] = value[k][key];
	}

	return result;
}

/** A dirty thing that shouldn't really be used, but sometimes you are lazy */
export function ZodCast<T>(): z.ZodType<T> {
	return z.any();
}

export const HexColorStringSchema = ZodTemplateString<`#${string}`>(z.string(), /^#[0-9a-f]{6}$/i);
export type HexColorString = z.infer<typeof HexColorStringSchema>;

export const HexRGBAColorStringSchema = ZodTemplateString<`#${string}`>(z.string(), /^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
export type HexRGBAColorString = z.infer<typeof HexRGBAColorStringSchema>;

/** Checks if the `obj` is an object (not null, not array) */
export function IsObject(obj: unknown): obj is Record<string, unknown> {
	return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

export const IsString = (value: unknown): value is string => typeof value === 'string';

export const IsNumber = (value: unknown): value is number => typeof value === 'number';

export const IsBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const IsUndefined = (value: unknown): value is undefined => value === undefined;

/**
 * Tests if the parameter is a valid username
 *
 * TODO - finalize this to what we want
 */
export const UserNameSchema = z.string().min(3).max(LIMIT_ACCOUNT_NAME_LENGTH).regex(/^[a-zA-Z0-9_-]*$/);
export const IsUsername = ZodMatcher(UserNameSchema);

export const DisplayNameSchema = z.string().min(3).max(LIMIT_ACCOUNT_NAME_LENGTH).regex(/^[a-zA-Z0-9_\- ]*$/).regex(ZodTrimedRegex);
export const IsDisplayName = ZodMatcher(DisplayNameSchema);

/** Name of a character */
export const CharacterNameSchema = z.string().max(LIMIT_CHARACTER_NAME_LENGTH).regex(/^[a-zA-Z0-9_\- ]*$/).regex(ZodTrimedRegex);
/** Name of a character as entered by user; further limits allowed values */
export const CharacterInputNameSchema = CharacterNameSchema.min(LIMIT_CHARACTER_NAME_MIN_LENGTH);
export const IsValidCharacterName = ZodMatcher(CharacterInputNameSchema);

/**
 * Tests if the parameter is a valid email address
 *
 * TODO - finalize this to what we want
 *
 * @see https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression/201378#201378
 */
// eslint-disable-next-line no-control-regex
export const EmailAddressSchema = z.string().min(5).max(LIMIT_MAIL_LENGTH).regex(/^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i);
export const IsEmail = ZodMatcher(EmailAddressSchema);

export const SIMPLE_TOKEN_LENGTH = 6;
/**
 * A simple digit-based token
 */
export const SimpleTokenSchema = z.string().length(SIMPLE_TOKEN_LENGTH).regex(/^[0-9]+$/);
export const IsSimpleToken = ZodMatcher(SimpleTokenSchema);

export const PasswordSchema = z.string().min(8);
export const PasswordSha512Schema = z.string().regex(/^[a-zA-Z0-9+/]{86}==$/);
