// This file is intended to run first before anything else is imported.
// Use it to handle the annoying libraries that need configuration before _any_ use.
import * as z from 'zod';

z.config({ jitless: true });
