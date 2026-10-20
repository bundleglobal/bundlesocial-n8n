import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { binaryFile, isVisible, properties, requiredValues, run } from './helpers.mjs';

// The CommonJS build is the one dist/ loads; n8n-workflow's ESM build does not run on plain Node.
const { NodeApiError, NodeOperationError } = createRequire(import.meta.url)('n8n-workflow');

describe('Post > Create', () => {
	const base = {
		resource: 'post',
		operation: 'create',
		teamId: 'team-1',
		title: 'Launch',
		postDate: '2026-01-01T00:00:00Z',
		status: 'DRAFT',
		socialAccountTypes: ['TIKTOK'],
	};

	it('builds the body from platform settings, lists, nested items and dates', async () => {
		const { requests, output } = await run({
			...base,
			postDate: '2026-10-21T10:00:00',
			status: 'SCHEDULED',
			socialAccountTypes: ['TIKTOK', 'INSTAGRAM'],
			dataTiktok: {
				text: 'Hello',
				uploadIds: 'u1, u2',
				privacy: 'PUBLIC_TO_EVERYONE',
				musicSoundInfo: { musicSoundId: 'm1' },
				disableComments: false,
			},
			dataInstagram: {
				text: 'Hi',
				carouselItems: { values: [{ uploadId: 'u1', additionalFields: { altText: 'alt' } }, { uploadId: 'u2' }] },
			},
			firstComment: { INSTAGRAM: 'first!' },
			additionalFields: { referenceKey: 'ref-1' },
		});
		assert.equal(requests.length, 1);
		assert.equal(requests[0].method, 'POST');
		assert.equal(requests[0].url, 'https://api.bundle.social/api/v1/post/');
		assert.deepEqual(requests[0].body, {
			data: {
				TIKTOK: {
					text: 'Hello',
					uploadIds: ['u1', 'u2'],
					privacy: 'PUBLIC_TO_EVERYONE',
					musicSoundInfo: { musicSoundId: 'm1' },
					disableComments: false,
				},
				INSTAGRAM: { text: 'Hi', carouselItems: [{ uploadId: 'u1', altText: 'alt' }, { uploadId: 'u2' }] },
			},
			teamId: 'team-1',
			title: 'Launch',
			// 10:00 in Europe/Warsaw (CEST) is 08:00 UTC.
			postDate: '2026-10-21T08:00:00.000Z',
			status: 'SCHEDULED',
			socialAccountTypes: ['TIKTOK', 'INSTAGRAM'],
			firstComment: { INSTAGRAM: 'first!' },
			referenceKey: 'ref-1',
		});
		assert.deepEqual(output[0].pairedItem, { item: 0 });
	});

	it('ignores settings of platforms that are not selected', async () => {
		const { requests } = await run({ ...base, dataYoutube: { text: 'hidden' }, dataTiktok: { text: 'shown' } });
		assert.deepEqual(requests[0].body.data, { TIKTOK: { text: 'shown' } });
	});

	it('shows platform sections only for selected platforms, or all of them for an expression', () => {
		const youtube = properties.find(
			(p) => p.name === 'dataYoutube' && p.displayOptions.show.resource[0] === 'post' && p.displayOptions.show.operation[0] === 'create',
		);
		assert.deepEqual(youtube.displayOptions.show.socialAccountTypes, ['YOUTUBE']);
		assert.equal(isVisible(youtube, { ...base, socialAccountTypes: ['TIKTOK'] }), false);
		assert.equal(isVisible(youtube, { ...base, socialAccountTypes: ['TIKTOK', 'YOUTUBE'] }), true);
		assert.equal(isVisible(youtube, { ...base, socialAccountTypes: '={{ $json.platforms }}' }), true);
		const firstComment = properties.find(
			(p) => p.name === 'firstComment' && p.displayOptions.show.resource[0] === 'post' && p.displayOptions.show.operation[0] === 'create',
		);
		const instagram = firstComment.options.find((o) => o.name === 'INSTAGRAM');
		assert.deepEqual(instagram.displayOptions.show['/socialAccountTypes'], ['INSTAGRAM']);
	});

	it('sends the JSON body as-is and ignores field parameters', async () => {
		const body = { ...base, data: { TIKTOK: { text: 'raw' } } };
		const { requests } = await run({ ...base, bodyInput: 'json', jsonBody: JSON.stringify(body), teamId: 'ignored' });
		assert.deepEqual(requests[0].body, body);
	});

	it('keeps the required data object when no platform settings are set', async () => {
		const { requests } = await run(base);
		assert.deepEqual(requests[0].body.data, {});
		assert.equal(requests[0].body.postDate, '2026-01-01T00:00:00Z');
	});

	it('rejects invalid JSON with a node error', async () => {
		await assert.rejects(
			run({ ...base, bodyInput: 'json', jsonBody: '{oops' }),
			(error) => error instanceof NodeOperationError && /not valid JSON/.test(error.message),
		);
	});
});

describe('Post > Get Many', () => {
	it('pages through every result with Return All', async () => {
		const page = (n) => ({ items: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })), total: 230 });
		const { requests, output } = await run(
			{
				resource: 'post',
				operation: 'getAll',
				teamId: 't',
				returnAll: true,
				options: { platforms: ['TIKTOK', 'YOUTUBE'], status: 'POSTED' },
			},
			{ responses: [page(100), page(100), page(30)] },
		);
		assert.deepEqual(
			requests.map((r) => r.qs.offset),
			[0, 100, 200],
		);
		assert.equal(requests[0].qs.platforms, 'TIKTOK,YOUTUBE');
		assert.equal(requests[0].qs.teamId, 't');
		assert.equal(requests[0].qs.limit, 100);
		assert.equal(output.length, 230);
	});

	it('stops at the limit', async () => {
		const { requests, output } = await run(
			{ resource: 'post', operation: 'getAll', teamId: 't', limit: 5 },
			{ responses: [{ items: Array.from({ length: 5 }, (_, i) => ({ id: i })), total: 99 }] },
		);
		assert.equal(requests.length, 1);
		assert.equal(requests[0].qs.limit, 5);
		assert.equal(output.length, 5);
	});
});

describe('requests', () => {
	it('encodes path parameters', async () => {
		const { requests } = await run({ resource: 'post', operation: 'get', id: 'abc/1' });
		assert.equal(requests[0].url, 'https://api.bundle.social/api/v1/post/abc%2F1');
		assert.equal(requests[0].body, undefined);
	});

	it('sends only the fields that were set on update', async () => {
		const { requests } = await run({
			resource: 'post',
			operation: 'update',
			id: 'p1',
			updateFields: { title: 'New' },
			dataLinkedin: { text: 'Edited' },
		});
		assert.equal(requests[0].method, 'PATCH');
		assert.deepEqual(requests[0].body, { data: { LINKEDIN: { text: 'Edited' } }, title: 'New' });
	});

	it('sends a JSON body on DELETE when the API expects one', async () => {
		const { requests } = await run({ resource: 'twitter', operation: 'deletePost', teamId: 't', postId: 'p' });
		assert.equal(requests[0].method, 'DELETE');
		assert.deepEqual(requests[0].body, { teamId: 't', postId: 'p' });
	});

	it('maps a body field named action without clashing with the operation selector', async () => {
		const { requests } = await run({
			resource: 'commentImport',
			operation: 'actOnFetchedComment',
			...requiredValues('commentImport', 'actOnFetchedComment'),
		});
		assert.equal(typeof requests[0].body.action, 'string');
	});
});

describe('uploads', () => {
	it('sends Upload File as multipart with the binary and form fields', async () => {
		const binary = { data: binaryFile('PNGDATA', 'a "b".png', 'image/png') };
		const { requests } = await run(
			{ resource: 'upload', operation: 'uploadFile', additionalFields: { teamId: 'team-9' } },
			{ binary },
		);
		const text = requests[0].body.toString();
		assert.match(requests[0].headers['Content-Type'], /^multipart\/form-data; boundary=/);
		assert.match(text, /name="teamId"\r\n\r\nteam-9\r\n/);
		assert.match(text, /name="file"; filename="a %22b%22.png"\r\nContent-Type: image\/png\r\n\r\nPNGDATA\r\n/);
	});

	it('runs init, storage PUT and finalize for Upload Large File', async () => {
		const binary = { data: binaryFile('VIDEO', 'clip.mp4', 'video/mp4') };
		const { requests, uploads, output } = await run(
			{ resource: 'upload', operation: 'uploadLargeFile', additionalFields: { teamId: 'team-9' } },
			{
				binary,
				responses: [{ url: 'https://storage.example/signed', path: 'team-9/x.mp4' }, { id: 'upload-1' }],
			},
		);
		assert.deepEqual(
			requests.map((r) => r.url),
			['https://api.bundle.social/api/v1/upload/init', 'https://api.bundle.social/api/v1/upload/finalize'],
		);
		assert.deepEqual(requests[0].body, { teamId: 'team-9', fileName: 'clip.mp4', mimeType: 'video/mp4', fileSize: 5 });
		assert.deepEqual(requests[1].body, { teamId: 'team-9', path: 'team-9/x.mp4' });
		assert.equal(uploads[0].method, 'PUT');
		assert.equal(uploads[0].url, 'https://storage.example/signed');
		assert.equal(uploads[0].headers['Content-Type'], 'application/octet-stream');
		assert.equal(uploads[0].body.toString(), 'VIDEO');
		assert.deepEqual(output[0].json, { id: 'upload-1' });
	});

	it('streams large files stored outside memory', async () => {
		const binary = { data: { id: 'fs:1', fileName: 'big.mp4', mimeType: 'video/mp4' } };
		const { uploads, requests } = await run(
			{ resource: 'upload', operation: 'uploadLargeFile' },
			{
				binary,
				binaryFiles: { 'fs:1': Buffer.alloc(42) },
				responses: [{ url: 'https://storage.example/signed', path: 'p' }, { id: 'u' }],
			},
		);
		assert.equal(requests[0].body.fileSize, 42);
		assert.equal(uploads[0].headers['Content-Length'], 42);
		assert.ok(uploads[0].body.stream, 'expected the binary stream as the PUT body');
	});
});

describe('errors and output', () => {
	it('lists validation issues per field', async () => {
		const response = {
			status: 400,
			body: {
				message: 'Validation failed',
				issues: [
					{ path: ['data', 'TIKTOK', 'text'], message: 'Required' },
					{ path: [], message: 'Bad body' },
				],
			},
		};
		await assert.rejects(run({ resource: 'team', operation: 'get', id: 't' }, { responses: [response] }), (error) => {
			assert.ok(error instanceof NodeApiError);
			assert.equal(error.message, 'Validation failed');
			assert.equal(error.httpCode, '400');
			assert.equal(error.description, 'data.TIKTOK.text: Required\nbody: Bad body');
			return true;
		});
	});

	it('returns errors as items with continueOnFail', async () => {
		const response = { status: 404, body: { message: 'Team not found' } };
		const { output } = await run(
			{ resource: 'team', operation: 'get', id: 't' },
			{ responses: [response], continueOnFail: true },
		);
		assert.deepEqual(output, [{ json: { error: 'Team not found' }, pairedItem: { item: 0 } }]);
	});

	it('wraps network failures in a NodeApiError', async () => {
		await assert.rejects(
			run({ resource: 'team', operation: 'get', id: 't' }, { responses: [new Error('socket hang up')] }),
			(error) => error instanceof NodeApiError,
		);
	});

	it('splits array responses into items and turns empty responses into success', async () => {
		let { output } = await run(
			{ resource: 'upload', operation: 'getAll', teamId: 't' },
			{ responses: [[{ id: 1 }, { id: 2 }]] },
		);
		assert.equal(output.length, 2);
		({ output } = await run({ resource: 'automation', operation: 'pause', id: 'f' }, { responses: [''] }));
		assert.deepEqual(output[0].json, { success: true });
	});
});

it('builds a request for every operation from its required parameters', async () => {
	const resources = properties.find((p) => p.name === 'resource').options.map((o) => o.value);
	for (const resource of resources) {
		const selector = properties.find(
			(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.[0] === resource,
		);
		for (const { value: operation } of selector.options) {
			const binary = { data: binaryFile('x', 'f.csv', 'text/csv') };
			const { requests } = await run(requiredValues(resource, operation), {
				binary,
				responses: [{ items: [], total: 0, url: 'https://storage.example/signed', path: 'p' }],
			});
			assert.ok(requests.length >= 1, `${resource}.${operation} sent no request`);
			for (const request of requests) {
				assert.doesNotMatch(request.url, /[{}]/, `${resource}.${operation} left a path placeholder`);
			}
		}
	}
});
