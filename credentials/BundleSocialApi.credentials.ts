import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BundleSocialApi implements ICredentialType {
	name = 'bundleSocialApi';

	displayName = 'bundle.social API';

	icon: Icon = { light: 'file:../icons/bundlesocial.svg', dark: 'file:../icons/bundlesocial.dark.svg' };

	documentationUrl = 'https://info.bundle.social/api-reference/introduction';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Create one in the bundle.social dashboard under Organization > API Keys',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.bundle.social',
			description: 'Change only to point the node at a non-production API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/organization/',
			method: 'GET',
		},
	};
}
