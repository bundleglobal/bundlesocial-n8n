import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { nodeProperties } from './generated';
import { executeOperations } from './shared/execute';
import { getSocialAccounts, getTeams } from './shared/loadOptions';

export class BundleSocial implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'bundle.social - social media API',
		name: 'bundleSocial',
		icon: { light: 'file:../../icons/bundlesocial.svg', dark: 'file:../../icons/bundlesocial.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Publish and manage social media posts, comments, DMs and analytics with bundle.social. Unlimited social accounts.',
		defaults: {
			name: 'bundle.social',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'bundleSocialApi',
				required: true,
			},
		],
		properties: nodeProperties,
	};

	methods = {
		loadOptions: {
			getTeams,
			getSocialAccounts,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return [await executeOperations.call(this)];
	}
}
