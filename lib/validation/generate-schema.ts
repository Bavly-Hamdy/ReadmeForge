import { z } from "zod";

export const generateRequestSchema = z.object({
  repoUrl: z
    .string()
    .url("Invalid URL format")
    .regex(/github\.com\/[^/]+\/[^/#?]+/, "Must be a valid GitHub repository URL"),
  customTitle: z.string().max(200).optional(),
  demoUrl: z.string().url().optional().or(z.literal("")),
  teamName: z.string().max(100).optional(),
  authorName: z.string().max(100).optional(),
  copyrightYear: z.string().regex(/^\d{4}$/).optional(),
  licenseType: z.enum(["MIT", "Apache-2.0", "GPL-3.0"]).optional(),
  includeLicense: z.boolean().optional().default(true),
  persona: z
    .enum(["PORTFOLIO", "OPEN_SOURCE", "MINIMALIST", "ENTERPRISE"])
    .optional()
    .default("ENTERPRISE"),
  collaborators: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role: z.string().max(50).nullable().optional(),
        githubHandle: z.string().max(40).nullable().optional(),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;

export const syncMetadataSchema = z.object({
  repoUrl: z
    .string()
    .url("Invalid URL format")
    .regex(/github\.com\/[^/]+\/[^/#?]+/, "Must be a valid GitHub repository URL"),
  description: z.string().max(350).optional(),
  homepage: z.string().url().optional().or(z.literal("")),
  topics: z.array(z.string().max(50)).max(20).optional().default([]),
  publishRelease: z.boolean().optional().default(false),
  releaseNotes: z.string().max(10000).optional(),
  tagName: z.string().max(30).optional().default("v1.0.0"),
});

export type SyncMetadataInput = z.infer<typeof syncMetadataSchema>;

export const pushReadmeSchema = z.object({
  repoUrl: z
    .string()
    .url("Invalid URL format")
    .regex(/github\.com\/[^/]+\/[^/#?]+/, "Must be a valid GitHub repository URL"),
  readmeContent: z.string().min(1, "README content cannot be empty"),
  licenseContent: z.string().optional(),
  mode: z.enum(["direct-commit", "pull-request"]),
  commitMessage: z.string().max(200).optional(),
});

export type PushReadmeInput = z.infer<typeof pushReadmeSchema>;

export const refineReadmeSchema = z.object({
  currentMarkdown: z.string().min(1, "Markdown cannot be empty"),
  instruction: z.string().min(1, "Instruction is required").max(2000),
  repoDigest: z.any().optional(),
});

export type RefineReadmeInput = z.infer<typeof refineReadmeSchema>;

export const generateLocalRequestSchema = z.object({
  treePaths: z.array(z.string()).min(1, "At least one file path must be provided"),
  fileContents: z.record(z.string()),
  customTitle: z.string().max(200).optional(),
  demoUrl: z.string().url().optional().or(z.literal("")),
  teamName: z.string().max(100).optional(),
  authorName: z.string().max(100).optional(),
  copyrightYear: z.string().regex(/^\d{4}$/).optional(),
  licenseType: z.enum(["MIT", "Apache-2.0", "GPL-3.0"]).optional(),
  includeLicense: z.boolean().optional().default(true),
  persona: z
    .enum(["PORTFOLIO", "OPEN_SOURCE", "MINIMALIST", "ENTERPRISE"])
    .optional()
    .default("ENTERPRISE"),
  collaborators: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role: z.string().max(50).nullable().optional(),
        githubHandle: z.string().max(40).nullable().optional(),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export type GenerateLocalRequestInput = z.infer<typeof generateLocalRequestSchema>;
