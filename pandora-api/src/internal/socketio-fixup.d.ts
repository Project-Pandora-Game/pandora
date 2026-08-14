/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/naming-convention, @typescript-eslint/no-empty-object-type */

// Public type shims to allow pandora-api to be platform independent

declare function setTimeout(handler: string | Function, timeout?: number, ...arguments: any[]): any;

interface Headers { }
