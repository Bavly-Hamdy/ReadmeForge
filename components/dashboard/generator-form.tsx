"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Loader2,
  AlertCircle,
  Users,
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
  Timer,
  Check,
  Building2,
  Briefcase,
  HeartHandshake,
  FileArchive,
  UploadCloud,
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";
import { PERSONA_REGISTRY, Persona } from "@/lib/ai/personas";
import { LocalUpload } from "./local-upload";

const STAGES = [
  { id: 0, title: "Stage 1/5", subtitle: "Parsing AST & Manifests", icon: Search },
  { id: 1, title: "Stage 2/5", subtitle: "Filtering Routes & Entrypoints", icon: Filter },
  { id: 2, title: "Stage 3/5", subtitle: "Summarizing Exported Interfaces", icon: Brain },
  { id: 3, title: "Stage 4/5", subtitle: "Constructing Topology & ADR", icon: BarChart3 },
  { id: 4, title: "Stage 5/5", subtitle: "Synthesizing GFM & Mermaid SVG", icon: Sparkles },
];

export function GeneratorForm() {
  const {
    repoUrl,
    persona,
    customTitle,
    demoUrl,
    teamName,
    authorName,
    copyrightYear,
    licenseType,
    includeLicense,
    collaborators,
    isGenerating,
    error,
    setRepoUrl,
    setPersona,
    setCustomTitle,
    setDemoUrl,
    setTeamName,
    setAuthorName,
    setCopyrightYear,
    setLicenseType,
    setIncludeLicense,
    addCollaborator,
    removeCollaborator,
    setIsGenerating,
    setGeneratedMarkdown,
    setGeneratedLicense,
    setSuggestedDescription,
    setSuggestedTopics,
    setReleaseNotes,
    setDigest,
    setError,
  } = useReadmeStore();

  const [inputMode, setInputMode] = useState<"github" | "local">("github");
  const [localProjectData, setLocalProjectData] = useState<{
    treePaths: string[];
    fileContents: Record<string, string>;
    projectName: string;
  } | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collabName, setCollabName] = useState("");
  const [collabRole, setCollabRole] = useState("");
  const [collabHandle, setCollabHandle] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);

  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [serverMessage, setServerMessage] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [apiResult, setApiResult] = useState<{ markdown: string; digest: any } | null>(null);

  const stepperRef = useRef<HTMLDivElement>(null);

  // Auto-detect repo owner when repoUrl changes if authorName is empty
  const handleRepoUrlChange = (url: string) => {
    setRepoUrl(url);
    const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
    if (match && match[1] && !authorName) {
      setAuthorName(match[1]);
    }
  };

  // Stopwatch timer for real-time generation elapsed display
  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timerInterval);
  }, [isGenerating]);

  // Handle completion transitions
  useEffect(() => {
    if (isFinished && apiResult) {
      const timeout = setTimeout(() => {
        setIsGenerating(false);
        setTimeout(() => {
          document.getElementById("readme-preview-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [isFinished, apiResult, setIsGenerating]);

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
    if (inputMode === "github" && !repoUrl.trim()) {
      setError("Please enter a valid GitHub repository URL.");
      return;
    }

    if (inputMode === "local" && !localProjectData) {
      setError("Please upload a .zip project archive first.");
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setCurrentStage(0);
    setServerMessage("Initializing pipeline...");
    setElapsedMs(0);
    setIsFinished(false);
    setApiResult(null);
    setError(null);
    setIsAuthError(false);
    setGeneratedMarkdown(null);

    // Scroll progress card into view smoothly
    setTimeout(() => {
      stepperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    try {
      const endpoint = inputMode === "github" ? "/api/generate" : "/api/generate-local";
      const payload =
        inputMode === "github"
          ? {
              repoUrl,
              persona: (persona as Persona) || "ENTERPRISE",
              customTitle: customTitle.trim() || undefined,
              demoUrl: demoUrl.trim() || undefined,
              teamName: teamName.trim() || undefined,
              authorName: authorName.trim() || undefined,
              copyrightYear: copyrightYear.trim() || undefined,
              licenseType,
              includeLicense,
              collaborators,
            }
          : {
              treePaths: localProjectData!.treePaths,
              fileContents: localProjectData!.fileContents,
              persona: (persona as Persona) || "ENTERPRISE",
              customTitle: (customTitle.trim() || localProjectData!.projectName) || undefined,
              demoUrl: demoUrl.trim() || undefined,
              teamName: teamName.trim() || undefined,
              authorName: authorName.trim() || undefined,
              copyrightYear: copyrightYear.trim() || undefined,
              licenseType,
              includeLicense,
              collaborators,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) setIsAuthError(true);
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Server-Sent Events streaming is not supported by your browser.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const block of events) {
          if (!block.trim()) continue;
          let eventName = "message";
          let dataStr = "";

          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (eventName === "stage-progress") {
              if (typeof data.stage === "number") setCurrentStage(data.stage);
              if (typeof data.progress === "number") setProgress(data.progress);
              if (data.message) setServerMessage(data.message);
            } else if (eventName === "complete") {
              setGeneratedMarkdown(data.markdown);
              setGeneratedLicense(data.licenseContent || null);
              if (data.suggestedDescription) setSuggestedDescription(data.suggestedDescription);
              if (data.suggestedTopics) setSuggestedTopics(data.suggestedTopics);
              if (data.releaseNotes) setReleaseNotes(data.releaseNotes);
              setDigest(data.digest);
              setApiResult({ markdown: data.markdown, digest: data.digest });
              setProgress(100);
              setIsFinished(true);
              setCurrentStage(STAGES.length - 1);
            } else if (eventName === "error") {
              throw new Error(data.error || "Generation pipeline encountered an error.");
            }
          } catch (streamErr: any) {
            if (eventName === "error" || streamErr.message?.includes("pipeline")) {
              throw streamErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred during generation.";
      setError(msg);
      setIsGenerating(false);
    }
  };

  const activeStageObj = STAGES[currentStage] || STAGES[0];
  const StageIcon = activeStageObj.icon;
  const roundedProgress = Math.min(100, Math.floor(progress));
  const isComplete = isFinished && roundedProgress === 100;

  const currentPersona = (persona as Persona) || "ENTERPRISE";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* ── PERSONA SELECTOR GRID ── */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Select Output Persona &amp; Tone
          </label>
          <span className="text-[11px] text-neutral-400 font-mono">
            {PERSONA_REGISTRY[currentPersona]?.sections.length} tailored sections
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {(Object.keys(PERSONA_REGISTRY) as Persona[]).map((pKey) => {
            const p = PERSONA_REGISTRY[pKey];
            const isSelected = currentPersona === pKey;
            const IconComponent =
              pKey === "ENTERPRISE"
                ? Building2
                : pKey === "PORTFOLIO"
                ? Briefcase
                : pKey === "OPEN_SOURCE"
                ? HeartHandshake
                : Sparkles;

            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setPersona(pKey)}
                disabled={isGenerating}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 shadow-sm ring-1 ring-indigo-500"
                    : "border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                } ${isGenerating ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-0.5">
                  {p.label}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MODE TOGGLE TABS ── */}
      <div className="w-full flex items-center justify-between mb-3">
        <div className="inline-flex p-1 bg-neutral-200/70 dark:bg-neutral-800/70 rounded-xl border border-neutral-300/50 dark:border-neutral-700/50">
          <button
            type="button"
            onClick={() => setInputMode("github")}
            disabled={isGenerating}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              inputMode === "github"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            GitHub Repository
          </button>
          <button
            type="button"
            onClick={() => setInputMode("local")}
            disabled={isGenerating}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              inputMode === "local"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Upload Local Project (.zip)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={isGenerating}
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors flex items-center gap-1.5"
        >
          <span>Advanced Config</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── INPUT METHOD CONTAINER ── */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        {inputMode === "github" ? (
          <div className="w-full minimal-card p-2 rounded-xl flex flex-col sm:flex-row gap-2 border border-neutral-300 dark:border-neutral-800 shadow-sm bg-neutral-100 dark:bg-neutral-900">
            <div className="flex-1 flex items-center px-4 bg-white dark:bg-neutral-950 rounded-lg border border-neutral-300 dark:border-neutral-800 focus-within:border-neutral-500 dark:focus-within:border-neutral-600 transition-colors">
              <GitBranch className="w-4 h-4 text-neutral-400 dark:text-neutral-500 mr-3 flex-shrink-0" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repository"
                disabled={isGenerating}
                className="w-full py-3 text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 bg-transparent focus:outline-none disabled:opacity-50"
              />
            </div>
            {/* Forge Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="relative overflow-hidden rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-6 py-3 font-semibold text-white text-sm shadow-lg transition-all duration-300 disabled:cursor-not-allowed min-w-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            >
              {isGenerating && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out ${
                    isComplete ? "bg-emerald-500/40" : "bg-indigo-500/50"
                  }`}
                  style={{ width: `${roundedProgress}%` }}
                />
              )}

              <span className="relative z-10 flex items-center justify-between w-full">
                {isGenerating ? (
                  isComplete ? (
                    <span className="flex items-center justify-center gap-2 w-full">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300 flex-shrink-0" />
                      <span>README Generated!</span>
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 min-w-0">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[130px] sm:max-w-[180px]">
                          {serverMessage || activeStageObj.subtitle}
                        </span>
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums flex-shrink-0">
                        {roundedProgress}%
                      </span>
                    </>
                  )
                ) : (
                  <span className="flex items-center justify-center gap-2 w-full">
                    <Sparkles className="h-4 w-4" />
                    <span>Forge {PERSONA_REGISTRY[currentPersona]?.label || "README"}</span>
                  </span>
                )}
              </span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <LocalUpload
              disabled={isGenerating}
              onZipProcessed={(data) => {
                setLocalProjectData(data);
                if (!customTitle) setCustomTitle(data.projectName);
              }}
            />
            {localProjectData && (
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full relative overflow-hidden rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-6 py-3 font-semibold text-white text-sm shadow-lg transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-indigo-500/50 transition-all duration-300 ease-out"
                    style={{ width: `${roundedProgress}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{serverMessage || "Processing local code..."} ({roundedProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Forge README for {localProjectData.projectName}</span>
                    </>
                  )}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── ADVANCED CONFIGURATION ACCORDION ── */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full overflow-hidden"
            >
              <div className="w-full p-5 rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm flex flex-col gap-4">
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Documentation &amp; Branding Metadata
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 block mb-1">
                      Custom Project Title
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g., ReadmeForge Next-Gen"
                      disabled={isGenerating}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 block mb-1">
                      Live Demo / Website URL
                    </label>
                    <input
                      type="url"
                      value={demoUrl}
                      onChange={(e) => setDemoUrl(e.target.value)}
                      placeholder="https://your-demo-app.com"
                      disabled={isGenerating}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 block mb-1">
                      Team / Organization Name
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g., Acme Cloud Core"
                      disabled={isGenerating}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 block mb-1">
                      Author / Copyright Holder
                    </label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="e.g., John Doe"
                      disabled={isGenerating}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLicense}
                      onChange={(e) => setIncludeLicense(e.target.checked)}
                      disabled={isGenerating}
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                      Generate official LICENSE file (MIT)
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-500">Year:</span>
                    <input
                      type="text"
                      value={copyrightYear}
                      onChange={(e) => setCopyrightYear(e.target.value)}
                      placeholder="2026"
                      disabled={isGenerating}
                      className="w-20 px-2 py-1 text-xs font-mono rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-center"
                    />
                  </div>
                </div>

                {/* Collaborators List */}
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Collaborators &amp; Authors ({collaborators.length})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={collabName}
                      onChange={(e) => setCollabName(e.target.value)}
                      placeholder="Name"
                      disabled={isGenerating}
                      className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs font-mono rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                    />
                    <input
                      type="text"
                      value={collabRole}
                      onChange={(e) => setCollabRole(e.target.value)}
                      placeholder="Role (e.g. Lead Dev)"
                      disabled={isGenerating}
                      className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs font-mono rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                    />
                    <input
                      type="text"
                      value={collabHandle}
                      onChange={(e) => setCollabHandle(e.target.value)}
                      placeholder="@github"
                      disabled={isGenerating}
                      className="w-28 px-2.5 py-1.5 text-xs font-mono rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                    />
                    <button
                      type="button"
                      onClick={handleAddCollaborator}
                      disabled={isGenerating || !collabName.trim()}
                      className="px-3 py-1.5 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-medium hover:opacity-90 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {collaborators.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {collaborators.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono border border-neutral-200 dark:border-neutral-700"
                        >
                          <span className="font-semibold">{c.name}</span>
                          {c.role && <span className="text-neutral-500">({c.role})</span>}
                          {c.githubHandle && (
                            <span className="text-indigo-500">@{c.githubHandle}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCollaborator(i)}
                            disabled={isGenerating}
                            className="text-neutral-400 hover:text-red-500 ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── REAL-TIME SSE PROGRESS CARD ── */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              ref={stepperRef}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full my-4 p-6 sm:p-8 rounded-3xl border-2 border-neutral-300 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl text-left shadow-2xl relative overflow-hidden ring-4 ring-neutral-200/50 dark:ring-neutral-800/50"
            >
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-2xl pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative p-3 rounded-2xl bg-indigo-600 text-white shadow-md">
                    <StageIcon className="w-6 h-6 animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
                        {roundedProgress === 100 ? "README Forged Successfully!" : "Forging Documentation..."}
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                        {activeStageObj.title}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                      {serverMessage || activeStageObj.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    <Timer className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{(elapsedMs / 1000).toFixed(1)}s</span>
                  </div>

                  <div className="px-4 py-2 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 shadow-lg border border-neutral-700 dark:border-neutral-300 flex items-center gap-1.5">
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                      {roundedProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-4 rounded-full overflow-hidden mb-6 p-0.5 border border-neutral-300 dark:border-neutral-700 relative shadow-inner">
                <motion.div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out shadow-md relative"
                  style={{ width: `${roundedProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-black/20 to-transparent animate-pulse" />
                </motion.div>
              </div>

              {/* Stage Stepper Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 relative z-10">
                {STAGES.map((s) => {
                  const isCompleted = s.id < currentStage || roundedProgress === 100;
                  const isCurrent = s.id === currentStage && roundedProgress < 100;
                  const StageItemIcon = s.icon;
                  return (
                    <motion.div
                      key={s.id}
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.03 : 1,
                        opacity: isCurrent || isCompleted ? 1 : 0.5,
                      }}
                      className={`flex flex-col items-center p-3 rounded-2xl border text-center transition-all ${
                        isCompleted
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : isCurrent
                          ? "bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 text-neutral-400"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${
                          isCompleted
                            ? "bg-emerald-500 text-white"
                            : isCurrent
                            ? "bg-indigo-600 text-white"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <StageItemIcon className="w-4 h-4" />}
                      </div>
                      <span className="text-[11px] font-mono font-bold leading-tight">{s.title}</span>
                      <span className="text-[9px] font-mono opacity-80 truncate w-full mt-0.5">{s.subtitle}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Alert */}
        {error && (
          <div className="w-full p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-mono flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Generation Error: </span>
              {error}
              {isAuthError && (
                <div className="mt-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                  Tip: Please sign in with your GitHub account using the button in the top navigation bar.
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
