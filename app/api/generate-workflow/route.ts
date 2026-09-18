import { NextRequest, NextResponse } from "next/server";
import { workflowConfigSchema } from "@/lib/validation/generate-schema";
import { generateWorkflowYaml } from "@/lib/cicd/workflow-generator";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = workflowConfigSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid workflow configuration payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const yaml = generateWorkflowYaml(parsed.data);

    return NextResponse.json({
      success: true,
      yaml,
      filename: ".github/workflows/readme-sync.yml",
    });
  } catch (error: unknown) {
    console.error("[Workflow Generator API Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to generate workflow YAML";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
