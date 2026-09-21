using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

internal static class Program
{
    private const string ResourceName = "CodexArchiveRepairScript";

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--self-test")
        {
            return WriteSelfTest(args[1]);
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new RepairForm());
        return 0;
    }

    private static int WriteSelfTest(string outputPath)
    {
        try
        {
            bool resourcePresent;
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName))
            {
                resourcePresent = stream != null && stream.Length > 0;
            }

            string powershell = FindPowerShell7();
            string node = FindExecutable("node.exe");
            string cli = FindUsableCodexCli();
            string report = string.Join(Environment.NewLine, new[]
            {
                "resource=" + (resourcePresent ? "ok" : "missing"),
                "powershell7=" + (!string.IsNullOrEmpty(powershell) ? "ok" : "missing"),
                "node=" + (!string.IsNullOrEmpty(node) ? "ok" : "missing"),
                "codexCliForTitleLookup=" + (!string.IsNullOrEmpty(cli) ? "ok" : "missing")
            });
            File.WriteAllText(outputPath, report, new UTF8Encoding(false));
            return resourcePresent && !string.IsNullOrEmpty(powershell) &&
                !string.IsNullOrEmpty(node) ? 0 : 1;
        }
        catch (Exception ex)
        {
            File.WriteAllText(outputPath, ex.ToString(), new UTF8Encoding(false));
            return 1;
        }
    }

    internal static RunResult RunEmbeddedScript(bool allAffected, string taskQuery, bool dryRun)
    {
        string scriptPath = null;
        string wrapperPath = null;
        try
        {
            scriptPath = ExtractResource();
            string cliPath = FindUsableCodexCli();
            bool queryIsUuid = IsUuid(taskQuery);
            if (!allAffected && !queryIsUuid && string.IsNullOrEmpty(cliPath))
            {
                return new RunResult(1,
                    "按标题查询需要可独立运行的 Codex CLI。请保留诊断内核，或改用任务 ID。");
            }

            wrapperPath = Path.Combine(Path.GetTempPath(),
                "codex-path-repair-launcher-" + Guid.NewGuid().ToString("N") + ".ps1");
            var wrapper = new StringBuilder();
            wrapper.AppendLine("$ErrorActionPreference = 'Stop'");
            wrapper.AppendLine("[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)");
            wrapper.AppendLine("$OutputEncoding = [Console]::OutputEncoding");
            wrapper.AppendLine("$env:NO_COLOR = '1'");
            wrapper.AppendLine("if ($null -ne $PSStyle) { $PSStyle.OutputRendering = 'PlainText' }");
            if (!allAffected)
            {
                string encodedQuery = Convert.ToBase64String(Encoding.UTF8.GetBytes(taskQuery ?? string.Empty));
                wrapper.Append("$taskQuery = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('")
                    .Append(encodedQuery).AppendLine("'))");
            }
            wrapper.AppendLine("try {");
            wrapper.Append("  & '").Append(PsQuote(scriptPath)).Append("'");
            if (allAffected)
            {
                wrapper.Append(" -AllAffected");
            }
            else
            {
                wrapper.Append(" -TaskQuery $taskQuery");
            }
            if (!string.IsNullOrEmpty(cliPath))
            {
                wrapper.Append(" -CodexExe '").Append(PsQuote(cliPath)).Append("'");
            }
            if (dryRun)
            {
                wrapper.Append(" -DryRun");
            }
            wrapper.AppendLine();
            wrapper.AppendLine("  exit 0");
            wrapper.AppendLine("}");
            wrapper.AppendLine("catch {");
            wrapper.AppendLine("  Write-Output 'RESULT_CODE=SCRIPT_ERROR'");
            wrapper.AppendLine("  Write-Output $_.Exception.Message");
            wrapper.AppendLine("  exit 1");
            wrapper.AppendLine("}");
            File.WriteAllText(wrapperPath, wrapper.ToString(), new UTF8Encoding(false));

            string powershell = FindPowerShell7();
            if (string.IsNullOrEmpty(powershell))
            {
                return new RunResult(1, "找不到 PowerShell 7。请先安装 PowerShell 7。程序不会修改任何数据。");
            }

            var start = new ProcessStartInfo
            {
                FileName = powershell,
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + wrapperPath + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            using (Process process = Process.Start(start))
            {
                string stdout = process.StandardOutput.ReadToEnd();
                string stderr = process.StandardError.ReadToEnd();
                process.WaitForExit();
                string output = CleanProcessOutput(stdout + Environment.NewLine + stderr);
                return new RunResult(process.ExitCode, output);
            }
        }
        catch (Exception ex)
        {
            return new RunResult(1, ex.Message);
        }
        finally
        {
            TryDelete(scriptPath);
            TryDelete(wrapperPath);
        }
    }

    private static bool IsUuid(string value)
    {
        Guid ignored;
        return !string.IsNullOrWhiteSpace(value) && Guid.TryParseExact(value.Trim(), "D", out ignored);
    }

    internal static bool IsCodexRunning()
    {
        Process[] processes = new Process[0];
        try
        {
            processes = Process.GetProcessesByName("Codex");
            return processes.Length > 0;
        }
        finally
        {
            foreach (Process process in processes)
            {
                process.Dispose();
            }
        }
    }

    private static string CleanProcessOutput(string value)
    {
        string output = value ?? string.Empty;
        output = Regex.Replace(output, "\\x1B\\[[0-?]*[ -/]*[@-~]", string.Empty);
        return output.Trim();
    }

    private static string ExtractResource()
    {
        string target = Path.Combine(Path.GetTempPath(),
            "codex-path-repair-" + Guid.NewGuid().ToString("N") + ".ps1");
        using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName))
        {
            if (source == null)
            {
                throw new InvalidOperationException("EXE 内嵌修复脚本缺失。");
            }
            using (FileStream destination = File.Create(target))
            {
                source.CopyTo(destination);
            }
        }
        return target;
    }

    private static string FindUsableCodexCli()
    {
        var candidates = new List<string>();
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string pathCandidate = FindExecutable("codex.exe");
        if (!string.IsNullOrEmpty(pathCandidate))
        {
            candidates.Add(pathCandidate);
        }

        string diagnosticDir = Path.Combine(userProfile, ".codex", "tmp", "archive-diagnostic");
        if (Directory.Exists(diagnosticDir))
        {
            candidates.AddRange(Directory.GetFiles(diagnosticDir, "codex-*.exe")
                .OrderByDescending(File.GetLastWriteTimeUtc));
        }

        foreach (string candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (CanRunCodexCli(candidate))
            {
                return candidate;
            }
        }
        return null;
    }

    private static bool CanRunCodexCli(string path)
    {
        try
        {
            var start = new ProcessStartInfo
            {
                FileName = path,
                Arguments = "--version",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using (Process process = Process.Start(start))
            {
                if (!process.WaitForExit(5000))
                {
                    process.Kill();
                    return false;
                }
                return process.ExitCode == 0;
            }
        }
        catch
        {
            return false;
        }
    }

    private static string FindExecutable(string name)
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (string directory in path.Split(Path.PathSeparator))
        {
            try
            {
                string candidate = Path.Combine(directory.Trim(), name);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // Ignore invalid PATH entries.
            }
        }
        return null;
    }

    private static string FindPowerShell7()
    {
        var candidates = new List<string>();
        string fromPath = FindExecutable("pwsh.exe");
        if (!string.IsNullOrEmpty(fromPath)) candidates.Add(fromPath);

        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        if (!string.IsNullOrEmpty(programFiles))
        {
            candidates.Add(Path.Combine(programFiles, "PowerShell", "7", "pwsh.exe"));
        }

        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        candidates.Add(Path.Combine(userProfile, ".cache", "codex-runtimes",
            "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe"));

        return candidates.FirstOrDefault(File.Exists);
    }

    private static string PsQuote(string value)
    {
        return value.Replace("'", "''");
    }

    private static void TryDelete(string path)
    {
        if (string.IsNullOrEmpty(path)) return;
        try { File.Delete(path); } catch { }
    }
}

internal sealed class RunResult
{
    internal RunResult(int exitCode, string output)
    {
        ExitCode = exitCode;
        Output = output;
    }

    internal int ExitCode { get; private set; }
    internal string Output { get; private set; }
}

internal sealed class RepairForm : Form
{
    private const int EmSetCueBanner = 0x1501;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(IntPtr hWnd, int message, IntPtr wParam, string lParam);

    private readonly Button bulkRepairButton;
    private readonly Button analyzeButton;
    private readonly TextBox queryBox;
    private readonly TextBox outputBox;

    internal RepairForm()
    {
        Text = "Codex 任务路径修复工具";
        Width = 760;
        Height = 570;
        MinimumSize = new Size(680, 500);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Microsoft YaHei UI", 9F);

        var safety = new Label
        {
            Text = "安全边界：本工具只修复已知的任务路径异常，绝不归档任务。",
            AutoSize = false,
            Left = 16,
            Top = 14,
            Width = 710,
            Height = 28,
            Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
            ForeColor = Color.DarkGreen
        };

        var bulkLabel = new Label
        {
            Text = "功能一：Codex 运行时也可先做只读扫描；只有发现异常并准备修复时，才需要完全退出 Codex。",
            AutoSize = false,
            Left = 16,
            Top = 48,
            Width = 710,
            Height = 40
        };
        bulkRepairButton = new Button
        {
            Text = "一键扫描并修复全部异常",
            Left = 16,
            Top = 88,
            Width = 220,
            Height = 34
        };

        var targetLabel = new Label
        {
            Text = "功能二：输入一个任务 ID，或任务窗口的完整标题。先只读分析；确认命中已知异常后，才会询问是否修复。",
            AutoSize = false,
            Left = 16,
            Top = 138,
            Width = 710,
            Height = 40
        };
        queryBox = new TextBox
        {
            Left = 16,
            Top = 178,
            Width = 520,
            Height = 28,
            Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
            AccessibleName = "任务 ID 或完整标题"
        };
        queryBox.HandleCreated += delegate
        {
            SendMessage(queryBox.Handle, EmSetCueBanner, IntPtr.Zero, "请输入任务 ID 或任务的完整标题名称");
        };
        analyzeButton = new Button
        {
            Text = "分析指定任务",
            Left = 548,
            Top = 176,
            Width = 178,
            Height = 32,
            Anchor = AnchorStyles.Top | AnchorStyles.Right
        };

        outputBox = new TextBox
        {
            Left = 16,
            Top = 224,
            Width = 710,
            Height = 292,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Both,
            WordWrap = false,
            Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
        };

        bulkRepairButton.Click += delegate { StartBulkRepair(); };
        analyzeButton.Click += delegate { StartTargetAnalysis(); };
        Controls.AddRange(new Control[]
        {
            safety, bulkLabel, bulkRepairButton, targetLabel, queryBox, analyzeButton, outputBox
        });
    }

    private void StartBulkRepair()
    {
        RunAsync(true, null, true, "正在进行在线只读扫描……此时不需要退出 Codex。",
            delegate(RunResult result)
            {
                outputBox.Text = string.IsNullOrWhiteSpace(result.Output)
                    ? "扫描已结束，但没有返回文本输出。"
                    : result.Output;
                if (result.ExitCode != 0)
                {
                    MessageBox.Show(this, "只读扫描失败，未修改任何数据。请查看输出。", "扫描失败",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
                if (result.Output.IndexOf("RESULT_CODE=BULK_NO_CHANGES", StringComparison.Ordinal) >= 0)
                {
                    MessageBox.Show(this, "扫描完成，没有发现本工具能够安全修复的已知路径异常。",
                        "扫描完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                if (result.Output.IndexOf("RESULT_CODE=BULK_FAULTS_FOUND", StringComparison.Ordinal) < 0)
                {
                    MessageBox.Show(this, "扫描返回了无法识别的结果。为安全起见，未执行修复。",
                        "结果无法确认", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                DialogResult choice = MessageBox.Show(this,
                    "只读扫描发现了已知路径异常，当前尚未修改任何数据。\r\n\r\n是否继续修复？请先完全退出 Codex（包括系统托盘进程），再点击“是”。工具会重新扫描，不会沿用可能过期的在线扫描结果。",
                    "发现可修复异常", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (choice != DialogResult.Yes) return;
                if (!EnsureCodexStoppedBeforeRepair()) return;

                RunAsync(true, null, false, "正在重新扫描并修复已知路径异常……请勿启动 Codex。",
                    delegate(RunResult repairResult)
                    {
                        ShowResult(repairResult,
                            GetRepairResultMessage(repairResult, "重新扫描与修复流程已结束；没有归档任何任务。"));
                    });
            });
    }

    private void StartTargetAnalysis()
    {
        string query = (queryBox.Text ?? string.Empty).Trim();
        if (query.Length == 0)
        {
            MessageBox.Show(this, "请输入任务 ID 或完整标题。", "缺少输入",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        RunAsync(false, query, true, "正在只读分析指定任务……",
            delegate(RunResult result)
            {
                outputBox.Text = string.IsNullOrWhiteSpace(result.Output)
                    ? "分析已结束，但没有返回文本输出。"
                    : result.Output;
                if (result.ExitCode != 0)
                {
                    MessageBox.Show(this, "分析失败或标题无法唯一定位。请查看输出。", "分析未完成",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
                if (result.Output.IndexOf("RESULT_CODE=KNOWN_PATH_FAULT", StringComparison.Ordinal) < 0)
                {
                    MessageBox.Show(this, "分析完成，没有发现本工具能够安全修复的已知路径异常。",
                        "分析完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                DialogResult choice = MessageBox.Show(this,
                    "已确认该任务命中已知路径异常。\r\n\r\n是否只修复这个任务的路径？不会归档、删除或移动任务。请先完全退出 Codex，再点击“是”。",
                    "确认只修复指定任务", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (choice != DialogResult.Yes) return;
                if (!EnsureCodexStoppedBeforeRepair()) return;

                RunAsync(false, query, false, "正在修复指定任务路径……请勿启动 Codex。",
                    delegate(RunResult repairResult)
                    {
                        ShowResult(repairResult,
                            GetRepairResultMessage(repairResult, "路径修复流程已结束；没有归档该任务。"));
                    });
            });
    }

    private void RunAsync(bool allAffected, string taskQuery, bool dryRun, string status, Action<RunResult> completed)
    {
        SetControlsEnabled(false);
        outputBox.Text = status;
        var worker = new BackgroundWorker();
        worker.DoWork += delegate(object sender, DoWorkEventArgs e)
        {
            e.Result = Program.RunEmbeddedScript(allAffected, taskQuery, dryRun);
        };
        worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs e)
        {
            SetControlsEnabled(true);
            if (e.Error != null)
            {
                outputBox.Text = e.Error.ToString();
                MessageBox.Show(this, "操作发生未处理错误，未确认任何修改。", "错误",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            completed((RunResult)e.Result);
        };
        worker.RunWorkerAsync();
    }

    private void SetControlsEnabled(bool enabled)
    {
        bulkRepairButton.Enabled = enabled;
        analyzeButton.Enabled = enabled;
        queryBox.Enabled = enabled;
    }

    private bool EnsureCodexStoppedBeforeRepair()
    {
        if (!Program.IsCodexRunning()) return true;
        MessageBox.Show(this,
            "检测到 Codex 仍在运行，因此尚未开始修复，也没有修改任何数据。\r\n\r\n请完全退出所有 Codex 窗口及系统托盘进程，然后重新点击扫描或分析。",
            "Codex 尚未完全退出", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return false;
    }

    private static string GetRepairResultMessage(RunResult result, string successMessage)
    {
        if (result.ExitCode == 0) return successMessage;
        if (result.Output.IndexOf("修复前必须完全退出 Codex", StringComparison.Ordinal) >= 0)
        {
            return "检测到 Codex 在修复开始前重新运行；本次未确认完成修复。请完全退出 Codex 后重试。";
        }
        return "修复未成功。请查看输出；如果已经发生路径修改，脚本只会在安全条件满足时尝试回滚。";
    }

    private void ShowResult(RunResult result, string message)
    {
        outputBox.Text = string.IsNullOrWhiteSpace(result.Output)
            ? "操作已结束，但没有返回文本输出。"
            : result.Output;
        MessageBox.Show(this, message,
            result.ExitCode == 0 ? "完成" : "失败",
            MessageBoxButtons.OK,
            result.ExitCode == 0 ? MessageBoxIcon.Information : MessageBoxIcon.Error);
    }
}
