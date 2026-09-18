import { describe, it, expect } from "vitest";
import { markdownToStyledHtml } from "../export/markdown-to-html";

describe("Markdown to Styled HTML Exporter", () => {
  it("converts Markdown to a full HTML5 document with CSS and typography", () => {
    const md = `
# ReadmeForge Title

This is a description paragraph with **bold** and *italic* text.

## Features
- First capability
- Second capability

| Header 1 | Header 2 |
| :--- | :--- |
| Val 1 | Val 2 |

\`\`\`typescript
const greeting = "hello world";
\`\`\`
`;

    const html = markdownToStyledHtml(md, {
      title: "ReadmeForge Export",
      theme: "dark",
      includeMermaid: true,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>ReadmeForge Export</title>");
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("<h1>ReadmeForge Title</h1>");
    expect(html).toContain("<h2>Features</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Header 1</th>");
    expect(html).toContain("<td>Val 1</td>");
    expect(html).toContain('<pre class="code-block language-typescript">');
    expect(html).toContain("@media print");
  });
});
