import { mkdir, readFile, writeFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const runtimePath = path.join(toolRoot, "PIPELINE_STEP_DECK_ENHANCEMENTS.js");
const [inputArgument, outputArgument] = process.argv.slice(2);

if (!inputArgument || !outputArgument || process.argv.length !== 4) {
  console.error("用法：node build-enhanced-deck.mjs <输入HTML> <独立的新输出HTML>");
  process.exit(2);
}

const inputPath = path.resolve(process.cwd(), inputArgument);
const outputPath = path.resolve(process.cwd(), outputArgument);
const repositoryRoot = await realpath(path.resolve(toolRoot, "../../../.."));
const inside = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
};
async function physicalOutput(file) {
  let parent = path.dirname(file);
  const suffix = [path.basename(file)];
  for (;;) {
    try { return path.join(await realpath(parent), ...suffix); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      suffix.unshift(path.basename(parent));
      const next = path.dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
}
function assertWritableOutput(file) {
  const protectedRoots = [".git", ".github", "总指挥工作流", "引用的外部工具"];
  const protectedFiles = ["AGENTS.md", ".gitignore", ".gitattributes"];
  if (protectedRoots.some(ref => inside(path.join(repositoryRoot, ref), file)) ||
      protectedFiles.some(ref => path.relative(path.join(repositoryRoot, ref), file) === "")) {
    throw new Error("PROTECTED_OUTPUT: 请把输出放在已获授权的独立成果目录。");
  }
}
const physical = await physicalOutput(outputPath);
assertWritableOutput(outputPath);
assertWritableOutput(physical);
try {
  await lstat(outputPath);
  throw new Error("OUTPUT_EXISTS: 输出必须是尚不存在的新文件，不能覆盖输入、链接或已有成果。");
} catch (error) { if (error.code !== "ENOENT") throw error; }

const [html, runtime] = await Promise.all([
  readFile(inputPath, "utf8"),
  readFile(runtimePath, "utf8")
]);

if (!/<\/body>/i.test(html)) throw new Error("输入文件缺少 </body>，无法安全注入增强器");
if (!/id=["']evidenceStage["']/i.test(html)) throw new Error("输入文件不是受支持的链路演示模板");
if (/data-pipeline-step-deck-enhancements=/i.test(html)) throw new Error("输入文件已经包含增强器，请从未增强的模板重新生成");

const safeRuntime = runtime.replace(/<\/script/gi, "<\\/script");
const injection = [
  "  <script data-pipeline-step-deck-enhancements=\"2.0.1\">",
  safeRuntime,
  "  </script>"
].join("\n");
const output = html.replace(/<\/body>/i, injection + "\n</body>");

await mkdir(path.dirname(outputPath), { recursive: true });
if (await physicalOutput(outputPath) !== physical) throw new Error("OUTPUT_PATH_CHANGED: 输出目录发生变化。");
// Exclusive creation also rejects competing writers and links created after preflight.
await writeFile(outputPath, output, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  runtimeVersion: "2.0.1",
  bytes: Buffer.byteLength(output)
}, null, 2));
