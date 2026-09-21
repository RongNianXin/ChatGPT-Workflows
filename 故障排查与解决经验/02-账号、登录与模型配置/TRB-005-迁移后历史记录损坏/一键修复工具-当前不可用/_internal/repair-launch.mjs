import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = dirname(fileURLToPath(import.meta.url));
const main = join(toolDir, "codex-encrypted-content-repair.mjs");

console.log("Codex 跨账号续聊修复：当前不可用。");
console.log("已停止修复，没有修改任何任务或备份。");
console.log("部分旧任务含有加密压缩记忆，直接删除可能丢失上下文；分页兼容性也尚未验证。");
console.log("请先使用仍能正常续聊的线路。目录中的“可用版”是旧名称，不代表当前可用。");
process.exit(2);

console.log("");
console.log("========================================");
console.log("  Codex 加密内容一键修复工具");
console.log("========================================");
console.log("");
console.log("工具会扫描当前未归档任务，移除无法跨账号验证的加密隐藏推理内容。");
console.log("执行前会自动备份；Codex 和 CC-Switch 必须完全退出。");
console.log("已归档任务不会修改。失败时会自动回滚已提交的文件。");
console.log("");
console.log("如果你确认现在要修复，请输入 Y；输入 N 或其他内容退出。");

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("> ", (answer) => {
  rl.close();
  if (!/^y$/i.test(answer.trim())) {
    console.log("已取消，未修改任何文件。");
    return;
  }
  const child = spawn(process.execPath, [main, "--apply"], { stdio: "inherit", windowsHide: false });
  child.on("error", (error) => {
    console.error(`启动失败：${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exitCode = 1;
    else process.exitCode = code ?? 1;
  });
});
