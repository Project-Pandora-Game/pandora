/** Services available on Padora's client, when running in normal user mode. */
type ClientServices = import('pandora-common').Satisfies<
	{
		directoryConnector: import('../networking/directoryConnector').DirectoryConnector;
	},
	import('pandora-common').BaseServicesDefinition
>;
