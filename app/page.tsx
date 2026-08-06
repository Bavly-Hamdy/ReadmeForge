"use client";

import React, { useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Terminal, Layers, ShieldCheck, LogOut, Github, Code2, FolderGit2, Sun, Moon } from "lucide-react";
import { GeneratorForm } from "@/components/dashboard/generator-form";
import { ReadmePreview } from "@/components/editor/readme-preview";
import { useReadmeStore } from "@/lib/store/use-readme-store";

export default function Home() {
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useReadmeStore();

  // Sync theme to root html element class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col justify-between transition-colors duration-200 bg-white dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            ReadmeForge
          </span>
          <span className="text-[10px] font-mono uppercase text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-800">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-95 flex items-center gap-1.5"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-mono">Dark</span>
              </>
            )}
          </button>

          {status === "authenticated" && session.user ? (
            <div className="flex items-center gap-3 bg-neutral-100 dark:bg-neutral-900/90 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-800">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-neutral-300 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                  {session.user.name?.[0] || "U"}
                </div>
              )}
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-300">
                {session.user.name || session.user.username}
              </span>
              <button
                onClick={() => signOut()}
                className="p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("github")}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-100 dark:text-neutral-900 bg-neutral-900 dark:bg-neutral-100 rounded-md hover:bg-neutral-800 dark:hover:bg-white transition-all shadow-sm flex items-center gap-2"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Sign In with GitHub</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero & Generator Section */}
      <main className="w-full max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-mono mb-6">
          <Code2 className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
          <span>Automated Codebase Documentation</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.12] text-neutral-900 dark:text-neutral-100">
          Engineering-grade READMEs <br />
          <span className="text-neutral-500 dark:text-neutral-400">for modern codebases.</span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl font-normal leading-relaxed mb-12">
          AST tree parsing, single-call git tree inspection, team contributor grids, and visual architecture topologies.
        </p>

        {/* Interactive Form Component */}
        <GeneratorForm />

        {/* Live Preview Component */}
        <ReadmePreview />

        {/* Features Bento Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="minimal-card p-6 rounded-xl border border-neutral-300 dark:border-neutral-800">
            <div className="p-2.5 w-fit rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 mb-4">
              <Terminal className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Single-Call Tree Inspection</h3>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Uses GitHub&apos;s recursive Git Trees API to parse repository structure without local disk cloning.
            </p>
          </div>

          <div className="minimal-card p-6 rounded-xl border border-neutral-300 dark:border-neutral-800">
            <div className="p-2.5 w-fit rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 mb-4">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Visual Architecture Topologies</h3>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Renders dynamic SVG diagrams for client-server data flows and Architectural Decision Records (ADR).
            </p>
          </div>

          <div className="minimal-card p-6 rounded-xl border border-neutral-300 dark:border-neutral-800">
            <div className="p-2.5 w-fit rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 mb-4">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">All-Contributors Team Grid</h3>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Generates HTML team member cards with GitHub avatars, roles, and linked profile references.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-200 dark:border-neutral-900 py-6 text-center text-xs text-neutral-500 font-mono">
        ReadmeForge &copy; 2026 — Minimalism Engineering Documentation
      </footer>
    </div>
  );
}
