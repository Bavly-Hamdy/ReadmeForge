export type Persona = "PORTFOLIO" | "OPEN_SOURCE" | "MINIMALIST" | "ENTERPRISE";

export interface PersonaConfig {
  id: Persona;
  label: string;
  description: string;
  icon: string; // lucide icon name
  sections: string[]; // Which README sections to include
  toneDirective: string; // Injected into system prompt
  maxSections: number;
}

export const PERSONA_REGISTRY: Record<Persona, PersonaConfig> = {
  ENTERPRISE: {
    id: "ENTERPRISE",
    label: "Enterprise SaaS",
    description: "Full 14-section README with ADRs, security, and deployment matrix",
    icon: "Building2",
    sections: [
      "hero",
      "toc",
      "overview",
      "architecture",
      "features",
      "tech",
      "install",
      "structure",
      "modules",
      "api",
      "security",
      "deployment",
      "contributors",
      "license",
    ],
    toneDirective:
      "Write as a Principal Architect for enterprise stakeholders, technical leads, and engineering teams. Focus on scalability, security compliance, architecture decisions, and rigorous setup.",
    maxSections: 14,
  },
  PORTFOLIO: {
    id: "PORTFOLIO",
    label: "Portfolio Showcase",
    description: "Visual, demo-focused README tailored for personal projects and recruiters",
    icon: "Briefcase",
    sections: [
      "hero",
      "overview",
      "features",
      "tech",
      "install",
      "structure",
      "contributors",
      "license",
    ],
    toneDirective:
      "Write as an exceptional software engineer showcasing their best work to recruiters, engineering managers, and clients. Highlight visual impact, live demos, core engineering achievements, and quick local reproduction.",
    maxSections: 8,
  },
  OPEN_SOURCE: {
    id: "OPEN_SOURCE",
    label: "Open-Source Maintainer",
    description: "Community-driven README with contributing guide and code of conduct",
    icon: "HeartHandshake",
    sections: [
      "hero",
      "toc",
      "overview",
      "features",
      "tech",
      "install",
      "structure",
      "api",
      "contributing",
      "contributors",
      "license",
    ],
    toneDirective:
      "Write for open-source contributors and adopters. Prioritize welcoming instructions, good first issues, transparent roadmap, setup ease, clear API documentation, and community guidelines.",
    maxSections: 11,
  },
  MINIMALIST: {
    id: "MINIMALIST",
    label: "Minimalist",
    description: "Ultra-clean, concise README with only the vital essentials",
    icon: "Sparkles",
    sections: ["hero", "overview", "install", "license"],
    toneDirective:
      "Be extremely concise. No verbose explanations, no unnecessary diagrams, no fluff. Provide just what someone needs to understand what this project is and run it in 60 seconds.",
    maxSections: 4,
  },
};
