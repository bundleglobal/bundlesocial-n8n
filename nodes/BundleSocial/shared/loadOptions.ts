import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { bundleSocialApiRequest } from './transport';

const PAGE_SIZE = 100;

interface TeamListResponse {
	items?: IDataObject[];
	total?: number;
}

async function getAllTeams(this: ILoadOptionsFunctions): Promise<IDataObject[]> {
	const teams: IDataObject[] = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const response = (await bundleSocialApiRequest.call(this, 'GET', '/api/v1/team/', {
			qs: { offset, limit: PAGE_SIZE },
		})) as TeamListResponse;
		const page = response.items ?? [];
		teams.push(...page);
		if (page.length < PAGE_SIZE || (response.total !== undefined && teams.length >= response.total)) {
			return teams;
		}
	}
}

export async function getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const teams = await getAllTeams.call(this);
	return teams
		.map((team) => ({ name: String(team.name ?? team.id), value: String(team.id) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSocialAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const teams = await getAllTeams.call(this);
	const options: INodePropertyOptions[] = [];
	for (const team of teams) {
		for (const account of (team.socialAccounts as IDataObject[] | undefined) ?? []) {
			const label = account.displayName ?? account.username ?? account.id;
			options.push({
				name: `${String(label)} (${String(account.type)}, ${String(team.name)})`,
				value: String(account.id),
			});
		}
	}
	return options.sort((a, b) => a.name.localeCompare(b.name));
}
