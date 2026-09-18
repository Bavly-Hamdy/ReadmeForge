import { create } from "zustand";
import { RepoDigest, CollaboratorInfo } from "@/types/repo-digest";

interface ReadmeStore {
  theme: "dark" | "light";
  repoUrl: string;
  persona: string;
  customTitle: string;
  demoUrl: string;
  teamName: string;
  authorName: string;
  copyrightYear: string;
  licenseType: string;
  includeLicense: boolean;
  collaborators: CollaboratorInfo[];
  isGenerating: boolean;
  generatedMarkdown: string | null;
  generatedLicense: string | null;
  suggestedDescription: string;
  suggestedTopics: string[];
  releaseNotes: string;
  digest: RepoDigest | null;
  error: string | null;
  editHistory: string[];
  auditResult: import("@/lib/audit/readme-auditor").AuditResult | null;
  isAuditing: boolean;
  translatedVersions: Record<string, string>;
  isTranslating: boolean;
  isExporting: boolean;

  toggleTheme: () => void;
  setRepoUrl: (url: string) => void;
  setPersona: (persona: string) => void;
  setCustomTitle: (title: string) => void;
  setDemoUrl: (url: string) => void;
  setTeamName: (team: string) => void;
  setAuthorName: (author: string) => void;
  setCopyrightYear: (year: string) => void;
  setLicenseType: (type: string) => void;
  setIncludeLicense: (include: boolean) => void;
  addCollaborator: (collab: CollaboratorInfo) => void;
  removeCollaborator: (index: number) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGeneratedMarkdown: (markdown: string | null) => void;
  setGeneratedLicense: (license: string | null) => void;
  setSuggestedDescription: (desc: string) => void;
  setSuggestedTopics: (topics: string[]) => void;
  setReleaseNotes: (notes: string) => void;
  setDigest: (digest: RepoDigest | null) => void;
  setError: (error: string | null) => void;
  pushEditHistory: (content: string) => void;
  undoEdit: () => void;
  setRepoUrlSilent: (url: string) => void;
  setAuditResult: (result: import("@/lib/audit/readme-auditor").AuditResult | null) => void;
  setIsAuditing: (isAuditing: boolean) => void;
  setTranslatedVersion: (langCode: string, content: string) => void;
  setIsTranslating: (isTranslating: boolean) => void;
  clearTranslations: () => void;
  setIsExporting: (isExporting: boolean) => void;
  loadFromHistory: (data: {
    markdown: string;
    repoUrl: string;
    persona?: string;
    license?: string | null;
  }) => void;
  reset: () => void;
}

export const useReadmeStore = create<ReadmeStore>((set) => ({
  theme: "dark",
  repoUrl: "",
  persona: "ENTERPRISE",
  customTitle: "",
  demoUrl: "",
  teamName: "",
  authorName: "",
  copyrightYear: new Date().getFullYear().toString(),
  licenseType: "MIT",
  includeLicense: true,
  collaborators: [],
  isGenerating: false,
  generatedMarkdown: null,
  generatedLicense: null,
  suggestedDescription: "",
  suggestedTopics: [],
  releaseNotes: "",
  digest: null,
  error: null,
  editHistory: [],
  auditResult: null,
  isAuditing: false,
  translatedVersions: {},
  isTranslating: false,
  isExporting: false,

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  setRepoUrl: (repoUrl) => set({ repoUrl, error: null }),
  setPersona: (persona) => set({ persona }),
  setCustomTitle: (customTitle) => set({ customTitle }),
  setDemoUrl: (demoUrl) => set({ demoUrl }),
  setTeamName: (teamName) => set({ teamName }),
  setAuthorName: (authorName) => set({ authorName }),
  setCopyrightYear: (copyrightYear) => set({ copyrightYear }),
  setLicenseType: (licenseType) => set({ licenseType }),
  setIncludeLicense: (includeLicense) => set({ includeLicense }),
  addCollaborator: (collab) =>
    set((state) => ({ collaborators: [...state.collaborators, collab] })),
  removeCollaborator: (index) =>
    set((state) => ({
      collaborators: state.collaborators.filter((_, i) => i !== index),
    })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratedMarkdown: (generatedMarkdown) =>
    set((state) => {
      const history = state.generatedMarkdown
        ? [...state.editHistory.slice(-20), state.generatedMarkdown]
        : state.editHistory;
      return {
        generatedMarkdown,
        editHistory: history,
      };
    }),
  setGeneratedLicense: (generatedLicense) => set({ generatedLicense }),
  setSuggestedDescription: (suggestedDescription) => set({ suggestedDescription }),
  setSuggestedTopics: (suggestedTopics) => set({ suggestedTopics }),
  setReleaseNotes: (releaseNotes) => set({ releaseNotes }),
  setDigest: (digest) => set({ digest }),
  setError: (error) => set({ error, isGenerating: false }),
  pushEditHistory: (content) =>
    set((state) => ({
      editHistory: [...state.editHistory.slice(-20), content],
    })),
  undoEdit: () =>
    set((state) => {
      if (state.editHistory.length === 0) return state;
      const prev = state.editHistory[state.editHistory.length - 1];
      return {
        generatedMarkdown: prev,
        editHistory: state.editHistory.slice(0, -1),
      };
    }),
  setRepoUrlSilent: (repoUrl) => set({ repoUrl }),
  setAuditResult: (auditResult) => set({ auditResult }),
  setIsAuditing: (isAuditing) => set({ isAuditing }),
  setTranslatedVersion: (langCode, content) =>
    set((state) => ({
      translatedVersions: {
        ...state.translatedVersions,
        [langCode]: content,
      },
    })),
  setIsTranslating: (isTranslating) => set({ isTranslating }),
  clearTranslations: () => set({ translatedVersions: {} }),
  setIsExporting: (isExporting) => set({ isExporting }),
  loadFromHistory: ({ markdown, repoUrl, persona, license }) =>
    set((state) => ({
      generatedMarkdown: markdown,
      repoUrl,
      persona: persona || state.persona,
      generatedLicense: license !== undefined ? license : state.generatedLicense,
      error: null,
      isGenerating: false,
      editHistory: [],
    })),
  reset: () =>
    set({
      theme: "dark",
      repoUrl: "",
      persona: "ENTERPRISE",
      customTitle: "",
      demoUrl: "",
      teamName: "",
      authorName: "",
      copyrightYear: new Date().getFullYear().toString(),
      licenseType: "MIT",
      includeLicense: true,
      collaborators: [],
      isGenerating: false,
      generatedMarkdown: null,
      generatedLicense: null,
      suggestedDescription: "",
      suggestedTopics: [],
      releaseNotes: "",
      digest: null,
      error: null,
      editHistory: [],
    }),
}));

declare global {
  interface Window {
    __README_STORE__?: typeof useReadmeStore;
  }
}

if (typeof window !== "undefined") {
  window.__README_STORE__ = useReadmeStore;
}
