import { NextRequest, NextResponse } from "next/server";
import { auditRequestSchema } from "@/lib/validation/generate-schema";
import { auditReadme, AuditResult } from "@/lib/audit/readme-auditor";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = auditRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid audit request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { markdownContent, checkLinks } = parsed.data;

    const result: AuditResult = auditReadme(markdownContent);

    // Optional real-time server-side link checking
    if (checkLinks) {
      const urlMatches = Array.from(
        markdownContent.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g)
      ).map((m) => m[2]);

      const uniqueUrls = Array.from(new Set(urlMatches)).slice(0, 15);
      const brokenUrls: string[] = [];

      await Promise.allSettled(
        uniqueUrls.map(async (url) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(url, {
              method: "HEAD",
              signal: controller.signal,
              headers: { "User-Agent": "ReadmeForge-AuditBot/1.0" },
            });
            clearTimeout(timeout);
            if (!res.ok && res.status >= 400 && res.status !== 403 && res.status !== 405) {
              brokenUrls.push(url);
            }
          } catch {
            // Network failure or timeout
          }
        })
      );

      if (brokenUrls.length > 0) {
        const linkCriterion = result.criteria.find((c) => c.id === "link-hygiene");
        if (linkCriterion) {
          linkCriterion.passed = false;
          linkCriterion.score = Math.max(0, linkCriterion.score - 5);
          linkCriterion.details = `Detected ${brokenUrls.length} unreachable or broken external link(s): ${brokenUrls.slice(0, 2).join(", ")}`;
        }
        result.totalScore = result.criteria.reduce((sum, c) => sum + c.score, 0);
      }
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    console.error("[Audit API Error]:", error);
    const message = error instanceof Error ? error.message : "Internal server error during README audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
