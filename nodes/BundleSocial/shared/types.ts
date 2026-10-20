import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

/**
 * How a parameter value from the n8n UI turns into its JSON form.
 * Keys of `fields` are JSON keys; keys without an entry pass through as-is.
 */
export type FieldShape =
	| { kind: 'value' }
	// Date picker value; a local date time is read in the workflow timezone.
	| { kind: 'date' }
	// Comma-separated string or array expression.
	| { kind: 'list'; numeric?: boolean }
	| { kind: 'json' }
	// Collection: keys are JSON keys.
	| { kind: 'object'; fields?: Record<string, FieldShape> }
	// Fixed collection with a single `values` group.
	| {
			kind: 'items';
			multiple: boolean;
			fields?: Record<string, FieldShape>;
			// Name of a nested collection whose entries are merged into each item.
			merge?: string;
	  };

export type ParamLocation =
	| 'path'
	| 'query'
	| 'body'
	// A collection whose entries are spread into the query or the body.
	| 'queryMerge'
	| 'bodyMerge'
	// The whole request body given as JSON.
	| 'jsonBody'
	// Name of the input binary property sent as a multipart file part.
	| 'file';

export interface ParamMapping {
	name: string;
	in: ParamLocation;
	// JSON key, or a dotted path for promoted nested objects (e.g. `data.TIKTOK`).
	key?: string;
	shape?: FieldShape;
}

export interface OperationSpec {
	method: IHttpRequestMethods;
	path: string;
	params: ParamMapping[];
	body?: 'json' | 'multipart';
	// The body can only be given as JSON (no "Specify Body" switch).
	jsonBodyOnly?: boolean;
	// Required objects sent even when none of their fields are set.
	bodyDefaults?: IDataObject;
	// Offset pagination: response array key and the largest page size the API accepts.
	pagination?: { itemsKey: string; pageSize: number };
	// Operation that chains several requests, implemented by hand in execute.ts.
	custom?: 'uploadLargeFile';
}
