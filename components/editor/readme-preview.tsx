"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Check, Copy, Download, Code, Eye, FileText } from "lucide-react";
import { useReadmeStore } from "@/lib/store/use-readme-store";
import { MermaidDiagram } from "./mermaid-diagram";

export function ReadmePreview() {
  const { generatedMarkdown, persona } = useReadmeStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  if (!generatedMarkdown) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-12 minimal-card rounded-2xl border border-neutral-300 dark:border-neutral-800 overflow-hidden shadow-md animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/90 dark:bg-neutral-900/90 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">README.md</h2>
              <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400 text-[10px] font-mono uppercase tracking-wider border border-neutral-300 dark:border-neutral-700">
                {persona} Mode
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-500">Engineering Documentation</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-neutral-950 p-1 rounded-lg border border-neutral-300 dark:border-neutral-800 mr-2">
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
              onClick={() => setActiveTab("code")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "code"
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-bold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Raw Markdown
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-neutral-300 dark:border-neutral-700 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3.5 py-1.5 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-neutral-100 dark:text-neutral-900 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Content Pane - Light Mode High Contrast */}
      <div className="p-6 sm:p-10 bg-white dark:bg-neutral-950/80 text-neutral-900 dark:text-neutral-100 overflow-x-auto min-h-[500px]">
        {activeTab === "preview" ? (
          <div className="readme-markdown-rendered text-neutral-900 dark:text-neutral-200 text-left max-w-none space-y-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-6 mt-2 tracking-tight flex flex-wrap items-center gap-3" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4 mt-8 tracking-tight flex items-center gap-2" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-3 mt-6" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 mb-4" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 mb-4 pl-2" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 mb-4 pl-2" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-neutral-900 dark:text-neutral-100 hover:underline underline-offset-4 font-semibold transition-colors inline-flex items-center gap-1" target="_blank" rel="noreferrer" {...props} />
                ),
                img: ({ node, ...props }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="inline-block max-w-full rounded shadow-sm my-1 mr-1.5 transition-transform hover:scale-[1.02]" alt={props.alt || "Badge"} {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-6 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
                    <table className="w-full text-left text-xs font-mono border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 font-semibold border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-4 py-2.5 border-r border-neutral-200 dark:border-neutral-800/80 last:border-r-0 font-semibold" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800/60 border-r border-neutral-200 dark:border-neutral-800/60 last:border-r-0 text-neutral-700 dark:text-neutral-300 text-xs" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-2 border-neutral-500 bg-neutral-100 dark:bg-neutral-900/60 p-4 my-4 rounded-r-lg text-xs italic text-neutral-800 dark:text-neutral-300 font-mono" {...props} />
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
                      <code className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono border border-neutral-300 dark:border-neutral-800" {...props}>
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
        ) : (
          <pre className="text-xs font-mono text-neutral-800 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
            {generatedMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
}
