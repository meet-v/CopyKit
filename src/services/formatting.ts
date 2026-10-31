import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function markdownToHtml(markdown: string): string {
  const body = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  const safeBody = DOMPurify.sanitize(body, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Obsidian export</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#222;line-height:1.55;max-width:900px;margin:40px auto;padding:0 28px}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.4em 0 .55em}p,li{orphans:3;widows:3}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f4;padding:12px;border-radius:6px}code{font-family:ui-monospace,SFMono-Regular,monospace}blockquote{border-left:3px solid #aaa;margin-left:0;padding-left:1em;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:7px;text-align:left}img{max-width:100%;height:auto}a{color:#2458a6}
</style>
</head>
<body>${safeBody}</body>
</html>`;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---\s*$[\s\S]*?^---\s*$/m, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*|__|~~|`/g, '')
    .trim();
}
