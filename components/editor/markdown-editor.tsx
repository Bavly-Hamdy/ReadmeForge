"use client";

import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme?: "dark" | "light";
}

export function MarkdownEditor({ value, onChange, theme = "dark" }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isInternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const baseTheme = EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "13px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      ".cm-scroller": {
        overflow: "auto",
        minHeight: "550px",
        maxHeight: "750px",
        padding: "12px 0",
      },
      ".cm-content": {
        padding: "0 16px",
      },
      ".cm-line": {
        lineHeight: "1.6",
      },
    });

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      baseTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isInternalUpdateRef.current = true;
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    if (theme === "dark") {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]); // Re-create on theme switch

  // Synchronize external value changes (e.g. from AI refinement or undo)
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#282c34] overflow-hidden shadow-inner"
    />
  );
}
