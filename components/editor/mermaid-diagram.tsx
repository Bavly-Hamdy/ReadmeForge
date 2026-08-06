"use client";

import React, { useEffect, useState } from "react";
import mermaid from "mermaid";
import { useReadmeStore } from "@/lib/store/use-readme-store";

export function MermaidDiagram({ chart }: { chart: string }) {
  const { theme } = useReadmeStore();
  const [svgContent, setSvgContent] = useState<string>("");
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const uniqueId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

    // Re-initialize mermaid theme dynamically depending on active theme
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      themeVariables: theme === "dark"
        ? {
            darkMode: true,
            background: "#0a0a0a",
            primaryColor: "#171717",
            primaryTextColor: "#ededed",
            primaryBorderColor: "#404040",
            lineColor: "#737373",
            secondaryColor: "#121212",
            tertiaryColor: "#262626",
            clusterBkg: "#0f0f0f",
            clusterBorder: "#262626",
          }
        : {
            darkMode: false,
            background: "#ffffff",
            primaryColor: "#f5f5f5",
            primaryTextColor: "#171717",
            primaryBorderColor: "#d4d4d4",
            lineColor: "#525252",
            secondaryColor: "#fafafa",
            tertiaryColor: "#e5e5e5",
            clusterBkg: "#fafafa",
            clusterBorder: "#e5e5e5",
          },
    });

    const cleanChart = chart
      .replace(/^```mermaid\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();

    mermaid
      .render(uniqueId, cleanChart)
      .then((res) => {
        if (isMounted) {
          setSvgContent(res.svg);
          setHasError(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("[Mermaid Component] Render error fallback:", err);
          setHasError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart, theme]);

  if (hasError || !svgContent) {
    return (
      <div className="my-6 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-xs font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto">
        <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2">
          Architecture Diagram Syntax
        </div>
        <pre className="whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-8 p-6 sm:p-8 rounded-2xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto flex justify-center items-center">
      <div
        className="w-full flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
