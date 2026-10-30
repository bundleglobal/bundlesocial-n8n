# n8n-nodes-bundlesocial

This is an n8n community node for [bundle.social](https://bundle.social). It lets you schedule and publish posts to 15 social networks, manage uploads, comments, DMs, automations and analytics from your n8n workflows, with unlimited social accounts.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Usage](#usage)
- [Operations](#operations)
- [Development](#development)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-bundlesocial`.

## Credentials

The node authenticates with a bundle.social API key.

1. Sign in to [bundle.social](https://bundle.social/dashboard) and open **Organization > API Keys**.
2. Create an API key and copy it.
3. In n8n, create a **bundle.social API** credential and paste the key into **API Key**.

Leave **Base URL** at `https://api.bundle.social` unless you are testing against a non-production API.

## Usage

Every operation of the public bundle.social API is available. Pick a **Resource** (for example *Post*), then an **Operation** (for example *Create*).

- **Team** fields are dropdowns loaded from your organization; you can also pass a team ID with an expression.
- **Post > Create** has one settings section per platform (*TikTok Settings*, *Instagram Settings*, ...). Fill in the sections for the platforms you selected in **Social Account Types**.
- Media goes in two steps: upload it with **Upload > Upload File** (binary input) or **Upload > Create From URL**, then pass the returned `id` in **Upload IDs** of the post.
- Files above 90 MB, such as long videos, go through **Upload > Upload Large File** (up to 5 GB). It initializes the upload, sends the file straight to storage and finalizes it in one step.
- **Post > Create** only shows the settings sections of the platforms selected in **Social Account Types**. When that field is an expression, every section is shown.
- Validation errors from the API list each invalid field in the error details, for example `data.TIKTOK.text: Required`.
- Fields that take several values (for example **Upload IDs**) accept a comma-separated list or an array from an expression.
- Every operation with a request body has **Specify Body**. Switch it to **Using JSON** to send the raw request body, which is handy for automation flow definitions or when the body comes from an earlier node.
- List operations support **Return All**; the node pages through the API for you.
- Date fields picked in the UI are read in the workflow timezone. Expressions returning ISO 8601 strings with an offset are sent as-is.

### Example: schedule a post with an image

1. **HTTP Request** (or any node) that outputs the image as binary data.
2. **bundle.social > Upload > Upload File**, Input Binary Field `data`.
3. **bundle.social > Post > Create**:
   - Team: your team
   - Social Account Types: `Instagram`, `LinkedIn`
   - Post Date: `{{ $now.plus(1, 'hour').toISO() }}`
   - Status: `Scheduled`
   - Instagram Settings > Text: your caption, Upload IDs: `{{ $('Upload File').item.json.id }}`
   - LinkedIn Settings > Text: your caption, Upload IDs: `{{ $('Upload File').item.json.id }}`

### Using the node as an AI agent tool

The node can be attached to an AI Agent as a tool. On self-hosted n8n set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` to allow community nodes as tools.

## Operations

<!-- operations:start -->

194 operations across 27 resources, generated from the bundle.social OpenAPI spec.

<details>
<summary><b>Analytics</b> (7)</summary>

| Operation | Endpoint |
|---|---|
| Get Bulk Post Analytics | `GET /api/v1/analytics/post/bulk` |
| Get Post Analytics | `GET /api/v1/analytics/post` |
| Get Raw Post Analytics | `GET /api/v1/analytics/post/raw` |
| Get Raw Social Account Analytics | `GET /api/v1/analytics/social-account/raw` |
| Get Social Account Analytics | `GET /api/v1/analytics/social-account` |
| Refresh Post Analytics | `POST /api/v1/analytics/post/force` |
| Refresh Social Account Analytics | `POST /api/v1/analytics/social-account/force` |

</details>

<details>
<summary><b>Automation</b> (14)</summary>

| Operation | Endpoint |
|---|---|
| Activate | `POST /api/v1/automations/{id}/activate` |
| Archive | `POST /api/v1/automations/{id}/archive` |
| Copy | `POST /api/v1/automations/copy` |
| Create | `POST /api/v1/automations` |
| Delete | `DELETE /api/v1/automations/{id}` |
| Get | `GET /api/v1/automations/{id}` |
| Get Execution | `GET /api/v1/automation-executions/{id}` |
| Get Executions | `GET /api/v1/automations/{id}/executions` |
| Get Many | `GET /api/v1/automations` |
| Pause | `POST /api/v1/automations/{id}/pause` |
| Publish | `POST /api/v1/automations/{id}/publish` |
| Send Rich Message | `POST /api/v1/automation-rich-messages/conversations/{conversationId}` |
| Test | `POST /api/v1/automations/{id}/test` |
| Update | `PATCH /api/v1/automations/{id}` |

</details>

<details>
<summary><b>Automation Provider Setting</b> (3)</summary>

| Operation | Endpoint |
|---|---|
| Create or Update | `PUT /api/v1/automation-provider-settings/{socialAccountId}/{type}` |
| Get Many | `GET /api/v1/automation-provider-settings` |
| Sync | `POST /api/v1/automation-provider-settings/{id}/sync` |

</details>

<details>
<summary><b>Bluesky</b> (2)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/bluesky/comment` |
| Delete Post | `DELETE /api/v1/misc/bluesky/post` |

</details>

<details>
<summary><b>Comment</b> (6)</summary>

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/comment/` |
| Delete | `DELETE /api/v1/comment/{id}` |
| Get | `GET /api/v1/comment/{id}` |
| Get Many | `GET /api/v1/comment/` |
| Retry | `POST /api/v1/comment/{id}/retry` |
| Update | `PATCH /api/v1/comment/{id}` |

</details>

<details>
<summary><b>Comment Import</b> (5)</summary>

| Operation | Endpoint |
|---|---|
| Act on Fetched Comment | `POST /api/v1/comment/import/comments/{commentId}/action` |
| Create | `POST /api/v1/comment/import` |
| Get | `GET /api/v1/comment/import/{importId}` |
| Get Fetched Comments | `GET /api/v1/comment/import/comments` |
| Get Many | `GET /api/v1/comment/import` |

</details>

<details>
<summary><b>Conversation</b> (10)</summary>

| Operation | Endpoint |
|---|---|
| Archive | `POST /api/v1/conversations/{id}/archive` |
| Get | `GET /api/v1/conversations/{id}` |
| Get Many | `GET /api/v1/conversations/` |
| Get Messages | `GET /api/v1/conversations/{id}/messages` |
| Mark as Read | `POST /api/v1/conversations/{id}/read` |
| Open | `POST /api/v1/conversations/{id}/open` |
| React to Message | `POST /api/v1/conversations/{id}/messages/{messageId}/reaction` |
| Send Message | `POST /api/v1/conversations/{id}/messages` |
| Send Private Reply | `POST /api/v1/conversations/private-reply` |
| Update | `PATCH /api/v1/conversations/{id}` |

</details>

<details>
<summary><b>Credit</b> (2)</summary>

| Operation | Endpoint |
|---|---|
| Get Balance | `GET /api/v1/billing/credits/balance` |
| Quote Billable Usage | `POST /api/v1/billing/billable-usage/quote` |

</details>

<details>
<summary><b>Discord</b> (1)</summary>

| Operation | Endpoint |
|---|---|
| Delete Message | `DELETE /api/v1/misc/discord/message` |

</details>

<details>
<summary><b>Facebook</b> (15)</summary>

| Operation | Endpoint |
|---|---|
| Debug Token | `GET /api/v1/misc/facebook/token-debug` |
| Delete Comment | `DELETE /api/v1/misc/facebook/comment` |
| Delete Post | `DELETE /api/v1/misc/facebook/post` |
| Edit Comment | `PATCH /api/v1/misc/facebook/comment` |
| Edit Post | `PATCH /api/v1/misc/facebook/post` |
| Get Recommendation by ID | `GET /api/v1/misc/facebook/recommendations/{recommendationId}` |
| Get Recommendation Comments | `GET /api/v1/misc/facebook/recommendations/{recommendationId}/comments` |
| Get Recommendation Import by ID | `GET /api/v1/misc/facebook/recommendations/import/{importId}` |
| Get Recommendation Imports | `GET /api/v1/misc/facebook/recommendations/import` |
| Get Recommendations | `GET /api/v1/misc/facebook/recommendations` |
| Get Text Format Presets | `GET /api/v1/misc/facebook/text-format-presets` |
| Import Recommendations | `POST /api/v1/misc/facebook/recommendations/import` |
| Reply to Recommendation | `PUT /api/v1/misc/facebook/recommendations/{recommendationId}/reply` |
| Reply to Recommendation Comment | `PUT /api/v1/misc/facebook/recommendations/{recommendationId}/comments/{commentId}/reply` |
| Search Pages | `GET /api/v1/misc/facebook/pages` |

</details>

<details>
<summary><b>Google Business Profile</b> (27)</summary>

| Operation | Endpoint |
|---|---|
| Add Media | `POST /api/v1/misc/google-business/media` |
| Create Place Action Link | `POST /api/v1/misc/google-business/location/place-action-links` |
| Delete Media | `DELETE /api/v1/misc/google-business/media` |
| Delete Place Action Link | `DELETE /api/v1/misc/google-business/location/place-action-links` |
| Delete Post | `DELETE /api/v1/misc/google-business/post` |
| Delete Review Reply | `DELETE /api/v1/misc/google-business/reviews/{reviewId}/reply` |
| Get Attributes | `GET /api/v1/misc/google-business/location/attributes` |
| Get Food Menus | `GET /api/v1/misc/google-business/location/food-menus` |
| Get Location | `GET /api/v1/misc/google-business/location` |
| Get Review by ID | `GET /api/v1/misc/google-business/reviews/{reviewId}` |
| Get Review Import by ID | `GET /api/v1/misc/google-business/reviews/import/{importId}` |
| Get Review Imports | `GET /api/v1/misc/google-business/reviews/import` |
| Get Reviews | `GET /api/v1/misc/google-business/reviews` |
| Get Service List | `GET /api/v1/misc/google-business/location/service-list` |
| Import Reviews | `POST /api/v1/misc/google-business/reviews/import` |
| List Available Attributes | `GET /api/v1/misc/google-business/location/attributes/available` |
| List Categories | `GET /api/v1/misc/google-business/location/categories/available` |
| List Media | `GET /api/v1/misc/google-business/media` |
| List Place Action Links | `GET /api/v1/misc/google-business/location/place-action-links` |
| List Search Keywords | `GET /api/v1/misc/google-business/location/search-keywords` |
| Reply to Review | `PUT /api/v1/misc/google-business/reviews/{reviewId}/reply` |
| Update Attributes | `PATCH /api/v1/misc/google-business/location/attributes` |
| Update Food Menus | `PATCH /api/v1/misc/google-business/location/food-menus` |
| Update Hours | `PATCH /api/v1/misc/google-business/location/hours` |
| Update Location | `PATCH /api/v1/misc/google-business/location` |
| Update Place Action Link | `PATCH /api/v1/misc/google-business/location/place-action-links` |
| Update Service List | `PATCH /api/v1/misc/google-business/location/service-list` |

</details>

<details>
<summary><b>Instagram</b> (4)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/instagram/comment` |
| Discover Business Account | `GET /api/v1/misc/instagram/tags` |
| Search Audio | `GET /api/v1/misc/instagram/audio` |
| Search Locations | `GET /api/v1/misc/instagram/locations` |

</details>

<details>
<summary><b>LinkedIn</b> (7)</summary>

| Operation | Endpoint |
|---|---|
| Build Commentary With Mentions | `POST /api/v1/misc/linkedin/mentions/builder` |
| Delete Comment | `DELETE /api/v1/misc/linkedin/comment` |
| Delete Post | `DELETE /api/v1/misc/linkedin/post` |
| Edit Comment | `PATCH /api/v1/misc/linkedin/comment` |
| Edit Post | `PATCH /api/v1/misc/linkedin/post` |
| Reshare Post | `POST /api/v1/misc/linkedin/post/reshare` |
| Search Mention Tags | `GET /api/v1/misc/linkedin/mentions/tags` |

</details>

<details>
<summary><b>Mastodon</b> (4)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/mastodon/comment` |
| Delete Status | `DELETE /api/v1/misc/mastodon/status` |
| Edit Comment | `PATCH /api/v1/misc/mastodon/comment` |
| Edit Status | `PATCH /api/v1/misc/mastodon/status` |

</details>

<details>
<summary><b>Organization</b> (6)</summary>

| Operation | Endpoint |
|---|---|
| Get | `GET /api/v1/organization/` |
| Get Comments Usage | `GET /api/v1/organization/usage/comments` |
| Get Daily Limits Usage | `GET /api/v1/organization/usage/daily-limits` |
| Get Imports Usage | `GET /api/v1/organization/usage/imports` |
| Get Posts Usage | `GET /api/v1/organization/usage/posts` |
| Get Uploads Usage | `GET /api/v1/organization/usage/uploads` |

</details>

<details>
<summary><b>Pinterest</b> (2)</summary>

| Operation | Endpoint |
|---|---|
| Delete Pin | `DELETE /api/v1/misc/pinterest/pin` |
| Edit Pin | `PATCH /api/v1/misc/pinterest/pin` |

</details>

<details>
<summary><b>Post</b> (9)</summary>

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/post/` |
| Delete | `DELETE /api/v1/post/{id}` |
| Get | `GET /api/v1/post/{id}` |
| Get by Reference Key | `GET /api/v1/post/reference-key/{referenceKey}` |
| Get Many | `GET /api/v1/post/` |
| Get Reconnect Candidates | `GET /api/v1/post/reconnect-social-account/candidates` |
| Reconnect Social Account | `POST /api/v1/post/reconnect-social-account` |
| Retry | `POST /api/v1/post/{id}/retry` |
| Update | `PATCH /api/v1/post/{id}` |

</details>

<details>
<summary><b>Post CSV Import</b> (5)</summary>

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/post-csv-import/` |
| Get | `GET /api/v1/post-csv-import/{importId}` |
| Get Many | `GET /api/v1/post-csv-import/` |
| Get Rows | `GET /api/v1/post-csv-import/{importId}/rows` |
| Get Status | `GET /api/v1/post-csv-import/{importId}/status` |

</details>

<details>
<summary><b>Post History Import</b> (6)</summary>

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/post-history-import/` |
| Delete Imported Posts | `DELETE /api/v1/post-history-import/posts` |
| Get | `GET /api/v1/post-history-import/{importId}` |
| Get Imported Posts | `GET /api/v1/post-history-import/posts` |
| Get Many | `GET /api/v1/post-history-import/` |
| Retry | `POST /api/v1/post-history-import/{importId}/retry` |

</details>

<details>
<summary><b>Reddit</b> (6)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/reddit/comment` |
| Delete Post | `DELETE /api/v1/misc/reddit/post` |
| Edit Comment | `PATCH /api/v1/misc/reddit/comment` |
| Edit Post | `PATCH /api/v1/misc/reddit/post` |
| Get Post Requirements | `GET /api/v1/misc/reddit/post-requirements` |
| Get Subreddit Flairs | `GET /api/v1/misc/reddit/subreddit-flairs` |

</details>

<details>
<summary><b>Slack</b> (2)</summary>

| Operation | Endpoint |
|---|---|
| Delete Message | `DELETE /api/v1/misc/slack/message` |
| Edit Message | `PATCH /api/v1/misc/slack/message` |

</details>

<details>
<summary><b>Social Account</b> (13)</summary>

| Operation | Endpoint |
|---|---|
| Connect | `POST /api/v1/social-account/connect` |
| Copy | `POST /api/v1/social-account/copy` |
| Create Portal Link | `POST /api/v1/social-account/create-portal-link` |
| Disable Messaging | `POST /api/v1/social-account/messaging/disable` |
| Disconnect | `DELETE /api/v1/social-account/disconnect` |
| Enable Messaging | `POST /api/v1/social-account/messaging/enable` |
| Get by Type | `GET /api/v1/social-account/by-type` |
| Get Scheduled for Deletion | `GET /api/v1/social-account/to-delete` |
| Refresh Channels | `POST /api/v1/social-account/refresh-channels` |
| Refresh Profile | `POST /api/v1/social-account/profile-refresh` |
| Run Connection Check | `POST /api/v1/social-account/connection-check` |
| Set Channel | `POST /api/v1/social-account/set-channel` |
| Unset Channel | `POST /api/v1/social-account/unset-channel` |

</details>

<details>
<summary><b>Team</b> (5)</summary>

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/team/` |
| Delete | `DELETE /api/v1/team/{id}` |
| Get | `GET /api/v1/team/{id}` |
| Get Many | `GET /api/v1/team/` |
| Update | `PATCH /api/v1/team/{id}` |

</details>

<details>
<summary><b>TikTok</b> (2)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/tiktok/comment` |
| Get Trending Commercial Music | `GET /api/v1/misc/tiktok/cml/trending-list` |

</details>

<details>
<summary><b>Upload</b> (13)</summary>

| Operation | Endpoint |
|---|---|
| Abort Multipart | `POST /api/v1/upload/multipart/abort` |
| Complete Multipart | `POST /api/v1/upload/multipart/complete` |
| Create From URL | `POST /api/v1/upload/from-url` |
| Delete | `DELETE /api/v1/upload/{id}` |
| Delete Many | `DELETE /api/v1/upload/` |
| Finalize Large | `POST /api/v1/upload/finalize` |
| Get | `GET /api/v1/upload/{id}` |
| Get Many | `GET /api/v1/upload/` |
| Initialize Large Upload | `POST /api/v1/upload/init` |
| Initialize Multipart Upload | `POST /api/v1/upload/multipart/init` |
| Sign Multipart Parts | `POST /api/v1/upload/multipart/sign` |
| Upload File | `POST /api/v1/upload/` |
| Upload Large File | `POST /api/v1/upload/init, then storage PUT, then /api/v1/upload/finalize` |

</details>

<details>
<summary><b>X (Twitter)</b> (4)</summary>

| Operation | Endpoint |
|---|---|
| Delete Comment | `DELETE /api/v1/misc/twitter/comment` |
| Delete Post | `DELETE /api/v1/misc/twitter/tweet` |
| Repost | `POST /api/v1/misc/twitter/retweet` |
| Undo Repost | `DELETE /api/v1/misc/twitter/retweet` |

</details>

<details>
<summary><b>YouTube</b> (14)</summary>

| Operation | Endpoint |
|---|---|
| Add Video to Playlist | `POST /api/v1/misc/youtube/playlist-items` |
| Create Playlist | `POST /api/v1/misc/youtube/playlist` |
| Delete Comment | `DELETE /api/v1/misc/youtube/comment` |
| Delete Playlist | `DELETE /api/v1/misc/youtube/playlist/{playlistId}` |
| Delete Video | `DELETE /api/v1/misc/youtube/video` |
| Edit Comment | `PATCH /api/v1/misc/youtube/comment` |
| Edit Video | `PATCH /api/v1/misc/youtube/video` |
| Get Playlist Videos | `GET /api/v1/misc/youtube/playlist-items` |
| Get Playlists | `GET /api/v1/misc/youtube/playlist` |
| Get Regions | `GET /api/v1/misc/youtube/regions` |
| Get Video Categories | `GET /api/v1/misc/youtube/video-categories` |
| Remove Video From Playlist | `DELETE /api/v1/misc/youtube/playlist-items/{playlistItemId}` |
| Set Thumbnail | `POST /api/v1/misc/youtube/thumbnail` |
| Update Playlist | `PUT /api/v1/misc/youtube/playlist` |

</details>

<!-- operations:end -->

## Development

The resource and operation descriptions in `nodes/BundleSocial/generated/` are generated from the bundle.social OpenAPI spec. Do not edit them by hand.

```bash
# Refresh the spec and regenerate
npm run fetch-openapi
npm run generate

npm install
npm run lint
npm test      # builds, then runs the tests in test/ against dist/
npm run dev   # starts a local n8n with the node loaded
```

`scripts/generate.mjs` holds the naming overrides (operation names, resource grouping, description fixes) on top of the spec. Fix problems in the generator, never in the generated files: CI regenerates and fails when the output differs.

The `generate` workflow is run by hand from the Actions tab. It fetches the spec, regenerates the node and opens a pull request when it changed; its `title` input becomes the commit title and so the release note. Releases are made by semantic-release from the commit messages on `main` (`feat:` for a minor version, `fix:` for a patch) and published to npm with provenance.

The tests in `test/` run the built node against a mocked n8n context. They check the generated parameters against the n8n lint rules used for verification and assert the requests each operation sends.

## Compatibility

Built with the `@n8n/node-cli` toolchain and tested against n8n 1.x. Development (`npm install`, `npm run dev`) requires Node.js 24 or newer, because current n8n depends on `isolated-vm@7`.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [bundle.social API reference](https://info.bundle.social/api-reference/introduction)
- [bundle.social OpenAPI spec](https://api.bundle.social/swagger-json)
