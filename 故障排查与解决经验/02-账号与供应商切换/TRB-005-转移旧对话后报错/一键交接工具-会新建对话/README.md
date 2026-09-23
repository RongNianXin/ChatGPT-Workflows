# Codex 跨账号密文故障交接资料

[English](README.en.md)

## 这是什么

`codex-encrypted-cross-account-handoff` 是处理 Codex 跨账号或跨供应商切换后，旧任务无法继续的专用 Skill。

常见错误形式：

```text
The encrypted content for item rs_... could not be verified.
Reason: Encrypted content could not be decrypted or parsed.
```

其中 `rs_...` 是会变化的具体密文项目编号，不是固定任务 ID。Skill 识别的是 `invalid_encrypted_content` 及多种密文错误文字，包括 `Encrypted function output content could not be decrypted or decoded`，不会把某一串 `rs_...` 写死。

它不解密旧账号密文，而是导出旧任务仍可读取的可见内容，让当前空白任务直接成为“原任务名-交接对话”。当前窗口就是最终接续窗口，不再创建第三个任务。

## 它和普通 handoff 的区别

普通 handoff 适合旧任务还能正常回复时主动整理交接。本 Skill 只用于旧任务已经因 `encrypted_content` 错误无法继续的情况。

## 它会做什么

1. 扫描任务，确认指定任务是明确的密文故障。
2. 导出用户和助手的可见消息、文件变化、工具结果及恢复材料。
3. 核对当前空白任务已经位于原项目。
4. 把当前任务改名为“原任务名-交接对话”。
5. 在当前窗口输出四段人话报告：当前任务 ID、交接质量、全部未完成事项和操作者最先应做的一件事。

## 它不会做什么

- 不解密旧账号密文。
- 不修改、覆盖或删除原任务。
- 不创建第三个任务，不分叉任务，也不把交接提示词发送到另一个窗口。
- 不迁移隐藏 reasoning、旧账号密文或未保存的编辑器内容。
- 不继承旧任务的远端发布、删除、费用、生产环境或不可逆授权。

用户明确指定任务名称或 ID 时，Skill 会检查全部可读取回合，而不是只看最后一次错误。因此，分支任务即使最后一次显示 502，只要历史中确实包含密文错误，也可以作为交接源；如果全部历史只有 502、连接中断或模型容量错误，则会拒绝本 Skill。

## Skill 实际保存位置

```text
<CODEX_HOME>\skills\codex-encrypted-cross-account-handoff
```

主要文件：

```text
SKILL.md
README.md
scripts\handoff.mjs
```

Skill 必须保留在 `.codex\skills` 下，Codex 才能自动发现。当前资料目录只保存说明和研究记录，不是 Skill 的运行目录。

本资料目录：

```text
<PROJECT_ROOT>\故障排查与解决经验\02-账号与供应商切换\TRB-005-转移旧对话后报错\一键交接工具-会新建对话
```

可见历史导出材料默认保存到：

```text
<CODEX_HANDOFFS_ROOT>
```

## 新手唯一调用方法

在旧任务所属的同一个项目中新建一个空白任务，然后把下面这一套提示词粘贴进去，只替换“任务名称或任务ID”：

```text
$codex-encrypted-cross-account-handoff
请在当前窗口交接“任务名称或任务ID”。只处理明确的 encrypted_content 密文故障：读取可见历史，保留原项目归属，把当前窗口改名为“原任务名-交接对话”，然后继续旧任务。不要创建、分叉或调用另一个交接任务。
```

例如可填旧任务名称：

```text
请在当前窗口交接“项目推广总指挥3号 (1)”……
```

也可填任务 ID：

```text
请在当前窗口交接“01a09a28-e998-7893-a759-64fe44d03347”……
```

一次空白任务处理一个旧任务；多个任务请分别新建空白任务并重复同一套提示词。

## 路径名称说明

Windows 实际目录名是 `A_Rong`。聊天或 Markdown 中出现 `A\_Rong`，通常只是下划线的转义写法，不是另一个目录名。不要创建或改名为 `A\_Rong`。

## 开源时的注意事项

发布前应删除本机用户名、真实任务 ID、真实交接材料和个人目录，并补充不同 Codex 版本的兼容说明。公开说明要明确：这是“可见历史交接工具”，不是官方客户端补丁，也不是密文解密器。
