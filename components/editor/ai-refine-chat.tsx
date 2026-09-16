"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";

const QUICK_PROMPTS = [
  "Add Docker & docker-compose instructions",
  "Switch package manager commands to pnpm",
  "Add a Troubleshooting & FAQ section",
  "Make the project overview punchier",
];

export function AIRefineChat() {
  const { generatedMarkdown, setGeneratedMarkdown, digest, editHistory, undoEdit } = useReadmeStore();
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefinedNotice, setLastRefinedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!generatedMarkdown) return null;

  const handleRefine = async (customPrompt?: string) => {
    const textToSubmit = (customPrompt || instruction).trim();
    if (!textToSubmit || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLastRefinedNotice(null);

    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentMarkdown: generatedMarkdown,
          instruction: textToSubmit,
          repoDigest: digest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to refine README");
      }

      setGeneratedMarkdown(data.refinedMarkdown);
      setLastRefinedNotice(`Applied: "${textToSubmit}"`);
      setInstruction("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error refining README";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mt-4 p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            AI Assistant Refinement
          </span>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            — Ask Gemini to modify or expand any section
          </span>
        </div>

        {editHistory.length > 0 && (
          <button
            type="button"
            onClick={undoEdit}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo ({editHistory.length})</span>
          </button>
        )}
      </div>

      {/* Quick Prompt Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            type="button"
            disabled={isLoading}
            onClick={() => {
              setInstruction(prompt);
              handleRefine(prompt);
            }}
            className="px-2.5 py-1 text-[11px] rounded-full border border-indigo-200 dark:border-indigo-900/60 bg-white/80 dark:bg-neutral-900/80 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 dark:hover:border-indigo-700 transition-colors disabled:opacity-50"
          >
            + {prompt}
          </button>
        ))}
      </div>

      {/* Chat Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRefine();
        }}
        className="flex items-center gap-2"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., Rewrite the Installation guide using Docker Compose, or add an API auth section..."
            disabled={isLoading}
            className="w-full pl-3 pr-10 py-2 text-xs font-mono rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !instruction.trim()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Refining...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Apply Refinement</span>
            </>
          )}
        </button>
      </form>

      {/* Notifications */}
      <AnimatePresence>
        {lastRefinedNotice && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2.5 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono"
          >
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{lastRefinedNotice}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2.5 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-mono"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
