"use client";

import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { UploadCloud, FileArchive, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface LocalUploadProps {
  onZipProcessed: (data: {
    treePaths: string[];
    fileContents: Record<string, string>;
    projectName: string;
  }) => void;
  disabled?: boolean;
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "svg", "pdf", "zip", "tar", "gz", "exe",
  "dll", "so", "dylib", "bin", "mp3", "mp4", "wav", "woff", "woff2", "ttf", "eot",
]);

export function LocalUpload({ onZipProcessed, disabled = false }: LocalUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stats, setStats] = useState<{ fileCount: number; codeFiles: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processZipFile = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a valid .zip archive.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Archive exceeds maximum allowed size (50MB).");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setFileName(file.name);

    try {
      const zip = await JSZip.loadAsync(file);
      const treePaths: string[] = [];
      const fileContents: Record<string, string> = {};

      const entries = Object.keys(zip.files);
      let textFileCount = 0;

      for (const relativePath of entries) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;

        // Strip leading top-level folder if all files are wrapped in one root folder
        const normalizedPath = relativePath.replace(/^[^/]+\//, "");
        if (!normalizedPath) continue;

        // Skip ignored directories
        if (
          normalizedPath.includes("node_modules/") ||
          normalizedPath.includes(".git/") ||
          normalizedPath.includes("dist/") ||
          normalizedPath.includes("build/") ||
          normalizedPath.includes(".next/")
        ) {
          continue;
        }

        treePaths.push(normalizedPath);

        const ext = normalizedPath.split(".").pop()?.toLowerCase() || "";
        if (!BINARY_EXTENSIONS.has(ext)) {
          try {
            const content = await zipEntry.async("string");
            // Only keep reasonable size files (< 500KB per file)
            if (content.length < 500_000) {
              fileContents[normalizedPath] = content;
              textFileCount++;
            }
          } catch {
            // Ignore unreadable binary streams
          }
        }
      }

      if (treePaths.length === 0) {
        throw new Error("No readable source files found in this archive.");
      }

      const projectName = file.name.replace(/\.zip$/i, "").replace(/[-_]/g, " ");
      setStats({ fileCount: treePaths.length, codeFiles: textFileCount });

      onZipProcessed({
        treePaths,
        fileContents,
        projectName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to extract ZIP archive.";
      setError(message);
      setFileName(null);
      setStats(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processZipFile(file);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processZipFile(file);
        }}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
        className={`w-full p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/10 scale-[0.99]"
            : "border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-neutral-400 dark:hover:border-neutral-700 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/80"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Extracting and indexing project tree...
            </p>
            <p className="text-xs text-neutral-500">Client-side extraction via JSZip</p>
          </div>
        ) : stats && fileName ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-1">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-emerald-500" />
              {fileName}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              {stats.fileCount} total files indexed · {stats.codeFiles} source files ready for AI analysis
            </p>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium underline mt-1">
              Click or drag another .zip to replace
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 mb-1">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              Drag and drop your project <span className="text-emerald-500 font-mono">.zip</span> archive here
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Max 50MB · No GitHub URL required · Extracted securely in your browser
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
