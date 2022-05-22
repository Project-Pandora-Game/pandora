import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
const { getRandomValues, subtle } = webcrypto;

global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder;
global.btoa ??= (str) => Buffer.from(str).toString('base64');
global.atob ??= (str) => Buffer.from(str, 'base64').toString('utf8');

global.crypto ??= webcrypto;
global.crypto.getRandomValues ??= getRandomValues;
global.crypto.subtle ??= subtle;

