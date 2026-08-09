import { CLI_COMMANDS } from './commands/_index.ts';

export function GetHelp(): string {
	return `
Usage: pandora-cli <command> [… command-specific arguments]

For global configuration set the following ENV variables or edit the '.env' file.
ENV variables:
- PANDORA_API_TOKEN - Token that the API will use, required for most commands.
- PANDORA_API_SERVER - Directory server the API will connect to. See 'PandoraApiCreateOptions::directoryConnectionAddress' in API for full info.
    Common values:
      - "main" - Main production server. (default)
      - "mainFallback" - Fallback path to production server. Use sparingly, as it has lower capacity than default path.
      - "ptb" - Public Test Build server. See https://ptb.project-pandora.com/ for more details.
      - "localDev" - Default configuration for locally running development server. You can use this if you host your own Pandora instance for development.

Available commands:
`.trim() + '\n' +
		CLI_COMMANDS.map((c): string => (
			`- ${c.key} ${c.usage}\n    ${c.description.replaceAll('\n', '\n    ')}\n`
		)).join('');
}
