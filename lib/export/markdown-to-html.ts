export interface HtmlExportOptions {
  title?: string;
  theme?: "dark" | "light";
  includeMermaid?: boolean;
}

/**
 * Converts Markdown content into a self-contained, beautifully styled HTML document.
 */
export function markdownToStyledHtml(
  markdown: string,
  options: HtmlExportOptions = {}
): string {
  const { title = "README Documentation", theme = "dark", includeMermaid = true } = options;

  const isDark = theme === "dark";

  // Basic HTML entity escaping for code blocks
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Lightweight markdown to HTML line-by-line processor for standalone HTML export
  let htmlBody = "";
  const lines = markdown.split(/\r?\n/);
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];
  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
        continue;
      } else {
        inCodeBlock = false;
        if (codeBlockLang.toLowerCase() === "mermaid" && includeMermaid) {
          htmlBody += `\n<pre class="mermaid">\n${codeBlockContent.join("\n")}\n</pre>\n`;
        } else {
          htmlBody += `\n<pre class="code-block language-${codeBlockLang}"><code>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>\n`;
        }
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) {
        inTable = true;
        htmlBody += `\n<div class="table-container"><table>\n`;
      }

      // Check if it's a separator line | :--- | :--- |
      if (/^\|(\s*:?-+:?\s*\|)+$/.test(line.trim())) {
        continue;
      }

      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // If it's the first row before any tbody, treat as th
      const tag = htmlBody.includes("<tbody>") ? "td" : "th";
      if (tag === "th" && !htmlBody.includes("<thead>")) {
        htmlBody += `<thead><tr>${cells.map((c) => `<th>${formatInlineMarkdown(c)}</th>`).join("")}</tr></thead><tbody>\n`;
      } else {
        htmlBody += `<tr>${cells.map((c) => `<td>${formatInlineMarkdown(c)}</td>`).join("")}</tr>\n`;
      }
      continue;
    } else if (inTable) {
      inTable = false;
      htmlBody += `</tbody></table></div>\n`;
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        inList = true;
        htmlBody += `\n<ul>\n`;
      }
      const itemContent = line.replace(/^\s*[-*]\s+/, "");
      htmlBody += `  <li>${formatInlineMarkdown(itemContent)}</li>\n`;
      continue;
    } else if (inList) {
      inList = false;
      htmlBody += `</ul>\n`;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      htmlBody += `<blockquote>${formatInlineMarkdown(line.slice(2))}</blockquote>\n`;
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      htmlBody += `<h1>${formatInlineMarkdown(line.slice(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith("## ")) {
      htmlBody += `<h2>${formatInlineMarkdown(line.slice(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith("### ")) {
      htmlBody += `<h3>${formatInlineMarkdown(line.slice(4))}</h3>\n`;
      continue;
    }
    if (line.startsWith("#### ")) {
      htmlBody += `<h4>${formatInlineMarkdown(line.slice(5))}</h4>\n`;
      continue;
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      htmlBody += `<hr />\n`;
      continue;
    }

    // Paragraph
    if (line.trim().length > 0) {
      htmlBody += `<p>${formatInlineMarkdown(line)}</p>\n`;
    }
  }

  if (inTable) htmlBody += `</tbody></table></div>\n`;
  if (inList) htmlBody += `</ul>\n`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ${
    includeMermaid
      ? `<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: '${isDark ? "dark" : "default"}' });
  </script>`
      : ""
  }
  <style>
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      --font-mono: 'JetBrains Mono', SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      ${
        isDark
          ? `
      --bg-canvas: #09090b;
      --bg-surface: #18181b;
      --border: #27272a;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --accent: #8b5cf6;
      --code-bg: #121215;
      `
          : `
      --bg-canvas: #ffffff;
      --bg-surface: #f4f4f5;
      --border: #e4e4e7;
      --text-main: #18181b;
      --text-muted: #71717a;
      --accent: #7c3aed;
      --code-bg: #f8fafc;
      `
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-sans);
      background-color: var(--bg-canvas);
      color: var(--text-main);
      line-height: 1.65;
      padding: 2.5rem 1.5rem;
      max-width: 900px;
      margin: 0 auto;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--text-main);
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.8rem;
      margin-bottom: 0.8rem;
    }
    h1 { font-size: 2.2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-top: 0; }
    h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
    h3 { font-size: 1.2rem; }
    h4 { font-size: 1.05rem; }

    p { margin-bottom: 1rem; color: var(--text-main); font-size: 0.95rem; }
    blockquote {
      border-left: 4px solid var(--accent);
      padding: 0.5rem 1rem;
      margin: 1rem 0;
      background: var(--bg-surface);
      border-radius: 0 8px 8px 0;
      color: var(--text-muted);
      font-style: italic;
    }

    ul, ol { margin-left: 1.8rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.35rem; font-size: 0.95rem; }

    code {
      font-family: var(--font-mono);
      background: var(--bg-surface);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.88em;
      border: 1px solid var(--border);
    }

    pre.code-block {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0 1.5rem 0;
    }
    pre.code-block code {
      background: transparent;
      padding: 0;
      border: none;
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .table-container {
      overflow-x: auto;
      margin: 1.5rem 0;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td {
      padding: 0.65rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: var(--bg-surface);
      font-weight: 600;
    }
    tr:last-child td { border-bottom: none; }

    hr {
      border: none;
      height: 1px;
      background: var(--border);
      margin: 2rem 0;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 0.5rem 0;
    }

    a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { text-decoration: underline; }

    @media print {
      body {
        background: white !important;
        color: black !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
      h1, h2 { page-break-after: avoid; }
      pre, table { page-break-inside: avoid; }
      a { color: black !important; text-decoration: underline; }
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
}

function formatInlineMarkdown(text: string): string {
  return text
    // Images: ![alt](url)
    .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Bold: **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
