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
  includeLicense: boolean;
  collaborators: CollaboratorInfo[];
  isGenerating: boolean;
  generatedMarkdown: string | null;
  generatedLicense: string | null;
  digest: RepoDigest | null;
  error: string | null;

  toggleTheme: () => void;
  setRepoUrl: (url: string) => void;
  setPersona: (persona: string) => void;
  setCustomTitle: (title: string) => void;
  setDemoUrl: (url: string) => void;
  setTeamName: (team: string) => void;
  setAuthorName: (author: string) => void;
  setIncludeLicense: (include: boolean) => void;
  addCollaborator: (collab: CollaboratorInfo) => void;
  removeCollaborator: (index: number) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGeneratedMarkdown: (markdown: string | null) => void;
  setGeneratedLicense: (license: string | null) => void;
  setDigest: (digest: RepoDigest | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useReadmeStore = create<ReadmeStore>((set) => ({
  theme: "dark",
  repoUrl: "",
  persona: "PORTFOLIO",
  customTitle: "",
  demoUrl: "",
  teamName: "",
  authorName: "",
  includeLicense: true,
  collaborators: [],
  isGenerating: false,
  generatedMarkdown: null,
  generatedLicense: null,
  digest: null,
  error: null,

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  setRepoUrl: (repoUrl) => set({ repoUrl, error: null }),
  setPersona: (persona) => set({ persona }),
  setCustomTitle: (customTitle) => set({ customTitle }),
  setDemoUrl: (demoUrl) => set({ demoUrl }),
  setTeamName: (teamName) => set({ teamName }),
  setAuthorName: (authorName) => set({ authorName }),
  setIncludeLicense: (includeLicense) => set({ includeLicense }),
  addCollaborator: (collab) =>
    set((state) => ({ collaborators: [...state.collaborators, collab] })),
  removeCollaborator: (index) =>
    set((state) => ({
      collaborators: state.collaborators.filter((_, i) => i !== index),
    })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratedMarkdown: (generatedMarkdown) => set({ generatedMarkdown }),
  setGeneratedLicense: (generatedLicense) => set({ generatedLicense }),
  setDigest: (digest) => set({ digest }),
  setError: (error) => set({ error, isGenerating: false }),
  reset: () =>
    set({
      theme: "dark",
      repoUrl: "",
      persona: "PORTFOLIO",
      customTitle: "",
      demoUrl: "",
      teamName: "",
      authorName: "",
      includeLicense: true,
      collaborators: [],
      isGenerating: false,
      generatedMarkdown: null,
      generatedLicense: null,
      digest: null,
      error: null,
    }),
}));

