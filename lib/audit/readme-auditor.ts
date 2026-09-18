export interface AuditCriterion {
  id: string;
  name: string;
  category: "Structure" | "Content" | "Technical" | "Community";
  passed: boolean;
  score: number;
  maxScore: number;
  details: string;
  autoFixPrompt?: string;
}

export type AuditGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface AuditResult {
  totalScore: number; // 0 to 100
  grade: AuditGrade;
  criteria: AuditCriterion[];
  suggestions: string[];
  summary: string;
}

/**
 * Audits a README markdown document against 10 comprehensive quality criteria.
 */
export function auditReadme(markdown: string): AuditResult {
  if (!markdown || !markdown.trim()) {
    return {
      totalScore: 0,
      grade: "F",
      criteria: [],
      suggestions: ["README is completely empty. Generate or write initial content."],
      summary: "Empty documentation file.",
    };
  }

  const criteria: AuditCriterion[] = [];

  // 1. Project Description (H1 + first substantive paragraph >= 30 chars)
  const hasH1 = /^#\s+[^\n\r]+/m.test(markdown);
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => !p.startsWith("#") && !p.startsWith("[!") && !p.startsWith("[![") && p.length > 0);
  const firstParaLen = paragraphs[0]?.length || 0;
  const descPassed = hasH1 && firstParaLen >= 30;
  criteria.push({
    id: "project-description",
    name: "Project Description & Title",
    category: "Structure",
    passed: descPassed,
    score: descPassed ? 10 : hasH1 ? 5 : 0,
    maxScore: 10,
    details: descPassed
      ? "Clear H1 project title and introductory paragraph found."
      : hasH1
      ? "Project has an H1 title, but introductory paragraph is under 30 characters."
      : "Missing primary # H1 project heading.",
    autoFixPrompt: "Add a crisp H1 title and a compelling 2-3 sentence project overview describing purpose and value.",
  });

  // 2. Installation Guide (Heading + code fence, allowing emojis)
  const hasInstallHeader = /##\s*(?:[^\w\s]+\s*)?(Installation|Getting\s+Started|Quick\s*start|Setup)/i.test(markdown);
  const hasCodeFenceAfterInstall = /##\s*(?:[^\w\s]+\s*)?(?:Installation|Getting\s+Started|Quick\s*start|Setup)[\s\S]*?```/i.test(markdown);
  const installPassed = hasInstallHeader && hasCodeFenceAfterInstall;
  criteria.push({
    id: "installation-guide",
    name: "Installation & Setup Guide",
    category: "Technical",
    passed: installPassed,
    score: installPassed ? 10 : hasInstallHeader ? 5 : 0,
    maxScore: 10,
    details: installPassed
      ? "Installation section with executable code commands is present."
      : hasInstallHeader
      ? "Installation heading found, but lacks executable command code blocks."
      : "Missing explicit 'Installation' or 'Getting Started' section.",
    autoFixPrompt: "Add an '## 🚀 Getting Started' section with prerequisites and copy-pasteable installation commands.",
  });

  // 3. Usage / Practical Code Examples (>= 3 code blocks)
  const codeBlockMatches = markdown.match(/```[a-zA-Z0-9_-]*[\s\S]*?```/g) || [];
  const codeCount = codeBlockMatches.length;
  const usagePassed = codeCount >= 3;
  criteria.push({
    id: "usage-examples",
    name: "Code Snippets & Usage Examples",
    category: "Technical",
    passed: usagePassed,
    score: usagePassed ? 10 : codeCount >= 1 ? 6 : 0,
    maxScore: 10,
    details: usagePassed
      ? `High technical density with ${codeCount} code blocks/examples.`
      : `Found ${codeCount} code block(s). Professional documentation needs at least 3 for thorough coverage.`,
    autoFixPrompt: "Add concrete usage code examples and CLI command snippets with syntax highlighting.",
  });

  // 4. API or CLI Reference
  const hasApiOrCli =
    /##\s*(?:[^\w\s]+\s*)?(API|CLI|Endpoints|Reference|Commands|Usage)/i.test(markdown) ||
    /\|\s*Method\s*\|\s*Endpoint\s*\|/i.test(markdown) ||
    /\|\s*Command\s*\|\s*Description\s*\|/i.test(markdown);
  criteria.push({
    id: "api-reference",
    name: "API or Command Reference",
    category: "Technical",
    passed: hasApiOrCli,
    score: hasApiOrCli ? 10 : 0,
    maxScore: 10,
    details: hasApiOrCli
      ? "API endpoints or CLI command matrix found."
      : "Missing API endpoint documentation or CLI command reference table.",
    autoFixPrompt: "Add an '## 🔌 API / CLI Reference' section with a markdown table of routes or commands.",
  });

  // 5. System Architecture / Diagram
  const hasMermaid = /```mermaid[\s\S]*?```/i.test(markdown);
  const hasAsciiDiagram = /(┌|├|└|│|─|-->|==>|──>)/.test(markdown);
  const archPassed = hasMermaid || hasAsciiDiagram;
  criteria.push({
    id: "architecture-diagram",
    name: "Visual Architecture Diagram",
    category: "Structure",
    passed: archPassed,
    score: archPassed ? 10 : 0,
    maxScore: 10,
    details: archPassed
      ? hasMermaid
        ? "Interactive Mermaid.js flow diagram detected."
        : "ASCII architectural diagram detected."
      : "No visual flowcharts, Mermaid diagrams, or architectural diagrams found.",
    autoFixPrompt: "Generate a Mermaid.js flowchart (```mermaid graph TD ...) illustrating the system architecture and data flow.",
  });

  // 6. License Section
  const hasLicense =
    /##\s*(?:[^\w\s]+\s*)?License/i.test(markdown) ||
    /\[!\[License/i.test(markdown) ||
    /img\.shields\.io\/badge\/License/i.test(markdown);
  criteria.push({
    id: "license-section",
    name: "Open Source License & Terms",
    category: "Community",
    passed: hasLicense,
    score: hasLicense ? 10 : 0,
    maxScore: 10,
    details: hasLicense
      ? "License declaration or badge found."
      : "No explicit License section or license badge found.",
    autoFixPrompt: "Add a '## 📄 License' section stating the license terms, permissions, and copyright notice.",
  });

  // 7. Contributing Guide
  const hasContributing =
    /##\s*(?:[^\w\s]+\s*)?(Contributing|Contribution|Development)/i.test(markdown) ||
    /CONTRIBUTING\.md/i.test(markdown);
  criteria.push({
    id: "contributing-guide",
    name: "Contributing Guidelines",
    category: "Community",
    passed: hasContributing,
    score: hasContributing ? 10 : 0,
    maxScore: 10,
    details: hasContributing
      ? "Contributing guidelines or link present."
      : "Missing contribution guidelines for open-source collaboration.",
    autoFixPrompt: "Add a '## 🤝 Contributing' section explaining how to submit PRs, report bugs, and adhere to code style.",
  });

  // 8. Badges and Shields
  const badgeMatches = markdown.match(/(?:shields\.io|badge\.svg|github\/actions\/workflow)/gi) || [];
  const badgeCount = badgeMatches.length;
  const badgesPassed = badgeCount >= 3;
  criteria.push({
    id: "badges-shields",
    name: "Status Badges & Shields",
    category: "Structure",
    passed: badgesPassed,
    score: badgesPassed ? 10 : badgeCount > 0 ? 5 : 0,
    maxScore: 10,
    details: badgesPassed
      ? `Found ${badgeCount} status badges (build, license, version).`
      : `Found ${badgeCount} badge(s). Professional repos typically feature at least 3 shields.io badges.`,
    autoFixPrompt: "Add Shields.io status badges at the top for License, Build status, Version, and Tech stack.",
  });

  // 9. Table of Contents
  const hasTocHeader = /##\s*(?:[^\w\s]+\s*)?Table\s+of\s+Contents/i.test(markdown);
  const anchorLinkCount = (markdown.match(/\[[^\]]+\]\(#[a-zA-Z0-9_\-]+\)/g) || []).length;
  const tocPassed = hasTocHeader || anchorLinkCount >= 4;
  criteria.push({
    id: "table-of-contents",
    name: "Table of Contents Navigation",
    category: "Structure",
    passed: tocPassed,
    score: tocPassed ? 10 : anchorLinkCount > 0 ? 5 : 0,
    maxScore: 10,
    details: tocPassed
      ? "Document contains navigation links or Table of Contents."
      : "Missing Table of Contents for seamless document navigation.",
    autoFixPrompt: "Add an anchored '## 📋 Table of Contents' with links to all major sections.",
  });

  // 10. Link Integrity & Markdown Hygiene
  const hasEmptyLinks = /\[\s*\]\([^\)]*\)/.test(markdown) || /\[[^\]]+\]\(\s*\)/.test(markdown);
  const unclosedFences = (markdown.match(/```/g) || []).length % 2 !== 0;
  const hygienePassed = !hasEmptyLinks && !unclosedFences;
  criteria.push({
    id: "link-hygiene",
    name: "Markdown Syntax & Link Hygiene",
    category: "Content",
    passed: hygienePassed,
    score: hygienePassed ? 10 : 4,
    maxScore: 10,
    details: hygienePassed
      ? "Clean Markdown formatting with no unclosed code fences or broken link brackets."
      : unclosedFences
      ? "Warning: Unclosed code fence detected in markdown."
      : "Warning: Empty or malformed markdown links detected.",
    autoFixPrompt: "Fix broken markdown formatting, unclosed code fences, and empty link targets.",
  });

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);

  let grade: AuditGrade = "F";
  if (totalScore >= 95) grade = "A+";
  else if (totalScore >= 85) grade = "A";
  else if (totalScore >= 70) grade = "B";
  else if (totalScore >= 55) grade = "C";
  else if (totalScore >= 40) grade = "D";

  const suggestions: string[] = criteria
    .filter((c) => !c.passed)
    .map((c) => c.details);

  const summary =
    totalScore >= 85
      ? "Exceptional documentation quality! Your README meets top-tier engineering standards."
      : totalScore >= 70
      ? "Solid documentation. Addressing a few missing sections will make it production-grade."
      : "Documentation needs significant improvements to reach professional engineering standards.";

  return {
    totalScore,
    grade,
    criteria,
    suggestions,
    summary,
  };
}
