import "dotenv/config";
import { AnalysisPipeline } from "./pipeline";

async function main() {
  console.log("🚀 ReadmeForge Async Worker Service Initializing...");
  console.log("[Worker] Configured AI Engine: Google Gemini (1.5 Pro / Flash)");

  const pipeline = new AnalysisPipeline();
  console.log("[Worker] Lean Analysis Pipeline ready (Stages 0 - 4).");
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
