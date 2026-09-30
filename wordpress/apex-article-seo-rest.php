<?php
/**
 * Plugin Name: Apex Article SEO REST Fields
 * Description: Exposes the three approved Yoast article fields to authenticated WordPress REST publishers.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', static function (): void {
    $fields = [
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
        '_yoast_wpseo_focuskw',
    ];

    foreach ($fields as $field) {
        register_post_meta('post', $field, [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => [
                'schema' => [
                    'type' => 'string',
                    'context' => ['view', 'edit'],
                ],
            ],
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => static function ($allowed, $meta_key, $post_id): bool {
                return current_user_can('edit_post', (int) $post_id);
            },
        ]);
    }
});
