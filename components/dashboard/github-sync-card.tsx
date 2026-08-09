"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Globe,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";

export function GithubSyncCard() {
  const {
    repoUrl,
    suggestedDescription,
    suggestedTopics,
    releaseNotes,
    demoUrl,
    generatedMarkdown,
  } = useReadmeStore();

  const [description, setDescription] = useState("");
  const [homepage, setHomepage] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [publishRelease, setPublishRelease] = useState(true);
  const [customReleaseNotes, setCustomReleaseNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    releaseUrl?: string;
    repoUrl?: string;
  } | null>(null);

  // Sync state with suggested values when generated
  useEffect(() => {
    if (suggestedDescription) setDescription(suggestedDescription);
    if (demoUrl) setHomepage(demoUrl);
    if (suggestedTopics && suggestedTopics.length > 0) setTopics(suggestedTopics);
    if (releaseNotes) setCustomReleaseNotes(releaseNotes);
  }, [suggestedDescription, demoUrl, suggestedTopics, releaseNotes]);

  if (!generatedMarkdown) return null;

  const handleAddTopic = () => {
    const tag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (tag && !topics.includes(tag)) {
      setTopics([...topics, tag]);
      setNewTagInput("");
    }
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    setTopics(topics.filter((_, i) => i !== indexToRemove));
  };

  const handleApplySync = async () => {
    setIsLoading(true);
    setError(null);
    setIsAuthError(false);
    setSuccessResult(null);

    try {
      const res = await fetch("/api/github/sync-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          description: description.trim(),
          homepage: homepage.trim(),
          topics,
          publishRelease,
          releaseNotes: customReleaseNotes.trim(),
          tagName: "v1.0.0",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) setIsAuthError(true);
        throw new Error(data.error || "Failed to update GitHub repository metadata.");
      }

      setSuccessResult({
        releaseUrl: data.release?.html_url,
        repoUrl: repoUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while updating metadata.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-5xl mx-auto mt-8 p-6 sm:p-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xl text-left"
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
                GitHub Repository Setup &amp; Auto-Release
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
                v1.0.0 Direct API
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
              Sync AI-generated description, topics, website link, and publish official release to GitHub
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="mt-6 space-y-6">
        {/* Repo Description & Homepage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                Repository Description
              </label>
              <span className={`text-[10px] font-mono ${description.length > 250 ? "text-amber-500 font-bold" : "text-neutral-400"}`}>
                {description.length} / 250
              </span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Engineering-grade description of your repository..."
              className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Website / Live Demo URL
            </label>
            <div className="flex items-center px-3.5 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-xl focus-within:border-indigo-500">
              <Globe className="w-4 h-4 text-neutral-400 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
                placeholder="https://demo.app or https://your-domain.vercel.app"
                className="w-full bg-transparent text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none placeholder-neutral-400"
              />
            </div>

            {/* Topics Tag Input */}
            <div className="mt-4">
              <label className="block text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                GitHub Repository Topics / Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-xl min-h-[42px]">
                {topics.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700"
                  >
                    <Tag className="w-3 h-3 text-neutral-500" />
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      className="text-neutral-400 hover:text-red-500 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTopic())}
                    placeholder="+ Add topic..."
                    className="bg-transparent text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none px-2 py-1 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Release Checkbox & Option */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={publishRelease}
              onChange={(e) => setPublishRelease(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Publish v1.0.0 Production Release on GitHub
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              </span>
              <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                Creates an official release tag (v1.0.0) with AI-compiled release notes
              </p>
            </div>
          </label>

          {publishRelease && (
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <label className="block text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                Release Notes (v1.0.0)
              </label>
              <textarea
                rows={4}
                value={customReleaseNotes}
                onChange={(e) => setCustomReleaseNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-mono flex flex-col gap-3">
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

        {successResult && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-mono flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>GitHub repository metadata and topics updated successfully!</span>
            </div>
            {successResult.releaseUrl && (
              <a
                href={successResult.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors"
              >
                <span>View v1.0.0 Release</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleApplySync}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying GitHub Metadata...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Apply Metadata &amp; Publish Release</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
