"use client";

import React, { useState, useEffect } from "react";
import {
  GitBranch,
  ArrowRight,
  Loader2,
  AlertCircle,
  Users,
  Briefcase,
  Globe,
  Code2,
  Building2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Brain,
  BarChart3,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";

const PERSONA_CARDS = [
  {
    id: "PORTFOLIO",
    title: "Portfolio Showcase",
    icon: Briefcase,
    desc: "Built for personal projects & developer showcases",
    highlights: [
      "🏗️ Architectural Decision Records (ADR)",
      "📱 Live Demo & Screenshots placeholders",
      "🎯 Problem Statement & Impact metrics",
    ],
  },
  {
    id: "OPEN_SOURCE",
    title: "Open Source Community",
    icon: Globe,
    desc: "Built for community repos & contributors",
    highlights: [
      "👥 All-Contributors avatar grid",
      "🤝 Contributing & Code of Conduct guides",
      "🏷️ Shields.io badges showcase",
    ],
  },
  {
    id: "MINIMALIST",
    title: "Minimalist Light",
    icon: Code2,
    desc: "Ultra-fast, zero-fluff document",
    highlights: [
      "⚡ Under 60 lines of clean markdown",
      "🚀 Prerequisites, Install & Run commands",
      "📄 One-click License summary",
    ],
  },
  {
    id: "ENTERPRISE",
    title: "Enterprise SaaS",
    icon: Building2,
    desc: "Built for corporate platforms & full API docs",
    highlights: [
      "🔌 Comprehensive API Endpoint Matrix",
      "🛡️ Security & Compliance Policies",
      "📊 Deployment & Environment Matrix",
    ],
  },
];

const STAGES = [
  { id: 0, title: "Extracting AST Manifests & Recursive Git Tree", icon: Search, progress: 20 },
  { id: 1, title: "Filtering Codebase Entrypoints & API Routes", icon: Filter, progress: 40 },
  { id: 2, title: "Summarizing Exported Interfaces & Sub-modules", icon: Brain, progress: 65 },
  { id: 3, title: "Constructing Unified RepoDigest Topology", icon: BarChart3, progress: 85 },
  { id: 4, title: "Synthesizing GFM README & Mermaid SVG Diagrams", icon: Sparkles, progress: 95 },
];

export function GeneratorForm() {
  const {
    repoUrl,
    persona,
    customTitle,
    demoUrl,
    teamName,
    collaborators,
    isGenerating,
    error,
    setRepoUrl,
    setPersona,
    setCustomTitle,
    setDemoUrl,
    setTeamName,
    addCollaborator,
    removeCollaborator,
    setIsGenerating,
    setGeneratedMarkdown,
    setDigest,
    setError,
  } = useReadmeStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collabName, setCollabName] = useState("");
  const [collabRole, setCollabRole] = useState("");
  const [collabHandle, setCollabHandle] = useState("");
  const [currentStage, setCurrentStage] = useState(0);

  // Cycle through progress stages while generating
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStage(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1800);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabName.trim()) return;
    addCollaborator({
      name: collabName.trim(),
      role: collabRole.trim() || "Contributor",
      githubHandle: collabHandle.trim().replace(/^@/, "") || null,
    });
    setCollabName("");
    setCollabRole("");
    setCollabHandle("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError("Please enter a valid GitHub repository URL.");
      return;
    }

    setIsGenerating(true);
    setCurrentStage(0);
    setError(null);
    setGeneratedMarkdown(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          persona,
          customTitle: customTitle.trim() || undefined,
          demoUrl: demoUrl.trim() || undefined,
          teamName: teamName.trim() || undefined,
          collaborators,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate README.");
      }

      setGeneratedMarkdown(data.markdown);
      setDigest(data.digest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred during generation.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeStageObj = STAGES[currentStage];
  const StageIcon = activeStageObj.icon;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* 1. Minimalist Persona Selection Grid */}
      <div className="w-full text-left mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Document Style & Target Persona
          </h3>
          <span className="text-xs text-neutral-500 font-mono">Select target mode</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERSONA_CARDS.map((card) => {
            const isSelected = persona === card.id;
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => setPersona(card.id)}
                className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 relative ${
                  isSelected
                    ? "bg-neutral-100 dark:bg-neutral-900 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm"
                    : "bg-white/80 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2.5 rounded-lg border ${
                      isSelected
                        ? "bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                        : "bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {card.title}
                      </h4>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                      {card.desc}
                    </p>

                    <ul className="mt-3 space-y-1">
                      {card.highlights.map((h, i) => (
                        <li key={i} className="text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5 font-mono">
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Repo URL Form - High Contrast Input Bar */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <div className="w-full minimal-card p-2 rounded-xl flex flex-col sm:flex-row gap-2 border border-neutral-300 dark:border-neutral-800 shadow-sm bg-neutral-100 dark:bg-neutral-900">
          <div className="flex-1 flex items-center px-4 bg-white dark:bg-neutral-950 rounded-lg border border-neutral-300 dark:border-neutral-800 focus-within:border-neutral-500 dark:focus-within:border-neutral-600 transition-colors">
            <GitBranch className="w-4 h-4 text-neutral-400 dark:text-neutral-500 mr-3 flex-shrink-0" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              disabled={isGenerating}
              className="w-full py-3 text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 bg-transparent focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating}
            className="px-6 py-3 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-neutral-100 dark:text-neutral-900 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm min-w-[180px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-100 dark:text-neutral-900" />
                <span>Processing AST...</span>
              </>
            ) : (
              <>
                <span>Forge README</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Live Interactive Progress Stepper */}
        {isGenerating && (
          <div className="w-full p-5 rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-100/90 dark:bg-neutral-900/90 text-left animate-in fade-in duration-300 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                <StageIcon className="w-4 h-4 text-neutral-700 dark:text-neutral-300 animate-pulse" />
                <span>Stage {currentStage + 1} of 5: {activeStageObj.title}</span>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400">
                {activeStageObj.progress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden mb-4">
              <div
                className="bg-neutral-900 dark:bg-neutral-100 h-full transition-all duration-500 ease-out"
                style={{ width: `${activeStageObj.progress}%` }}
              />
            </div>

            {/* Stage Indicators */}
            <div className="grid grid-cols-5 gap-1 pt-1">
              {STAGES.map((s) => {
                const isCompleted = s.id < currentStage;
                const isCurrent = s.id === currentStage;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                      isCurrent
                        ? "bg-white dark:bg-neutral-950 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100"
                        : isCompleted
                        ? "bg-neutral-200/60 dark:bg-neutral-800/60 border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
                        : "bg-transparent border-transparent text-neutral-400 opacity-50"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mb-1" />
                    ) : (
                      <span className="text-[10px] font-mono font-bold mb-1">{s.id + 1}</span>
                    )}
                    <span className="text-[9px] font-mono line-clamp-1">{s.title.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Advanced Team & Metadata Accordion */}
        <div className="w-full text-left minimal-card rounded-xl border border-neutral-300 dark:border-neutral-800 overflow-hidden bg-white/70 dark:bg-neutral-950/60">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-5 py-3 flex items-center justify-between text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 bg-neutral-100/60 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-900/80 transition-colors text-xs font-mono uppercase tracking-wider"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-500" />
              <span>Team Members & Project Metadata ({collaborators.length} Members)</span>
            </div>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="p-5 space-y-5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/80">
              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-1.5">Custom Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. ReadmeForge SaaS"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-1.5">Team / Company</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Core Engineering"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-1.5">Live Demo URL</label>
                  <input
                    type="text"
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                    placeholder="https://demo.app"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              </div>

              {/* Add Team Member */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
                <h4 className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                  Team Members & Contributors (All-Contributors Grid)
                </h4>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    value={collabName}
                    onChange={(e) => setCollabName(e.target.value)}
                    placeholder="Name (e.g. Bavly Hamdy)"
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none font-mono"
                  />
                  <input
                    type="text"
                    value={collabRole}
                    onChange={(e) => setCollabRole(e.target.value)}
                    placeholder="Role (e.g. Systems Architect)"
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none font-mono"
                  />
                  <input
                    type="text"
                    value={collabHandle}
                    onChange={(e) => setCollabHandle(e.target.value)}
                    placeholder="GitHub Handle (e.g. octocat)"
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddCollaborator}
                    className="px-4 py-2 bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-100 dark:text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors border border-neutral-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                </div>

                {/* Team Members List */}
                {collaborators.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {collaborators.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-neutral-200"
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[10px] text-neutral-600 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700">
                          {c.role}
                        </span>
                        {c.githubHandle && (
                          <span className="text-[10px] text-neutral-500">@{c.githubHandle}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCollaborator(i)}
                          className="text-neutral-400 hover:text-red-500 transition-colors ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Error Alert */}
      {error && (
        <div className="mt-4 w-full p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-mono flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
