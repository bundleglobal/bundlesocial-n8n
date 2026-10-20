// Checks the generated descriptions against the n8n lint rules that verification enforces,
// so a generator change cannot silently produce something `npm run lint:fix` would rewrite.
import assert from 'node:assert/strict';
import { it } from 'vitest';
import { operationSpecs } from '../dist/nodes/BundleSocial/generated/index.js';
import { properties } from './helpers.mjs';

const SMALL_WORDS = new Set(
	'a an and as at because but by en for if in neither nor of on only or over per so some than that the then to up upon v versus via vs when with without yet'.split(
		' ',
	),
);
const DYNAMIC_DESCRIPTION =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';
const ALLOWED_TAG = /^<\/?(h\d|p|b|em|i|a|ol|ul|li|code|br)( [^>]*)?>$/i;

function descriptionProblems(p) {
	const d = p.description;
	if (d === undefined) return [];
	const out = [];
	if (typeof d !== 'string' || !d.trim()) return ['empty description'];
	if (d !== d.trim()) out.push('untrimmed description');
	if (/`/.test(d)) out.push('backticks in description');
	if (/\s{2,}/.test(d)) out.push('inner whitespace in description');
	if (/^[a-z]/.test(d)) out.push('description starts lowercase');
	if (/\b(i|I)d(s?)\b/.test(d)) out.push('miscased ID in description');
	if (/\b(u|U)rl(s?)\b/.test(d)) out.push('miscased URL in description');
	if (/\b(j|J)son\b/.test(d)) out.push('miscased JSON in description');
	const egLess = d.replace('e.g.', '');
	const sentences = egLess.split('. ').length;
	if (sentences === 1 && egLess.endsWith('.')) out.push('excess final period');
	if (sentences === 2 && !egLess.endsWith('.') && !egLess.endsWith('</code>')) out.push('missing final period');
	if (p.type === 'boolean' && !d.startsWith('Whether')) out.push('boolean description without "Whether"');
	if (d.toLowerCase() === String(p.displayName).toLowerCase()) out.push('description repeats displayName');
	for (const tag of d.match(/<\/?[a-z0-9]+[^>]*>/gi) ?? []) if (!ALLOWED_TAG.test(tag)) out.push(`tag ${tag}`);
	return out;
}

function titleProblems(text) {
	if (text.toLowerCase().endsWith('or')) return [];
	const out = [];
	const tokens = text.split(/[\s:\u2013\u2014-]+/).filter(Boolean);
	tokens.forEach((token, i) => {
		if (/.(?=[A-Z]|\..)/.test(token)) return;
		const small = SMALL_WORDS.has(token.toLowerCase());
		if (small && i > 0 && i < tokens.length - 1) return;
		const first = token.match(/[A-Za-z0-9]/)?.[0];
		if (first && first !== first.toUpperCase()) out.push(`not title case: "${text}"`);
	});
	if (/\b(i|I)d(s?)\b/.test(text)) out.push(`miscased ID: "${text}"`);
	return out;
}

const isSorted = (list, key) =>
	list.length < 5 || list.every((x, i) => i === 0 || list[i - 1][key].localeCompare(x[key]) <= 0);

function paramProblems(p, { inCollection = false } = {}) {
	const out = [...titleProblems(p.displayName), ...descriptionProblems(p)];
	if (Object.keys(p)[0] !== 'displayName') out.push('displayName is not the first key');
	if (!('default' in p)) out.push('missing default');
	if (p.required === false) out.push('required: false');
	if (inCollection && p.required) out.push('required inside a collection');
	if (/secret|password|token|apiKey/.test(p.name) && p.type === 'string' && !p.typeOptions?.password) {
		out.push('sensitive field without password');
	}
	// Lint reads a top-level options parameter named `action` as the operation selector.
	if (!inCollection && p.type === 'options' && p.name === 'action') out.push('options parameter named "action"');
	if (p.typeOptions?.loadOptionsMethod) {
		if (!p.displayName.endsWith('Name or ID')) out.push('dynamic options displayName');
		if (p.description !== DYNAMIC_DESCRIPTION) out.push('dynamic options description');
	} else if (p.type === 'options' || p.type === 'multiOptions') {
		const options = p.options ?? [];
		if (p.type === 'options' && !options.some((o) => o.value === p.default)) out.push('default not in options');
		if (!isSorted(options, 'name')) out.push('options not sorted');
		if (new Set(options.map((o) => o.name)).size !== options.length) out.push('duplicate option names');
		if (new Set(options.map((o) => o.value)).size !== options.length) out.push('duplicate option values');
	}
	if (p.name === 'limit' && p.type === 'number') {
		if (p.default !== 50 || p.description !== 'Max number of results to return') out.push('limit conventions');
	}
	if (p.type === 'collection') {
		if (!isSorted(p.options, 'displayName')) out.push('collection not sorted');
		for (const option of p.options) {
			out.push(...paramProblems(option, { inCollection: true }).map((m) => `${option.name}: ${m}`));
		}
	}
	if (p.type === 'fixedCollection') {
		for (const group of p.options) {
			if (!isSorted(group.values, 'displayName')) out.push('fixed collection not sorted');
			for (const value of group.values) out.push(...paramProblems(value).map((m) => `${value.name}: ${m}`));
		}
	}
	return out;
}

function sentenceCase(text) {
	const kept = text.split(' ').filter((word) => word !== word.toUpperCase()).join(' ');
	return kept === kept.replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

it('generated parameters follow the n8n lint rules', () => {
	const problems = [];
	for (const p of properties) {
		const where = `${p.displayOptions?.show?.resource ?? ''}.${p.displayOptions?.show?.operation ?? ''} ${p.name}`;
		problems.push(...paramProblems(p).map((m) => `${where}: ${m}`));
	}
	assert.deepEqual(problems, []);
});

it('operation options have sentence-case actions and matching specs', () => {
	const problems = [];
	for (const selector of properties.filter((p) => p.name === 'operation')) {
		const resource = selector.displayOptions.show.resource[0];
		if (!selector.noDataExpression) problems.push(`${resource}: operation without noDataExpression`);
		for (const option of selector.options) {
			const where = `${resource}.${option.value}`;
			if (!option.action) problems.push(`${where}: no action`);
			else if (!sentenceCase(option.action)) problems.push(`${where}: action "${option.action}" not sentence case`);
			if (option.value === 'getAll' && (option.name !== 'Get Many' || !option.action.startsWith('Get many'))) {
				problems.push(`${where}: Get Many naming`);
			}
			if (option.description && option.description.toLowerCase() === option.name.toLowerCase()) {
				problems.push(`${where}: description repeats name`);
			}
			if (/\b(i|I)d(s?)\b/.test(option.description ?? '')) problems.push(`${where}: miscased ID`);
			if (!operationSpecs[resource]?.[option.value]) problems.push(`${where}: no operation spec`);
		}
	}
	assert.deepEqual(problems, []);
});

it('every operation spec maps to visible parameters and fills its path', () => {
	const problems = [];
	for (const [resource, specs] of Object.entries(operationSpecs)) {
		for (const [operation, spec] of Object.entries(specs)) {
			const where = `${resource}.${operation}`;
			const own = properties.filter(
				(p) => p.displayOptions?.show?.resource?.[0] === resource && p.displayOptions.show.operation?.includes(operation),
			);
			const seen = new Set();
			for (const p of own) {
				const { resource: _r, operation: _o, ...conditions } = p.displayOptions.show;
				const key = `${p.name}|${JSON.stringify(conditions)}`;
				if (seen.has(key)) problems.push(`${where}: duplicate parameter ${p.name}`);
				seen.add(key);
				const mapped = spec.params.some((m) => m.name === p.name);
				if (!mapped && !['bodyInput', 'returnAll', 'limit'].includes(p.name)) {
					problems.push(`${where}: parameter ${p.name} is not mapped`);
				}
			}
			for (const m of spec.params) {
				if (!own.some((p) => p.name === m.name)) problems.push(`${where}: mapping ${m.name} has no parameter`);
			}
			for (const placeholder of spec.path.match(/\{[^}]+\}/g) ?? []) {
				if (!spec.params.some((m) => m.in === 'path' && `{${m.key}}` === placeholder)) {
					problems.push(`${where}: ${placeholder} is never filled`);
				}
			}
		}
	}
	assert.deepEqual(problems, []);
});
