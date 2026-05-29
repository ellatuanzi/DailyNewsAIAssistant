import fs from "node:fs/promises";
import path from "node:path";

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadResearchLibrary(researchDir) {
  const stockAnalysis = await readJson(path.join(researchDir, "stock-analysis.json"));
  const aiSupplyChain = await readJson(path.join(researchDir, "ai-supply-chain.json"));

  return {
    stockAnalysis,
    aiSupplyChain
  };
}
