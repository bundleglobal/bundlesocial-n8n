import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { operationSpecs } from '../generated';
import { bundleSocialApiRequest, type BinaryStream, uploadToSignedUrl } from './transport';
import type { FieldShape, OperationSpec, ParamMapping } from './types';

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const isPlainObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// Date pickers return a local date time; read it in the workflow timezone and send UTC.
function toUtcIso(value: string, timeZone: string): string {
	if (!LOCAL_DATE_TIME.test(value)) return value;
	const asUtc = new Date(`${value}Z`);
	if (Number.isNaN(asUtc.getTime())) return value;
	const zoned = new Date(asUtc.toLocaleString('en-US', { timeZone }));
	const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
	return new Date(asUtc.getTime() - (zoned.getTime() - utc.getTime())).toISOString();
}

function setPath(target: IDataObject, path: string, value: unknown) {
	const keys = path.split('.');
	let current = target;
	for (const key of keys.slice(0, -1)) {
		if (!isPlainObject(current[key])) current[key] = {};
		current = current[key] as IDataObject;
	}
	current[keys[keys.length - 1]] = value as IDataObject[keyof IDataObject];
}

class ValueConverter {
	private readonly ctx: IExecuteFunctions;

	private readonly itemIndex: number;

	constructor(ctx: IExecuteFunctions, itemIndex: number) {
		this.ctx = ctx;
		this.itemIndex = itemIndex;
	}

	convert(value: unknown, shape: FieldShape | undefined, label: string): unknown {
		if (value === undefined || value === null) return undefined;
		switch (shape?.kind ?? 'value') {
			case 'date':
				return value === '' ? undefined : toUtcIso(String(value), this.ctx.getTimezone());
			case 'list':
				return this.toList(value, shape?.kind === 'list' && shape.numeric === true, label);
			case 'json':
				return this.parseJson(value, label);
			case 'object':
				return this.toObject(value, shape?.kind === 'object' ? shape.fields : undefined, label);
			case 'items':
				return this.toItems(value, shape as Extract<FieldShape, { kind: 'items' }>, label);
			default:
				if (value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
				return value;
		}
	}

	parseJson(value: unknown, label: string): unknown {
		if (typeof value !== 'string') return value;
		if (value.trim() === '') return undefined;
		try {
			return JSON.parse(value);
		} catch {
			throw new NodeOperationError(this.ctx.getNode(), `"${label}" is not valid JSON`, {
				itemIndex: this.itemIndex,
			});
		}
	}

	private toList(value: unknown, numeric: boolean, label: string): unknown[] | undefined {
		let list: unknown[];
		if (Array.isArray(value)) {
			list = value;
		} else if (typeof value === 'string') {
			const text = value.trim();
			if (!text) return undefined;
			if (text.startsWith('[')) {
				const parsed = this.parseJson(text, label);
				list = Array.isArray(parsed) ? parsed : [parsed];
			} else {
				list = text.split(',').map((part) => part.trim());
			}
		} else {
			list = [value];
		}
		list = list.filter((entry) => entry !== '' && entry !== null && entry !== undefined);
		if (numeric) {
			list = list.map((entry) => {
				const num = Number(entry);
				if (Number.isNaN(num)) {
					throw new NodeOperationError(this.ctx.getNode(), `"${label}" must contain numbers only`, {
						itemIndex: this.itemIndex,
					});
				}
				return num;
			});
		}
		return list.length ? list : undefined;
	}

	private toObject(
		value: unknown,
		fields: Record<string, FieldShape> | undefined,
		label: string,
	): IDataObject | undefined {
		if (!isPlainObject(value)) return this.parseJson(value, label) as IDataObject | undefined;
		const out: IDataObject = {};
		for (const [key, entry] of Object.entries(value)) {
			const converted = this.convert(entry, fields?.[key], `${label} > ${key}`);
			if (converted !== undefined) out[key] = converted as IDataObject[keyof IDataObject];
		}
		return Object.keys(out).length ? out : undefined;
	}

	private toItems(
		value: unknown,
		shape: Extract<FieldShape, { kind: 'items' }>,
		label: string,
	): IDataObject | IDataObject[] | undefined {
		if (!isPlainObject(value)) return this.parseJson(value, label) as IDataObject | undefined;
		const group = value.values;
		const rows = (Array.isArray(group) ? group : group ? [group] : []) as IDataObject[];
		const items = rows
			.map((row) => {
				const { [shape.merge ?? '']: extra, ...rest } = row;
				const merged = shape.merge && isPlainObject(extra) ? { ...rest, ...extra } : row;
				return this.toObject(merged, shape.fields, label);
			})
			.filter((row): row is IDataObject => row !== undefined);
		if (!items.length) return undefined;
		return shape.multiple ? items : items[0];
	}
}

function buildMultipartBody(
	fields: IDataObject,
	file: { field: string; name: string; mimeType: string; data: Buffer },
): { body: Buffer; contentType: string } {
	const boundary = `----n8nBundleSocial${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const escape = (text: string) => text.replace(/"/g, '%22').replace(/\r?\n/g, ' ');
	const chunks: Buffer[] = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		chunks.push(
			Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${escape(key)}"\r\n\r\n${text}\r\n`),
		);
	}
	chunks.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${escape(file.field)}"; filename="${escape(file.name)}"\r\n` +
				`Content-Type: ${file.mimeType}\r\n\r\n`,
		),
		file.data,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function runOperation(
	this: IExecuteFunctions,
	spec: OperationSpec,
	itemIndex: number,
): Promise<unknown> {
	const converter = new ValueConverter(this, itemIndex);
	const useJsonBody =
		spec.jsonBodyOnly === true ||
		(spec.body === 'json' && this.getNodeParameter('bodyInput', itemIndex, 'fields') === 'json');

	let endpoint = spec.path;
	const qs: IDataObject = {};
	let body: IDataObject = JSON.parse(JSON.stringify(spec.bodyDefaults ?? {}));
	let rawBody: unknown;
	let file: { field: string; property: string } | undefined;

	const read = (param: ParamMapping) => this.getNodeParameter(param.name, itemIndex, null) as unknown;

	for (const param of spec.params) {
		const isBodyField = param.in === 'body' || param.in === 'bodyMerge';
		if (param.in === 'jsonBody') {
			if (useJsonBody) rawBody = converter.parseJson(read(param), 'JSON Body');
			continue;
		}
		if (isBodyField && useJsonBody) continue;

		switch (param.in) {
			case 'path': {
				const value = String(read(param) ?? '').trim();
				if (!value) {
					throw new NodeOperationError(this.getNode(), `"${param.name}" is required`, { itemIndex });
				}
				endpoint = endpoint.replace(`{${param.key}}`, encodeURIComponent(value));
				break;
			}
			case 'query': {
				const value = converter.convert(read(param), param.shape, param.name);
				if (value !== undefined) qs[param.key ?? param.name] = value as IDataObject[keyof IDataObject];
				break;
			}
			case 'queryMerge': {
				const value = converter.convert(read(param), param.shape, param.name);
				if (isPlainObject(value)) Object.assign(qs, value);
				break;
			}
			case 'body': {
				const value = converter.convert(read(param), param.shape, param.name);
				if (value !== undefined) setPath(body, param.key ?? param.name, value);
				break;
			}
			case 'bodyMerge': {
				const value = converter.convert(read(param), param.shape, param.name);
				if (isPlainObject(value)) body = { ...body, ...value };
				break;
			}
			case 'file':
				file = { field: param.key ?? 'file', property: String(read(param) ?? 'data') };
				break;
		}
	}

	if (spec.pagination) {
		return await paginate.call(this, spec, spec.pagination, endpoint, qs, itemIndex);
	}

	if (spec.custom === 'uploadLargeFile') {
		return await uploadLargeFile.call(this, body, file?.property ?? 'data', itemIndex);
	}

	if (spec.body === 'multipart') {
		if (!file) {
			throw new NodeOperationError(this.getNode(), 'No binary field configured for the upload', { itemIndex });
		}
		const binary = this.helpers.assertBinaryData(itemIndex, file.property);
		const data = await this.helpers.getBinaryDataBuffer(itemIndex, file.property);
		const multipart = buildMultipartBody(body, {
			field: file.field,
			name: binary.fileName ?? 'file',
			mimeType: binary.mimeType || 'application/octet-stream',
			data,
		});
		return await bundleSocialApiRequest.call(this, spec.method, endpoint, {
			qs,
			body: multipart.body,
			headers: { 'Content-Type': multipart.contentType },
			itemIndex,
		});
	}

	const sendsBody = spec.body === 'json';
	return await bundleSocialApiRequest.call(this, spec.method, endpoint, {
		qs,
		body: sendsBody ? ((useJsonBody ? rawBody ?? {} : body) as IDataObject) : undefined,
		itemIndex,
	});
}

// Large files skip the multipart endpoint: init a signed URL, PUT the file to storage, finalize.
async function uploadLargeFile(
	this: IExecuteFunctions,
	fields: IDataObject,
	property: string,
	itemIndex: number,
): Promise<unknown> {
	const binary = this.helpers.assertBinaryData(itemIndex, property);
	let data: Buffer | BinaryStream;
	let size: number;
	if (binary.id) {
		// Filesystem or S3 binary mode: stream instead of loading the whole file into memory.
		size = (await this.helpers.getBinaryMetadata(binary.id)).fileSize;
		data = await this.helpers.getBinaryStream(binary.id);
	} else {
		const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, property);
		size = buffer.length;
		data = buffer;
	}

	const init = (await bundleSocialApiRequest.call(this, 'POST', '/api/v1/upload/init', {
		body: { ...fields, fileName: binary.fileName ?? 'file', mimeType: binary.mimeType, fileSize: size },
		itemIndex,
	})) as { url: string; path: string };
	await uploadToSignedUrl.call(this, init.url, data, size, itemIndex);
	return await bundleSocialApiRequest.call(this, 'POST', '/api/v1/upload/finalize', {
		body: { ...fields, path: init.path },
		itemIndex,
	});
}

async function paginate(
	this: IExecuteFunctions,
	spec: OperationSpec,
	{ itemsKey, pageSize }: NonNullable<OperationSpec['pagination']>,
	endpoint: string,
	qs: IDataObject,
	itemIndex: number,
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const results: IDataObject[] = [];
	let offset = 0;

	while (results.length < limit) {
		const response = (await bundleSocialApiRequest.call(this, spec.method, endpoint, {
			qs: { ...qs, offset, limit: Math.min(pageSize, limit - results.length) },
			itemIndex,
		})) as IDataObject;
		const page = (response?.[itemsKey] as IDataObject[] | undefined) ?? [];
		results.push(...page);
		offset += page.length;
		const total = typeof response?.total === 'number' ? response.total : undefined;
		if (!page.length || (total !== undefined && offset >= total)) break;
	}
	return results.slice(0, limit);
}

function toItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		return response.map((entry) => (isPlainObject(entry) ? entry : { value: entry }));
	}
	if (isPlainObject(response)) return [response];
	if (response === undefined || response === null || response === '') return [{ success: true }];
	return [{ value: response }];
}

export async function executeOperations(this: IExecuteFunctions): Promise<INodeExecutionData[]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const resource = this.getNodeParameter('resource', itemIndex) as string;
			const operation = this.getNodeParameter('operation', itemIndex) as string;
			const spec = operationSpecs[resource]?.[operation];
			if (!spec) {
				throw new NodeOperationError(
					this.getNode(),
					`The operation "${operation}" is not supported for resource "${resource}"`,
					{ itemIndex },
				);
			}
			const response = await runOperation.call(this, spec, itemIndex);
			returnData.push(
				...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(toItems(response)), {
					itemData: { item: itemIndex },
				}),
			);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
				continue;
			}
			const nodeError =
				error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			throw nodeError;
		}
	}

	return returnData;
}
