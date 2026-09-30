# WordPress publishing support

`apex-article-seo-rest.php` is a small, auditable plugin for the WordPress
multisite network. It registers the Yoast SEO title, meta description, and
focus-keyphrase fields for authenticated REST writes on posts. It does not
create users, credentials, posts, or Headless Hostman releases.

Install it as a network-controlled plugin or must-use plugin only after review.
Then set `supports_yoast_meta: true` in a verified practice's BigQuery
`publisher_config_reference`. Without that explicit flag, the publisher uses
only WordPress core fields: post title, slug, excerpt, and featured media.

The n8n WordPress user must already have permission to edit the target post.
The plugin's authorization callback does not grant additional permissions.
