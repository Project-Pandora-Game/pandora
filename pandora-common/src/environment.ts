import * as z from 'zod';
import { GetLogger } from './logging/logging.ts';
import { IsObject, ZodTemplateString } from './validation.ts';

declare const process: Record<string, Record<string, unknown>>;

const logger = GetLogger('ENV');

export function CreateEnvParser<TEnvSchema extends Record<string, z.ZodType> = NonNullable<unknown>>(envSchema: TEnvSchema) {
	const transformed: Record<string, z.ZodType> = {};
	for (const [key, schema] of Object.entries(envSchema)) {
		if (!EnvironmentKeySchema.safeParse(key).success) {
			logger.fatal(`invalid environment key: ${key}`);
			throw new Error(`failed to create env: invalid environment key: ${key}`);
		}
		switch (GetZodDefType(schema)) {
			case 'boolean':
				transformed[key] = z.preprocess((arg, ctx) => {
					if (typeof arg !== 'string') {
						return arg;
					}
					switch (arg.trim().toLowerCase()) {
						case 'true':
							return true;
						case 'false':
							return false;
						default:
							ctx.addIssue({
								code: 'custom',
								message: 'must be a "true" or "false"',
							});
							return z.NEVER;
					}
				}, schema);
				break;
			case 'number':
				transformed[key] = z.preprocess((arg) => {
					if (typeof arg !== 'string') {
						return arg;
					}
					return parseInt(arg);
				}, schema);
				break;
			case 'unfiltered':
				transformed[key] = schema;
				break;
		}
	}
	return (obj?: Record<string, unknown>): EnvOutput<TEnvSchema> => {
		if (obj === undefined) {
			if (!IsObject(process?.env)) {
				logger.fatal('process.env is not an object');
				throw new Error('failed to create env: process.env is not an object');
			}
			obj = process.env;
		}
		const parsed = z.object(transformed).safeParse(obj);
		if (!parsed.success) {
			const errString = z.prettifyError(parsed.error);
			logger.fatal('Failed to create env:\n', errString);
			throw new Error('Failed to create env:\n' + errString);
		}
		return parsed.data as unknown as EnvOutput<TEnvSchema>;
	};
}

function GetZodDefType(schema: z.ZodType): 'number' | 'boolean' | 'unfiltered' {

	switch (schema.def.type) {
		case 'number':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'catch':
		case 'default':
		case 'lazy':
		case 'nullable':
		case 'optional':
		case 'readonly':
			return GetZodDefType((schema as z.ZodCatch<z.ZodType> | z.ZodDefault<z.ZodType> | z.ZodLazy<z.ZodType> | z.ZodNullable<z.ZodType> | z.ZodOptional<z.ZodType> | z.ZodReadonly<z.ZodType>).unwrap());
		default:
			return 'unfiltered';
	}
}

const EnvironmentKeySchema = ZodTemplateString(z.string(), /^[A-Z0-9_]+$/);

export type EnvOutput<TEnvSchema extends Record<string, z.ZodType>> = {
	readonly [K in keyof TEnvSchema]: z.output<TEnvSchema[K]>;
};

export type EnvInputJson<TEnvSchema extends Record<string, z.ZodType>> = {
	readonly [K in keyof TEnvSchema]: string | number | boolean;
};

export function EnvStringify(envOvj: Record<string, unknown>): Record<string, string | undefined> {
	const transformed: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(envOvj)) {
		transformed[key] = Stringify(value);
	}
	return transformed;
}

function Stringify(value: unknown, allowArray = true): string | undefined {
	if (value == null) {
		return undefined;
	}
	switch (typeof value) {
		case 'string':
			return value;
		case 'number':
			return value.toString();
		case 'boolean':
			return value ? 'true' : 'false';
		case 'object':
			if (allowArray && Array.isArray(value)) {
				return value.map((v: unknown) => Stringify(v, false)).join(',');
			}
			return undefined;
		default:
			return undefined;
	}
}

/**
 * Creates a Zod type that accepts a string representing a time interval in seconds (s), minutes (m), hours (h), days (d), or weeks (w). \
 * If no unit is specified or number is provided, it is assumed to be in milliseconds.
 *
 * Output is always in milliseconds.
 */
export function EnvTimeInterval(): z.ZodType<number, number | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | ''}`> {
	return z.preprocess((arg, ctx) => {
		if (typeof arg !== 'string') {
			return arg;
		}
		const match = /^(\d+)([smhdw])?$/.exec(arg);
		if (!match) {
			ctx.addIssue({
				code: 'custom',
				message: 'invalid time interval',
			});
			return z.NEVER;
		}
		const value = parseInt(match[1]);
		switch (match[2]) {
			case 's':
				return value * 1000;
			case 'm':
				return value * 60 * 1000;
			case 'h':
				return value * 60 * 60 * 1000;
			case 'd':
				return value * 24 * 60 * 60 * 1000;
			case 'w':
				return value * 7 * 24 * 60 * 60 * 1000;
			default:
				return value;
		}
	}, z.number().int().nonnegative());
}
