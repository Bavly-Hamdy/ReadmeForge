import { describe, it, expect } from "vitest";
import { auditReadme } from "../audit/readme-auditor";

describe("Readme Auditor Engine", () => {
  it("returns score 0 and grade F for empty markdown", () => {
    const result = auditReadme("");
    expect(result.totalScore).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.criteria.length).toBe(0);
  });

  it("evaluates high-quality comprehensive README and awards high score", () => {
    const richMarkdown = `
# ReadmeForge ⚡

> Next-generation automated technical documentation intelligence platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

## 📋 Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## 🔍 Overview
ReadmeForge provides enterprise-grade repository analysis, AST tree digestion, and high-density markdown generation.

## 🚀 Getting Started

Prerequisites: Node.js 20+ and npm.

\`\`\`bash
git clone https://github.com/Bavly-Hamdy/ReadmeForge.git
cd ReadmeForge
npm install
npm run dev
\`\`\`

## 💻 Usage Examples

Running analysis pipeline:

\`\`\`typescript
import { AnalysisPipeline } from "./worker/pipeline";
const pipeline = new AnalysisPipeline();
const stage0 = await pipeline.runStage0(["package.json"], {});
\`\`\`

Testing suite:

\`\`\`bash
npm test
\`\`\`

## 🔌 API Reference

| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| \`POST\` | \`/api/generate\` | SSE Stream for README synthesis | \`200\` |
| \`POST\` | \`/api/refine\` | AI Refinement chat endpoint | \`200\` |

## 🏛️ System Architecture

\`\`\`mermaid
graph TD
    Client["Client UI"] --> API["Next.js API"]
    API --> Gemini["Gemini 1.5 Pro"]
\`\`\`

## 🤝 Contributing
Contributions are warmly welcomed! Please read our contributing guide before opening a PR.

## 📄 License
Released under the MIT License. Copyright (c) 2026 ReadmeForge Team.
`;

    const result = auditReadme(richMarkdown);
    expect(result.totalScore).toBeGreaterThanOrEqual(90);
    expect(["A+", "A"]).toContain(result.grade);
    expect(result.criteria.length).toBe(10);
    expect(result.criteria.every((c) => c.passed)).toBe(true);
  });

  it("detects missing sections and offers actionable recommendations", () => {
    const poorMarkdown = `
# Tiny Project
Some very short text without installation or code blocks.
`;

    const result = auditReadme(poorMarkdown);
    expect(result.totalScore).toBeLessThan(50);
    expect(["D", "F"]).toContain(result.grade);
    const failedCriteria = result.criteria.filter((c) => !c.passed);
    expect(failedCriteria.length).toBeGreaterThan(4);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
