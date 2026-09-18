"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  X,
  RefreshCw,
  Wand2,
  ChevronRight,
  Info,
} from "lucide-react";
import { AuditResult, AuditCriterion } from "@/lib/audit/readme-auditor";

interface AuditScorecardProps {
  result: AuditResult;
  onClose: () => void;
  onAutoFix?: (prompt: string) => void;
  isApplyingFix?: boolean;
}

export function AuditScorecard({
  result,
  onClose,
  onAutoFix,
  isApplyingFix,
}: AuditScorecardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Structure", "Technical", "Community", "Content"];

  const filteredCriteria =
    selectedCategory === "All"
      ? result.criteria
      : result.criteria.filter((c) => c.category === selectedCategory);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return {
          text: "text-emerald-400",
          border: "border-emerald-500/40",
          bg: "bg-emerald-500/10",
          stroke: "#10b981",
        };
      case "B":
        return {
          text: "text-cyan-400",
          border: "border-cyan-500/40",
          bg: "bg-cyan-500/10",
          stroke: "#06b6d4",
        };
      case "C":
        return {
          text: "text-amber-400",
          border: "border-amber-500/40",
          bg: "bg-amber-500/10",
          stroke: "#f59e0b",
        };
      default:
        return {
          text: "text-rose-400",
          border: "border-rose-500/40",
          bg: "bg-rose-500/10",
          stroke: "#f43f5e",
        };
    }
  };

  const gradeColors = getGradeColor(result.grade);

  // SVG Radial calculations
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (result.totalScore / 100) * circumference;

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
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl shadow-black/80 overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                Documentation Health Audit
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
                  v3.0 Engine
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                10-point architectural compliance and developer experience scorecard
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Top Score Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 items-center">
            {/* Circular Gauge */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    className="stroke-zinc-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke={gradeColors.stroke}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {result.totalScore}%
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Score
                  </span>
                </div>
              </div>
            </div>

            {/* Grade & Summary */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center space-x-3">
                <span
                  className={`text-2xl font-black px-3 py-1 rounded-xl border ${gradeColors.bg} ${gradeColors.border} ${gradeColors.text}`}
                >
                  Grade {result.grade}
                </span>
                <span className="text-xs text-zinc-400">
                  {result.criteria.filter((c) => c.passed).length} of {result.criteria.length} checks passed
                </span>
              </div>
              <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                {result.summary}
              </p>
              {result.suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{result.suggestions.length} actionable recommendation(s) available</span>
                </div>
              )}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Criteria Checklist */}
          <div className="space-y-3">
            {filteredCriteria.map((crit) => (
              <div
                key={crit.id}
                className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {crit.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-200">
                        {crit.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {crit.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {crit.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      crit.passed
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {crit.score} / {crit.maxScore}
                  </span>

                  {!crit.passed && crit.autoFixPrompt && onAutoFix && (
                    <button
                      onClick={() => onAutoFix(crit.autoFixPrompt!)}
                      disabled={isApplyingFix}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 hover:border-violet-500/50 transition-all disabled:opacity-50"
                    >
                      {isApplyingFix ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      <span>Auto-Fix</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/40 flex justify-between items-center text-xs text-zinc-400">
          <span>Target standard: &gt;85% for top-tier GitHub presence</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs transition-colors"
          >
            Close Audit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
