# Yoast SEO fields and the Blog category

Workflow 15 sends each article's Yoast SEO settings with the WordPress post:

| Yoast setting | WordPress field | Source |
| --- | --- | --- |
| SEO title | `_yoast_wpseo_title` | the article's SEO title, followed by ` %%sep%% %%sitename%%` (the site name) |
| Meta description | `_yoast_wpseo_metadesc` | the article's meta description (about 140 to 155 characters) |
| Focus keyphrase | `_yoast_wpseo_focuskw` | the article's focus keyphrase (articles written from November 2026 on) |
| Social titles and descriptions | `_yoast_wpseo_opengraph-title`, `_yoast_wpseo_opengraph-description`, `_yoast_wpseo_twitter-title`, `_yoast_wpseo_twitter-description` | the SEO title and meta description |

Yoast uses the featured image as the social image, and keeps its own canonical, indexing, and schema settings.

## One-time setup on the WordPress sites (Jake or the web team)

WordPress only accepts these fields through its REST API once they are registered. Until then, WordPress quietly ignores them. The post still publishes, and the publisher records `yoast_saved: false` on the `article.published` event. Add this small must-use plugin once for the network, for example as `wp-content/mu-plugins/apex-yoast-rest-fields.php`:

```php
<?php
/**
 * Plugin Name: Apex - Yoast SEO fields over the REST API
 * Description: Lets the article publisher save Yoast SEO titles, descriptions, and focus keyphrases.
 */
add_action('init', function () {
    $keys = [
        '_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw',
        '_yoast_wpseo_opengraph-title', '_yoast_wpseo_opengraph-description',
        '_yoast_wpseo_twitter-title', '_yoast_wpseo_twitter-description',
    ];
    foreach ($keys as $key) {
        register_post_meta('post', $key, [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function () { return current_user_can('edit_posts'); },
        ]);
    }
});
```

After it's in place, re-send one article from the dashboard and check its Yoast panel in WordPress.

## Checking the result

After publishing, the publisher compares the saved meta description with Yoast's own output for the post (`yoast_head_json`). It records `yoast_saved` (`true`, `false`, or `unknown` when Yoast is not installed) and `blog_category` (`true` or `false`) on the `article.published` event.

## Blog category

Every article goes in each site's **Blog** category. The publisher looks it up by the slug `blog` ("Find Blog Category"). If a site has no category with that slug, the post keeps its previous categories and the event records `blog_category: false`.
