[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [Alias('Id')]
    [string]$TaskId,

    [switch]$ShowTurnPreview,

    [string]$ReportPath,

    [string]$Language = 'zh-CN'
)

# 支持以下用法：
#   .\check-codex-session.ps1 -TaskId '任务 ID'
#   .\check-codex-session.ps1 -TaskId '任务 ID' -Language en-US
#   .\check-codex-session.ps1 '任务 ID'
#   .\check-codex-session.ps1 -TaskId '任务 ID' -ReportPath '报告路径.md'
#   .\check-codex-session.ps1                 # 根据提示输入任务 ID
# -ShowTurnPreview 作为旧命令兼容参数保留；详细报告固定包含前三高消耗回合的完整用户输入。

if (@('zh-CN', 'en-US') -notcontains $Language) {
    if ($Language -imatch '^en(?:-|$)') {
        throw "Unsupported language '$Language'. Use zh-CN or en-US."
    }

    throw "不支持的语言 '$Language'；仅支持 zh-CN 或 en-US。"
}
$Language = if ($Language -ieq 'en-US') { 'en-US' } else { 'zh-CN' }

# 所有用户可见文案集中在这里；统计与扫描逻辑只保留一套。
$uiCatalog = @{
    'zh-CN' = @{
        PromptTaskId = '请输入 Codex 任务 ID'
        InvalidTaskId = "任务 ID 格式无效：{0}`n正确示例：00000000-0000-0000-0000-000000000000"
        TaskNameNotIndexed = '未取得（本地任务索引未记录）'
        TaskNameReadFailed = '未取得（读取本地任务索引失败）'
        ReportDirectory = 'Codex会话交接评估\报告'
        ReportFileName = '{0}-详细分析报告.md'
        ReportPathMissingDirectory = '详细报告路径缺少目录：{0}'
        ReportNoBom = '详细报告没有写入 UTF-8 BOM。'
        ReportRoundTripMismatch = '详细报告写后回读内容不一致。'
        ReportWriteFailed = '写入详细分析报告失败，旧报告未被破坏：{0}'
        SessionMetaMissing = '未找到可解析的 session_meta。'
        SessionIdMissing = 'session_meta.payload.id 缺失。'
        SessionTimestampMissing = 'session_meta.timestamp 缺失，无法稳定排序。'
        SessionTimestampInvalid = 'session_meta.timestamp 格式无效，无法稳定排序。'
        SessionDirectoryMissing = '未找到 Codex 会话目录。'
        SessionFileMissing = '未找到任务 {0} 的本地会话文件。'
        SessionCandidatesRejected = '候选文件均未通过 session_meta.payload.id 核验，无法确认任务 {0} 的本地会话分段。'
        SegmentMetadataConflict = '会话分段元数据冲突：{0} 存在多个不一致值，拒绝静默拼接。'
        SegmentRangeOverlap = '会话分段时间范围发生重叠：当前分段开始 {0}，上一分段结束 {1}；无法在没有可靠记录标识的情况下安全聚合。'
        SegmentRecordOverlap = '会话分段记录时间发生重叠，拒绝静默重复统计。'
        SegmentReadFailed = '读取会话分段失败：{0}'
        ReportExtensionInvalid = '详细报告必须使用 .md 扩展名：{0}'
        ReportMatchesSession = '详细报告路径不能与会话 JSONL 文件相同。'
        CategoryCompacted = '压缩历史快照（不含内联附件）'
        CategoryTurnContext = '回合上下文与指令'
        CategorySessionMeta = '会话元数据'
        CategoryTools = '工具调用与输出'
        CategoryConversation = '用户、助手与推理文本'
        CategoryOtherResponse = '其他响应记录'
        CategoryTokenMetadata = 'Token 与速率元数据'
        CategoryOtherEvent = '其他事件记录'
        CategoryOther = '其他事件与结构'
        CategoryInlineData = '内联图片与附件数据'
        StatusCompleted = '已完成'
        StatusAborted = '已中止'
        StatusUnfinished = '未结束'
        StatusUnknown = '状态待确认'
        StorageMixed = '混合（活动与归档分段并存）'
        StorageArchived = '已归档'
        StorageActive = '未归档（不代表应用正在运行）'
        RangeSeparator = ' 至 '
        AdditionalSegments = '（另有 {0} 个分段）'
        Unavailable = '无法取得'
        ContextUnavailableBasis = '最近输入占窗口估计未知；缺失值不会当作零。'
        ContextCriticalBasis = '最近已知输入占窗口 {0}，达到 95% 容量提醒线；先核对可恢复断点。压缩阈值取决于运行配置。'
        ContextHighBasis = '最近已知输入占窗口 {0}，达到 85% 容量提醒线；准备可恢复断点。'
        ContextNormalBasis = '最近已知输入占窗口 {0}；仅作容量观测，不参与评分，也不能单独判断交接收益。'
        SizeBasis = '文件大小：{0}；大小分 {1}/5。'
        CompressionBasis = '上下文压缩：{0}次；压缩分 {1}/5。'
        AdviceHandoff = '建议交接（3～7分，橙色）：先检查安全断点和重建成本；正在修复且容量仍够时，先完成当前工作单元。分数本身不证明交接更省。'
        AdviceRequired = '必须交接（8～10分，红色，传统经验评分）：优先安排最近安全断点，不中断在途操作；容量不足以安全收尾时先保存证据和可恢复断点。此分数不证明立刻交接最省Token。'
        AdviceContinue = '继续（0～2分）：传统经验评分尚未达到3分；仍需独立查看最新输入量与容量提醒。'
        LevelContinue = '继续'
        LevelRecommended = '建议交接'
        LevelRequired = '必须交接'
        LevelUnknown = '观测未知'
        AdviceUnknown = '无法取得可靠观测；不据此推断继续或交接。'
        TrendBasis = '近六个已完成回合、五个间隔的实测均值：{0} Token/回合；有效点 {2}/6。仅比较同模型、提供商声明、窗口和压缩段；样本不足时未知，不预测未来压力。'
        ReportTitle = '# Codex 会话详细分析报告'
        ReportTaskId = '- 任务 ID：{0}'
        ReportTaskName = '- 任务名称：{0}'
        ReportSegmentCount = '- 会话分段数：{0}'
        ReportAggregateBytes = '- 聚合字节数：{0} B（{1}）'
        ReportTimeRange = '- 分段时间范围：{0}'
        ReportPaths = '- 分段路径：{0}'
        ReportGeneratedAt = '- 生成时间：{0}'
        ReportEncoding = '- 编码：UTF-8 BOM'
        ReportPrivacy = '> 本报告包含完整用户输入，可能带有本地路径、内部信息或其他敏感内容；请只在本地受控范围内使用。'
        ReportHandoffLine = '- 交接评分：{0}/10（{1}）；文件大小分 {2}/5 + 压缩次数分 {3}/5。'
        ReportHandoffContext = '- 容量与观察提示：{0}'
        ReportTokenHeading = '## Token 消耗最高回合'
        ReportTokenExplanation = '按本地累计 Token 快照增量排序。M tokens 表示百万 Token；MiB 表示本地文件字节，二者不能固定换算。'
        RankNames = @('第一', '第二', '第三')
        ReportTurnHeading = '### {0}：第 {1} 轮（{2}）'
        ReportTokenUsage = '{0} tokens；输入 {1}（其中缓存 {2}），输出 {3}（其中推理 {4}）。'
        LocatorEventTime = '事件时间 {0}'
        LocatorTurnSuffix = '回合 ID 尾号 {0}'
        LocatorGrowth = '本轮 JSONL 增长 {0}'
        ReportLocator = '定位：{0}。'
        ReportUserInput = '用户输入（完整）：'
        ReportUserInputMissing = '未从本地记录取得该回合的用户输入。'
        ReportTokenUnavailable = '无法可靠取得：当前文件没有可用的累计 Token 增量。'
        ReportFileHeading = '## 本地会话文件占用前三'
        ReportFileExplanation = '本节反映 JSONL 文件构成，不等同于 Token 消耗。'
        ReportFileRank = '{0}：{1}，{2}，占 {3}%，涉及 {4} 条记录。'
        ReportFileUnavailable = '无法取得：未扫描到完整的本地会话记录。'
        SectionBasic = '一、基本信息'
        LabelTaskId = '任务 ID：'
        LabelTaskName = '任务名称：'
        LabelStorage = '会话存储状态：'
        LabelSegmentCount = '会话分段数：'
        ValueSegmentCount = '{0} 个'
        LabelAggregateBytes = '聚合字节数：'
        ValueAggregateBytes = '{0} B（{1}）'
        LabelTimeRange = '分段时间范围：'
        LabelPath = '路径：'
        LabelLastModified = '最后修改：'
        LabelContext = '最近输入占窗口：'
        SectionResources = '二、文件资源'
        LabelCompactions = '上下文压缩：'
        ValueCompactions = '{0} 次'
        LabelTurnStats = '回合统计：'
        ValueTurnStats = '已完成 {0} 轮；已中止 {1} 轮；未结束 {2} 轮'
        LabelTurnDetection = '回合识别：'
        ValueTurnDetection = '原始 turn_context {0} 条；按 turn_id/终止边界合并重复 {1} 条；识别 {2} 轮'
        LabelMilestone = '{0:D2} 轮结束后文件大小：'
        MilestoneUnavailable = '无法取得（未发现明确终止边界）'
        LabelLatestTurn = '最新回合与文件：'
        ValueLatestTurn = '第 {0} 轮（{1}）；{2}'
        ValueNoTurns = '未识别到回合；{0}'
        LabelReport = '详细分析报告：'
        SectionAdvice = '三、交接建议'
        ScoreSummary = '交接评分：{0}/10（传统大小＋压缩次数；依据如下）'
        ScoreMethodHeading = '## 评分依据、上下文与交接决策'
        ScoreEquation = '计分算式：文件大小分 {0} + 压缩次数分 {1} = {2}/10。'
        SizeThresholds = '文件大小分：达到30、50、100、200、400 MiB依次增加1分，最高5分；按聚合字节数÷1,048,576计算。'
        CompressionThresholds = '压缩次数分：达到4、7、10、15、20次依次增加1分，最高5分；使用已识别的上下文压缩事件数。'
        ScoreBoundaries = '等级固定：0～2分继续；3～7分建议交接（橙色）；8～10分必须交接（红色）。当前输入量不直接加分。'
        ScoreThresholdTable = '总分=大小分＋压缩次数分；0～2分继续，3～7分橙色建议交接，8～10分红色必须交接。当前输入、窗口占比与增长预测均不参与计分。'
        ScoreCalibration = '证据等级：上述阈值沿用传统经验算法，尚未经全程Token成本和完成质量校准。文件大小不能稳定换算当前Token，压缩次数记录历史事件；3分不是已证实的最省Token点。'
        TokenThresholdEvidence = 'Token观察：没有足够依据把100,000或150,000 Token设为必须交接线；混合模型/供应商的耗时相关性不能证明统一拐点。85%/95%只是独立容量提醒，不改3/8分界。'
        PhaseGate = '交接可行性：当前工作单元是否完成、证据是否齐全、能否安全恢复均为未知（日志中的回合结束不等于业务完成）。优先完成当前工作单元，再在安全断点交接；容量不足时先保存证据和断点，不为等整项完成而冒险继续。'
        CostGate = '交接收益：未知；不把输入Token多直接判为浪费。需比较后续重复携带成本与交接整理、规则重读、证据重建、缓存重建和预期返工的总成本。新窗口仅做少量简单任务，可能尚未回本。'
        CostEquation = '简化Token回本条件：N × (C - R) > H；C为旧窗口每次模型请求输入，R为新窗口重建后每次输入，H为交接额外开销，N为后续模型请求次数（不是用户对话轮数）；只在同口径且未来输入近似不变时适用。'
        CostLimit = '金额与耗时须另算：缓存命中率、输入/输出单价、长上下文倍率及交接时间会改变结论；这些输入缺失时不输出伪精确的节省金额或最佳交接分数。本工具只读建议，不执行交接。'
        ContextRaw = '本次原生用量观测：输入 {0} Token / 窗口 {1} Token = {2}；input_tokens已含缓存输入，不重复相加。'
        AdviceSummary = '交接建议：{0}'
        BasisHeading = '参考依据：'
        ExperienceRule = '  3. 输入量、实测增长及85%/95%容量提醒仅作独立诊断，不参与传统评分；容量提醒是经验提示，不是官方交接门槛。'
        ContextReminderHeading = '最近观测与趋势（仅估计输入，不是界面实测或延迟结论）：'
        HumanReminderHeading = '人工判断提醒：'
        HumanReminder = '请主动判断 AI 是否已出现明显理解不足，例如忘记约束、重复执行或前后矛盾；如已出现，应提高交接优先级。'
        ScanWarningsHeading = '扫描提醒：'
        WarningParse = '  - {0} 条关键记录未能解析；活动任务写入结束后可重试。'
        WarningTokenReset = '  - 累计 Token 计数回退 {0} 次；回退点已重新建立基线，排名可能少计但不会把旧累计量重复计算。'
        WarningTokenBaseline = '  - 后续回合或新分段的首个累计 Token 快照有 {0} 次仅作为基线；排名可能少计，但不会把历史累计量重复算到单一回合。'
        WarningOffset = '  - 检测到非统一编码或换行；最终文件占用已按实际扫描字节校正，历史里程碑大小可能有轻微偏差。'
        WarningDuplicateContext = '  - 同一界面回合可能包含多条内部上下文记录。本次发现并合并了 {0} 条重复记录，最终识别为 {1} 个回合。'
        WarningMetadataParse = '  - 有 {0} 个文件名候选的 session_meta 无法解析，已排除且未参与聚合。'
        WarningCandidateExcluded = '  - 有 {0} 个文件名候选的内部任务 ID 不匹配，已排除且未参与聚合。'
        WarningVersion = '  - 会话分段记录了不同 CLI 版本；已按各分段格式读取，版本差异需人工留意。'
        WarningFormat = '  - 会话分段的编码或换行格式不一致；已逐段识别并聚合。'
        WarningLocation = '  - 同一任务同时存在活动目录和归档目录分段；已明确标记为混合存储状态。'
        WarningTime = '  - 多个分段的 session_meta 时间相同；已使用完整路径作为稳定次序。'
        WarningIncompleteMetadata = '  - 有 {0} 类 session_meta 字段在部分分段中缺失；已继续聚合，但兼容性需人工留意。'
        WarningTaskNameParse = '  - 本地任务索引中有 {0} 条记录无法解析；任务名称可能不是最新值。'
        WarningTaskNameMissing = '  - 未能从本地任务索引取得任务名称；任务 ID 和其余会话分析结果不受影响。'
        WarningFileChanged = '  - 文件在扫描期间仍有写入；轮次、Token 和内容占比以本次已读取数据为准。'
    }
    'en-US' = @{
        PromptTaskId = 'Enter the Codex task ID'
        InvalidTaskId = "Invalid task ID: {0}`nExample: 00000000-0000-0000-0000-000000000000"
        TaskNameNotIndexed = 'Unavailable (not recorded in the local task index)'
        TaskNameReadFailed = 'Unavailable (failed to read the local task index)'
        ReportDirectory = 'CodexSessionHandoffAssessment\Reports'
        ReportFileName = '{0}-detailed-analysis-report.md'
        ReportPathMissingDirectory = 'The detailed report path has no directory: {0}'
        ReportNoBom = 'The detailed report was not written with a UTF-8 BOM.'
        ReportRoundTripMismatch = 'The detailed report did not match after write-back verification.'
        ReportWriteFailed = 'Failed to write the detailed report. The previous report was not changed: {0}'
        SessionMetaMissing = 'No parseable session_meta record was found.'
        SessionIdMissing = 'session_meta.payload.id is missing.'
        SessionTimestampMissing = 'session_meta.timestamp is missing, so the segments cannot be sorted reliably.'
        SessionTimestampInvalid = 'session_meta.timestamp is invalid, so the segments cannot be sorted reliably.'
        SessionDirectoryMissing = 'No Codex session directory was found.'
        SessionFileMissing = 'No local session file was found for task {0}.'
        SessionCandidatesRejected = 'None of the candidate files passed session_meta.payload.id verification for task {0}.'
        SegmentMetadataConflict = 'Session segment metadata conflict: {0} has inconsistent values. The segments will not be joined silently.'
        SegmentRangeOverlap = 'Session segment time ranges overlap: the current segment starts at {0}, while the previous segment ends at {1}. The segments cannot be joined safely without reliable record identifiers.'
        SegmentRecordOverlap = 'Session segment records overlap in time. Duplicate counting was not performed.'
        SegmentReadFailed = 'Failed to read a session segment: {0}'
        ReportExtensionInvalid = 'The detailed report must use the .md extension: {0}'
        ReportMatchesSession = 'The detailed report path cannot be the same as a session JSONL file.'
        CategoryCompacted = 'Compacted history snapshots (excluding inline attachments)'
        CategoryTurnContext = 'Turn context and instructions'
        CategorySessionMeta = 'Session metadata'
        CategoryTools = 'Tool calls and outputs'
        CategoryConversation = 'User, assistant, and reasoning text'
        CategoryOtherResponse = 'Other response records'
        CategoryTokenMetadata = 'Token and rate metadata'
        CategoryOtherEvent = 'Other event records'
        CategoryOther = 'Other events and structure'
        CategoryInlineData = 'Inline image and attachment data'
        StatusCompleted = 'completed'
        StatusAborted = 'aborted'
        StatusUnfinished = 'unfinished'
        StatusUnknown = 'status unavailable'
        StorageMixed = 'mixed (active and archived segments)'
        StorageArchived = 'archived'
        StorageActive = 'not archived (this does not mean the app is running)'
        RangeSeparator = ' to '
        AdditionalSegments = ' ({0} more segment(s))'
        Unavailable = 'Unavailable'
        ContextUnavailableBasis = 'Recent input/window estimate is unknown; missing values are never zero.'
        ContextCriticalBasis = 'Latest known input uses {0} of the window, reaching the 95% capacity reminder. Check a recoverable breakpoint; compaction depends on runtime configuration.'
        ContextHighBasis = 'Latest known input uses {0} of the window, reaching the 85% capacity reminder. Prepare a recoverable breakpoint.'
        ContextNormalBasis = 'Latest known input uses {0} of the window; capacity observation only, not a score input or proof of handoff savings.'
        SizeBasis = 'File size: {0}; size score {1}/5.'
        CompressionBasis = 'Compactions: {0}; compaction score {1}/5.'
        AdviceHandoff = 'Handoff recommended (3-7, orange): check a safe breakpoint and reconstruction cost; finish the current repair unit if capacity allows. The score alone does not prove savings.'
        AdviceRequired = 'Handoff required (8-10, red, traditional heuristic): prioritize the next safe breakpoint without interrupting in-flight work. Preserve evidence and a recoverable checkpoint if capacity cannot support completion. This score does not prove immediate handoff minimizes tokens.'
        AdviceContinue = 'Continue (0-2): the traditional heuristic is below three; review latest input and capacity diagnostics separately.'
        LevelContinue = 'continue'
        LevelRecommended = 'handoff recommended'
        LevelRequired = 'handoff required'
        LevelUnknown = 'unknown observation'
        AdviceUnknown = 'Reliable observation unavailable; no continue or handoff conclusion.'
        TrendBasis = 'Observed mean across five intervals from six completed turns: {0} tokens/turn; valid points {2}/6. Same model, declared provider, window and compaction segment only; insufficient samples remain unknown. No future-pressure forecast.'
        ReportTitle = '# Codex session detailed analysis report'
        ReportTaskId = '- Task ID: {0}'
        ReportTaskName = '- Task name: {0}'
        ReportSegmentCount = '- Session segments: {0}'
        ReportAggregateBytes = '- Aggregate bytes: {0} B ({1})'
        ReportTimeRange = '- Segment time range: {0}'
        ReportPaths = '- Segment path(s): {0}'
        ReportGeneratedAt = '- Generated at: {0}'
        ReportEncoding = '- Encoding: UTF-8 BOM'
        ReportPrivacy = '> This report may contain complete user input, local paths, internal information, or other sensitive content. Keep it in a controlled local environment.'
        ReportHandoffLine = '- Handoff score: {0}/10 ({1}); file-size score {2}/5 + compaction-count score {3}/5.'
        ReportHandoffContext = '- Capacity and observation note: {0}'
        ReportTokenHeading = '## Turns with the highest token usage'
        ReportTokenExplanation = 'Ranked by increases in local cumulative token snapshots. M tokens means one million tokens; MiB measures local file bytes and cannot be converted to tokens at a fixed ratio.'
        RankNames = @('First', 'Second', 'Third')
        ReportTurnHeading = '### {0}: turn {1} ({2})'
        ReportTokenUsage = '{0} tokens; input {1} ({2} cached), output {3} ({4} reasoning).'
        LocatorEventTime = 'event time {0}'
        LocatorTurnSuffix = 'turn ID suffix {0}'
        LocatorGrowth = 'JSONL growth in this turn {0}'
        ReportLocator = 'Location: {0}.'
        ReportUserInput = 'Complete user input:'
        ReportUserInputMissing = 'The user input for this turn was not found in the local records.'
        ReportTokenUnavailable = 'Unavailable: this session has no reliable cumulative token increase.'
        ReportFileHeading = '## Largest local session file categories'
        ReportFileExplanation = 'This section describes the JSONL file composition. It is not token usage.'
        ReportFileRank = '{0}: {1}, {2}, {3}% of scanned bytes across {4} record(s).'
        ReportFileUnavailable = 'Unavailable: no complete local session records were scanned.'
        SectionBasic = '1. Basic information'
        LabelTaskId = 'Task ID:'
        LabelTaskName = 'Task name:'
        LabelStorage = 'Session storage:'
        LabelSegmentCount = 'Session segments:'
        ValueSegmentCount = '{0}'
        LabelAggregateBytes = 'Aggregate bytes:'
        ValueAggregateBytes = '{0} B ({1})'
        LabelTimeRange = 'Segment time range:'
        LabelPath = 'Path:'
        LabelLastModified = 'Last modified:'
        LabelContext = 'Recent context usage:'
        SectionResources = '2. File resources'
        LabelCompactions = 'Compactions:'
        ValueCompactions = '{0}'
        LabelTurnStats = 'Turn status:'
        ValueTurnStats = '{0} completed; {1} aborted; {2} unfinished'
        LabelTurnDetection = 'Turn detection:'
        ValueTurnDetection = '{0} turn_context record(s); {1} duplicate record(s) merged by turn_id or terminal boundary; {2} turn(s) identified'
        LabelMilestone = 'Size after turn {0:D2}:'
        MilestoneUnavailable = 'Unavailable (no explicit terminal boundary)'
        LabelLatestTurn = 'Latest turn and file:'
        ValueLatestTurn = 'turn {0} ({1}); {2}'
        ValueNoTurns = 'no turns identified; {0}'
        LabelReport = 'Detailed report:'
        SectionAdvice = '3. Handoff recommendation'
        ScoreSummary = 'Handoff score: {0}/10 (traditional size + compaction count; basis below)'
        ScoreMethodHeading = '## Scoring basis, context and handoff decisions'
        ScoreEquation = 'Score equation: file-size score {0} + compaction-count score {1} = {2}/10.'
        SizeThresholds = 'File-size score: add one point at each of 30, 50, 100, 200 and 400 MiB, capped at five; MiB = aggregate bytes / 1,048,576.'
        CompressionThresholds = 'Compaction-count score: add one point at each of 4, 7, 10, 15 and 20 detected compaction events, capped at five.'
        ScoreBoundaries = 'Fixed levels: 0-2 continue; 3-7 handoff recommended (orange); 8-10 handoff required (red). Current input does not directly add points.'
        ScoreThresholdTable = 'Total = size score + compaction-count score; 0-2 continue, 3-7 orange recommendation, 8-10 red required tier. Current input, window utilization and growth forecasts do not contribute to the score.'
        ScoreCalibration = 'Evidence level: these are restored traditional heuristic thresholds, not calibrated against end-to-end token cost or completion quality. File size cannot reliably convert to current tokens, and compaction count records historical events; three points is not a proven token optimum.'
        TokenThresholdEvidence = 'Token evidence: neither 100,000 nor 150,000 tokens is established as a mandatory handoff limit. Latency correlations pooled across models/providers cannot establish a universal cliff. The 85%/95% reminders concern capacity only and do not change the three/eight score boundaries.'
        PhaseGate = 'Handoff feasibility: work-unit completion, evidence completeness and safe recovery are unknown; a terminal log turn does not prove business completion. Prefer completing the current unit and handing off at a safe breakpoint. If capacity is insufficient, preserve evidence and a checkpoint before continuing.'
        CostGate = 'Handoff benefit: unknown; large input alone is not proof of waste. Compare future repeated-input cost against handoff preparation, rule reloads, evidence reconstruction, cache rebuilding and expected rework. A new window with only a few simple tasks may not break even.'
        CostEquation = 'Simplified token break-even: N × (C - R) > H; C is old-window input per model request, R is reconstructed new-window input per request, H is handoff overhead, and N counts future model requests, not user turns. This assumes comparable accounting and roughly stable future inputs.'
        CostLimit = 'Money and time require separate accounting: cache-hit rates, input/output prices, long-context multipliers and handoff time can change the result. Missing inputs do not justify precise savings or an optimal handoff score. This tool provides read-only advice and never performs a handoff.'
        ContextRaw = 'Native usage observation: input {0} tokens / window {1} tokens = {2}; input_tokens already includes cached input, which is not added twice.'
        AdviceSummary = 'Recommendation: {0}'
        BasisHeading = 'Basis:'
        ExperienceRule = '  3. Input, observed growth and 85%/95% capacity reminders are independent diagnostics, not traditional score inputs; the reminders are heuristics, not official handoff limits.'
        ContextReminderHeading = 'Latest observation and trend (input estimate, not UI measurement or latency evidence):'
        HumanReminderHeading = 'Manual review reminder:'
        HumanReminder = 'Check whether the AI is forgetting constraints, repeating work, or contradicting itself. If so, raise the handoff priority.'
        ScanWarningsHeading = 'Scan warnings:'
        WarningParse = '  - {0} key record(s) could not be parsed. Retry after the active task stops writing.'
        WarningTokenReset = '  - The cumulative token counter moved backward {0} time(s). A new baseline was established; rankings may undercount but will not count old totals twice.'
        WarningTokenBaseline = '  - The first cumulative token snapshot in a later turn or segment was used only as a baseline {0} time(s). Rankings may undercount, but historical totals will not be assigned to one turn again.'
        WarningOffset = '  - Mixed encoding or line endings were detected. Final file usage was corrected to scanned bytes; historical milestones may differ slightly.'
        WarningDuplicateContext = '  - One UI turn may contain multiple internal context records. {0} duplicate record(s) were merged, producing {1} identified turn(s).'
        WarningMetadataParse = '  - session_meta could not be parsed for {0} filename candidate(s). They were excluded from aggregation.'
        WarningCandidateExcluded = '  - {0} filename candidate(s) had a different internal task ID and were excluded.'
        WarningVersion = '  - Session segments record different CLI versions. Each segment was parsed separately; review version differences if needed.'
        WarningFormat = '  - Session segments use different encodings or line endings. Each format was detected before aggregation.'
        WarningLocation = '  - The task has segments in both active and archived storage. The storage state is marked as mixed.'
        WarningTime = '  - Multiple segments have the same session_meta timestamp. Full paths were used as a stable secondary order.'
        WarningIncompleteMetadata = '  - {0} session_meta field type(s) are missing from some segments. Aggregation continued, but compatibility should be reviewed.'
        WarningTaskNameParse = '  - {0} local task index record(s) could not be parsed, so the task name may be outdated.'
        WarningTaskNameMissing = '  - The task name was not found in the local task index. The task ID and other analysis results are unaffected.'
        WarningFileChanged = '  - A session file changed during the scan. Turn, token, and composition results reflect the data read in this scan.'
    }
}
$script:Ui = $uiCatalog[$Language]

function Get-UiText {
    param(
        [Parameter(Mandatory)]
        [string]$Key,

        [object[]]$Arguments = @()
    )

    if (-not $script:Ui.ContainsKey($Key)) {
        throw "Missing localized text key: $Key"
    }

    $template = [string]$script:Ui[$Key]
    if ($Arguments.Count -gt 0) {
        return $template -f $Arguments
    }
    return $template
}

if ([string]::IsNullOrWhiteSpace($TaskId)) {
    $TaskId = Read-Host (Get-UiText 'PromptTaskId')
}

$TaskId = $TaskId.Trim()
$taskIdPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

if ($TaskId -notmatch $taskIdPattern) {
    throw (Get-UiText 'InvalidTaskId' @($TaskId))
}

function Format-StatusLine {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter(Mandatory)]
        [string]$Value,

        [int]$ValueColumn = 24
    )

    $displayWidth = 0
    foreach ($character in $Label.ToCharArray()) {
        # 当前标签中的中文和全角标点占两列，ASCII 字符占一列。
        $displayWidth += if ([int]$character -le 0x7F) { 1 } else { 2 }
    }

    $paddingWidth = [Math]::Max(1, $ValueColumn - $displayWidth)
    return $Label + (' ' * $paddingWidth) + $Value
}

function Format-MiB {
    param([long]$Bytes)

    return ($Bytes / 1MB).ToString(
        'F2',
        [Globalization.CultureInfo]::InvariantCulture
    ) + ' MiB'
}

function Format-ByteSize {
    param([long]$Bytes)

    if ($Bytes -ge 1GB) {
        return ($Bytes / 1GB).ToString(
            'F2',
            [Globalization.CultureInfo]::InvariantCulture
        ) + ' GiB'
    }

    if ($Bytes -ge 1MB) {
        return Format-MiB $Bytes
    }

    if ($Bytes -ge 1KB) {
        return ($Bytes / 1KB).ToString(
            'F2',
            [Globalization.CultureInfo]::InvariantCulture
        ) + ' KiB'
    }

    return "$Bytes B"
}

function Format-Integer {
    param([long]$Value)

    return $Value.ToString(
        'N0',
        [Globalization.CultureInfo]::InvariantCulture
    )
}

function Format-TokenValue {
    param([long]$Value)

    if ($Value -ge 1000000) {
        return ($Value / 1000000).ToString(
            'F3',
            [Globalization.CultureInfo]::InvariantCulture
        ) + ' M'
    }

    return Format-Integer $Value
}

function Format-EventTimestamp {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ''
    }

    try {
        $parsed = [DateTimeOffset]::Parse(
            $Value,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        )
        return $parsed.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss zzz')
    }
    catch {
        return $Value
    }
}

function Get-MarkdownFence {
    param(
        [string]$Value
    )

    $backtick = ([char]0x60).ToString()
    $maximumRun = 0
    foreach ($match in [regex]::Matches($Value, $backtick + '+')) {
        $maximumRun = [Math]::Max($maximumRun, $match.Length)
    }

    return $backtick * [Math]::Max(3, $maximumRun + 1)
}

function Add-ReportLine {
    param(
        [Parameter(Mandatory)]
        [Text.StringBuilder]$Builder,

        [AllowEmptyString()]
        [string]$Value = ''
    )

    [void]$Builder.Append($Value)
    [void]$Builder.Append([Environment]::NewLine)
}

function Get-DetailedReportPath {
    param(
        [string]$RequestedPath,
        [Parameter(Mandatory)]
        [string]$CurrentTaskId
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return [IO.Path]::GetFullPath($RequestedPath)
    }

    $localAppData = [Environment]::GetFolderPath(
        [Environment+SpecialFolder]::LocalApplicationData
    )
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        $localAppData = Join-Path $env:USERPROFILE 'AppData\Local'
    }

    $reportDirectory = Join-Path $localAppData (Get-UiText 'ReportDirectory')
    $reportFileName = Get-UiText 'ReportFileName' @($CurrentTaskId)
    return Join-Path $reportDirectory $reportFileName
}

function Get-TaskNameFromLocalIndex {
    param(
        [Parameter(Mandatory)]
        [string]$CurrentTaskId
    )

    $fallbackName = Get-UiText 'TaskNameNotIndexed'
    $codexHome = Join-Path $env:USERPROFILE '.codex'
    $indexPath = Join-Path $codexHome 'session_index.jsonl'

    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        return [pscustomobject]@{
            TaskName = $fallbackName
            IndexFound = $false
            ParseWarnings = 0
        }
    }

    $taskName = $fallbackName
    $indexFound = $false
    $parseWarnings = 0
    $stream = $null
    $reader = $null

    try {
        $stream = [IO.File]::Open(
            $indexPath,
            [IO.FileMode]::Open,
            [IO.FileAccess]::Read,
            [IO.FileShare]::ReadWrite
        )
        $reader = [IO.StreamReader]::new(
            $stream,
            [Text.UTF8Encoding]::new($false),
            $true,
            65536
        )

        while (($line = $reader.ReadLine()) -ne $null) {
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }
            if ($line.IndexOf(
                $CurrentTaskId,
                [StringComparison]::OrdinalIgnoreCase
            ) -lt 0) {
                continue
            }

            try {
                $entry = $line | ConvertFrom-Json -ErrorAction Stop
            }
            catch {
                $parseWarnings++
                continue
            }

            $entryId = ''
            foreach ($idField in @('id', 'thread_id', 'session_id')) {
                $property = $entry.PSObject.Properties[$idField]
                if ($null -ne $property -and $null -ne $property.Value) {
                    $entryId = [string]$property.Value
                    break
                }
            }
            if (-not [string]::Equals(
                $entryId,
                $CurrentTaskId,
                [StringComparison]::OrdinalIgnoreCase
            )) {
                continue
            }

            foreach ($nameField in @('thread_name', 'title', 'name')) {
                $property = $entry.PSObject.Properties[$nameField]
                if (
                    $null -ne $property -and
                    -not [string]::IsNullOrWhiteSpace([string]$property.Value)
                ) {
                    $singleLineName = (
                        [string]$property.Value -replace '[\x00-\x1F\x7F]+', ' '
                    ).Trim()
                    if (-not [string]::IsNullOrWhiteSpace($singleLineName)) {
                        # 索引可能包含同一任务的多条更新记录，以最后一条有效名称为准。
                        $taskName = $singleLineName
                        $indexFound = $true
                    }
                    break
                }
            }
        }
    }
    catch {
        return [pscustomobject]@{
            TaskName = Get-UiText 'TaskNameReadFailed'
            IndexFound = $false
            ParseWarnings = $parseWarnings
        }
    }
    finally {
        if ($reader) {
            $reader.Dispose()
        }
        elseif ($stream) {
            $stream.Dispose()
        }
    }

    return [pscustomobject]@{
        TaskName = $taskName
        IndexFound = $indexFound
        ParseWarnings = $parseWarnings
    }
}

function Write-Utf8BomFileAtomic {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Content
    )

    $fullPath = [IO.Path]::GetFullPath($Path)
    $directory = [IO.Path]::GetDirectoryName($fullPath)
    if ([string]::IsNullOrWhiteSpace($directory)) {
        throw (Get-UiText 'ReportPathMissingDirectory' @($Path))
    }

    [void][IO.Directory]::CreateDirectory($directory)
    $temporaryName = '.{0}.{1}.{2}.tmp' -f `
        [IO.Path]::GetFileName($fullPath), `
        $PID, `
        [Guid]::NewGuid().ToString('N')
    $temporaryPath = Join-Path $directory $temporaryName
    $backupPath = $fullPath + '.replace-backup'
    $encoding = [Text.UTF8Encoding]::new($true, $true)

    try {
        [IO.File]::WriteAllText($temporaryPath, $Content, $encoding)
        $bytes = [IO.File]::ReadAllBytes($temporaryPath)
        if (
            $bytes.Length -lt 3 -or
            $bytes[0] -ne 0xEF -or
            $bytes[1] -ne 0xBB -or
            $bytes[2] -ne 0xBF
        ) {
            throw (Get-UiText 'ReportNoBom')
        }

        $roundTrip = [IO.File]::ReadAllText($temporaryPath, $encoding)
        if ($roundTrip -cne $Content) {
            throw (Get-UiText 'ReportRoundTripMismatch')
        }

        if ([IO.File]::Exists($fullPath)) {
            if ([IO.File]::Exists($backupPath)) {
                [IO.File]::Delete($backupPath)
            }
            [IO.File]::Replace($temporaryPath, $fullPath, $backupPath)
            if ([IO.File]::Exists($backupPath)) {
                try {
                    [IO.File]::Delete($backupPath)
                }
                catch {
                    # 报告已经原子替换成功；固定备份路径会在下次运行前继续清理。
                }
            }
        }
        else {
            [IO.File]::Move($temporaryPath, $fullPath)
        }
    }
    catch {
        if ([IO.File]::Exists($temporaryPath)) {
            [IO.File]::Delete($temporaryPath)
        }
        if (
            [IO.File]::Exists($backupPath) -and
            [IO.File]::Exists($fullPath)
        ) {
            try {
                [IO.File]::Delete($backupPath)
            }
            catch {
                # 保留旧备份比在错误处理中再次破坏目标文件更安全。
            }
        }
        throw (Get-UiText 'ReportWriteFailed' @($_.Exception.Message))
    }

    return $fullPath
}

function Get-JsonlTextFormat {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $probe = $null
    try {
        $probe = [IO.File]::Open(
            $Path,
            [IO.FileMode]::Open,
            [IO.FileAccess]::Read,
            [IO.FileShare]::ReadWrite
        )
        $buffer = New-Object byte[] 65536
        $count = $probe.Read($buffer, 0, $buffer.Length)
    }
    finally {
        if ($probe) {
            $probe.Dispose()
        }
    }

    $encoding = [Text.UTF8Encoding]::new($false)
    $bomBytes = 0
    $newLineBytes = 1
    $asciiByteWidth = 1
    $encodingKind = 'utf8'

    if (
        $count -ge 3 -and
        $buffer[0] -eq 0xEF -and
        $buffer[1] -eq 0xBB -and
        $buffer[2] -eq 0xBF
    ) {
        $encoding = [Text.UTF8Encoding]::new($true)
        $bomBytes = 3
    }
    elseif (
        $count -ge 2 -and
        $buffer[0] -eq 0xFF -and
        $buffer[1] -eq 0xFE
    ) {
        $encoding = [Text.Encoding]::Unicode
        $bomBytes = 2
        $newLineBytes = 2
        $asciiByteWidth = 2
        $encodingKind = 'utf16le'
    }
    elseif (
        $count -ge 2 -and
        $buffer[0] -eq 0xFE -and
        $buffer[1] -eq 0xFF
    ) {
        $encoding = [Text.Encoding]::BigEndianUnicode
        $bomBytes = 2
        $newLineBytes = 2
        $asciiByteWidth = 2
        $encodingKind = 'utf16be'
    }

    if ($encodingKind -eq 'utf8') {
        for ($index = $bomBytes; $index -lt $count; $index++) {
            if ($buffer[$index] -eq 0x0A) {
                $newLineBytes = if (
                    $index -gt $bomBytes -and
                    $buffer[$index - 1] -eq 0x0D
                ) { 2 } else { 1 }
                break
            }
        }
    }
    elseif ($encodingKind -eq 'utf16le') {
        for ($index = $bomBytes; $index -lt ($count - 1); $index += 2) {
            if ($buffer[$index] -eq 0x0A -and $buffer[$index + 1] -eq 0x00) {
                $newLineBytes = if (
                    $index -ge ($bomBytes + 2) -and
                    $buffer[$index - 2] -eq 0x0D -and
                    $buffer[$index - 1] -eq 0x00
                ) { 4 } else { 2 }
                break
            }
        }
    }
    else {
        for ($index = $bomBytes; $index -lt ($count - 1); $index += 2) {
            if ($buffer[$index] -eq 0x00 -and $buffer[$index + 1] -eq 0x0A) {
                $newLineBytes = if (
                    $index -ge ($bomBytes + 2) -and
                    $buffer[$index - 2] -eq 0x00 -and
                    $buffer[$index - 1] -eq 0x0D
                ) { 4 } else { 2 }
                break
            }
        }
    }

    return [pscustomobject]@{
        Encoding = $encoding
        BomBytes = $bomBytes
        NewLineBytes = $newLineBytes
        AsciiByteWidth = $asciiByteWidth
    }
}

function Get-RecordShape {
    param([string]$Line)

    # Valid records are classified by object structure, never by textual key order.
    # Keep the object for downstream consumers so large records are parsed only once.
    try {
        $record = $Line | ConvertFrom-Json -ErrorAction Stop
        $topType = if ($record.type -is [string]) { $record.type } else { '' }
        $payloadType = if ($record.payload.type -is [string]) { $record.payload.type } else { '' }
        $timestamp = if ($record.timestamp -is [string]) { $record.timestamp }
            elseif ($record.timestamp -is [datetime] -or $record.timestamp -is [datetimeoffset]) {
                # ConvertFrom-Json may materialize ISO timestamps as dates depending on PowerShell version.
                $record.timestamp.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
            }
            else { '' }
        $turnId = if ($record.payload.turn_id -is [string]) { $record.payload.turn_id }
            elseif ($record.turn_id -is [string]) { $record.turn_id } else { '' }
        return [pscustomobject]@{
            TopType = $topType
            PayloadType = $payloadType
            Timestamp = $timestamp
            TurnId = $turnId
            Record = $record
        }
    }
    catch {
        # Preserve the existing malformed-record policy in this narrow fix.
        # Downstream token/user parsing still reports its existing parse warning.
        $head = $Line.Substring(0, [Math]::Min(4096, $Line.Length))
        $typeMatches = [regex]::Matches($head, '"type"\s*:\s*"([^"\\]+)"')
        return [pscustomobject]@{
            TopType = if ($typeMatches.Count -ge 1) { $typeMatches[0].Groups[1].Value } else { '' }
            PayloadType = if ($typeMatches.Count -ge 2) { $typeMatches[1].Groups[1].Value } else { '' }
            Timestamp = Get-HeadStringField $head 'timestamp'
            TurnId = Get-HeadStringField $head 'turn_id'
            Record = $null
        }
    }
}
function Get-HeadStringField {
    param(
        [string]$Head,
        [string]$Name
    )

    $match = [regex]::Match(
        $Head,
        '"' + [regex]::Escape($Name) + '"\s*:\s*"([^"\\]*)"'
    )
    if (-not $match.Success) {
        return ''
    }

    return $match.Groups[1].Value
}

function Get-RecordCategory {
    param(
        [string]$TopType,
        [string]$PayloadType
    )

    if ($TopType -eq 'compacted') {
        return 'compacted'
    }

    if ($TopType -eq 'turn_context') {
        return 'turn_context'
    }

    if ($TopType -eq 'session_meta') {
        return 'session_meta'
    }

    if ($TopType -eq 'response_item') {
        if ($PayloadType -match '(?i)(tool|function_call|command|web_search|computer|mcp|apply_patch)') {
            return 'tools'
        }

        if ($PayloadType -match '(?i)(message|reasoning|summary)') {
            return 'conversation'
        }

        return 'other_response'
    }

    if ($TopType -eq 'event_msg') {
        if ($PayloadType -eq 'token_count') {
            return 'token_metadata'
        }

        if ($PayloadType -match '(?i)(exec|tool|command|patch|web|computer|mcp)') {
            return 'tools'
        }

        if ($PayloadType -match '(?i)(user_message|agent_message|reasoning|summary)') {
            return 'conversation'
        }

        return 'other_event'
    }

    return 'other'
}

function Get-CategoryDisplayName {
    param([string]$Category)

    $keys = @{
        compacted = 'CategoryCompacted'
        turn_context = 'CategoryTurnContext'
        session_meta = 'CategorySessionMeta'
        tools = 'CategoryTools'
        conversation = 'CategoryConversation'
        other_response = 'CategoryOtherResponse'
        token_metadata = 'CategoryTokenMetadata'
        other_event = 'CategoryOtherEvent'
        other = 'CategoryOther'
        inline_data = 'CategoryInlineData'
    }
    if ($keys.ContainsKey($Category)) {
        return Get-UiText $keys[$Category]
    }
    return $Category
}

function Get-StatusDisplayName {
    param([string]$Status)

    switch ($Status) {
        'completed' { return Get-UiText 'StatusCompleted' }
        'aborted' { return Get-UiText 'StatusAborted' }
        'unfinished' { return Get-UiText 'StatusUnfinished' }
        default { return Get-UiText 'StatusUnknown' }
    }
}

function Get-InlineDataByteCount {
    param(
        [string]$Line,
        [int]$AsciiByteWidth = 1
    )

    $total = [long]0
    $searchFrom = 0
    $needle = 'data:'

    while ($searchFrom -lt $Line.Length) {
        $dataStart = $Line.IndexOf(
            $needle,
            $searchFrom,
            [StringComparison]::Ordinal
        )
        if ($dataStart -lt 0) {
            break
        }

        $quoteEnd = $Line.IndexOf(
            '"',
            $dataStart,
            [StringComparison]::Ordinal
        )
        if ($quoteEnd -lt 0) {
            $quoteEnd = $Line.Length
        }

        $base64Marker = $Line.IndexOf(
            ';base64,',
            $dataStart,
            [StringComparison]::Ordinal
        )
        if ($base64Marker -ge 0 -and $base64Marker -lt $quoteEnd) {
            # data URL 使用 ASCII 字符；UTF-16 文件中每个字符占两个字节。
            $total += [long](
                ($quoteEnd - $dataStart) * $AsciiByteWidth
            )
        }

        $searchFrom = [Math]::Max($dataStart + 5, $quoteEnd + 1)
    }

    return $total
}

function Add-CategoryStat {
    param(
        [hashtable]$ByteTable,
        [hashtable]$RecordTable,
        [string]$Category,
        [long]$Bytes,
        [bool]$CountRecord = $true
    )

    if ($Bytes -le 0) {
        return
    }

    if (-not $ByteTable.ContainsKey($Category)) {
        $ByteTable[$Category] = [long]0
        $RecordTable[$Category] = 0
    }

    $ByteTable[$Category] = [long]$ByteTable[$Category] + $Bytes
    if ($CountRecord) {
        $RecordTable[$Category] = [int]$RecordTable[$Category] + 1
    }
}

function Get-LongProperty {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return [long]0
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        return [long]0
    }

    try {
        return [long]$property.Value
    }
    catch {
        return [long]0
    }
}

function Get-TokenSnapshot {
    param([object]$Info)

    if ($null -eq $Info -or $null -eq $Info.total_token_usage) {
        return $null
    }

    $usage = $Info.total_token_usage
    $inputTokens = Get-LongProperty $usage 'input_tokens'
    $cachedInputTokens = Get-LongProperty $usage 'cached_input_tokens'
    $outputTokens = Get-LongProperty $usage 'output_tokens'
    $reasoningTokens = Get-LongProperty $usage 'reasoning_output_tokens'
    $totalTokens = Get-LongProperty $usage 'total_tokens'

    if ($totalTokens -le 0 -and ($inputTokens -gt 0 -or $outputTokens -gt 0)) {
        $totalTokens = $inputTokens + $outputTokens
    }

    return [pscustomobject]@{
        InputTokens = $inputTokens
        CachedInputTokens = $cachedInputTokens
        OutputTokens = $outputTokens
        ReasoningTokens = $reasoningTokens
        TotalTokens = $totalTokens
    }
}

function Get-OrCreateTurnUsage {
    param(
        [hashtable]$Table,
        [int]$TurnIndex,
        [string]$TurnId = '',
        [long]$StartBytes = -1,
        [string]$StartTimestamp = ''
    )

    if (-not $Table.ContainsKey($TurnIndex)) {
        $Table[$TurnIndex] = [pscustomobject]@{
            TurnIndex = $TurnIndex
            TurnId = $TurnId
            Status = 'unfinished'
            HasTurnContext = $false
            StartBytes = $StartBytes
            EndBytes = [long]-1
            StartTimestamp = $StartTimestamp
            EndTimestamp = ''
            UserInput = ''
            InputTokens = [long]0
            CachedInputTokens = [long]0
            OutputTokens = [long]0
            ReasoningTokens = [long]0
            TotalTokens = [long]0
        }
    }

    $item = $Table[$TurnIndex]
    if (
        [string]::IsNullOrWhiteSpace($item.TurnId) -and
        -not [string]::IsNullOrWhiteSpace($TurnId)
    ) {
        $item.TurnId = $TurnId
    }
    if ($item.StartBytes -lt 0 -and $StartBytes -ge 0) {
        $item.StartBytes = $StartBytes
    }
    if (
        [string]::IsNullOrWhiteSpace($item.StartTimestamp) -and
        -not [string]::IsNullOrWhiteSpace($StartTimestamp)
    ) {
        $item.StartTimestamp = $StartTimestamp
    }

    return $item
}

function Get-SessionSegmentMetadata {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $textFormat = Get-JsonlTextFormat -Path $Path
    $stream = $null
    $reader = $null
    $sessionRecord = $null
    $sessionTimestampText = ''

    try {
        $stream = [IO.File]::Open(
            $Path,
            [IO.FileMode]::Open,
            [IO.FileAccess]::Read,
            [IO.FileShare]::ReadWrite
        )
        $reader = [IO.StreamReader]::new(
            $stream,
            $textFormat.Encoding,
            $true,
            65536
        )

        while (($line = $reader.ReadLine()) -ne $null) {
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }
            $head = $line.Substring(0, [Math]::Min(4096, $line.Length))
            $metadataShape = Get-RecordShape -Line $line
            if ($metadataShape.TopType -ne 'session_meta') {
                continue
            }
            $sessionTimestampText = $metadataShape.Timestamp
            $sessionRecord = if ($null -ne $metadataShape.Record) { $metadataShape.Record } else { $line | ConvertFrom-Json -ErrorAction Stop }
            break
        }
    }
    finally {
        if ($reader) {
            $reader.Dispose()
        }
        elseif ($stream) {
            $stream.Dispose()
        }
    }

    if ($null -eq $sessionRecord -or $null -eq $sessionRecord.payload) {
        throw (Get-UiText 'SessionMetaMissing')
    }

    $payload = $sessionRecord.payload
    $idProperty = $payload.PSObject.Properties['id']
    if ($null -eq $idProperty -or [string]::IsNullOrWhiteSpace([string]$idProperty.Value)) {
        throw (Get-UiText 'SessionIdMissing')
    }

    if ([string]::IsNullOrWhiteSpace($sessionTimestampText)) {
        throw (Get-UiText 'SessionTimestampMissing')
    }
    try {
        $sessionStart = [DateTimeOffset]::Parse(
            $sessionTimestampText,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        )
    }
    catch {
        throw (Get-UiText 'SessionTimestampInvalid')
    }

    $file = Get-Item -LiteralPath $Path -ErrorAction Stop
    $metadata = @{}
    foreach ($field in @('originator', 'cli_version', 'source', 'model_provider')) {
        $property = $payload.PSObject.Properties[$field]
        $metadata[$field] = if ($null -eq $property -or $null -eq $property.Value) {
            ''
        }
        else {
            [string]$property.Value
        }
    }

    return [pscustomobject]@{
        FullName = $file.FullName
        LengthBeforeScan = [long]$file.Length
        LengthAfterScan = [long]$file.Length
        LastWriteTime = $file.LastWriteTime
        TaskId = ([string]$idProperty.Value).Trim()
        SessionStart = $sessionStart
        ScanEndTime = $sessionStart
        Originator = $metadata['originator']
        CliVersion = $metadata['cli_version']
        Source = $metadata['source']
        ModelProvider = $metadata['model_provider']
        StorageKind = if ($file.FullName -like '*\archived_sessions\*') {
            'archived'
        }
        else {
            'active'
        }
        TextFormat = $textFormat
    }
}

$roots = @(
    (Join-Path $env:USERPROFILE '.codex\sessions'),
    (Join-Path $env:USERPROFILE '.codex\archived_sessions')
) | Where-Object { Test-Path -LiteralPath $_ }

if (-not $roots) {
    throw (Get-UiText 'SessionDirectoryMissing')
}

$candidateFiles = @(
    Get-ChildItem -LiteralPath $roots -Recurse -File `
        -Filter "*$taskId*.jsonl" -ErrorAction Stop
)

if ($candidateFiles.Count -eq 0) {
    throw (Get-UiText 'SessionFileMissing' @($taskId))
}

$segmentMetadataParseWarnings = 0
$excludedCandidateCount = 0
$segments = @()
foreach ($candidate in $candidateFiles) {
    try {
        $segment = Get-SessionSegmentMetadata -Path $candidate.FullName
    }
    catch {
        $segmentMetadataParseWarnings++
        continue
    }

    if (-not [string]::Equals(
        $segment.TaskId,
        $taskId,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        $excludedCandidateCount++
        continue
    }
    $segments += $segment
}

if ($segments.Count -eq 0) {
    throw (Get-UiText 'SessionCandidatesRejected' @($taskId))
}

$files = @(
    $segments | Sort-Object -Property `
        @{ Expression = { $_.SessionStart.UtcDateTime }; Descending = $false }, `
        @{ Expression = { $_.FullName }; Descending = $false }
)
$segmentCount = $files.Count

foreach ($field in @('Originator', 'Source', 'ModelProvider')) {
    $values = @(
        $files |
            ForEach-Object { $_.$field } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Sort-Object -Unique
    )
    if ($values.Count -gt 1) {
        throw (Get-UiText 'SegmentMetadataConflict' @($field))
    }
}

$segmentVersionWarnings = if (@(
    $files |
        ForEach-Object { $_.CliVersion } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
).Count -gt 1) { 1 } else { 0 }
$segmentFormatWarnings = if (@(
    $files | ForEach-Object {
        '{0}|{1}|{2}' -f `
            $_.TextFormat.Encoding.WebName, `
            $_.TextFormat.NewLineBytes, `
            $_.TextFormat.AsciiByteWidth
    } | Sort-Object -Unique
).Count -gt 1) { 1 } else { 0 }
$segmentLocationWarnings = if (@(
    $files | ForEach-Object { $_.StorageKind } | Sort-Object -Unique
).Count -gt 1) { 1 } else { 0 }
$segmentTimeWarnings = if (@(
    $files | Group-Object -Property { $_.SessionStart.UtcTicks } |
        Where-Object { $_.Count -gt 1 }
).Count -gt 0) { 1 } else { 0 }
$segmentIncompleteMetadataWarnings = 0
if ($segmentCount -gt 1) {
    foreach ($field in @('Originator', 'CliVersion', 'Source', 'ModelProvider')) {
        if (@(
            $files | Where-Object {
                [string]::IsNullOrWhiteSpace([string]$_.$field)
            }
        ).Count -gt 0) {
            $segmentIncompleteMetadataWarnings++
        }
    }
}

$primaryFile = $files[0]
$taskNameInfo = Get-TaskNameFromLocalIndex -CurrentTaskId $taskId
$taskName = $taskNameInfo.TaskName
$taskNameIndexWarnings = $taskNameInfo.ParseWarnings

function New-ContextObservationState {
    return @{ Model = ''; Provider = ''; Window = $null; LastTotal = $null; LastSignature = ''; Current = $null; Request = $null; LastRequestSignature = ''; Points = @{} }
}

function Reset-ContextObservations {
    param($State)
    $State.Current = $null
    $State.Request = $null
    $State.Points = @{}
    $State.Window = $null
    # Preserve the last request identity across boundaries: a repeated pre-compaction
    # rate-limit/usage snapshot must not become a new post-compaction observation.
}

function Get-NullableTokenNumber {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value -or $property.Value -is [bool]) { return $null }
    $value = [double]0
    if (-not [double]::TryParse([string]$property.Value, [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture, [ref]$value) -or
        [double]::IsNaN($value) -or [double]::IsInfinity($value) -or $value -lt 0) { return $null }
    return $value
}

function Set-ContextObservationIdentity {
    param($State, [string]$Model, [string]$Provider)
    if ($State.Model -cne $Model -or $State.Provider -cne $Provider) {
        Reset-ContextObservations $State
        $State.Model = $Model
        $State.Provider = $Provider
    }
}

function Add-ContextObservation {
    param($State, $Info, [int]$TurnIndex, [string]$Timestamp)
    $inputValue = Get-NullableTokenNumber $Info.last_token_usage 'input_tokens'
    $validInput = ($null -ne $inputValue -and $inputValue -le 9007199254740991 -and [Math]::Floor($inputValue) -eq $inputValue)
    $windowValue = Get-NullableTokenNumber $Info 'model_context_window'
    $totalValue = Get-NullableTokenNumber $Info.total_token_usage 'total_tokens'
    # A native per-request input is useful even without capacity or cumulative counters.
    # Keep an independent signature so a repeated pre-boundary snapshot cannot revive it.
    $requestPoint = $null
    if ($validInput) {
        $requestSignature = '{0}|{1}|{2}|{3}|{4}' -f $State.Model, $State.Provider, $windowValue, $totalValue, $inputValue
        if ($requestSignature -cne $State.LastRequestSignature) {
            $requestPoint = [pscustomobject]@{ Input = $inputValue; Timestamp = $Timestamp }
        } elseif ($null -ne $State.Request) {
            $requestPoint = $State.Request
        }
        $State.LastRequestSignature = $requestSignature
    }
    if (-not $validInput -or $null -eq $windowValue -or $windowValue -le 0 -or $null -eq $totalValue) {
        Reset-ContextObservations $State
        $State.Request = $requestPoint
        return
    }
    if (($null -ne $State.Window -and $State.Window -ne $windowValue) -or
        ($null -ne $totalValue -and $null -ne $State.LastTotal -and $totalValue -lt $State.LastTotal)) {
        Reset-ContextObservations $State
    }
    $State.Request = $requestPoint
    $signature = '{0}|{1}|{2}|{3}|{4}' -f $State.Model, $State.Provider, $windowValue, $totalValue, $inputValue
    if ($signature -ceq $State.LastSignature) { return }
    $State.LastSignature = $signature
    $State.Window = $windowValue
    $State.LastTotal = $totalValue
    # Codex input_tokens already includes cached_input_tokens. Never add cached input again.
    $point = [pscustomobject]@{ Input = $inputValue; Window = $windowValue; Turn = $TurnIndex; Timestamp = $Timestamp }
    $State.Current = $point
    if ($TurnIndex -gt 0) { $State.Points[$TurnIndex] = $point }
}

function Get-ContextTrend {
    param($State, $Turns)
    $percent = $null; $growth = $null
    # Retain empty compatibility fields; no observation target or future pressure is inferred.
    $rounds = $null; $forecastPercent = $null
    if ($null -ne $State.Current) { $percent = 100.0 * $State.Current.Input / $State.Current.Window }
    # Select completed turns first; skipping a turn with no usage would change the denominator.
    $completed = @($Turns.Keys | Where-Object { $Turns[$_].Status -eq 'completed' } |
        Sort-Object { [int]$_ } | Select-Object -Last 6)
    $points = @($completed | Where-Object { $State.Points.ContainsKey([int]$_) } |
        ForEach-Object { $State.Points[[int]$_] })
    if ($completed.Count -eq 6 -and $points.Count -eq 6 -and -not [string]::IsNullOrWhiteSpace($State.Model)) {
        $growth = ($points[-1].Input - $points[0].Input) / 5.0
    }
    return [pscustomobject]@{ Percent = $percent; ForecastPercent = $forecastPercent; Growth = $growth; Rounds = $rounds; Samples = $points.Count }
}

$contextState = New-ContextObservationState
$compactCount = 0
$parseWarnings = 0
$tokenResetWarnings = 0
$tokenBaselineWarnings = 0
$offsetWarnings = 0
$turnContextRecordCount = 0
$duplicateTurnContextCount = 0
$completedTurnCount = 0
$abortedTurnCount = 0
$currentTurnIndex = 0
$turnSequenceCount = 0
$tokenAdvanceCount = 0
$previousTokenSnapshot = $null
$turnUsages = @{}
$turnIdToIndex = @{}
$turnEndSizeByIndex = @{}
$terminalTurnIds = @{}
$categoryBytes = @{}
$categoryRecords = @{}
$cumulativeBytes = [long]0
$scanEndPosition = [long]0
$lastResidualCategory = 'other'
$lastTerminalTurnIndex = 0
$lastLineWasTerminal = $false
$lastLineHadNewline = $true
$stream = $null
$reader = $null
$fileChangedDuringScan = $false
$previousSegmentEndTime = $null

for ($segmentIndex = 0; $segmentIndex -lt $files.Count; $segmentIndex++) {
    $file = $files[$segmentIndex]
    $textFormat = $file.TextFormat
    $segmentBaseBytes = $cumulativeBytes
    $segmentScanEndPosition = [long]0
    $segmentLastEventTime = $file.SessionStart
    $lastResidualCategory = 'other'
    $lastTerminalTurnIndex = 0
    $lastLineWasTerminal = $false
    $lastLineHadNewline = $true
    $stream = $null
    $reader = $null

    if (
        $null -ne $previousSegmentEndTime -and
        $file.SessionStart -lt $previousSegmentEndTime
    ) {
        throw (Get-UiText 'SegmentRangeOverlap' @(
            $file.SessionStart.ToString('o'),
            $previousSegmentEndTime.ToString('o')
        ))
    }

    if ($segmentIndex -gt 0) {
        # 后续分段的首个累计快照只作基线，避免把上一分段累计量重复计算。
        $previousTokenSnapshot = $null
    }

    $cumulativeBytes += [long]$textFormat.BomBytes
    if ($textFormat.BomBytes -gt 0) {
    Add-CategoryStat `
        $categoryBytes `
        $categoryRecords `
        'other' `
        $textFormat.BomBytes `
        $false
    }

    try {
    $stream = [IO.File]::Open(
        $file.FullName,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
    )
    $reader = [IO.StreamReader]::new(
        $stream,
        $textFormat.Encoding,
        $true,
        65536
    )

    while (($line = $reader.ReadLine()) -ne $null) {
        $recordStartBytes = $cumulativeBytes
        $lineByteCount = [long]$textFormat.Encoding.GetByteCount($line)
        $recordBytes = $lineByteCount + [long]$textFormat.NewLineBytes
        $cumulativeBytes += $recordBytes
        $lastLineWasTerminal = $false

        $head = $line.Substring(0, [Math]::Min(4096, $line.Length))
        $shape = Get-RecordShape -Line $line
        if ($null -eq $shape.Record) {
            Reset-ContextObservations $contextState
            if ($shape.PayloadType -notin @('token_count','user_message')) { $parseWarnings++ }
        }
        $recordTurnId = $shape.TurnId
        $recordTimestamp = $shape.Timestamp
        $category = Get-RecordCategory $shape.TopType $shape.PayloadType
        $lastResidualCategory = $category

        if (-not [string]::IsNullOrWhiteSpace($recordTimestamp)) {
            $recordTime = $null
            try {
                $recordTime = [DateTimeOffset]::Parse(
                    $recordTimestamp,
                    [Globalization.CultureInfo]::InvariantCulture,
                    [Globalization.DateTimeStyles]::RoundtripKind
                )
            }
            catch {
                $parseWarnings++
            }
            if ($null -ne $recordTime) {
                if (
                    $segmentIndex -gt 0 -and
                    $shape.TopType -ne 'session_meta' -and
                    $null -ne $previousSegmentEndTime -and
                    $recordTime -lt $previousSegmentEndTime
                ) {
                    throw (Get-UiText 'SegmentRecordOverlap')
                }
                if ($recordTime -gt $segmentLastEventTime) {
                    $segmentLastEventTime = $recordTime
                }
            }
        }

        $inlineDataBytes = Get-InlineDataByteCount `
            $line `
            $textFormat.AsciiByteWidth
        $inlineDataBytes = [Math]::Min($inlineDataBytes, $recordBytes)
        if ($inlineDataBytes -gt 0) {
            Add-CategoryStat `
                $categoryBytes `
                $categoryRecords `
                'inline_data' `
                $inlineDataBytes
        }

        $residualBytes = $recordBytes - $inlineDataBytes
        Add-CategoryStat `
            $categoryBytes `
            $categoryRecords `
            $category `
            $residualBytes

        if ($shape.TopType -eq 'compacted') {
            $compactCount++
            Reset-ContextObservations $contextState
        }
        if ($shape.TopType -in @('session_meta', 'turn_context')) {
            try {
                $identityRecord = if ($null -ne $shape.Record) { $shape.Record } else { $line | ConvertFrom-Json -ErrorAction Stop }
                if ($shape.TopType -eq 'session_meta') {
                    Set-ContextObservationIdentity $contextState $contextState.Model ([string]$identityRecord.payload.model_provider)
                } else {
                    Set-ContextObservationIdentity $contextState ([string]$identityRecord.payload.model) $contextState.Provider
                }
            } catch { Reset-ContextObservations $contextState }
        }

        $isTurnStartEvent = (
            $shape.TopType -eq 'event_msg' -and
            $shape.PayloadType -match '^(task_started|turn_started)$'
        )
        if ($isTurnStartEvent) {
            if (
                -not [string]::IsNullOrWhiteSpace($recordTurnId) -and
                $turnIdToIndex.ContainsKey($recordTurnId)
            ) {
                $currentTurnIndex = [int]$turnIdToIndex[$recordTurnId]
            }
            elseif (-not [string]::IsNullOrWhiteSpace($recordTurnId)) {
                if (
                    $currentTurnIndex -gt 0 -and
                    (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -eq 'unfinished' -and
                    [string]::IsNullOrWhiteSpace((Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId)
                ) {
                    # 兼容先出现无 ID 用户消息、稍后才补 turn_id 的旧记录。
                }
                else {
                    $turnSequenceCount++
                    $currentTurnIndex = $turnSequenceCount
                }
                $turnIdToIndex[$recordTurnId] = $currentTurnIndex
            }
            elseif (
                $currentTurnIndex -le 0 -or
                (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -ne 'unfinished'
            ) {
                $turnSequenceCount++
                $currentTurnIndex = $turnSequenceCount
            }

            $null = Get-OrCreateTurnUsage `
                $turnUsages `
                $currentTurnIndex `
                $recordTurnId `
                $recordStartBytes `
                $recordTimestamp
        }

        if ($shape.TopType -eq 'turn_context') {
            $turnContextRecordCount++
            if (
                -not [string]::IsNullOrWhiteSpace($recordTurnId) -and
                $turnIdToIndex.ContainsKey($recordTurnId)
            ) {
                $currentTurnIndex = [int]$turnIdToIndex[$recordTurnId]
            }
            elseif (-not [string]::IsNullOrWhiteSpace($recordTurnId)) {
                if (
                    $currentTurnIndex -gt 0 -and
                    (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -eq 'unfinished' -and
                    [string]::IsNullOrWhiteSpace((Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId)
                ) {
                    # 兼容旧格式在 turn_context 才首次提供 turn_id。
                }
                else {
                    $turnSequenceCount++
                    $currentTurnIndex = $turnSequenceCount
                }
                $turnIdToIndex[$recordTurnId] = $currentTurnIndex
            }
            elseif (
                $currentTurnIndex -le 0 -or
                (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -ne 'unfinished'
            ) {
                $turnSequenceCount++
                $currentTurnIndex = $turnSequenceCount
            }

            $turnUsage = Get-OrCreateTurnUsage `
                $turnUsages `
                $currentTurnIndex `
                $recordTurnId `
                $recordStartBytes `
                $recordTimestamp
            if ($turnUsage.HasTurnContext) {
                $duplicateTurnContextCount++
            }
            $turnUsage.HasTurnContext = $true
        }

        if (
            $shape.TopType -eq 'event_msg' -and
            $shape.PayloadType -eq 'user_message'
        ) {
            if (
                -not [string]::IsNullOrWhiteSpace($recordTurnId) -and
                $turnIdToIndex.ContainsKey($recordTurnId)
            ) {
                $currentTurnIndex = [int]$turnIdToIndex[$recordTurnId]
            }
            elseif (-not [string]::IsNullOrWhiteSpace($recordTurnId)) {
                if (
                    $currentTurnIndex -gt 0 -and
                    (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -eq 'unfinished' -and
                    [string]::IsNullOrWhiteSpace((Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId)
                ) {
                    # 当前匿名回合取得正式 ID，不创建重复回合。
                }
                else {
                    $turnSequenceCount++
                    $currentTurnIndex = $turnSequenceCount
                }
                $turnIdToIndex[$recordTurnId] = $currentTurnIndex
            }
            elseif (
                $currentTurnIndex -le 0 -or
                (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -ne 'unfinished'
            ) {
                $turnSequenceCount++
                $currentTurnIndex = $turnSequenceCount
                if (-not [string]::IsNullOrWhiteSpace($recordTurnId)) {
                    $turnIdToIndex[$recordTurnId] = $currentTurnIndex
                }
            }

            $turnUsage = Get-OrCreateTurnUsage `
                $turnUsages `
                $currentTurnIndex `
                $recordTurnId `
                $recordStartBytes `
                $recordTimestamp
            if (
                -not [string]::IsNullOrWhiteSpace($recordTurnId) -and
                -not $turnIdToIndex.ContainsKey($recordTurnId)
            ) {
                $turnIdToIndex[$recordTurnId] = $currentTurnIndex
            }

            if ([string]::IsNullOrWhiteSpace($turnUsage.UserInput)) {
                try {
                    $userRecord = if ($null -ne $shape.Record) { $shape.Record } else { $line | ConvertFrom-Json -ErrorAction Stop }
                    $messageProperty = $userRecord.payload.PSObject.Properties['message']
                    if (
                        $null -ne $messageProperty -and
                        $messageProperty.Value -is [string]
                    ) {
                        $turnUsage.UserInput = [string]$messageProperty.Value
                    }
                }
                catch {
                    $parseWarnings++
                }
            }
        }

        if (
            $shape.TopType -eq 'event_msg' -and
            $shape.PayloadType -eq 'token_count'
        ) {
            try {
                $record = if ($null -ne $shape.Record) { $shape.Record } else { $line | ConvertFrom-Json -ErrorAction Stop }
                $info = $record.payload.info
                if ($currentTurnIndex -le 0) {
                    $turnSequenceCount++
                    $currentTurnIndex = $turnSequenceCount
                }
                $contextTurnIndex = if ($turnUsages.ContainsKey($currentTurnIndex) -and
                    $turnUsages[$currentTurnIndex].Status -eq 'unfinished') { $currentTurnIndex } else { 0 }
                Add-ContextObservation $contextState $info $contextTurnIndex $recordTimestamp

                $snapshot = Get-TokenSnapshot $info
                if ($null -ne $snapshot -and $snapshot.TotalTokens -gt 0) {
                    if ($currentTurnIndex -le 0) {
                        $turnSequenceCount++
                        $currentTurnIndex = $turnSequenceCount
                    }
                    $turnUsage = Get-OrCreateTurnUsage `
                        $turnUsages `
                        $currentTurnIndex `
                        '' `
                        $recordStartBytes `
                        $recordTimestamp

                    if ($null -eq $previousTokenSnapshot) {
                        if (
                            $segmentIndex -eq 0 -and
                            $currentTurnIndex -le 1 -and
                            $completedTurnCount -eq 0 -and
                            $abortedTurnCount -eq 0
                        ) {
                            $deltaInput = $snapshot.InputTokens
                            $deltaCached = $snapshot.CachedInputTokens
                            $deltaOutput = $snapshot.OutputTokens
                            $deltaReasoning = $snapshot.ReasoningTokens
                            $deltaTotal = $snapshot.TotalTokens
                        }
                        else {
                            # 首个累计快照若出现在后续回合，可能包含缺失的历史记录。
                            $tokenBaselineWarnings++
                            $deltaInput = [long]0
                            $deltaCached = [long]0
                            $deltaOutput = [long]0
                            $deltaReasoning = [long]0
                            $deltaTotal = [long]0
                        }
                    }
                    elseif ($snapshot.TotalTokens -gt $previousTokenSnapshot.TotalTokens) {
                        $deltaInput = [Math]::Max(0, $snapshot.InputTokens - $previousTokenSnapshot.InputTokens)
                        $deltaCached = [Math]::Max(0, $snapshot.CachedInputTokens - $previousTokenSnapshot.CachedInputTokens)
                        $deltaOutput = [Math]::Max(0, $snapshot.OutputTokens - $previousTokenSnapshot.OutputTokens)
                        $deltaReasoning = [Math]::Max(0, $snapshot.ReasoningTokens - $previousTokenSnapshot.ReasoningTokens)
                        $deltaTotal = $snapshot.TotalTokens - $previousTokenSnapshot.TotalTokens
                    }
                    elseif ($snapshot.TotalTokens -lt $previousTokenSnapshot.TotalTokens) {
                        # 累计计数发生回退时重新建立基线，避免把旧累计量重复归入当前回合。
                        $tokenResetWarnings++
                        $deltaInput = [long]0
                        $deltaCached = [long]0
                        $deltaOutput = [long]0
                        $deltaReasoning = [long]0
                        $deltaTotal = [long]0
                    }
                    else {
                        # 相同累计快照可能只是速率限制更新，不能重复计算 last_token_usage。
                        $deltaInput = [long]0
                        $deltaCached = [long]0
                        $deltaOutput = [long]0
                        $deltaReasoning = [long]0
                        $deltaTotal = [long]0
                    }

                    if ($deltaTotal -gt 0) {
                        $turnUsage.InputTokens += [long]$deltaInput
                        $turnUsage.CachedInputTokens += [long]$deltaCached
                        $turnUsage.OutputTokens += [long]$deltaOutput
                        $turnUsage.ReasoningTokens += [long]$deltaReasoning
                        $turnUsage.TotalTokens += [long]$deltaTotal
                        $tokenAdvanceCount++
                    }

                    $previousTokenSnapshot = $snapshot
                }
            }
            catch {
                $parseWarnings++
                Reset-ContextObservations $contextState
            }
        }

        $isCompleteEvent = (
            $shape.TopType -eq 'event_msg' -and
            $shape.PayloadType -match '^(task_complete|turn_complete)$'
        )
        $isAbortEvent = (
            $shape.TopType -eq 'event_msg' -and
            $shape.PayloadType -match '^(turn_aborted|task_aborted)$'
        )

        if ($isCompleteEvent -or $isAbortEvent) {
            $turnId = $recordTurnId

            $isDuplicateTerminal = (
                -not [string]::IsNullOrWhiteSpace($turnId) -and
                $terminalTurnIds.ContainsKey($turnId)
            )

            if (-not $isDuplicateTerminal) {
                if (-not [string]::IsNullOrWhiteSpace($turnId)) {
                    $terminalTurnIds[$turnId] = $true
                }

                if (
                    -not [string]::IsNullOrWhiteSpace($turnId) -and
                    $turnIdToIndex.ContainsKey($turnId)
                ) {
                    $currentTurnIndex = [int]$turnIdToIndex[$turnId]
                }
                elseif (
                    -not [string]::IsNullOrWhiteSpace($turnId) -and
                    $currentTurnIndex -gt 0 -and
                    (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -eq 'unfinished' -and
                    [string]::IsNullOrWhiteSpace((Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId)
                ) {
                    $turnIdToIndex[$turnId] = $currentTurnIndex
                }
                elseif (
                    $currentTurnIndex -le 0 -or
                    (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).Status -ne 'unfinished' -or
                    (
                        -not [string]::IsNullOrWhiteSpace($turnId) -and
                        -not [string]::IsNullOrWhiteSpace((Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId) -and
                        (Get-OrCreateTurnUsage $turnUsages $currentTurnIndex).TurnId -ne $turnId
                    )
                ) {
                    $turnSequenceCount++
                    $currentTurnIndex = $turnSequenceCount
                    if (-not [string]::IsNullOrWhiteSpace($turnId)) {
                        $turnIdToIndex[$turnId] = $currentTurnIndex
                    }
                }
                $turnUsage = Get-OrCreateTurnUsage `
                    $turnUsages `
                    $currentTurnIndex `
                    $turnId `
                    $recordStartBytes `
                    $recordTimestamp
                $turnUsage.EndBytes = $cumulativeBytes
                $turnUsage.EndTimestamp = $recordTimestamp
                $turnEndSizeByIndex[$turnUsage.TurnIndex] = $cumulativeBytes
                $lastTerminalTurnIndex = $turnUsage.TurnIndex
                $lastLineWasTerminal = $true

                if ($isCompleteEvent) {
                    $turnUsage.Status = 'completed'
                    $completedTurnCount++
                }
                else {
                    $turnUsage.Status = 'aborted'
                    $abortedTurnCount++
                }

            }
        }
    }

    $segmentScanEndPosition = [long]$stream.Position
    if ($segmentScanEndPosition -gt 0) {
        $savedPosition = $stream.Position
        $null = $stream.Seek(-1, [IO.SeekOrigin]::End)
        $lastByte = $stream.ReadByte()
        $lastLineHadNewline = ($lastByte -eq 0x0A)
        $null = $stream.Seek($savedPosition, [IO.SeekOrigin]::Begin)
    }
    }
    catch {
        throw (Get-UiText 'SegmentReadFailed' @($_.Exception.Message))
    }
    finally {
    if ($reader) {
        $reader.Dispose()
    }
    elseif ($stream) {
        $stream.Dispose()
    }
    }

    if (
        -not $lastLineHadNewline -and
        ($cumulativeBytes - $segmentBaseBytes) -gt 0
    ) {
    $cumulativeBytes -= [long]$textFormat.NewLineBytes
    if ($categoryBytes.ContainsKey($lastResidualCategory)) {
        $categoryBytes[$lastResidualCategory] = [Math]::Max(
            0,
            [long]$categoryBytes[$lastResidualCategory] - [long]$textFormat.NewLineBytes
        )
    }
    if ($lastLineWasTerminal -and $lastTerminalTurnIndex -gt 0) {
        $turnEndSizeByIndex[$lastTerminalTurnIndex] -= [long]$textFormat.NewLineBytes
        if (
            $currentTurnIndex -gt 0 -and
            $turnUsages.ContainsKey($currentTurnIndex) -and
            $turnUsages[$currentTurnIndex].EndBytes -ge 0
        ) {
            $turnUsages[$currentTurnIndex].EndBytes -= [long]$textFormat.NewLineBytes
        }
    }
    }

    $segmentEstimatedBytes = $cumulativeBytes - $segmentBaseBytes
    if ($segmentScanEndPosition -ne $segmentEstimatedBytes) {
    # 极少数混合换行文件可能让按行估算与实际字节位置不一致。
    $offsetDifference = $segmentScanEndPosition - $segmentEstimatedBytes
    if (-not $categoryBytes.ContainsKey($lastResidualCategory)) {
        $categoryBytes[$lastResidualCategory] = [long]0
        $categoryRecords[$lastResidualCategory] = 0
    }
    $categoryBytes[$lastResidualCategory] = [Math]::Max(
        0,
        [long]$categoryBytes[$lastResidualCategory] + $offsetDifference
    )
    $cumulativeBytes += $offsetDifference
    $offsetWarnings++
    }

    $scanEndPosition += $segmentScanEndPosition
    $currentFileInfo = Get-Item -LiteralPath $file.FullName -ErrorAction Stop
    if (
        [long]$currentFileInfo.Length -ne [long]$file.LengthBeforeScan -or
        [long]$currentFileInfo.Length -ne $segmentScanEndPosition
    ) {
        $fileChangedDuringScan = $true
    }
    $file.LastWriteTime = $currentFileInfo.LastWriteTime
    $file.LengthAfterScan = [long]$currentFileInfo.Length
    $file.ScanEndTime = $segmentLastEventTime
    $previousSegmentEndTime = $segmentLastEventTime
}

foreach ($turnUsage in $turnUsages.Values) {
    if ($turnUsage.StartBytes -lt 0) {
        $turnUsage.StartBytes = [long]0
    }
    if ($turnUsage.EndBytes -lt 0) {
        $turnUsage.EndBytes = $cumulativeBytes
    }
}

$completedTurnCount = @(
    $turnUsages.Values | Where-Object { $_.Status -eq 'completed' }
).Count
$abortedTurnCount = @(
    $turnUsages.Values | Where-Object { $_.Status -eq 'aborted' }
).Count
$unfinishedTurnCount = @(
    $turnUsages.Values | Where-Object { $_.Status -eq 'unfinished' }
).Count

$latestLength = [long](
    $files | Measure-Object -Property LengthAfterScan -Sum
).Sum
$latestLastWriteTime = (
    $files | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 1
).LastWriteTime
$sizeMiB = $latestLength / 1MB
$sizeText = Format-MiB $latestLength
$storageState = if ($segmentLocationWarnings -gt 0) {
    Get-UiText 'StorageMixed'
}
elseif ($primaryFile.StorageKind -eq 'archived') {
    Get-UiText 'StorageArchived'
}
else {
    Get-UiText 'StorageActive'
}
$segmentEndTime = (
    $files | Sort-Object -Property ScanEndTime -Descending | Select-Object -First 1
).ScanEndTime
$segmentTimeRangeText = '{0}{1}{2}' -f `
    (Format-EventTimestamp $primaryFile.SessionStart.ToString('o')), `
    (Get-UiText 'RangeSeparator'), `
    (Format-EventTimestamp $segmentEndTime.ToString('o'))

$contextTrend = Get-ContextTrend $contextState $turnUsages
$contextPercent = $contextTrend.Percent
$contextGrowth = $contextTrend.Growth
$roundsToObservation = $contextTrend.Rounds
$contextForecastPercent = $contextTrend.ForecastPercent
$assessmentVersion = 'handoff-score-v6-traditional'
$contextText = Get-UiText 'Unavailable'
if ($null -ne $contextPercent) {
    $contextText = $contextPercent.ToString('F1', [Globalization.CultureInfo]::InvariantCulture) + '%'
}
$growthText = Get-UiText 'Unavailable'
if ($null -ne $contextGrowth) {
    $growthText = $contextGrowth.ToString('F0', [Globalization.CultureInfo]::InvariantCulture)
}
$roundsText = Get-UiText 'Unavailable'
if ($null -ne $roundsToObservation) { $roundsText = [string]$roundsToObservation }
$trendBasis = Get-UiText 'TrendBasis' @($growthText, $roundsText, $contextTrend.Samples)
$inputTextCurrent = Get-UiText 'Unavailable'
$windowTextCurrent = Get-UiText 'Unavailable'
if ($null -ne $contextState.Request) { $inputTextCurrent = Format-Integer $contextState.Request.Input }
if ($null -ne $contextState.Current) {
    $windowTextCurrent = Format-Integer $contextState.Current.Window
}
$contextRaw = Get-UiText 'ContextRaw' @($inputTextCurrent, $windowTextCurrent, $contextText)

$maximumTurnIndex = if ($turnUsages.Count -gt 0) {
    [int]($turnUsages.Keys | Measure-Object -Maximum).Maximum
}
else {
    0
}
$startedTurnCount = $maximumTurnIndex

function Get-HandoffAssessmentScore {
    # Traditional historical-load heuristic. Context observations never change this score.
    param(
        [Parameter(Mandatory)][double]$SizeMiB,
        [Parameter(Mandatory)][int]$CompactCount
    )
    if ([double]::IsNaN($SizeMiB) -or [double]::IsInfinity($SizeMiB) -or $SizeMiB -lt 0 -or $CompactCount -lt 0) {
        return [pscustomobject]@{ SizeScore=$null; CompressionScore=$null; Basis='unavailable'; TotalScore=$null; Level='unknown' }
    }
    $sizeScore = 0
    foreach ($sizeStep in @(30, 50, 100, 200, 400)) {
        if ($SizeMiB -ge $sizeStep) { $sizeScore++ }
    }
    $compressionScore = 0
    foreach ($compactStep in @(4, 7, 10, 15, 20)) {
        if ($CompactCount -ge $compactStep) { $compressionScore++ }
    }
    $totalScore = $sizeScore + $compressionScore
    $level = 'continue'
    if ($totalScore -ge 8) { $level = 'required' }
    elseif ($totalScore -ge 3) { $level = 'recommended' }
    return [pscustomobject]@{
        SizeScore=$sizeScore; CompressionScore=$compressionScore
        Basis='traditional'; TotalScore=$totalScore; Level=$level
    }
}

$handoffScore = Get-HandoffAssessmentScore -SizeMiB $sizeMiB -CompactCount $compactCount
$sizeScore = $handoffScore.SizeScore
$compressionScore = $handoffScore.CompressionScore
$scoreBasis = $handoffScore.Basis
$totalScore = $handoffScore.TotalScore
$handoffLevel = $handoffScore.Level

if ($handoffLevel -eq 'unknown') {
    $levelText = Get-UiText 'LevelUnknown'
}
elseif ($handoffLevel -eq 'recommended') {
    $levelText = Get-UiText 'LevelRecommended'
}
elseif ($handoffLevel -eq 'required') {
    $levelText = Get-UiText 'LevelRequired'
}
else {
    $levelText = Get-UiText 'LevelContinue'
}

if ($null -eq $contextPercent) {
    $contextBasis = Get-UiText 'ContextUnavailableBasis'
}
elseif ($contextPercent -ge 95) {
    $contextBasis = Get-UiText 'ContextCriticalBasis' @($contextText)
}
elseif ($contextPercent -ge 85) {
    $contextBasis = Get-UiText 'ContextHighBasis' @($contextText)
}
else {
    $contextBasis = Get-UiText 'ContextNormalBasis' @($contextText)
}

$sizeBasis = Get-UiText 'SizeBasis' @($sizeText, $sizeScore)
$compressionBasis = Get-UiText 'CompressionBasis' @($compactCount, $compressionScore)
$scoreText = Get-UiText 'Unavailable'
if ($null -ne $totalScore) {
    $scoreText = [string]$totalScore
}

if ($handoffLevel -eq 'unknown') {
    $advice = Get-UiText 'AdviceUnknown'
}
elseif ($handoffLevel -eq 'recommended') {
    $advice = Get-UiText 'AdviceHandoff'
}
elseif ($handoffLevel -eq 'required') {
    $advice = Get-UiText 'AdviceRequired'
}
else {
    $advice = Get-UiText 'AdviceContinue'
}

$tokenRankings = @(
    $turnUsages.Values |
        Where-Object { $_.TotalTokens -gt 0 } |
        Sort-Object -Property `
            @{ Expression = { $_.TotalTokens }; Descending = $true }, `
            @{ Expression = { $_.TurnIndex }; Descending = $false } |
        Select-Object -First 3
)

$fileRankings = @(
    $categoryBytes.GetEnumerator() |
        Where-Object { $_.Value -gt 0 } |
        Sort-Object -Property `
            @{ Expression = { $_.Value }; Descending = $true }, `
            @{ Expression = { $_.Key }; Descending = $false } |
        Select-Object -First 3
)

$resolvedReportPath = Get-DetailedReportPath `
    -RequestedPath $ReportPath `
    -CurrentTaskId $taskId
if ([IO.Path]::GetExtension($resolvedReportPath) -ine '.md') {
    throw (Get-UiText 'ReportExtensionInvalid' @($resolvedReportPath))
}
if (@(
    $files | Where-Object {
        [string]::Equals(
            [IO.Path]::GetFullPath($resolvedReportPath),
            [IO.Path]::GetFullPath($_.FullName),
            [StringComparison]::OrdinalIgnoreCase
        )
    }
).Count -gt 0) {
    throw (Get-UiText 'ReportMatchesSession')
}
$pathSummary = if ($segmentCount -eq 1) {
    $primaryFile.FullName
}
else {
    $primaryFile.FullName + (
        Get-UiText 'AdditionalSegments' @(($segmentCount - 1))
    )
}
$reportBuilder = [Text.StringBuilder]::new()
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportTitle')
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportTaskId' @($taskId)
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportTaskName' @($taskName)
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportSegmentCount' @($segmentCount)
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportAggregateBytes' @(
        (Format-Integer $latestLength),
        $sizeText
    )
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportHandoffLine' @(
        $scoreText,
        $levelText,
        $sizeScore,
        $compressionScore
    )
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportHandoffContext' @($contextBasis)
)
Add-ReportLine -Builder $reportBuilder -Value $contextRaw
Add-ReportLine -Builder $reportBuilder -Value $trendBasis
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportTimeRange' @($segmentTimeRangeText)
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportPaths' @($pathSummary)
)
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportGeneratedAt' @(
        [DateTimeOffset]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz')
    )
)
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportEncoding')
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportPrivacy')
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ScoreMethodHeading')
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ScoreEquation' @(
    $sizeScore,
    $compressionScore,
    $scoreText))
foreach ($key in @('SizeThresholds','CompressionThresholds','ScoreThresholdTable','ScoreBoundaries','ScoreCalibration','TokenThresholdEvidence','PhaseGate','CostGate','CostEquation','CostLimit')) {
    Add-ReportLine -Builder $reportBuilder -Value (Get-UiText $key)
}
Add-ReportLine -Builder $reportBuilder -Value $sizeBasis
Add-ReportLine -Builder $reportBuilder -Value $compressionBasis
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'AdviceSummary' @($advice))
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportTokenHeading')
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (
    Get-UiText 'ReportTokenExplanation'
)
Add-ReportLine -Builder $reportBuilder

if ($tokenRankings.Count -gt 0 -and $tokenAdvanceCount -gt 0) {
    $rankNames = @($script:Ui['RankNames'])
    for ($index = 0; $index -lt $tokenRankings.Count; $index++) {
        $item = $tokenRankings[$index]
        $totalText = Format-TokenValue $item.TotalTokens
        $inputText = Format-TokenValue $item.InputTokens
        $cachedText = Format-TokenValue $item.CachedInputTokens
        $outputText = Format-TokenValue $item.OutputTokens
        $reasoningText = Format-TokenValue $item.ReasoningTokens
        $statusText = Get-StatusDisplayName $item.Status
        Add-ReportLine -Builder $reportBuilder -Value (
            Get-UiText 'ReportTurnHeading' @(
                $rankNames[$index],
                $item.TurnIndex,
                $statusText
            )
        )
        Add-ReportLine -Builder $reportBuilder
        Add-ReportLine -Builder $reportBuilder -Value (
            Get-UiText 'ReportTokenUsage' @(
                $totalText,
                $inputText,
                $cachedText,
                $outputText,
                $reasoningText
            )
        )

        $locatorParts = @()
        $timestamp = if (-not [string]::IsNullOrWhiteSpace($item.EndTimestamp)) {
            Format-EventTimestamp $item.EndTimestamp
        }
        else {
            Format-EventTimestamp $item.StartTimestamp
        }
        if (-not [string]::IsNullOrWhiteSpace($timestamp)) {
            $locatorParts += Get-UiText 'LocatorEventTime' @($timestamp)
        }
        if (-not [string]::IsNullOrWhiteSpace($item.TurnId)) {
            $suffixStart = [Math]::Max(0, $item.TurnId.Length - 8)
            $locatorParts += Get-UiText 'LocatorTurnSuffix' @(
                $item.TurnId.Substring($suffixStart)
            )
        }
        $turnFileBytes = [Math]::Max(
            0,
            [long]$item.EndBytes - [long]$item.StartBytes
        )
        $locatorParts += Get-UiText 'LocatorGrowth' @(
            (Format-MiB $turnFileBytes)
        )
        $locatorSeparator = if ($Language -eq 'en-US') { '; ' } else { '；' }
        Add-ReportLine -Builder $reportBuilder -Value (
            Get-UiText 'ReportLocator' @(($locatorParts -join $locatorSeparator))
        )
        Add-ReportLine -Builder $reportBuilder
        Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportUserInput')
        Add-ReportLine -Builder $reportBuilder
        if (-not [string]::IsNullOrWhiteSpace($item.UserInput)) {
            $fence = Get-MarkdownFence $item.UserInput
            Add-ReportLine -Builder $reportBuilder -Value $fence
            [void]$reportBuilder.Append($item.UserInput)
            if (
                -not $item.UserInput.EndsWith("`n") -and
                -not $item.UserInput.EndsWith("`r")
            ) {
                [void]$reportBuilder.Append([Environment]::NewLine)
            }
            Add-ReportLine -Builder $reportBuilder -Value $fence
        }
        else {
            Add-ReportLine -Builder $reportBuilder -Value (
                Get-UiText 'ReportUserInputMissing'
            )
        }
        Add-ReportLine -Builder $reportBuilder
    }
}
else {
    Add-ReportLine -Builder $reportBuilder -Value (
        Get-UiText 'ReportTokenUnavailable'
    )
    Add-ReportLine -Builder $reportBuilder
}

Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportFileHeading')
Add-ReportLine -Builder $reportBuilder
Add-ReportLine -Builder $reportBuilder -Value (Get-UiText 'ReportFileExplanation')
Add-ReportLine -Builder $reportBuilder
if ($fileRankings.Count -gt 0 -and $scanEndPosition -gt 0) {
    $rankNames = @($script:Ui['RankNames'])
    for ($index = 0; $index -lt $fileRankings.Count; $index++) {
        $item = $fileRankings[$index]
        $percentage = [Math]::Round(
            100 * [double]$item.Value / [double]$scanEndPosition,
            1
        ).ToString('F1', [Globalization.CultureInfo]::InvariantCulture)
        $recordCount = if ($categoryRecords.ContainsKey($item.Key)) {
            $categoryRecords[$item.Key]
        }
        else {
            0
        }
        $byteText = Format-ByteSize $item.Value
        $categoryText = Get-CategoryDisplayName $item.Key
        Add-ReportLine -Builder $reportBuilder -Value (
            Get-UiText 'ReportFileRank' @(
                $rankNames[$index],
                $categoryText,
                $byteText,
                $percentage,
                $recordCount
            )
        )
        Add-ReportLine -Builder $reportBuilder
    }
}
else {
    Add-ReportLine -Builder $reportBuilder -Value (
        Get-UiText 'ReportFileUnavailable'
    )
}

$reportText = $reportBuilder.ToString()
$resolvedReportPath = Write-Utf8BomFileAtomic `
    -Path $resolvedReportPath `
    -Content $reportText

Get-UiText 'SectionBasic'
Format-StatusLine (Get-UiText 'LabelTaskId') $taskId
Format-StatusLine (Get-UiText 'LabelTaskName') $taskName
Format-StatusLine (Get-UiText 'LabelStorage') $storageState
Format-StatusLine (Get-UiText 'LabelSegmentCount') (
    Get-UiText 'ValueSegmentCount' @($segmentCount)
)
Format-StatusLine (Get-UiText 'LabelAggregateBytes') (
    Get-UiText 'ValueAggregateBytes' @(
        (Format-Integer $latestLength),
        $sizeText
    )
)
Format-StatusLine (Get-UiText 'LabelTimeRange') $segmentTimeRangeText
Format-StatusLine (Get-UiText 'LabelPath') $pathSummary
Format-StatusLine (Get-UiText 'LabelLastModified') (
    $latestLastWriteTime.ToString('yyyy-MM-dd HH:mm:ss zzz')
)
Format-StatusLine (Get-UiText 'LabelContext') $contextText
''
Get-UiText 'SectionResources'
Format-StatusLine (Get-UiText 'LabelCompactions') (
    Get-UiText 'ValueCompactions' @($compactCount)
)
Format-StatusLine (Get-UiText 'LabelTurnStats') (
    Get-UiText 'ValueTurnStats' @(
        $completedTurnCount,
        $abortedTurnCount,
        $unfinishedTurnCount
    )
)
Format-StatusLine (Get-UiText 'LabelTurnDetection') (
    Get-UiText 'ValueTurnDetection' @(
        $turnContextRecordCount,
        $duplicateTurnContextCount,
        $startedTurnCount
    )
)

for ($milestone = 5; $milestone -lt $startedTurnCount; $milestone += 5) {
    $milestoneLabel = Get-UiText 'LabelMilestone' @($milestone)
    if ($turnEndSizeByIndex.ContainsKey($milestone)) {
        $milestoneText = Format-MiB $turnEndSizeByIndex[$milestone]
    }
    else {
        $milestoneText = Get-UiText 'MilestoneUnavailable'
    }
    Format-StatusLine $milestoneLabel $milestoneText
}

if ($startedTurnCount -gt 0) {
    $latestTurnStatus = if ($turnUsages.ContainsKey($startedTurnCount)) {
        Get-StatusDisplayName $turnUsages[$startedTurnCount].Status
    }
    else {
        Get-UiText 'StatusUnknown'
    }
    Format-StatusLine (Get-UiText 'LabelLatestTurn') (
        Get-UiText 'ValueLatestTurn' @(
            $startedTurnCount,
            $latestTurnStatus,
            $sizeText
        )
    )
}
else {
    Format-StatusLine (Get-UiText 'LabelLatestTurn') (
        Get-UiText 'ValueNoTurns' @($sizeText)
    )
}
Format-StatusLine (Get-UiText 'LabelReport') $resolvedReportPath

''
Get-UiText 'SectionAdvice'
Get-UiText 'ScoreSummary' @($scoreText)
Get-UiText 'AdviceSummary' @($advice)
''
Get-UiText 'BasisHeading'
"  1. $sizeBasis"
"  2. $compressionBasis"
Get-UiText 'ScoreEquation' @($sizeScore, $compressionScore, $scoreText)
foreach ($key in @('SizeThresholds','CompressionThresholds','ScoreThresholdTable','ScoreBoundaries','ScoreCalibration','TokenThresholdEvidence','PhaseGate','CostGate','CostEquation','CostLimit')) { Get-UiText $key }
''
Get-UiText 'ContextReminderHeading'
"  - $contextBasis"
$contextRaw
$trendBasis
''
Get-UiText 'HumanReminderHeading'
Get-UiText 'HumanReminder'

if (
    $parseWarnings -gt 0 -or
    $tokenResetWarnings -gt 0 -or
    $tokenBaselineWarnings -gt 0 -or
    $offsetWarnings -gt 0 -or
    $duplicateTurnContextCount -gt 0 -or
    $segmentMetadataParseWarnings -gt 0 -or
    $excludedCandidateCount -gt 0 -or
    $segmentVersionWarnings -gt 0 -or
    $segmentFormatWarnings -gt 0 -or
    $segmentLocationWarnings -gt 0 -or
    $segmentTimeWarnings -gt 0 -or
    $segmentIncompleteMetadataWarnings -gt 0 -or
    $taskNameIndexWarnings -gt 0 -or
    -not $taskNameInfo.IndexFound -or
    $fileChangedDuringScan
) {
    ''
    Get-UiText 'ScanWarningsHeading'
    if ($parseWarnings -gt 0) {
        Get-UiText 'WarningParse' @($parseWarnings)
    }
    if ($tokenResetWarnings -gt 0) {
        Get-UiText 'WarningTokenReset' @($tokenResetWarnings)
    }
    if ($tokenBaselineWarnings -gt 0) {
        Get-UiText 'WarningTokenBaseline' @($tokenBaselineWarnings)
    }
    if ($offsetWarnings -gt 0) {
        Get-UiText 'WarningOffset'
    }
    if ($duplicateTurnContextCount -gt 0) {
        Get-UiText 'WarningDuplicateContext' @(
            $duplicateTurnContextCount,
            $startedTurnCount
        )
    }
    if ($segmentMetadataParseWarnings -gt 0) {
        Get-UiText 'WarningMetadataParse' @($segmentMetadataParseWarnings)
    }
    if ($excludedCandidateCount -gt 0) {
        Get-UiText 'WarningCandidateExcluded' @($excludedCandidateCount)
    }
    if ($segmentVersionWarnings -gt 0) {
        Get-UiText 'WarningVersion'
    }
    if ($segmentFormatWarnings -gt 0) {
        Get-UiText 'WarningFormat'
    }
    if ($segmentLocationWarnings -gt 0) {
        Get-UiText 'WarningLocation'
    }
    if ($segmentTimeWarnings -gt 0) {
        Get-UiText 'WarningTime'
    }
    if ($segmentIncompleteMetadataWarnings -gt 0) {
        Get-UiText 'WarningIncompleteMetadata' @(
            $segmentIncompleteMetadataWarnings
        )
    }
    if ($taskNameIndexWarnings -gt 0) {
        Get-UiText 'WarningTaskNameParse' @($taskNameIndexWarnings)
    }
    if (-not $taskNameInfo.IndexFound) {
        Get-UiText 'WarningTaskNameMissing'
    }
    if ($fileChangedDuringScan) {
        Get-UiText 'WarningFileChanged'
    }
}

''
