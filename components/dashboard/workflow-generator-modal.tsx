"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GitBranch,
  Copy,
  Check,
  Download,
  Terminal,
  Clock,
  Sparkles,
  X,
  FileCode2,
  Workflow,
  CheckCircle2,
} from "lucide-react";
import { generateWorkflowYaml } from "@/lib/cicd/workflow-generator";
import { Persona } from "@/types/repo-digest";

interface WorkflowGeneratorModalProps {
  repoFullName: string;
  persona?: string;
  onClose: () => void;
}

export function WorkflowGeneratorModal({
  repoFullName,
  persona,
  onClose,
}: WorkflowGeneratorModalProps) {
  const [branch, setBranch] = useState("main");
  const [schedulePreset, setSchedulePreset] = useState<"none" | "daily" | "weekly" | "custom">("weekly");
  const [customCron, setCustomCron] = useState("0 0 * * 1");
  const [includeTests, setIncludeTests] = useState(false);
  const [nodeVersion, setNodeVersion] = useState("20");
  const [copied, setCopied] = useState(false);

  const getEffectiveSchedule = () => {
    switch (schedulePreset) {
      case "daily":
        return "0 0 * * *";
      case "weekly":
        return "0 0 * * 1";
      case "custom":
        return customCron.trim() || undefined;
      default:
        return undefined;
    }
  };

  const generatedYaml = generateWorkflowYaml({
    repoFullName: repoFullName || "owner/repo",
    triggerBranch: branch.trim() || "main",
    schedule: getEffectiveSchedule(),
    persona: (persona as Persona) || "ENTERPRISE",
    includeTests,
    nodeVersion,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedYaml], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "readme-sync.yml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.94, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-600/15 border border-cyan-500/30 text-cyan-400">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                GitHub Actions CI/CD Workflow Generator
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  Continuous Docs
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Automate documentation synchronization on every push to your repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60 space-y-4">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Workflow Configuration
              </h3>

              {/* Target Branch */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Trigger Branch</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>

              {/* Schedule Presets */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Automated Schedule (Cron)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["none", "daily", "weekly", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setSchedulePreset(preset)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                        schedulePreset === preset
                          ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30 font-semibold"
                          : "bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-750"
                      }`}
                    >
                      {preset === "none" ? "Push Only" : preset}
                    </button>
                  ))}
                </div>

                {schedulePreset === "custom" && (
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 0 * * 1"
                    className="w-full mt-2 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                )}
              </div>

              {/* Node Version */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Node.js Runtime</span>
                </label>
                <select
                  value={nodeVersion}
                  onChange={(e) => setNodeVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="20">Node.js 20.x (LTS - Iron)</option>
                  <option value="22">Node.js 22.x (Current)</option>
                  <option value="18">Node.js 18.x (Maintenance)</option>
                </select>
              </div>

              {/* Include Tests Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-200">
                    Verify Test Suite
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Run unit tests before committing docs
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={includeTests}
                  onChange={(e) => setIncludeTests(e.target.checked)}
                  className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500 h-4 w-4 bg-zinc-900"
                />
              </div>
            </div>

            {/* Installation Tip */}
            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> File Target Destination
              </span>
              <p className="text-cyan-200/80 text-[11px] leading-relaxed">
                Save this file as <code className="font-mono bg-cyan-900/40 px-1 py-0.5 rounded text-white">.github/workflows/readme-sync.yml</code> in your repository root.
              </p>
            </div>
          </div>

          {/* Code Preview Column */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px] text-zinc-300 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                .github/workflows/readme-sync.yml
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .yml</span>
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800/80 p-4 font-mono text-[11px] text-zinc-300 overflow-x-auto overflow-y-auto max-h-[420px] leading-relaxed select-all">
              <pre>{generatedYaml}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/40 flex justify-between items-center text-xs text-zinc-400">
          <span>Automatic continuous documentation integration</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
