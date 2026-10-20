// Mocked n8n execution context for running the built node without an n8n instance.
import assert from 'node:assert/strict';
import { BundleSocial } from '../dist/nodes/BundleSocial/BundleSocial.node.js';

export const node = new BundleSocial();
export const properties = node.description.properties;

// Mirrors n8n's displayOptions: array values match when any entry matches, expressions always show.
function matches(allowed, value) {
	const values = Array.isArray(value) ? value : [value];
	if (values.some((v) => typeof v === 'string' && v.startsWith('='))) return true;
	return allowed.some((entry) => values.includes(entry));
}

function valueOf(name, params) {
	if (name in params) return params[name];
	return properties.find((p) => p.name === name && isVisible(p, params))?.default;
}

export function isVisible(prop, params) {
	const show = prop.displayOptions?.show ?? {};
	return Object.entries(show).every(([key, allowed]) => matches(allowed, valueOf(key.replace(/^\//, ''), params)));
}

/** Values for every required, visible top-level parameter of an operation. */
export function requiredValues(resource, operation) {
	const values = { resource, operation };
	for (const p of properties) {
		if (!p.required || p.type === 'json' || !isVisible(p, values)) continue;
		if (p.type === 'options') values[p.name] = p.options?.[0]?.value ?? 'id-1';
		else if (p.type === 'multiOptions') values[p.name] = [p.options[0].value];
		else if (p.type === 'number') values[p.name] = 1;
		else if (p.name === 'binaryPropertyName') values[p.name] = 'data';
		else values[p.name] = p.hint ? '1' : 'value-1';
	}
	return values;
}

/**
 * Runs the node once. `responses` are API bodies (status 200), `{ status, body }` objects,
 * or Errors to throw; the last one repeats.
 */
export async function run(params, { responses = [], binary, continueOnFail = false, binaryFiles = {} } = {}) {
	const requests = [];
	const uploads = [];
	const nextResponse = () => (responses.length > 1 ? responses.shift() : responses[0]);
	const ctx = {
		getInputData: () => [{ json: {}, binary }],
		getNode: () => ({
			id: '1',
			name: 'bundle.social',
			type: 'n8n-nodes-bundlesocial.bundleSocial',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getTimezone: () => 'Europe/Warsaw',
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ apiKey: 'key', baseUrl: 'https://api.bundle.social/' }),
		getNodeParameter(name, _itemIndex, fallback) {
			const prop = properties.find((p) => p.name === name && isVisible(p, params));
			if (!prop) {
				if (fallback === undefined) throw new Error(`Could not get parameter "${name}"`);
				return fallback;
			}
			return name in params ? params[name] : prop.default;
		},
		helpers: {
			async httpRequestWithAuthentication(credentialType, request) {
				assert.equal(credentialType, 'bundleSocialApi');
				assert.equal(request.returnFullResponse, true);
				requests.push(request);
				const next = nextResponse();
				if (next instanceof Error) throw next;
				if (next && typeof next === 'object' && 'status' in next) {
					return { statusCode: next.status, body: next.body, headers: {} };
				}
				return { statusCode: 200, body: next ?? { ok: true }, headers: {} };
			},
			async httpRequest(request) {
				uploads.push(request);
				return '';
			},
			assertBinaryData(_itemIndex, property) {
				assert.ok(binary?.[property], `binary property "${property}" missing`);
				return binary[property];
			},
			getBinaryDataBuffer: async (_itemIndex, property) => Buffer.from(binary[property].data, 'base64'),
			getBinaryMetadata: async (id) => ({ fileSize: binaryFiles[id].length }),
			getBinaryStream: async (id) => ({ stream: binaryFiles[id] }),
			returnJsonArray: (data) => (Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (items, { itemData }) =>
				items.map((item) => ({ ...item, pairedItem: itemData })),
		},
	};
	const [output] = await node.execute.call(ctx);
	return { output, requests, uploads };
}

export const binaryFile = (text, fileName, mimeType) => ({
	data: Buffer.from(text).toString('base64'),
	fileName,
	mimeType,
});
