#!/usr/bin/env node
// Generates the node's resource descriptions and operation specs from the bundle.social OpenAPI spec.
// Usage: node scripts/generate.mjs [path/to/openapi.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = process.argv[2] ?? path.join(ROOT, 'openapi', 'bundlesocial.openapi.json');
const OUT_DIR = path.join(ROOT, 'nodes', 'BundleSocial', 'generated');
const README_PATH = path.join(ROOT, 'README.md');
const API_DOCS_URL = 'https://info.bundle.social/api-reference/introduction';

// Objects and arrays nested deeper than this become JSON fields.
const MAX_DEPTH = 4;
const DEFAULT_PAGE_SIZE = 100;
const SKIPPED_OPERATIONS = new Set(['app.getHealth']);
const GET_MANY = 'Get Many';

const BRANDS = {
	TIKTOK: 'TikTok',
	YOUTUBE: 'YouTube',
	INSTAGRAM: 'Instagram',
	FACEBOOK: 'Facebook',
	TWITTER: 'X (Twitter)',
	THREADS: 'Threads',
	LINKEDIN: 'LinkedIn',
	PINTEREST: 'Pinterest',
	REDDIT: 'Reddit',
	MASTODON: 'Mastodon',
	DISCORD: 'Discord',
	SLACK: 'Slack',
	BLUESKY: 'Bluesky',
	GOOGLE_BUSINESS: 'Google Business Profile',
	SNAPCHAT: 'Snapchat',
};

const ACRONYMS = {
	id: 'ID',
	ids: 'IDs',
	url: 'URL',
	urls: 'URLs',
	uri: 'URI',
	dm: 'DM',
	dms: 'DMs',
	csv: 'CSV',
	api: 'API',
	ai: 'AI',
	cta: 'CTA',
	utc: 'UTC',
	iso: 'ISO',
	sku: 'SKU',
	json: 'JSON',
	html: 'HTML',
	gbp: 'GBP',
	oauth: 'OAuth',
	cml: 'CML',
	sms: 'SMS',
	utm: 'UTM',
	nsfw: 'NSFW',
};

// Resource value -> display name, plural noun for "Get many" actions, brand words dropped from actions.
const RESOURCES = {
	analytics: { name: 'Analytics', plural: 'analytics' },
	automation: { name: 'Automation', plural: 'automation flows' },
	automationProviderSetting: {
		name: 'Automation Provider Setting',
		plural: 'automation provider settings',
	},
	bluesky: { name: 'Bluesky', brands: ['Bluesky'] },
	comment: { name: 'Comment', plural: 'comments' },
	commentImport: { name: 'Comment Import', plural: 'comment imports' },
	conversation: { name: 'Conversation', plural: 'conversations' },
	credit: { name: 'Credit' },
	discord: { name: 'Discord', brands: ['Discord'] },
	facebook: { name: 'Facebook', brands: ['Facebook'] },
	googleBusinessProfile: { name: 'Google Business Profile', brands: ['Google Business', 'Google'] },
	instagram: { name: 'Instagram', brands: ['Instagram'] },
	linkedin: { name: 'LinkedIn', brands: ['LinkedIn', 'Linkedin'] },
	mastodon: { name: 'Mastodon', brands: ['Mastodon'] },
	organization: { name: 'Organization' },
	pinterest: { name: 'Pinterest', brands: ['Pinterest'] },
	post: { name: 'Post', plural: 'posts' },
	postCsvImport: { name: 'Post CSV Import', plural: 'post CSV imports' },
	postHistoryImport: { name: 'Post History Import', plural: 'post history imports' },
	reddit: { name: 'Reddit', brands: ['Reddit'] },
	slack: { name: 'Slack', brands: ['Slack'] },
	socialAccount: { name: 'Social Account', plural: 'social accounts' },
	team: { name: 'Team', plural: 'teams' },
	tiktok: { name: 'TikTok', brands: ['TikTok'] },
	twitter: { name: 'X (Twitter)', brands: ['Twitter/X', 'Twitter', 'X'] },
	upload: { name: 'Upload', plural: 'uploads' },
	youtube: { name: 'YouTube', brands: ['YouTube'] },
};

const OPERATION_NAMES = {
	'organization.getOrganization': 'Get',
	'team.getTeam': 'Get',
	'team.updateTeam': 'Update',
	'team.deleteTeam': 'Delete',
	'team.getList': GET_MANY,
	'team.createTeam': 'Create',
	'socialAccount.connectionCheck': 'Run Connection Check',
	'socialAccount.profileRefresh': 'Refresh Profile',
	'socialAccount.getByType': 'Get by Type',
	'socialAccount.getAccountsToDelete': 'Get Scheduled for Deletion',
	'upload.getList': GET_MANY,
	'upload.create': 'Upload File',
	'upload.createFromUrl': 'Create From URL',
	'upload.initLargeUpload': 'Initialize Large Upload',
	'upload.initMultipartUpload': 'Initialize Multipart Upload',
	'post.getReconnectSocialAccountCandidates': 'Get Reconnect Candidates',
	'post.getByReferenceKey': 'Get by Reference Key',
	'post.getList': GET_MANY,
	'credit.getCreditBalance': 'Get Balance',
	'analytics.getSocialAccountAnalytics': 'Get Social Account Analytics',
	'analytics.getPostAnalytics': 'Get Post Analytics',
	'analytics.getBulkPostAnalytics': 'Get Bulk Post Analytics',
	'analytics.forceSocialAccountAnalytics': 'Refresh Social Account Analytics',
	'analytics.forcePostAnalytics': 'Refresh Post Analytics',
	'analytics.getSocialAccountAnalyticsRaw': 'Get Raw Social Account Analytics',
	'analytics.getPostAnalyticsRaw': 'Get Raw Post Analytics',
	'comment.importCreate': 'Create',
	'comment.importGetList': GET_MANY,
	'comment.importGetFetchedComments': 'Get Fetched Comments',
	'comment.importActionFetchedComment': 'Act on Fetched Comment',
	'comment.importGetById': 'Get',
	'comment.getList': GET_MANY,
	'conversation.getList': GET_MANY,
	'conversation.reactMessage': 'React to Message',
	'conversation.markRead': 'Mark as Read',
	'conversation.privateReply': 'Send Private Reply',
	'automation.getFlows': GET_MANY,
	'automation.createFlow': 'Create',
	'automation.copyFlows': 'Copy',
	'automation.getFlow': 'Get',
	'automation.updateFlow': 'Update',
	'automation.deleteFlow': 'Delete',
	'automation.publishFlow': 'Publish',
	'automation.pauseFlow': 'Pause',
	'automation.activateFlow': 'Activate',
	'automation.archiveFlow': 'Archive',
	'automation.getFlowExecutions': 'Get Executions',
	'automation.getExecution': 'Get Execution',
	'automation.testFlow': 'Test',
	'automation.sendRichMessage': 'Send Rich Message',
	'automation.getProviderSettings': GET_MANY,
	'automation.upsertProviderSetting': 'Create or Update',
	'automation.syncProviderSetting': 'Sync',
	'misc.youtube.getChannelPlaylist': 'Get Playlists',
	'misc.youtube.createNewChannelPlaylist': 'Create Playlist',
	'misc.youtube.updateChannelPlaylist': 'Update Playlist',
	'misc.youtube.deleteChannelPlaylist': 'Delete Playlist',
	'misc.youtube.getVideosFromPlaylist': 'Get Playlist Videos',
	'misc.youtube.deleteVideoFromPlaylist': 'Remove Video From Playlist',
	'misc.linkedin.getTags': 'Search Mention Tags',
	'misc.linkedin.buildCommentary': 'Build Commentary With Mentions',
	'misc.facebook.getTokenDebug': 'Debug Token',
	'misc.facebook.getRecommendationImportStatus': 'Get Recommendation Imports',
	'misc.google_business.getReviewImportStatus': 'Get Review Imports',
	'misc.instagram.businessDiscovery': 'Discover Business Account',
	'misc.twitter.deleteTweet': 'Delete Post',
	'misc.twitter.retweet': 'Repost',
	'misc.twitter.unretweet': 'Undo Repost',
	'misc.tiktok.getCommercialMusicTrendingList': 'Get Trending Commercial Music',
	'postImport.create': 'Create',
	'postImport.getStatus': GET_MANY,
	'postImport.getById': 'Get',
	'postImport.retryImport': 'Retry',
	'postCSV.create': 'Create',
	'postCSV.getList': GET_MANY,
	'postCSV.getById': 'Get',
};

// Labels for objects whose children are promoted to their own top-level parameters.
const PROMOTED_SUFFIX = { data: 'Settings' };
// Strings that are dates in practice but typed as plain strings in the spec.
const DATE_FIELDS = new Set(['postDate']);
const DYNAMIC_OPTIONS = {
	teamId: { method: 'getTeams', label: 'Team Name or ID' },
	socialAccountId: { method: 'getSocialAccounts', label: 'Social Account Name or ID' },
};
const DYNAMIC_OPTIONS_DESCRIPTION =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';
const LIMIT_DESCRIPTION = 'Max number of results to return';
const RETURN_ALL_DESCRIPTION = 'Whether to return all results or only up to a given limit';
const SENSITIVE_NAME = /secret|password|token|apikey/i;
// n8n lint treats any options parameter named `action` like the operation selector.
const RESERVED_NAMES = new Set([
	'resource',
	'operation',
	'action',
	'returnAll',
	'limit',
	'additionalFields',
	'updateFields',
	'options',
	'bodyInput',
	'jsonBody',
	'binaryPropertyName',
]);

// ---------- text helpers ----------

const SMALL_WORDS = new Set(
	'a an and as at because but by en for if in neither nor of on only or over per so some than that the then to up upon v versus via vs when with without yet'.split(
		' ',
	),
);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const camelCase = (text) =>
	text
		.replace(/[^A-Za-z0-9 ]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word, i) => (i === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
		.join('');
const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();

// Words with inner capitals that camelCase splitting would break apart or flatten.
const MIXED_CASE_WORDS = { oauth: 'OAuth', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn' };

function splitWords(key) {
	return String(key)
		.replace(/OAuth/g, ' oauth ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[\s_\-./:]+/)
		.filter(Boolean);
}

function titleCase(text) {
	const words = text.split(' ').filter(Boolean);
	return words
		.map((word, i) => {
			const lower = word.toLowerCase();
			if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
			return word.replace(/[A-Za-z0-9]/, (c) => c.toUpperCase());
		})
		.join(' ');
}

function labelFor(key) {
	if (BRANDS[key]) return BRANDS[key];
	const words = splitWords(key).map((word) => {
		const fixed = ACRONYMS[word.toLowerCase()] ?? MIXED_CASE_WORDS[word.toLowerCase()];
		if (fixed) return fixed;
		if (isAllCaps(word) && word.length > 1) return capitalize(word.toLowerCase());
		return word;
	});
	return titleCase(words.join(' ')) || String(key);
}

function singular(word) {
	if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
	if (/ss$/i.test(word) || !/s$/i.test(word)) return word;
	return word.slice(0, -1);
}

function idLabel(key, apiPath) {
	if (key !== 'id') return labelFor(key);
	const segments = apiPath.split('/');
	const index = segments.indexOf('{id}');
	const owner = index > 0 ? segments[index - 1] : 'item';
	const words = splitWords(owner);
	words[words.length - 1] = singular(words[words.length - 1]);
	return `${labelFor(words.join(' '))} ID`;
}

// The casing n8n lint enforces for ID, URL and JSON in any description.
function fixCasing(text) {
	return text
		.replace(/\bids\b/gi, 'IDs')
		.replace(/\bid\b/gi, 'ID')
		.replace(/\burls\b/gi, 'URLs')
		.replace(/\burl\b/gi, 'URL')
		.replace(/\bjson\b/gi, 'JSON')
		.replace(/comma separated/gi, 'comma-separated');
}

// Applies the n8n description lint rules: casing, backticks, entities and final periods.
function cleanDescription(text) {
	if (!text) return undefined;
	let out = fixCasing(
		String(text)
			.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)')
			.replace(/\s+/g, ' ')
			.replace(/([a-z)])\.([A-Z])/g, '$1. $2')
			.trim()
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/`/g, "'"),
	);
	if (!out) return undefined;
	out = capitalize(out);
	const egLess = out.replace('e.g.', '');
	const sentences = egLess.split('. ').length;
	if (sentences === 1 && out.endsWith('.')) out = out.slice(0, -1);
	if (sentences >= 2 && !out.endsWith('.') && !out.endsWith('</code>') && !out.endsWith('---')) {
		out += '.';
	}
	return out;
}

const VERB_BASE_FORMS = {
	adds: 'add',
	allows: 'allow',
	controls: 'control',
	creates: 'create',
	disables: 'disable',
	enables: 'enable',
	excludes: 'exclude',
	forces: 'force',
	hides: 'hide',
	includes: 'include',
	keeps: 'keep',
	makes: 'make',
	marks: 'mark',
	notifies: 'notify',
	publishes: 'publish',
	removes: 'remove',
	requires: 'require',
	returns: 'return',
	routes: 'route',
	sends: 'send',
	sets: 'set',
	shows: 'show',
	skips: 'skip',
	uploads: 'upload',
	uses: 'use',
};
const BASE_VERBS = new Set(Object.values(VERB_BASE_FORMS));

// Spec descriptions that no rewrite rule turns into a good "Whether ..." sentence.
// Keys are `<operationId>.<field>` or just `<field>`.
const BOOLEAN_DESCRIPTIONS = {
	'socialAccount.connect.withBusinessScope':
		'Whether to request the business scopes: business_management, ads_management and ads_read on Facebook and Instagram, and the monetary analytics scope on YouTube',
	'socialAccount.createPortalLink.withBusinessScope':
		'Whether the portal skips the business scope selection modal on Facebook login paths. Facebook and Instagram only.',
	withMessagingScope:
		'Whether to request the Meta messaging (DM) scopes on Facebook and Instagram. Ignored unless messaging is enabled for your organization.',
	// The spec has the Duet and Stitch descriptions swapped.
	disableDuet: 'Whether other TikTok users are prevented from making Duets with this post',
	disableStitch: 'Whether other TikTok users are prevented from making Stitches with this post',
};

const BRAND_WORDS = new Set(Object.values(BRANDS).flatMap((b) => b.split(' ')).concat(['Meta', 'Google']));
const CONDITION_PREFIX =
	/^(?:if set to true|if you set (?:that|this|it) to true|set to true if|if true|if enabled|when true|when enabled)[,\s]+/i;
const TO_PREFIX = /^(?:set to true to|true to|flag to)\s+/i;

function whetherTo(text) {
	const [first, ...rest] = text.split(' ');
	if (BRAND_WORDS.has(first)) return `Whether ${text}`;
	const verb = first.toLowerCase();
	return `Whether to ${[VERB_BASE_FORMS[verb] ?? verb, ...rest].join(' ')}`;
}

function whetherClause(text) {
	const clause = text.replace(/^indicates?\s+(?:that\s+)?/i, '');
	const [first, ...rest] = clause.split(' ');
	const verb = first.toLowerCase();
	const base = VERB_BASE_FORMS[verb] ?? (BASE_VERBS.has(verb) ? verb : undefined);
	return base ? `Whether to ${[base, ...rest].join(' ')}` : `Whether ${clause}`;
}

// n8n requires boolean descriptions to start with "Whether".
function booleanDescription(text, key) {
	const override = BOOLEAN_DESCRIPTIONS[`${currentOperationId}.${key}`] ?? BOOLEAN_DESCRIPTIONS[key];
	if (override) return cleanDescription(override);
	const cleaned = cleanDescription(text);
	if (!cleaned) return undefined;
	if (/^whether\b/i.test(cleaned)) return cleaned;
	const sentences = cleaned
		.replace(/\.$/, '')
		.split(/\.\s+/)
		.map((s) => s.trim().replace(/^optional and experimental$/i, 'Experimental'))
		.filter((s) => s && !/^optional$/i.test(s));
	if (!sentences.length) return undefined;
	let index = sentences.findIndex((s) => CONDITION_PREFIX.test(s) || TO_PREFIX.test(s));
	if (index < 0) index = 0;
	const sentence = sentences[index];
	const main = TO_PREFIX.test(sentence)
		? whetherTo(sentence.replace(TO_PREFIX, ''))
		: CONDITION_PREFIX.test(sentence)
			? whetherClause(sentence.replace(CONDITION_PREFIX, ''))
			: whetherTo(sentence);
	const others = sentences
		.filter((_, i) => i !== index)
		.map((s) => s.replace(/^(when false|if false),?\s+indicates?\s+(?:that\s+)?/i, '$1, '));
	return cleanDescription([main, ...others].join('. '));
}

function firstSentence(text, max = 200) {
	if (!text) return undefined;
	const plain = String(text)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/`/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const match = plain.match(/^(.+?[.!?])(\s|$)/);
	let sentence = (match ? match[1] : plain).replace(/[.!?]$/, '');
	if (sentence.length > max) sentence = sentence.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
	return sentence;
}

function sentenceCaseAction(summary, brands = []) {
	let text = String(summary)
		.replace(/\[[^\]]*\]/g, ' ')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\//g, ' or ')
		.replace(/&/g, ' and ');
	for (const brand of [...brands].sort((a, b) => b.length - a.length)) {
		const escaped = brand.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
		text = text.replace(new RegExp(`\\b${escaped}\\b`, 'g'), ' ');
	}
	const words = text
		.replace(/[^A-Za-z0-9 ]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((word, i) => {
			if (i === 0) return capitalize(word.toLowerCase());
			if (/^[A-Z0-9]+$/.test(word) && word.length > 1) return word;
			return word.toLowerCase();
		});
	return words.join(' ');
}

// ---------- schema helpers ----------

const SCALARS = new Set(['string', 'number', 'integer', 'boolean']);

function resolveSchema(schema) {
	if (!schema || typeof schema !== 'object') return { type: 'json' };
	const variants = schema.oneOf ?? schema.anyOf;
	if (variants) {
		if (variants.every((v) => SCALARS.has(v.type))) {
			// Unions like boolean | "true" | "false" collapse to their first scalar type.
			const first = variants[0];
			return {
				...first,
				enum: first.type === 'boolean' ? undefined : first.enum,
				description: schema.description ?? first.description,
				default: schema.default ?? first.default,
			};
		}
		return { type: 'json', description: schema.description, isArray: false };
	}
	if (schema.allOf?.length === 1) {
		return resolveSchema({ ...schema.allOf[0], description: schema.description ?? schema.allOf[0].description });
	}
	return schema;
}

const hasProperties = (s) => s.properties && Object.keys(s.properties).length > 0;
const isRecord = (s) => s.additionalProperties !== undefined && s.additionalProperties !== false;

function kindOf(schema, key, depth) {
	const s = resolveSchema(schema);
	if (s.type === 'json') return 'json';
	if (s.type === 'string') {
		if (s.format === 'binary') return 'binary';
		if (s.enum) return 'options';
		if (s.format === 'date-time' || DATE_FIELDS.has(key)) return 'dateTime';
		return 'string';
	}
	if (s.type === 'integer' || s.type === 'number') return s.enum ? 'options' : 'number';
	if (s.type === 'boolean') return 'boolean';
	if (s.type === 'array') {
		const item = resolveSchema(s.items);
		if (item.type === 'string' && item.enum) return 'multiOptions';
		if (SCALARS.has(item.type) && item.type !== 'boolean') return 'list';
		if (item.type === 'object' && hasProperties(item) && !isRecord(item) && depth < MAX_DEPTH) return 'items';
		return 'json';
	}
	if (s.type === 'object' && hasProperties(s) && !isRecord(s) && depth < MAX_DEPTH) return 'object';
	return 'json';
}

function isPromotable(schema) {
	const s = resolveSchema(schema);
	if (s.type !== 'object' || !hasProperties(s) || isRecord(s)) return false;
	return Object.values(s.properties).every((child) => {
		const c = resolveSchema(child);
		return c.type === 'object' && hasProperties(c) && !isRecord(c);
	});
}

function enumOptions(values) {
	const seen = new Set();
	const options = values.map((value) => {
		let name = value === '' ? 'Empty' : typeof value === 'string' ? labelFor(value) : String(value);
		if (seen.has(name)) name = `${name} (${value})`;
		seen.add(name);
		return { name, value };
	});
	return sortIfLong(options, 'name');
}

function sortIfLong(items, key) {
	if (items.length < 5) return items;
	return [...items].sort((a, b) => a[key].localeCompare(b[key]));
}

// ---------- field builder ----------

/**
 * Turns one schema property into an n8n parameter plus the shape the executor needs
 * to convert the UI value back to JSON.
 */
function buildField(key, rawSchema, ctx) {
	const s = resolveSchema(rawSchema);
	const kind = kindOf(rawSchema, key, ctx.depth);
	const displayName = ctx.displayName ?? labelFor(key);
	const prop = { displayName, name: ctx.name ?? key };
	let shape;
	const description = cleanDescription(s.description ?? rawSchema?.description);
	const dynamic = DYNAMIC_OPTIONS[key];

	if (dynamic && (kind === 'string' || kind === 'options')) {
		prop.displayName = dynamic.label;
		prop.type = 'options';
		prop.typeOptions = { loadOptionsMethod: dynamic.method };
		prop.default = '';
		prop.description = DYNAMIC_OPTIONS_DESCRIPTION;
		return finish(prop, shape, ctx);
	}

	if (key === 'limit' && kind === 'number') {
		prop.displayName = 'Limit';
		prop.type = 'number';
		prop.typeOptions = { minValue: 1, ...(typeof s.maximum === 'number' ? { maxValue: s.maximum } : {}) };
		prop.default = 50;
		prop.description = LIMIT_DESCRIPTION;
		return finish(prop, shape, ctx);
	}

	switch (kind) {
		case 'string': {
			prop.type = /colou?r$/i.test(key) ? 'color' : 'string';
			prop.default = typeof s.default === 'string' ? s.default : '';
			if (prop.type === 'string' && SENSITIVE_NAME.test(key)) prop.typeOptions = { password: true };
			else if (prop.type === 'string' && (s.maxLength ?? 0) > 300) prop.typeOptions = { rows: 4 };
			if (s.format === 'uri') prop.placeholder = 'https://example.com';
			break;
		}
		case 'dateTime': {
			prop.type = 'dateTime';
			prop.default = '';
			shape = { kind: 'date' };
			break;
		}
		case 'number': {
			prop.type = 'number';
			prop.default = typeof s.default === 'number' ? s.default : typeof s.minimum === 'number' ? s.minimum : 0;
			const typeOptions = {};
			if (typeof s.minimum === 'number') typeOptions.minValue = s.minimum;
			if (typeof s.maximum === 'number') typeOptions.maxValue = s.maximum;
			if (s.type === 'integer') typeOptions.numberPrecision = 0;
			if (Object.keys(typeOptions).length) prop.typeOptions = typeOptions;
			break;
		}
		case 'boolean': {
			prop.type = 'boolean';
			prop.default = typeof s.default === 'boolean' ? s.default : false;
			prop.description = booleanDescription(s.description ?? rawSchema?.description, key);
			return finish(prop, shape, ctx);
		}
		case 'options': {
			prop.type = 'options';
			prop.options = enumOptions(s.enum);
			prop.default = s.enum.includes(s.default) ? s.default : prop.options[0].value;
			break;
		}
		case 'multiOptions': {
			const item = resolveSchema(s.items);
			prop.type = 'multiOptions';
			prop.options = enumOptions(item.enum);
			prop.default = Array.isArray(s.default) ? s.default : [];
			break;
		}
		case 'list': {
			const item = resolveSchema(s.items);
			prop.type = 'string';
			prop.default = '';
			prop.hint = 'Comma-separated list, or an array from an expression';
			shape = { kind: 'list', ...(item.type === 'string' ? {} : { numeric: true }) };
			break;
		}
		case 'object': {
			const { options, shapes } = buildChildren(s, ctx.depth + 1);
			prop.type = 'collection';
			prop.placeholder = 'Add Field';
			prop.default = {};
			prop.options = sortIfLong(options, 'displayName');
			shape = { kind: 'object', ...(Object.keys(shapes).length ? { fields: shapes } : {}) };
			break;
		}
		case 'items': {
			const item = resolveSchema(s.items);
			const required = new Set(item.required ?? []);
			const requiredChildren = {};
			const optionalChildren = {};
			for (const [childKey, childSchema] of Object.entries(item.properties)) {
				(required.has(childKey) ? requiredChildren : optionalChildren)[childKey] = childSchema;
			}
			const values = [];
			const shapes = {};
			for (const [childKey, childSchema] of Object.entries(requiredChildren)) {
				const child = buildField(childKey, childSchema, { depth: ctx.depth + 1, required: true });
				values.push(child.prop);
				if (child.shape) shapes[childKey] = child.shape;
			}
			let merge;
			if (Object.keys(optionalChildren).length) {
				merge = values.length ? 'additionalFields' : 'fields';
				const { options, shapes: optionalShapes } = buildChildren(
					{ properties: optionalChildren },
					ctx.depth + 1,
				);
				Object.assign(shapes, optionalShapes);
				values.push({
					displayName: merge === 'fields' ? 'Fields' : 'Additional Fields',
					name: merge,
					type: 'collection',
					placeholder: 'Add Field',
					default: {},
					options: sortIfLong(options, 'displayName'),
				});
			}
			prop.type = 'fixedCollection';
			prop.typeOptions = { multipleValues: true };
			prop.placeholder = `Add ${singular(displayName.split(' ').pop())}`;
			prop.default = {};
			prop.options = [
				{ displayName: singular(displayName), name: 'values', values: sortIfLong(values, 'displayName') },
			];
			shape = {
				kind: 'items',
				multiple: true,
				...(Object.keys(shapes).length ? { fields: shapes } : {}),
				...(merge ? { merge } : {}),
			};
			break;
		}
		case 'binary':
		case 'json':
		default: {
			const isArray = s.type === 'array' || rawSchema?.type === 'array';
			prop.type = 'json';
			prop.default = isArray ? '[]' : '{}';
			shape = { kind: 'json' };
			const base = description ?? `${isArray ? 'Array' : 'Object'} in JSON format`;
			prop.description = cleanDescription(`${base}. See ${API_DOCS_URL} for the expected shape.`);
			return finish(prop, shape, ctx);
		}
	}
	if (description && description.toLowerCase() !== prop.displayName.toLowerCase()) prop.description = description;
	return finish(prop, shape, ctx);
}

function finish(prop, shape, ctx) {
	if (ctx.required && !ctx.inCollection && !['collection', 'fixedCollection', 'boolean'].includes(prop.type)) {
		prop.required = true;
	}
	return { prop: orderKeys(prop), shape };
}

function buildChildren(schema, depth) {
	const options = [];
	const shapes = {};
	for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
		if (resolveSchema(childSchema).format === 'binary') continue;
		const child = buildField(key, childSchema, { depth, inCollection: true });
		options.push(child.prop);
		if (child.shape) shapes[key] = child.shape;
	}
	return { options, shapes };
}

const KEY_ORDER = [
	'displayName',
	'name',
	'type',
	'required',
	'noDataExpression',
	'typeOptions',
	'displayOptions',
	'options',
	'values',
	'default',
	'placeholder',
	'hint',
	'description',
];

function orderKeys(prop) {
	const ordered = {};
	for (const key of KEY_ORDER) if (prop[key] !== undefined) ordered[key] = prop[key];
	for (const [key, value] of Object.entries(prop)) if (!(key in ordered) && value !== undefined) ordered[key] = value;
	return ordered;
}

// ---------- operations ----------

function resourceOf(operationId) {
	const [group, sub] = operationId.split('.');
	if (group === 'misc') return sub === 'google_business' ? 'googleBusinessProfile' : sub;
	if (group === 'comment' && sub.startsWith('import')) return 'commentImport';
	if (group === 'automation' && /ProviderSetting/.test(sub)) return 'automationProviderSetting';
	if (group === 'postImport') return 'postHistoryImport';
	if (group === 'postCSV') return 'postCsvImport';
	return group;
}

function operationName(operationId, resource) {
	if (OPERATION_NAMES[operationId]) return OPERATION_NAMES[operationId];
	const tail = operationId.split('.').pop();
	const resourceWords = new Set(splitWords(RESOURCES[resource].name).map((w) => w.toLowerCase()));
	const words = splitWords(tail);
	const kept = words.filter((w, i) => i === 0 || !resourceWords.has(w.toLowerCase()));
	return labelFor(kept.join(' '));
}

function jsonSchemaOf(content, type) {
	return content?.[type]?.schema;
}

// Operation being generated, for per-operation description overrides.
let currentOperationId = '';

function buildOperation(operationId, method, apiPath, op) {
	currentOperationId = operationId;
	const resource = resourceOf(operationId);
	const resourceInfo = RESOURCES[resource];
	if (!resourceInfo) throw new Error(`No resource mapping for ${operationId}`);
	const name = operationName(operationId, resource);
	const isGetMany = name === GET_MANY;
	// Values are stored in saved workflows: renaming an operation breaks them.
	const value = isGetMany ? 'getAll' : camelCase(name);
	const action = isGetMany
		? `Get many ${resourceInfo.plural ?? resourceInfo.name.toLowerCase()}`
		: sentenceCaseAction(op.summary ?? name, resourceInfo.brands);
	// Some spec descriptions are implementation notes; the summary reads better there.
	const described = firstSentence(op.description);
	const weak = !described || described.length < 25 || /^(body requires|use typed|requires|field mask)/i.test(described);
	let optionDescription = fixCasing(
		isGetMany
			? `Get many ${resourceInfo.plural ?? resourceInfo.name.toLowerCase()}`
			: weak
				? firstSentence(String(op.summary ?? action).replace(/\[[^\]]*\]\s*/g, ''))
				: described,
	);
	// n8n lint rejects a description that only repeats the name.
	if (optionDescription.toLowerCase() === name.toLowerCase()) optionDescription = undefined;

	const show = { resource: [resource], operation: [value] };
	const properties = [];
	const params = [];
	const used = new Set(RESERVED_NAMES);
	const uniqueName = (base, prefix) => {
		let candidate = base;
		if (used.has(candidate)) candidate = `${prefix}${capitalize(base)}`;
		let n = 2;
		while (used.has(candidate)) candidate = `${prefix}${capitalize(base)}${n++}`;
		used.add(candidate);
		return candidate;
	};
	const add = (prop, extraShow = {}) => {
		const added = orderKeys({ ...prop, displayOptions: { show: { ...show, ...extraShow } } });
		properties.push(added);
		return added;
	};

	const parameters = op.parameters ?? [];
	const pathParams = parameters.filter((p) => p.in === 'path');
	const queryParams = parameters.filter((p) => p.in === 'query');

	// Path parameters, in URL order.
	const pathOrder = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
	for (const key of pathOrder) {
		const param = pathParams.find((p) => p.name === key) ?? { name: key, schema: { type: 'string' } };
		const field = buildField(key, { ...param.schema, description: param.description ?? param.schema?.description }, {
			depth: 0,
			required: true,
			name: uniqueName(key, 'path'),
			displayName: idLabel(key, apiPath),
		});
		add(field.prop);
		params.push({ name: field.prop.name, in: 'path', key });
	}

	// Offset pagination when the response carries `total` plus an array of items.
	const responseSchema = jsonSchemaOf((op.responses?.['200'] ?? op.responses?.['201'])?.content, 'application/json');
	const hasOffset = queryParams.some((p) => p.name === 'offset');
	const limitParam = queryParams.find((p) => p.name === 'limit');
	let pagination;
	if (hasOffset && limitParam && responseSchema?.properties?.total) {
		const itemsKey = Object.keys(responseSchema.properties).find(
			(k) => resolveSchema(responseSchema.properties[k]).type === 'array',
		);
		if (itemsKey) {
			const max = limitParam.schema?.maximum;
			pagination = { itemsKey, pageSize: Math.min(DEFAULT_PAGE_SIZE, typeof max === 'number' ? max : DEFAULT_PAGE_SIZE) };
		}
	}

	const requiredQuery = queryParams.filter((p) => p.required);
	const optionalQuery = queryParams.filter(
		(p) => !p.required && !(pagination && (p.name === 'offset' || p.name === 'limit')),
	);
	for (const param of requiredQuery) {
		if (pagination && (param.name === 'offset' || param.name === 'limit')) continue;
		const field = buildField(param.name, { ...param.schema, description: param.description ?? param.schema?.description }, {
			depth: 0,
			required: true,
			name: uniqueName(param.name, 'query'),
		});
		add(field.prop);
		params.push(mapping(field, 'query', param.name));
	}

	// Request body.
	const content = op.requestBody?.content ?? {};
	const multipartSchema = jsonSchemaOf(content, 'multipart/form-data');
	const jsonSchema = jsonSchemaOf(content, 'application/json');
	let bodyType;
	let bodyDefaults;
	let jsonBodyOnly = false;
	const isUpdate = /^(update|edit)/.test(value) || method === 'patch';
	const extraFieldsName = isUpdate ? 'updateFields' : 'additionalFields';
	const extraFields = [];
	const extraShapes = {};
	let bodyShow = {};

	const addBodyProperties = (schema, location) => {
		const required = new Set(schema.required ?? []);
		// A required platform list (e.g. socialAccountTypes) hides the sections of unselected platforms.
		const selectorKey = Object.entries(schema.properties ?? {}).find(
			([k, s]) => required.has(k) && kindOf(s, k, 0) === 'multiOptions',
		)?.[0];
		const platforms = new Set(
			selectorKey ? resolveSchema(resolveSchema(schema.properties[selectorKey]).items).enum : [],
		);
		const platformScoped = [];
		const assignedNames = {};

		for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
			const resolved = resolveSchema(childSchema);
			if (resolved.format === 'binary') continue;
			if (isPromotable(childSchema)) {
				if (required.has(key)) (bodyDefaults ??= {})[key] = {};
				for (const [childKey, grandChild] of Object.entries(resolved.properties)) {
					const field = buildField(childKey, grandChild, {
						depth: 1,
						name: uniqueName(`${key}${capitalize(splitWords(childKey).map((w) => capitalize(w.toLowerCase())).join(''))}`, 'body'),
						displayName: `${labelFor(childKey)} ${PROMOTED_SUFFIX[key] ?? labelFor(key)}`,
					});
					const added = add(field.prop, bodyShow);
					if (platforms.has(childKey)) platformScoped.push({ target: added, platform: childKey, nested: false });
					params.push(mapping(field, location, `${key}.${childKey}`));
				}
				continue;
			}
			const kind = kindOf(childSchema, key, 0);
			if (kind === 'object') {
				if (required.has(key)) (bodyDefaults ??= {})[key] = {};
				const field = buildField(key, childSchema, { depth: 0, name: uniqueName(key, 'body') });
				const added = add(field.prop, bodyShow);
				// Collections keyed by platform (e.g. firstComment) only offer the selected platforms.
				if (added.options.length && added.options.every((option) => platforms.has(option.name))) {
					for (const option of added.options) {
						platformScoped.push({ target: option, platform: option.name, nested: true });
					}
				}
				params.push(mapping(field, location, key));
				continue;
			}
			if (required.has(key)) {
				const field = buildField(key, childSchema, { depth: 0, required: true, name: uniqueName(key, 'body') });
				add(field.prop, bodyShow);
				assignedNames[key] = field.prop.name;
				params.push(mapping(field, location, key));
				continue;
			}
			const field = buildField(key, childSchema, { depth: 0, inCollection: true });
			extraFields.push(field.prop);
			if (field.shape) extraShapes[key] = field.shape;
		}

		const selectorName = selectorKey && assignedNames[selectorKey];
		if (!selectorName) return;
		for (const { target, platform, nested } of platformScoped) {
			// Options inside a collection refer to top-level parameters with a leading slash.
			const condition = { [nested ? `/${selectorName}` : selectorName]: [platform] };
			target.displayOptions = { show: { ...(target.displayOptions?.show ?? {}), ...condition } };
		}
	};

	if (multipartSchema) {
		bodyType = 'multipart';
		const fileKey = Object.entries(multipartSchema.properties ?? {}).find(
			([, s]) => resolveSchema(s).format === 'binary',
		)?.[0];
		if (fileKey) {
			add({
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				hint: 'The name of the input binary field containing the file to be uploaded',
			});
			params.push({ name: 'binaryPropertyName', in: 'file', key: fileKey });
		}
		addBodyProperties(multipartSchema, 'body');
	} else if (jsonSchema) {
		bodyType = 'json';
		const root = resolveSchema(jsonSchema);
		if (root.type === 'object' && hasProperties(root) && !isRecord(root)) {
			used.add('bodyInput');
			add({
				displayName: 'Specify Body',
				name: 'bodyInput',
				type: 'options',
				options: [
					{ name: 'Using Fields Below', value: 'fields' },
					{ name: 'Using JSON', value: 'json' },
				],
				default: 'fields',
			});
			add(
				{
					displayName: 'JSON Body',
					name: 'jsonBody',
					type: 'json',
					required: true,
					default: '{}',
					description: cleanDescription(`Full request body. See ${API_DOCS_URL} for the schema.`),
				},
				{ bodyInput: ['json'] },
			);
			params.push({ name: 'jsonBody', in: 'jsonBody' });
			bodyShow = { bodyInput: ['fields'] };
			addBodyProperties(root, 'body');
		} else if (root.type === 'object' && !hasProperties(root)) {
			// Empty object body: nothing to configure, the executor sends `{}`.
		} else {
			jsonBodyOnly = true;
			add({
				displayName: 'JSON Body',
				name: 'jsonBody',
				type: 'json',
				required: true,
				default: root.type === 'array' ? '[]' : '{}',
				description: cleanDescription(`Full request body. See ${API_DOCS_URL} for the schema.`),
			});
			params.push({ name: 'jsonBody', in: 'jsonBody' });
		}
	}

	if (pagination) {
		add({
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: RETURN_ALL_DESCRIPTION,
		});
		add(
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: LIMIT_DESCRIPTION,
			},
			{ returnAll: [false] },
		);
	}

	if (extraFields.length) {
		add(
			{
				displayName: isUpdate ? 'Update Fields' : 'Additional Fields',
				name: extraFieldsName,
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: sortIfLong(extraFields, 'displayName'),
			},
			bodyShow,
		);
		params.push({
			name: extraFieldsName,
			in: 'bodyMerge',
			shape: { kind: 'object', ...(Object.keys(extraShapes).length ? { fields: extraShapes } : {}) },
		});
	}

	if (optionalQuery.length) {
		const options = [];
		const shapes = {};
		for (const param of optionalQuery) {
			const field = buildField(param.name, { ...param.schema, description: param.description ?? param.schema?.description }, {
				depth: 0,
				inCollection: true,
			});
			options.push(field.prop);
			if (field.shape) shapes[param.name] = field.shape;
		}
		add({
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: sortIfLong(options, 'displayName'),
		});
		params.push({
			name: 'options',
			in: 'queryMerge',
			shape: { kind: 'object', ...(Object.keys(shapes).length ? { fields: shapes } : {}) },
		});
	}

	const spec = {
		method: method.toUpperCase(),
		path: apiPath,
		params,
		...(bodyType ? { body: bodyType } : {}),
		...(jsonBodyOnly ? { jsonBodyOnly: true } : {}),
		...(bodyDefaults ? { bodyDefaults } : {}),
		...(pagination ? { pagination } : {}),
	};

	return {
		resource,
		value,
		option: { name, value, description: optionDescription, action },
		properties,
		spec,
		operationId,
		summary: op.summary,
		method: method.toUpperCase(),
		apiPath,
	};
}

// Operations that chain several requests; the executor runs them via `spec.custom`.
function buildCustomOperations() {
	currentOperationId = 'custom.uploadLargeFile';
	const show = { resource: ['upload'], operation: ['uploadLargeFile'] };
	const teamField = buildField('teamId', { type: 'string' }, { depth: 0, inCollection: true });
	return [
		{
			resource: 'upload',
			value: 'uploadLargeFile',
			option: {
				name: 'Upload Large File',
				value: 'uploadLargeFile',
				description:
					'Upload a file of up to 5 GB, such as a long video: initializes a large upload, sends the file to storage and finalizes it',
				action: 'Upload a large file',
			},
			properties: [
				{
					displayName: 'Input Binary Field',
					name: 'binaryPropertyName',
					type: 'string',
					required: true,
					displayOptions: { show },
					default: 'data',
					hint: 'The name of the input binary field containing the file to be uploaded',
				},
				{
					displayName: 'Additional Fields',
					name: 'additionalFields',
					type: 'collection',
					displayOptions: { show },
					default: {},
					placeholder: 'Add Field',
					options: [teamField.prop],
				},
			],
			spec: {
				method: 'POST',
				path: '/api/v1/upload/init',
				params: [
					{ name: 'binaryPropertyName', in: 'file', key: 'file' },
					{ name: 'additionalFields', in: 'bodyMerge', shape: { kind: 'object' } },
				],
				custom: 'uploadLargeFile',
			},
			method: 'POST',
			apiPath: '/api/v1/upload/init, then storage PUT, then /api/v1/upload/finalize',
		},
	];
}

function mapping(field, location, key) {
	return { name: field.prop.name, in: location, key, ...(field.shape ? { shape: field.shape } : {}) };
}

// ---------- TypeScript output ----------

function quote(s) {
	return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function tsKey(k) {
	return /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
}

function toTs(value, indent = 0) {
	const pad = '\t'.repeat(indent);
	const pad1 = '\t'.repeat(indent + 1);
	if (Array.isArray(value)) {
		if (!value.length) return '[]';
		const inline = value.every((v) => v === null || typeof v !== 'object');
		if (inline) {
			const text = `[${value.map((v) => toTs(v)).join(', ')}]`;
			if (text.length + indent * 2 < 90) return text;
		}
		return `[\n${value.map((v) => `${pad1}${toTs(v, indent + 1)},`).join('\n')}\n${pad}]`;
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).filter(([, v]) => v !== undefined);
		if (!entries.length) return '{}';
		return `{\n${entries.map(([k, v]) => `${pad1}${tsKey(k)}: ${toTs(v, indent + 1)},`).join('\n')}\n${pad}}`;
	}
	if (typeof value === 'string') return quote(value);
	return String(value);
}

const HEADER =
	'// Generated by scripts/generate.mjs from openapi/bundlesocial.openapi.json. Do not edit by hand.\n';

function writeResourceFile(resource, operations) {
	const sortedOptions = sortIfLong(
		operations.map((o) => o.option),
		'name',
	);
	const preferred = ['create', 'getAll', 'get'].find((v) => operations.some((o) => o.value === v));
	const operationProperty = {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: sortedOptions,
		default: preferred ?? sortedOptions[0].value,
	};
	const specs = Object.fromEntries(operations.map((o) => [o.value, o.spec]));
	const properties = [operationProperty, ...operations.flatMap((o) => o.properties)];
	const source = `${HEADER}import type { INodeProperties } from 'n8n-workflow';
import type { OperationSpec } from '../shared/types';

export const ${resource}Operations: Record<string, OperationSpec> = ${toTs(specs)};

export const ${resource}Properties: INodeProperties[] = ${toTs(properties)};
`;
	fs.writeFileSync(path.join(OUT_DIR, `${resource}.ts`), source);
}

function writeIndex(resources) {
	const resourceProperty = {
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: sortIfLong(
			resources.map((r) => ({ name: RESOURCES[r].name, value: r })),
			'name',
		),
		default: 'post',
	};
	const imports = resources
		.map((r) => `import { ${r}Operations, ${r}Properties } from './${r}';`)
		.join('\n');
	const source = `${HEADER}import type { INodeProperties } from 'n8n-workflow';
import type { OperationSpec } from '../shared/types';
${imports}

export const operationSpecs: Record<string, Record<string, OperationSpec>> = {
${resources.map((r) => `\t${r}: ${r}Operations,`).join('\n')}
};

export const nodeProperties: INodeProperties[] = [
\t${toTs(resourceProperty, 1)},
${resources.map((r) => `\t...${r}Properties,`).join('\n')}
];
`;
	fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), source);
}

function updateReadme(byResource, resources) {
	if (!fs.existsSync(README_PATH)) return;
	const readme = fs.readFileSync(README_PATH, 'utf8');
	const start = '<!-- operations:start -->';
	const end = '<!-- operations:end -->';
	if (!readme.includes(start) || !readme.includes(end)) return;
	const total = resources.reduce((n, r) => n + byResource[r].length, 0);
	const lines = [
		start,
		'',
		`${total} operations across ${resources.length} resources, generated from the bundle.social OpenAPI spec.`,
		'',
	];
	for (const resource of [...resources].sort((a, b) => RESOURCES[a].name.localeCompare(RESOURCES[b].name))) {
		lines.push(`<details>\n<summary><b>${RESOURCES[resource].name}</b> (${byResource[resource].length})</summary>\n`);
		lines.push('| Operation | Endpoint |', '|---|---|');
		for (const op of [...byResource[resource]].sort((a, b) => a.option.name.localeCompare(b.option.name))) {
			lines.push(`| ${op.option.name} | \`${op.method} ${op.apiPath}\` |`);
		}
		lines.push('', '</details>', '');
	}
	lines.push(end);
	const next = readme.replace(new RegExp(`${start}[\\s\\S]*${end}`), lines.join('\n'));
	fs.writeFileSync(README_PATH, next);
}

// ---------- main ----------

function main() {
	const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
	const byResource = {};
	for (const [apiPath, methods] of Object.entries(spec.paths)) {
		for (const [method, op] of Object.entries(methods)) {
			if (!op?.operationId || SKIPPED_OPERATIONS.has(op.operationId)) continue;
			const built = buildOperation(op.operationId, method, apiPath, op);
			(byResource[built.resource] ??= []).push(built);
		}
	}
	for (const built of buildCustomOperations()) (byResource[built.resource] ??= []).push(built);
	for (const [resource, operations] of Object.entries(byResource)) {
		const values = new Set();
		for (const op of operations) {
			if (values.has(op.value)) throw new Error(`Duplicate operation value ${resource}.${op.value}`);
			values.add(op.value);
		}
	}
	const resources = Object.keys(byResource).sort();
	fs.rmSync(OUT_DIR, { recursive: true, force: true });
	fs.mkdirSync(OUT_DIR, { recursive: true });
	for (const resource of resources) writeResourceFile(resource, byResource[resource]);
	writeIndex(resources);
	updateReadme(byResource, resources);
	const total = resources.reduce((n, r) => n + byResource[r].length, 0);
	console.log(`Generated ${total} operations across ${resources.length} resources into ${path.relative(ROOT, OUT_DIR)}`);
}

main();
