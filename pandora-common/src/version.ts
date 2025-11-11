/**
 * Version of database data.
 *
 * This dictates whether:
 * - Directory can migrate data (as some migrations are removed over time)
 * - Directory can load data (safeguard against backwards-incompatible migrations)
 * - Shard is allowed to communicate with Directory
 *
 * This should be increased whenever there is an backwards-incompatible migration introduced.
 *
 * Last updated: 2025/11
 */
export const PANDORA_VERSION_DATABASE = 1;
