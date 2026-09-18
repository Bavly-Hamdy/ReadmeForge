"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Languages, Loader2, Check, Globe, ChevronDown } from "lucide-react";
import { SUPPORTED_LANGUAGES, LanguageOption } from "@/lib/i18n/languages";
import { useReadmeStore } from "@/lib/store/use-readme-store";

interface TranslateDropdownProps {
  currentMarkdown: string;
  repoName?: string;
  onTranslationLoaded: (translatedMarkdown: string, lang: LanguageOption) => void;
}

export function TranslateDropdown({
  currentMarkdown,
  repoName,
  onTranslationLoaded,
}: TranslateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<LanguageOption | null>(null);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    translatedVersions,
    setTranslatedVersion,
    isTranslating,
    setIsTranslating,
  } = useReadmeStore();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTranslate = async (lang: LanguageOption) => {
    if (!currentMarkdown || isTranslating) return;

    // Check cache in store first
    if (translatedVersions[lang.code]) {
      setActiveLang(lang);
      onTranslationLoaded(translatedVersions[lang.code], lang);
      setIsOpen(false);
      return;
    }

    setLoadingCode(lang.code);
    setIsTranslating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdownContent: currentMarkdown,
          targetLanguage: lang.code,
          repoName: repoName || "Project",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Translation request failed");
      }

      setTranslatedVersion(lang.code, data.translatedMarkdown);
      setActiveLang(lang);
      onTranslationLoaded(data.translatedMarkdown, lang);
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Translation failed";
      setErrorMsg(msg);
    } finally {
      setLoadingCode(null);
      setIsTranslating(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={!currentMarkdown || isTranslating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/60 text-zinc-200 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isTranslating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-violet-400" />
        )}
        <span>{activeLang ? `${activeLang.flag} ${activeLang.label}` : "Translate"}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-750 shadow-xl shadow-black/80 py-1 z-50 text-zinc-200"
          >
            <div className="px-3 py-1.5 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Select Language</span>
              <span className="text-[10px] text-zinc-500">12 Locales</span>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 text-xs text-rose-400 bg-rose-500/10 border-b border-rose-500/20">
                {errorMsg}
              </div>
            )}

            <div className="py-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isLoading = loadingCode === lang.code;
                const isCached = Boolean(translatedVersions[lang.code]);
                const isSelected = activeLang?.code === lang.code;

                return (
                  <button
                    key={lang.code}
                    onClick={() => handleTranslate(lang)}
                    disabled={isTranslating}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-zinc-800/70 transition-colors group disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-base">{lang.flag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-200 group-hover:text-white">
                          {lang.label}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {lang.nativeLabel} {lang.direction === "rtl" ? "• RTL" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                      ) : isSelected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : isCached ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                          Ready
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
