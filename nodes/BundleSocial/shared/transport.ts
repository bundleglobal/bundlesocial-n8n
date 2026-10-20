import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const CREDENTIAL_TYPE = 'bundleSocialApi';
const DEFAULT_BASE_URL = 'https://api.bundle.social';

export type BinaryStream =Awaited<ReturnType<IExecuteFunctions['helpers']['getBinaryStream']>>;

export interface ApiRequestOptions {
	qs?: IDataObject;
	body?: IDataObject | IDataObject[] | Buffer;
	headers?: IDataObject;
	itemIndex?: number;
}

interface ApiErrorBody {
	message?: unknown;
	issues?: Array<{ message?: unknown; path?: unknown }>;
}

// The API splits comma-separated query values into arrays, so arrays are sent joined.
function serializeQuery(qs: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = Array.isArray(value) ? value.join(',') : value;
	}
	return out;
}

// Validation errors carry one issue per invalid field; list them so the user sees which field failed.
function toApiError(node: INode, response: IN8nHttpFullResponse, itemIndex?: number): NodeApiError {
	const isObject =
		typeof response.body === 'object' && response.body !== null && !Array.isArray(response.body);
	const body = (isObject ? response.body : {}) as unknown as ApiErrorBody;
	const message =
		typeof body.message === 'string' && body.message
			? body.message
			: `Request failed with status ${response.statusCode}`;
	const issues = Array.isArray(body.issues)
		? body.issues.map((issue) => {
				const path = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'body';
				return `${path}: ${String(issue.message)}`;
			})
		: [];
	return new NodeApiError(node, body as unknown as JsonObject, {
		message,
		description: issues.length ? issues.join('\n') : undefined,
		httpCode: String(response.statusCode),
		itemIndex,
	});
}

export async function bundleSocialApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	options: ApiRequestOptions = {},
): Promise<unknown> {
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		qs: serializeQuery(options.qs ?? {}),
		headers: options.headers,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (options.body !== undefined) request.body = options.body;

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_TYPE,
			request,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: options.itemIndex });
	}
	if (response.statusCode >= 400) throw toApiError(this.getNode(), response, options.itemIndex);
	return response.body;
}

// The signed URL from /upload/init carries its own credentials and expects an octet stream.
export async function uploadToSignedUrl(
	this: IExecuteFunctions,
	url: string,
	body: Buffer | BinaryStream,
	size: number,
	itemIndex: number,
): Promise<void> {
	try {
		await this.helpers.httpRequest({
			method: 'PUT',
			url,
			body,
			headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': size },
		});
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: 'Uploading the file to storage failed',
			itemIndex,
		});
	}
}
