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
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";

// Persona is permanently hardcoded to ENTERPRISE — no selector UI needed.

const STAGES = [
  { id: 0, title: "Stage 1/5", subtitle: "Parsing AST & Git Trees", icon: Search, targetProgress: 22 },
  { id: 1, title: "Stage 2/5", subtitle: "Filtering Routes & Entrypoints", icon: Filter, targetProgress: 45 },
  { id: 2, title: "Stage 3/5", subtitle: "Summarizing Exported Interfaces", icon: Brain, targetProgress: 68 },
  { id: 3, title: "Stage 4/5", subtitle: "Constructing Topology & ADR", icon: BarChart3, targetProgress: 86 },
  { id: 4, title: "Stage 5/5", subtitle: "Synthesizing GFM & Mermaid SVG", icon: Sparkles, targetProgress: 98 },
];

export function GeneratorForm() {
  const {
    repoUrl,
    customTitle,
    demoUrl,
    teamName,
    collaborators,
    isGenerating,
    error,
    setRepoUrl,
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
  const [isAuthError, setIsAuthError] = useState(false);

  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [apiResult, setApiResult] = useState<{ markdown: string; digest: any } | null>(null);

  const stepperRef = useRef<HTMLDivElement>(null);

  // Refs so interval callbacks always read the latest values — no stale closures
  const isFinishedRef = useRef(false);
  const currentStageRef = useRef(0);
  const progressRef = useRef(0);

  // Single effect — fires only when isGenerating toggles. All intervals read
  // live values through refs so there are ZERO stale-closure bugs.
  useEffect(() => {
    if (!isGenerating) {
      // Reset everything when generation stops
      setProgress(0);
      setCurrentStage(0);
      setElapsedMs(0);
      setIsFinished(false);
      setApiResult(null);
      isFinishedRef.current = false;
      currentStageRef.current = 0;
      progressRef.current = 0;
      return;
    }

    // Scroll progress card into view
    setTimeout(() => {
      stepperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    // ── Timer: elapsed seconds display ──
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    // ── Progress tick: runs at 40 ms, reads refs for fresh values ──
    const tickInterval = setInterval(() => {
      if (isFinishedRef.current) {
        // API returned — sprint to 100%
        const next = progressRef.current + 4.5;
        if (next >= 100) {
          progressRef.current = 100;
          setProgress(100);
          clearInterval(tickInterval);
          return;
        }
        progressRef.current = next;
        setProgress(next);
      } else {
        // Creep toward the current stage's target
        const target = STAGES[currentStageRef.current]?.targetProgress ?? 95;
        const prev = progressRef.current;
        if (prev < target) {
          const next = prev + Math.max(0.3, (target - prev) * 0.1);
          progressRef.current = next;
          setProgress(next);
        }
      }
    }, 40);

    // ── Stage advance: every 2.2 s while API hasn't returned ──
    const stageInterval = setInterval(() => {
      if (!isFinishedRef.current) {
        const next = Math.min(currentStageRef.current + 1, STAGES.length - 1);
        currentStageRef.current = next;
        setCurrentStage(next);
      } else {
        clearInterval(stageInterval);
      }
    }, 2200);

    return () => {
      clearInterval(timerInterval);
      clearInterval(tickInterval);
      clearInterval(stageInterval);
    };
  }, [isGenerating]); // ← only isGenerating — no stale restarts on every stage tick

  // When the API result arrives, mark finished via ref so the tick interval picks it up
  useEffect(() => {
    if (isFinished && apiResult) {
      isFinishedRef.current = true;
      setCurrentStage(STAGES.length - 1);
      // After fill reaches 100%, give a short pause then close the generating state
      const timeout = setTimeout(() => {
        setIsGenerating(false);

        // Smooth scroll to README Preview
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
    if (!repoUrl.trim()) {
      setError("Please enter a valid GitHub repository URL.");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setCurrentStage(0);
    setElapsedMs(0);
    setIsFinished(false);
    setApiResult(null);
    setError(null);
    setIsAuthError(false);
    setGeneratedMarkdown(null);
    // Keep refs in sync with state resets
    isFinishedRef.current = false;
    currentStageRef.current = 0;
    progressRef.current = 0;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          persona: "ENTERPRISE",
          customTitle: customTitle.trim() || undefined,
          demoUrl: demoUrl.trim() || undefined,
          teamName: teamName.trim() || undefined,
          collaborators,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) setIsAuthError(true);
        throw new Error(data.error || "Failed to generate README.");
      }

      // Immediately set generated markdown in store so preview displays
      setGeneratedMarkdown(data.markdown);
      setDigest(data.digest);
      setApiResult({ markdown: data.markdown, digest: data.digest });
      setIsFinished(true);
      setCurrentStage(STAGES.length - 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred during generation.";
      setError(msg);
      setIsGenerating(false);
    }
  };

  const activeStageObj = STAGES[currentStage];
  const StageIcon = activeStageObj.icon;
  const roundedProgress = Math.min(100, Math.floor(progress));
  const isComplete = isFinished && roundedProgress === 100;

  // Derive status text from progress range — no extra state needed
  const statusText =
    roundedProgress >= 100
      ? "README Ready! ✨"
      : roundedProgress >= 80
      ? "Formatting Markdown & Diagrams..."
      : roundedProgress >= 50
      ? "Running Gemini AI Summarization..."
      : roundedProgress >= 25
      ? "Parsing Dependencies & Stack..."
      : "Fetching Repository Tree...";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Enterprise mode badge — persona is locked, no selector shown */}
      <div className="w-full flex items-center gap-3 mb-6">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Enterprise SaaS Mode
        </span>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-500 font-mono">
          Full API matrix · Mermaid architecture · Compliance &amp; deployment docs
        </span>
      </div>

      {/* Main Repo URL Form */}
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
          {/* ── FORGE BUTTON: ENTERPRISE PROGRESS-FILL ── */}
          <button
            type="submit"
            disabled={isGenerating}
            role={isGenerating ? "progressbar" : undefined}
            aria-valuenow={isGenerating ? roundedProgress : undefined}
            aria-valuemin={isGenerating ? 0 : undefined}
            aria-valuemax={isGenerating ? 100 : undefined}
            aria-label={isGenerating ? `Generating README — ${roundedProgress}%` : "Forge Enterprise README"}
            className="relative overflow-hidden rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-6 py-3 font-semibold text-white text-sm shadow-lg transition-all duration-300 disabled:cursor-not-allowed min-w-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
          >
            {/* Animated progress fill overlay */}
            {isGenerating && (
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 transition-all duration-200 ease-out ${
                  isComplete ? "bg-emerald-500/40" : "bg-indigo-500/50"
                }`}
                style={{ width: `${roundedProgress}%` }}
              >
                {/* Shimmer sweep */}
                {!isComplete && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                )}
              </span>
            )}

            {/* Button inner content */}
            <span className="relative z-10 flex items-center justify-between w-full">
              {isGenerating ? (
                isComplete ? (
                  /* STATE 3 — Complete */
                  <span className="flex items-center justify-center gap-2 w-full">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300 flex-shrink-0" />
                    <span>README Generated!</span>
                  </span>
                ) : (
                  /* STATE 2 — In-progress */
                  <>
                    <span className="flex items-center gap-2 min-w-0">
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      <span
                        aria-live="polite"
                        className="text-sm font-medium truncate max-w-[130px] sm:max-w-[180px]"
                      >
                        {statusText}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums flex-shrink-0">
                      {roundedProgress}%
                    </span>
                  </>
                )
              ) : (
                /* STATE 1 — Idle */
                <span className="flex items-center justify-center gap-2 w-full">
                  <Sparkles className="h-4 w-4" />
                  <span>Forge Enterprise README</span>
                </span>
              )}
            </span>
          </button>
        </div>

        {/* PROMINENT LIVE ANIMATED PROGRESS CARD WITH PERCENTAGE */}
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
              {/* Background Ambient Glow Ring */}
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gradient-to-br from-neutral-200/40 via-neutral-300/20 to-transparent dark:from-neutral-800/40 dark:via-neutral-700/20 blur-2xl pointer-events-none" />

              {/* Header Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative p-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 shadow-md">
                    <StageIcon className="w-6 h-6 animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
                        {roundedProgress === 100 ? "README Forged Successfully!" : "Forging Engineering README..."}
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                        {activeStageObj.title}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1">
                      {activeStageObj.subtitle}
                    </p>
                  </div>
                </div>

                {/* Percentage Ticker & Timer Badge */}
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

              {/* Glowing High-Precision Animated Progress Bar */}
              <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-4 rounded-full overflow-hidden mb-6 p-0.5 border border-neutral-300 dark:border-neutral-700 relative shadow-inner">
                <motion.div
                  className="bg-gradient-to-r from-neutral-800 via-neutral-900 to-black dark:from-neutral-300 dark:via-neutral-100 dark:to-white h-full rounded-full transition-all duration-300 ease-out shadow-md relative"
                  style={{ width: `${roundedProgress}%` }}
                >
                  {/* Shimmer Line Overlay */}
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
                        isCurrent
                          ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-600 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 shadow-md font-bold ring-2 ring-neutral-400/50 dark:ring-neutral-600/50"
                          : isCompleted
                          ? "bg-neutral-200/60 dark:bg-neutral-950/80 border-emerald-500/40 text-neutral-800 dark:text-neutral-200"
                          : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-400"
                      }`}
                    >
                      <div className="flex items-center justify-center mb-1.5">
                        {isCompleted ? (
                          <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className={`p-1 rounded-lg ${isCurrent ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900" : "text-neutral-500"}`}>
                            <StageItemIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-mono font-semibold leading-tight">{s.subtitle}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
        <div className="mt-4 w-full p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-mono flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
          {isAuthError && (
            <a
              href="/api/auth/signin"
              className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Sign in with GitHub
            </a>
          )}
        </div>
      )}
    </div>
  );
}
