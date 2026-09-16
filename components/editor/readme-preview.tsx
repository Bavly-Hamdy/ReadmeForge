"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Code,
  Eye,
  Edit3,
  FileText,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";
import { MermaidDiagram } from "./mermaid-diagram";
import { GithubSyncCard } from "@/components/dashboard/github-sync-card";
import { MarkdownEditor } from "./markdown-editor";
import { AIRefineChat } from "./ai-refine-chat";

export function ReadmePreview() {
  const {
    generatedMarkdown,
    generatedLicense,
    persona,
    repoUrl,
    theme,
    setGeneratedMarkdown,
    setGeneratedLicense,
  } = useReadmeStore();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "edit" | "code">("preview");
  const [activeFile, setActiveFile] = useState<"readme" | "license">("readme");

  // Push to GitHub state
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushMode, setPushMode] = useState<"direct-commit" | "pull-request">("pull-request");
  const [commitMessage, setCommitMessage] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    htmlUrl: string;
    message: string;
  } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  if (!generatedMarkdown) return null;

  const currentContent = activeFile === "readme" ? generatedMarkdown : generatedLicense || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadActive = () => {
    const filename = activeFile === "readme" ? "README.md" : "LICENSE";
    downloadFile(currentContent, filename);
  };

  const handleDownloadBoth = () => {
    if (generatedMarkdown) downloadFile(generatedMarkdown, "README.md");
    if (generatedLicense) {
      setTimeout(() => {
        downloadFile(generatedLicense, "LICENSE");
      }, 300);
    }
  };

  const handlePushToGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) {
      setPushError("No GitHub repository URL specified. Please enter a repo URL.");
      return;
    }

    setIsPushing(true);
    setPushError(null);
    setPushResult(null);

    try {
      const res = await fetch("/api/github/push-readme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          readmeContent: generatedMarkdown,
          licenseContent: generatedLicense || undefined,
          mode: pushMode,
          commitMessage: commitMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to push documentation to GitHub");
      }

      setPushResult({
        htmlUrl: data.htmlUrl,
        message: data.message || "Successfully published to GitHub!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while pushing to GitHub.";
      setPushError(msg);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <motion.div
      id="readme-preview-section"
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl mx-auto mt-12 rounded-2xl border border-neutral-300 dark:border-neutral-800 overflow-hidden shadow-2xl bg-white dark:bg-neutral-950 scroll-mt-8"
    >
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex flex-wrap items-center justify-between gap-4">
        {/* File Tabs: README.md vs LICENSE */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-neutral-950 p-1 rounded-xl border border-neutral-300 dark:border-neutral-800 shadow-sm">
            <button
              onClick={() => setActiveFile("readme")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                activeFile === "readme"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>README.md</span>
            </button>

            {generatedLicense && (
              <button
                onClick={() => setActiveFile("license")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                  activeFile === "license"
                    ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>LICENSE</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold uppercase">
                  MIT
                </span>
              </button>
            )}
          </div>

          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-neutral-300 dark:border-neutral-700">
            {persona} Mode
          </span>
        </div>

        {/* View / Edit Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-neutral-950 p-1 rounded-lg border border-neutral-300 dark:border-neutral-800 mr-1">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "preview"
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-bold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "edit"
                  ? "bg-indigo-600 text-white shadow-sm font-bold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Live Edit
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "code"
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-bold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Raw
            </button>
          </div>

          {/* Push to GitHub Button */}
          {repoUrl && (
            <button
              onClick={() => setPushModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Push to GitHub</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-neutral-300 dark:border-neutral-700 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy {activeFile === "readme" ? "README" : "LICENSE"}</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadActive}
            className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-neutral-100 dark:text-neutral-900 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {generatedLicense && (
            <button
              onClick={handleDownloadBoth}
              title="Download both README.md & LICENSE files"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Both</span>
            </button>
          )}
        </div>
      </div>

      {/* Push to GitHub Modal */}
      <AnimatePresence>
        {pushModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg p-6 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl relative text-left"
            >
              <button
                type="button"
                onClick={() => setPushModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <GitCommit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Push Documentation to GitHub
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono truncate max-w-[340px]">
                    {repoUrl}
                  </p>
                </div>
              </div>

              {pushResult ? (
                <div className="flex flex-col gap-4 py-2">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-start gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">{pushResult.message}</p>
                      <a
                        href={pushResult.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80"
                      >
                        View on GitHub <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPushResult(null);
                      setPushModalOpen(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePushToGithub} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 block mb-2">
                      Deployment Method:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPushMode("pull-request")}
                        className={`p-3 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-1 ${
                          pushMode === "pull-request"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                            : "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <GitPullRequest className="w-4 h-4" />
                          <span>Open Pull Request</span>
                        </div>
                        <span className="text-[11px] opacity-80">
                          Recommended — create a branch &amp; PR for review
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPushMode("direct-commit")}
                        className={`p-3 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-1 ${
                          pushMode === "direct-commit"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                            : "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <GitCommit className="w-4 h-4" />
                          <span>Direct Commit</span>
                        </div>
                        <span className="text-[11px] opacity-80">
                          Commit straight to the default branch
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                      Commit Message (Optional):
                    </label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={
                        pushMode === "pull-request"
                          ? "docs: synchronize README.md and documentation via ReadmeForge"
                          : "docs: update README.md via ReadmeForge"
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {pushError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-mono flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{pushError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setPushModalOpen(false)}
                      disabled={isPushing}
                      className="px-4 py-2 rounded-xl text-xs font-mono text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPushing}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isPushing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <GitCommit className="w-3.5 h-3.5" />
                          <span>{pushMode === "pull-request" ? "Create Pull Request" : "Commit Changes"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Pane */}
      <div className="p-6 sm:p-10 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-x-auto min-h-[500px]">
        {activeFile === "readme" ? (
          activeTab === "preview" ? (
            <div className="readme-markdown-rendered text-neutral-900 dark:text-neutral-200 text-left max-w-none space-y-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1
                      className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-6 mt-2 tracking-tight flex flex-wrap items-center gap-3"
                      {...props}
                    />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2
                      className="text-xl font-bold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4 mt-8 tracking-tight flex items-center gap-2"
                      {...props}
                    />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3
                      className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-3 mt-6"
                      {...props}
                    />
                  ),
                  p: ({ node, ...props }) => (
                    <p
                      className="text-xs sm:text-sm leading-relaxed text-neutral-800 dark:text-neutral-300 mb-4"
                      {...props}
                    />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul
                      className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-neutral-800 dark:text-neutral-300 mb-4 pl-2"
                      {...props}
                    />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol
                      className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-neutral-800 dark:text-neutral-300 mb-4 pl-2"
                      {...props}
                    />
                  ),
                  li: ({ node, ...props }) => (
                    <li
                      className="text-xs sm:text-sm leading-relaxed text-neutral-800 dark:text-neutral-300"
                      {...props}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      className="text-neutral-900 dark:text-neutral-100 hover:underline underline-offset-4 font-semibold transition-colors inline-flex items-center gap-1"
                      target="_blank"
                      rel="noreferrer"
                      {...props}
                    />
                  ),
                  img: ({ node, ...props }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="inline-block max-w-full rounded shadow-sm my-1 mr-1.5 transition-transform hover:scale-[1.02]"
                      alt={props.alt || "Badge"}
                      {...props}
                    />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-6 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <table className="w-full text-left text-xs font-mono border-collapse" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead
                      className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 font-semibold border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider"
                      {...props}
                    />
                  ),
                  th: ({ node, ...props }) => (
                    <th
                      className="px-4 py-2.5 border-r border-neutral-200 dark:border-neutral-800/80 last:border-r-0 font-semibold"
                      {...props}
                    />
                  ),
                  td: ({ node, ...props }) => (
                    <td
                      className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800/60 border-r border-neutral-200 dark:border-neutral-800/60 last:border-r-0 text-neutral-800 dark:text-neutral-300 text-xs"
                      {...props}
                    />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className="border-l-2 border-neutral-500 bg-neutral-100 dark:bg-neutral-900/60 p-4 my-4 rounded-r-lg text-xs italic text-neutral-800 dark:text-neutral-300 font-mono"
                      {...props}
                    />
                  ),
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || "");
                    const content = String(children).replace(/\n$/, "");

                    if (match && match[1] === "mermaid") {
                      return <MermaidDiagram chart={content} />;
                    }

                    const isInline = !match && !String(children).includes("\n");

                    if (isInline) {
                      return (
                        <code
                          className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono border border-neutral-200 dark:border-neutral-800"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return (
                      <div className="relative my-4 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                          <span>{match ? match[1] : "code"}</span>
                        </div>
                        <pre className="p-4 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-200 text-xs font-mono overflow-x-auto leading-relaxed">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                }}
              >
                {generatedMarkdown}
              </ReactMarkdown>
            </div>
          ) : activeTab === "edit" ? (
            <div className="w-full">
              <MarkdownEditor
                value={currentContent}
                onChange={(val) => setGeneratedMarkdown(val)}
                theme={theme}
              />
            </div>
          ) : (
            <pre className="text-xs font-mono text-neutral-900 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
              {generatedMarkdown}
            </pre>
          )
        ) : (
          /* LICENSE View */
          <div className="max-w-3xl mx-auto text-left">
            {activeTab === "edit" ? (
              <div className="w-full">
                <MarkdownEditor
                  value={currentContent}
                  onChange={(val) => setGeneratedLicense(val)}
                  theme={theme}
                />
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-inner">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Official MIT License Text
                  </span>
                  <span className="text-xs font-mono text-neutral-500">
                    Standard Open Source License
                  </span>
                </div>
                <pre className="text-xs sm:text-sm font-mono text-neutral-900 dark:text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {generatedLicense}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant Refinement Chat */}
        <AIRefineChat />
      </div>

      {/* GitHub Auto-Sync & Release Panel */}
      <GithubSyncCard />
    </motion.div>
  );
}
