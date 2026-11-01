# Changelog

## 0.3.0

- Removed the `jspdf` dependency with `pdf-lib` to resolve the Obsidian review comment of "Dynamically injecting script elements can load and execute arbitrary external code."
- Fixed project dependency mismatches and node module vulnerabilities.
- Other minor bug fixes and code clean-up.

## 0.2.0

- Replaced separate selection/heading copy commands with one Copy and export modal.
- Added Markdown, plain-text, and HTML/rich-text clipboard formats.
- Added Markdown, plain-text, HTML, and PDF file exports.
- Changed table and image actions so they no longer intercept or replace Obsidian's native context menu.
- Changed experimental Outline integration to add a dedicated action button that opens the shared Copy and export modal.
- Added default copy and export format settings.

## 0.1.0

- Initial source project.
- Selection and heading export workflows.
- Rendered table copy/export actions.
- Image copy and vault-save actions.
- Isolated, opt-in experimental Outline integration.
