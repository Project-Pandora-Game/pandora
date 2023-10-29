import { enableMapSet } from 'immer';
import { isEqual } from 'lodash';
import { z, ZodObject, ZodString, ZodType, ZodTypeAny, ZodTypeDef, RefinementCtx, ZodEffects } from 'zod';
import { LIMIT_ACCOUNT_NAME_LENGTH, LIMIT_CHARACTER_NAME_LENGTH, LIMIT_MAIL_LENGTH } from './inputLimits';

enableMapSet();

export function ZodTemplateString<T extends string>(validator: ZodString, regex: RegExp): ZodType<T> & ZodString {
	return validator.regex(regex) as unknown as ZodType<T> & ZodString;
}

/** ZodString .trim method doesn't do actual validation, we need to use regex */
export const ZodTrimedRegex = /^[^\s].*[^\s]$/;

export const ZodBase64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function ZodMatcher<T extends ZodTypeAny>(validator: T, passthrough?: true): (val: unknown) => val is z.infer<T> {
	if (!passthrough && validator instanceof ZodObject) {
		validator = validator.strict() as unknown as T;
	}
	return (val: unknown): val is z.infer<T> => {
		const parseResult = validator.safeParse(val);
		return parseResult.success && isEqual(val, parseResult.data);
	};
}

export function ZodArrayWithInvalidDrop<ZodShape extends ZodTypeAny, ZodPreCheck extends ZodTypeAny>(shape: ZodShape, preCheck: ZodPreCheck) {
	return z.array(preCheck).transform((values) => {
		const res: z.output<ZodShape>[] = [];
		for (const value of values) {
			const parsed = shape.safeParse(value);
			if (parsed.success) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				res.push(parsed.data);
			}
		}
		return res;
	});
}

export const SCHEME_OVERRIDE = Symbol('SCHEME_OVERRIDE');

export interface ZodOverridableType<Output, Def extends ZodTypeDef = ZodTypeDef, Input = Output> extends ZodEffects<ZodType<Output, Def, Input>, Output, Input> {
	[SCHEME_OVERRIDE]: ((attachedValidation: ((arg: Output, ctx: RefinementCtx) => void)) => void);
}

export function ZodOverridable<Output, Def extends ZodTypeDef = ZodTypeDef, Input = Output>(schema: ZodType<Output, Def, Input>): ZodOverridableType<Output, Def, Input> {
	let attachedValidation: ((arg: Output, ctx: RefinementCtx) => void) | undefined;
	const refined = schema.superRefine((arg, ctx) => attachedValidation?.(arg, ctx)) as ZodOverridableType<Output, Def, Input>;
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

/** A dirty thing that shouldn't really be used, but sometimes you are lazy */
export function ZodCast<T>(): ZodType<T> {
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
export const UserNameSchema = z.string().min(3).max(LIMIT_ACCOUNT_NAME_LENGTH).regex(/^[a-zA-Z0-9_-]+$/);
export const IsUsername = ZodMatcher(UserNameSchema);

/**
 * Tests if the parameter is a valid character name
 *
 * TODO - finalize this to what we want
 */
export const CharacterNameSchema = z.string().min(3).max(LIMIT_CHARACTER_NAME_LENGTH).regex(/^[a-zA-Z0-9_\- ]+$/).regex(ZodTrimedRegex);
export const IsCharacterName = ZodMatcher(CharacterNameSchema);

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

/**
 * Tests if string is a 'simple' token format - 6 digits
 */
export const SimpleTokenSchema = z.string().length(6).regex(/^[0-9]+$/);
export const IsSimpleToken = ZodMatcher(SimpleTokenSchema);

export const PasswordSha512Schema = z.string().regex(/^[a-zA-Z0-9+/]{86}==$/);
