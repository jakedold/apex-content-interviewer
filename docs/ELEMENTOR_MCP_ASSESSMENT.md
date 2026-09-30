# Elementor MCP assessment

Elementor MCP is not the per-article publishing transport for this project.
The deterministic path remains BigQuery → n8n → authenticated WordPress REST.

The verified Prestonwood pilot subsite runs WordPress 6.8.1, Elementor 4.3.1,
and Elementor Pro 4.3.0, so it meets Elementor's published version minimums.
However, the current WordPress account could not access the Elementor MCP admin
page. Elementor states that connections are per site, limited to site admins,
and create a WordPress application password. No MCP connection or credential
was created during this assessment.

Elementor MCP currently fits two possible one-time administrative jobs:

1. Build or revise an Atomic/V4 single-post template that displays the featured
   image and dynamic post fields consistently.
2. Inspect or repair Elementor-native layout structure under human review.

It is a poor fit for selecting each campaign's image, joining a dentist
profile, or publishing an approved article. Those are structured database
operations and must be repeatable without a fresh agent prompt. Elementor also
states that existing-layout editing currently supports Atomic/V4 layouts,
while older V3 widget layout support is still forthcoming. Connections to
Yoast and other WordPress abilities require Angie.

References:

- [Elementor MCP launch](https://elementor.com/blog/elementor-mcp-launch/)
- [Connection and permission requirements](https://elementor.com/help/how-to-connect-elementor-to-an-ai-tool-using-mcp/)
- [Elementor MCP capabilities and current limitations](https://elementor.com/mcp/)
- [Build and edit with Elementor MCP](https://elementor.com/help/how-to-build-and-edit-your-site-using-elementor-mcp/)
- [Yoast REST API is read-only](https://developer.yoast.com/customization/apis/rest-api/)
