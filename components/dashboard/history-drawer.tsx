"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";

interface HistoryEntry {
  id: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  persona: string;
  contentPreview: string;
  contentLength: number;
  createdAt: string;
  updatedAt: string;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadFromHistory = useReadmeStore((state) => state.loadFromHistory);

  // Fetch history when drawer opens
  useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteId(null);
      return;
    }

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/history", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            setError("Sign in with GitHub to access your generation history.");
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load history");
        }
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(
      (item) =>
        item.repoFullName.toLowerCase().includes(query) ||
        item.persona.toLowerCase().includes(query) ||
        item.contentPreview.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const handleLoadItem = async (item: HistoryEntry) => {
    try {
      setLoadingId(item.id);
      const res = await fetch(`/api/history/${item.id}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to retrieve complete README content");
      }
      const fullData = await res.json();
      loadFromHistory({
        markdown: fullData.content,
        repoUrl: `https://github.com/${item.repoFullName}`,
        persona: fullData.persona,
      });
      setToastMessage(`Loaded README for ${item.repoFullName}`);
      onClose();
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(id);
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete record");
      }
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
      setToastMessage("Project removed from history");
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeletingId(null);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300">
                  <Clock className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
                    Project History
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {history.length} {history.length === 1 ? "saved forge" : "saved forges"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 transition-colors"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="border-b border-zinc-800/80 px-6 py-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter by repository or persona..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 pl-9 pr-8 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition-colors focus:border-zinc-600 focus:bg-zinc-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {isLoading ? (
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 space-y-2.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-1/2 bg-zinc-800 rounded" />
                        <div className="h-4 w-16 bg-zinc-800 rounded-full" />
                      </div>
                      <div className="h-3 w-3/4 bg-zinc-800/60 rounded" />
                      <div className="h-8 w-full bg-zinc-800/40 rounded-lg pt-1" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-8 text-center my-6">
                  <AlertCircle className="h-8 w-8 text-zinc-400 mb-2" />
                  <p className="text-xs font-medium text-zinc-300 mb-1">{error}</p>
                  <p className="text-[11px] text-zinc-500">
                    Sign in to preserve and restore all your generated README projects.
                  </p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 p-8 text-center my-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
                    <Sparkles className="h-5 w-5 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-200">
                    {searchQuery ? "No matching projects" : "No saved projects yet"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 max-w-xs">
                    {searchQuery
                      ? "Try searching for a different repository name or persona."
                      : "Generate your first README with ReadmeForge and it will automatically be archived here."}
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const isConfirming = confirmDeleteId === item.id;
                  const isDeleting = deletingId === item.id;
                  const isCurLoading = loadingId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-lg"
                    >
                      {/* Top Bar: Repo Name + Persona Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-zinc-100">
                              {item.repoName}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              /{item.repoOwner}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {formatRelativeTime(item.createdAt)} · {(item.contentLength / 1000).toFixed(1)}k chars
                          </p>
                        </div>

                        <span className="shrink-0 rounded border border-zinc-700/60 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300">
                          {item.persona}
                        </span>
                      </div>

                      {/* Content Preview Snippet */}
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400 font-mono bg-zinc-950/60 rounded p-2 border border-zinc-800/50 mb-3">
                        {item.contentPreview || "README documentation generated..."}
                      </p>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={`https://github.com/${item.repoFullName}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="View on GitHub"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="font-mono text-[10px]">GitHub</span>
                        </a>

                        <div className="flex items-center gap-1.5">
                          {/* Delete flow with confirm */}
                          {isConfirming ? (
                            <div className="flex items-center gap-1 bg-red-950/40 border border-red-900/60 rounded-lg px-2 py-1">
                              <ShieldAlert className="h-3 w-3 text-red-400 shrink-0" />
                              <span className="text-[10px] text-red-300 mr-1">Delete?</span>
                              <button
                                onClick={(e) => handleDeleteItem(item.id, e)}
                                disabled={isDeleting}
                                className="text-[10px] font-semibold text-red-400 hover:text-red-300 underline disabled:opacity-50"
                              >
                                {isDeleting ? "..." : "Yes"}
                              </button>
                              <span className="text-zinc-600 text-[10px]">/</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="text-[10px] text-zinc-400 hover:text-zinc-200"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(item.id);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800/80 hover:text-red-400 transition-colors"
                              title="Delete from history"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Load Button */}
                          <button
                            onClick={() => handleLoadItem(item)}
                            disabled={isCurLoading}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 px-2.5 py-1 text-xs font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700 transition-all disabled:opacity-50"
                          >
                            {isCurLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                                <span className="text-[11px]">Loading...</span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-3 w-3 text-zinc-300" />
                                <span className="text-[11px]">Load</span>
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800/80 px-6 py-3 text-center text-[10px] text-zinc-500 font-mono">
              Press Esc or click outside to dismiss
            </div>

            {/* Toast Notification */}
            <AnimatePresence>
              {toastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-12 left-6 right-6 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 shadow-xl"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{toastMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
