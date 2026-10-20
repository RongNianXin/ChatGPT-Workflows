import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureRuleRefresh } from './Inspect-RuleRefresh.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = path.join(root, '总指挥工作流', '第二代总指挥的工作模式');
// Existing prose contracts check visible wording; the dedicated reference check
// separately validates these hidden semantic bindings and history boundaries.
const read = name => fs.readFileSync(path.join(workflow, name), 'utf8')
  .replace(/<!-- SCENARIO_(?:REFS:[^\n]*|HISTORY:(?:BEGIN|END)) -->/g, '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const schema = JSON.parse(fs.readFileSync(path.join(workflow, 'templates', 'HANDOFF_STATE.schema.json'), 'utf8'));
const REFRESH_REQUIRED_RULES = [
  '.github/scripts/HandoffWorkspaceScope.mjs',
  '.github/scripts/HandoffSeal.mjs',
  '.github/scripts/Prepare-Handoff.mjs',
  '.github/scripts/Mark-Handoff-Delivered.mjs',
  '.github/scripts/Inspect-RuleRefresh.mjs',
  '.github/scripts/Inspect-QuotaProtection.mjs',
  '.github/scripts/Inspect-PrReviewPayload.mjs',
  '.github/scripts/Inspect-WorktreeLifecycle.mjs',
  '.github/scripts/Test-OperatorManualReferences.mjs',
  'templates/OPERATOR_MANUAL_REFERENCES.json',
  ...Array.from({ length: 12 }, (_, index) => `${String(index).padStart(2, '0')}-`),
  '总指挥轻量交接启动配置.md',
  '规则刷新广播包.md',
  '规则刷新接收回执模板.md',
  'docs/EXECUTION_AND_INDEPENDENT_REVIEW.md',
  'docs/CROSS_SOFTWARE_COLLABORATION.md',
  '引用的外部工具/外部工具目录.md',
  '引用的外部工具/外部工具自动对接规范.md'
];
const reaRoot = path.join(root, '引用的外部工具', 'rea');
const reaReadme = fs.readFileSync(path.join(reaRoot, 'README.md'), 'utf8');
const reaGuide = fs.readFileSync(path.join(reaRoot, '调用指南.md'), 'utf8');
const reaMaintenance = fs.readFileSync(path.join(reaRoot, '安装与维护记录.md'), 'utf8');
const toolRegistry = fs.readFileSync(path.join(root, '引用的外部工具', '外部工具目录.md'), 'utf8');
const activeToolDirectory = toolRegistry.match(/<!-- TOOL_DIRECTORY:BEGIN -->([\s\S]*?)<!-- TOOL_DIRECTORY:END -->/)?.[1];
if (!activeToolDirectory || /EXT-004|\bREA\b|rea-agents|morluto\/rea|rea\//i.test(activeToolDirectory)) {
  throw new Error('REA is retired and must not appear in the active tool directory');
}
for (const name of ['README.md', 'README.en.md']) {
  if (/\bREA\b|rea\/README/i.test(fs.readFileSync(path.join(root, name), 'utf8'))) {
    throw new Error('Retired REA must not remain a homepage recommendation');
  }
}
const checks = [
  ['workflow feedback preserves the main task and gives a scoped change decision', read('02-总指挥核心规则.md'), ['先回应新增内容，再沿仍有效的主线继续', '主线目标、实际结果、未完断点及下一行动方和推荐动作', '是否需要修改工作流、判断依据是什么、修改后会有什么影响', '不另造模板或推定新增实施、通信与其他项目权限']],
  ['handoff planning shares locked admission without reviving stopped writers', `${read('04-状态、目标变更与交接规范.md')}\n${read('01-操作者操作手册.md')}`, ['planSealAppend', '原有双锁内重新核验', '预检不创建目录、锁、证明或附件', 'CURRENT_ATTESTATION_REQUIRED', '不要求我为正常内部准备重复说', '旧写者已停止时', '不要求即时续签封条']],
  ['business on-demand adapter loading does not skip formal refresh text', read('docs/CROSS_SOFTWARE_COLLABORATION.md'), ['普通业务只在命中跨软件协作时加载本文', '0A/0B 规则刷新、规则维护及明确全文审计', '不因“业务按需”跳过必读正文']],
  ['cross-software collaboration is an on-demand adapter, not a new scenario', `${read('00-第二代工作流总览.md')}\n${read('docs/CROSS_SOFTWARE_COLLABORATION.md')}`, ['按需加载', '不新增编号场景', '实际接入与测试由使用它的项目总指挥', '不触发 1C/1D 或世代轮换', '不另建中央账本']],
  ['external creation and roundtrip gates preserve native same-app behavior', `${read('04-状态、目标变更与交接规范.md')}\n${read('docs/EXECUTION_AND_INDEPENDENT_REVIEW.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['原生消息握手规则适用于同应用独立任务', '创建、实例登记及往返确认', '下文 `create_thread` 创建要求针对同应用独立窗口', '未指定外部协作时保持原流程', '不因原生失败自动改走外部路径']],
  ['external collaboration binds authority, rules and actual transport', read('docs/CROSS_SOFTWARE_COLLABORATION.md'), ['操作者指定的对象与回交渠道须可核对', '均不是身份证明或授权', '不能假设软件自动加载 `AGENTS.md`', '文本转交成功不能代签文件可用', '不登记原生主动通信成功', 'worktree 不是安全沙箱', '不能继承总指挥或旧实例的“已读”']],
  ['external delivery guards staleness, duplicate effects and stopped writers', read('docs/CROSS_SOFTWARE_COLLABORATION.md'), ['已交付内容不原地修改', '重复收到同一任务/轮次', '旧轮次、错对象、基线漂移、半写文件', '不凭超时认定失败或重新派发冲突写入', '写入及相关后台作业已停止', '普通 ACK、成果已就绪、关闭主界面都不够', '文件更新不会自动唤醒', '不因换软件或轮次清零']],
  ['project trials and deidentified feedback do not confer public maintenance authority', `${read('docs/CROSS_SOFTWARE_COLLABORATION.md')}\n${read('09-自动化授权与风险分级.md')}\n${read('01-操作者操作手册.md')}`, ['不自动授权任何未来测试', '操作者报告/直接观察/推断分别标明', '不接管来源项目', '不继承同应用回复预授权', '准备最小接入方案', '公共规则更新后仍由项目总指挥加载、核验和继续测试']],
  ['REA retirement preserves identity without an active candidate', `${toolRegistry}\n${reaReadme}`, ['EXT-004', 'Reverse Engineer Anything', 'morluto/rea', 'rea-agents', 'RETIRED', '编号不复用', '历史记录不构成重新启用授权']],
  ['old REA invocation links stop use without blocking independent work', reaGuide, ['RETIRED', '不得推荐、安装、注册 MCP/Skill 或调用 REA', '不能用旧提示词、旧授权或目录存在恢复使用', '不依赖 REA 的已授权任务继续', '不得声称已运行 REA']],
  ['REA retirement is not an uninstall or a safety guarantee', reaReadme, ['不等于已卸载', '不保证账号不受限制', '不代表其他窗口已经更新', '另行评审和明确授权']],
  ['REA retirement records distinguish evidence and attribution', reaMaintenance, ['风险偏好', '未取得官方个案归因', '没有安装、注册或调用', '不证明全机从未安装', '不删除历史', '不修改登录、代理或其他项目配置']],
  ['tool discovery accepts goals without requiring an explicit tool name', `${fs.readFileSync(path.join(root, '引用的外部工具', 'README.md'), 'utf8')}\n${toolRegistry}`, ['按工具名称或任务目标识别候选后', '不以发现候选代替安装、权限或实际调用核验', 'agency%20agents/README.md']],
  ['tool directory is a shared goal-first summary rather than a second manual', toolRegistry, ['# 外部工具通讯录', '人和 AI 共用', '用途标签', '适用场景 / 基本用法', '登记快照', '只读选中工具的 README', '不另建第二份名单', '没有对口项时', '具体技能主动调用限制优先']],
  ['tool overview routes to the unique list without duplicating tools', fs.readFileSync(path.join(root, '引用的外部工具', 'README.md'), 'utf8'), ['先看[外部工具通讯录]', '人和 AI 共用这一份名单', '本导览不重复列举工具', '资源随用随取', '缺少安装等权限时只暂停依赖动作']],
  ['on-demand acquisition preserves runnable dependencies and existing boundaries', fs.readFileSync(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'), 'utf8'), ['轻量通讯录与随用随取', '不先逐个翻阅所有工具', '基础能力足够的简单任务', '普通按需调用不改变0A规则刷新或正式交接的必要读取范围', '最小可运行资源', '依赖要求完整包', '不直接落进公开文档子目录', '收益未实测不报告已节省', '仓库内实物须已忽略且未跟踪', '不能靠新增忽略规则放行已跟踪的软件包', '仓库外另核精确目标路径写入许可', '不要求命中本仓库 `.gitignore`']],
  ['new tools supply directory summaries and correct copied parent links', fs.readFileSync(path.join(root, '引用的外部工具', '外部工具接入模板.md'), 'utf8'), ['通讯录用途标签', '通讯录适用场景 / 基本用法', '../外部工具目录.md', '../外部工具自动对接规范.md', '不默认完整克隆、下载或安装']],
  ['generic external-tool wording resolves the directory, not an arbitrary tool', `${toolRegistry}\n${fs.readFileSync(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'), 'utf8')}`, ['“外部工具”“工具通讯录”“外部工具通讯录”“外部工具目录”', '不指定某个具体工具', '不要求补全名称', '仅要求查看或讨论时只做选择与说明', '不因泛称获得执行、安装或配置权限']],
  ['goal-only tasks select tools without forcing repeated reading or new permissions', fs.readFileSync(path.join(root, '引用的外部工具', '外部工具自动对接规范.md'), 'utf8'), ['完全未提工具名时仍走第1.1节', '不以操作者提醒作为启动条件', '未提工具名时仍按目标判断', '确需外部增强时查简短通讯录，不等待提醒', '当前目标满足具体工具的有效触发依据、能力适配且所需权限齐备时，实际读取并使用', '同任务优先复用有效选择与已读证据', '明确要求主动调用的工具仍须相应请求', '不创建后台检索进程', '真实窗口行为、读取成本及质量收益需另有观察证据']],
  ['operator entry removes the second-command requirement without claiming universal adoption', fs.readFileSync(path.join(root, '引用的外部工具', 'README.md'), 'utf8'), ['只记得“外部工具”也可以', '完全不提工具名', '不要求操作者再发一次调用指令', '尚未加载新版的窗口不保证自动采用']],
  ['copy delivery is bound to the checked edition without mandatory per-answer storage', read('docs/DOCUMENT_REVIEW_STANDARD.md'), ['可回读的检查版', '聊天复制块直接取自该版', '采用待确认', '普通短答不强制逐条落盘或计算哈希', '远端写入仍分别核权']],
  ['language and TeX checks retain their actual acceptance limits', read('docs/DOCUMENT_REVIEW_STANDARD.md'), ['最终实际交付文本', '专业词和误报需人工复核', '目标引擎、模板、编码和章节结构', '编译成功均不等于文字无错', '不把合法 Unicode 一律判错']],
  ['missing origins do not prove attribution', read('docs/DOCUMENT_REVIEW_STANDARD.md'), ['其他文件无错不能证明聊天必然有错', '不能据此确定操作者或 AI 的责任', '只报告已核范围和待确认项', '不把推断或自责当作原因证据']],
  ['shared document validation follows effective write scope and concurrency', `${read('docs/DOCUMENT_REVIEW_STANDARD.md')}\n${read('02-总指挥核心规则.md')}`, ['实际写入边界、协作并发风险和拟声明范围', '整个实际写入范围', '写前重核目标最新内容或版本', '不声称已消除并发风险', '文件数量相同不能证明其他内容未变', '不盲目回滚他人新内容']],
  ['0A separates full integrity and rule reading from unused implementation text', read('10-自动状态索引规范.md'), ['RULE_TEXT_AND_IMPLEMENTATION_ON_DEMAND_V1', '全部文件仍核可读性', 'TEXT_DEFERRED', '安全依赖', '旧完整模式继续有效', '不得把延后阅读写成“源码已读”']],
  ['refresh and operator entries share the layered contract', read('01-操作者操作手册.md') + read('规则刷新广播包.md'), ['RULE_TEXT_AND_IMPLEMENTATION_ON_DEMAND_V1', 'TEXT_DEFERRED', '全部清单条目仍核摘要及稳定性', '分段补读与停止条件不变']],
  ['takeover recovery retains private storage and versioned exact write scope', read('04-状态、目标变更与交接规范.md'), ['同一只读存储检查', 'workspace_projection.version=2', 'workspace_projection_sha256', '恢复拒绝日志证据篡改、删除或无锚点投影', '只采用无投影的旧严格算法', '不得降级删字段', '不提供任意跳检/排除参数', '公共工具维护完成不表示来源项目迁移完成']],
  ['handoff failure report separates readiness and completion reminder', read('总指挥轻量交接启动配置.md'), ['材料已就绪但登记未完成', '才显示完成后的派新任务提醒', '操作、目的、预期结果与失败时最小证据', '不称来源损坏']],
  ['1C distinguishes unread identity from verified non-commander identity', read('01-操作者操作手册.md'), ['已核验为普通或专项任务', '工具启动失败、来源暂时不可读', '暂时无法核验总指挥身份', '不把核验未完成写成身份不符', '不据此改用 1E/1F']],
  ['stage closeout reconciles central facts without transferring identity', read('10-自动状态索引规范.md'), ['### 阶段收口状态核账', '工作项主记录落盘不等于中央登记已更新', '中央工作项清单 → 当前进度视图 → 状态索引', '本轮已采用规则版本和指纹', '阶段成果与验证边界', '身份依据有效性与业务状态新鲜度分别核验', '只暂停依赖缺口的动作', '已冻结候选来源不得回写']],
  ['PR decision separates evidence, pending work and merge eligibility', read('docs/PR_SUBMISSION_AND_REVIEW_STANDARD.md'), ['“尚未批准”不等于“要求修改”', '可以附非阻断建议', 'CI 仅排队、其他审阅者批准待齐', '不以缩小范围规避必要审查', '审阅者暂时读不到不等于作者没有提供', '不要求先发生真实安全事故或数据丢失', '缺远端授权只保留正确结论的本地草稿']],
  ['PR formal state changes are not body edits or comments', read('docs/PR_SUBMISSION_AND_REVIEW_STANDARD.md'), ['复审仍绑定当前 Head', '作者声称已修复或线程被标为 resolved，不能代替验证', '编辑 Review 正文或补发 `Comment` 不等于改变已有 `Request changes` 的状态', '不是平台状态计算公式', '修复后实质复审及正式结论变化按7.1处理']],
  ['PR prompt uses canonical decision boundaries', read('01-操作者操作手册.md'), ['审阅认可不等于整个 PR 已可合并', '影响本次判断的必要验证缺失时不能提前批准', '可附非阻断建议', '编辑正文或补发 Comment 不能代替正式审阅状态变化', '缺远端权限时只保留本地草稿']],
  ['PR delivery counts reader entries, not only API calls', read('docs/PR_SUBMISSION_AND_REVIEW_STANDARD.md'), ['一次 API 调用或一个 Review event 不等于一个阅读入口', '默认一条完整正文', '默认 `comments` 为空', '例外必须有实际需要', '不能用“一条正文”禁止有效复审', 'Inspect-PrReviewPayload.mjs', '不验证完整 GitHub API schema', '不能重跑包含发布的整段脚本', '不为减少数量抹去他人记录']],
  ['PR prompt previews delivery shape before authorization', read('01-操作者操作手册.md'), ['本轮全部意见默认汇入一条完整正文', '总评及额外评论/线程回复的数量、用途和理由', '不能把“一次 Review”当作只有一条阅读入口', '不得为减少条数删除他人讨论']],
  ['PR permission entry binds delivery to the canonical standard', read('09-自动化授权与风险分级.md'), ['PR标准7.2', '例外依据和最终载荷一起确认', '只恢复回读', '不产生远端授权']],
  ['state upgrades require migration and real project evidence', read('06-复盘与优化规则.md'), ['旧状态识别', '责任与权限', '旧状态兼容验证', '当前项目迁移', '真实使用预检', 'preflight_only', '不能替代', 'SUPERSEDED']],
  ['missing fields do not manufacture authority or weaken migration gates', read('项目配置迁移清单.md'), ['格式缺项不等于身份冲突', '新注释不能反过来自证身份', '冻结或生成新候选之前', '多文件迁移中断不得宣布完成', '不由规则维护者批量回写']],
  ['handoff entry executes scoped migration and actual preflight', read('01-操作者操作手册.md'), ['在冻结候选前自动最小补齐并回读', '不重复询问已获授权', '当前真实项目的完整 `preflight_only` 预检']],
  ['matrix separates logical and machine phases', read('交接阶段矩阵.md'), ['逻辑交接阶段', '封条阶段', '附件交付状态', '候选核验状态']],
  ['broadcast is load-only and self-describing', read('规则刷新广播包.md'), ['规则广播只做一件事', '规则更新指令 + 第二代规则路径', '不需要手工填写 `RULE_REFRESH_ID`', '项目问题另列待办', '规则根向上两级得到的仓库根', '以 `.github/` 开头']],
  ['broadcast limits failure to rule-root faults', read('规则刷新广播包.md'), ['路径不可访问', '必需文件缺失', '哈希不一致', '更高优先级规则冲突', '不得触发 `WARN/BLOCKED`']],
  ['ordinary refresh reads saved local text while pinned verification stays strict', read('规则刷新广播包.md'), ['普通本地刷新（默认）', '旧预期指纹或版本标签待同步', '不单独否决普通刷新', '精确版本核验', '不自动降为本地正文模式', '立即取消本批']],
  ['refresh separates bytes, reading and adoption', read('规则刷新广播包.md'), ['必要正文实际呈现', '补读' , '分段范围', 'text_reading=COMPLETE', '单次输出的截断只表示本段需要继续读取', '不能替代正文理解', '任一必需条目核验失败', '不得以“其余文件已读”宣称刷新完成', '外部工具目录与统一自动对接规范也是必需条目']],
  ['manual bootstrap carries saved local adoption and the dual-root rule', read('01-操作者操作手册.md'), ['请完整读取并采用规则目录中已保存的最新本地正文', '规则加载、项目接入、身份确认和控制面写入分开处理', '以 `.github/` 开头的文件，按规则根向上两级得到的仓库根读取', '不要猜测身份、授权或任务清单', '不执行远端写入']],
  ['receipt is minimal pass or fail', read('规则刷新接收回执模板.md'), ['正常成功给操作者按下面五项回复', '1. 执行结果：成功', 'RULE_SOURCE_LOCATOR：SOURCE_NOT_LOCATED / STALE_SOURCE_UNCONFIRMED / INPUT_REQUIRED', 'RULE_REFRESH：PASS/FAIL', 'PROJECT_ENROLLMENT：ENROLLED/NOT_ENROLLED/UNKNOWN', 'IDENTITY_CONTROL_PLANE：VERIFIED/NOT_REQUESTED/UNKNOWN', '规则加载结果不使用 `WARN/BLOCKED`']],
  ['project migration is independent', read('项目配置迁移清单.md'), ['不再随规则广播自动执行', '本清单存在缺口也不得降低规则加载结果']],
  ['project state cannot block rule loading', read('09-自动化授权与风险分级.md'), ['规则刷新是纯规则加载事件', '规则加载只允许两种最终结果：`PASS` 或 `FAIL`', '不得产生 `WARN/BLOCKED`']],
  ['affirmative reply binds the latest unique plan', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['最近唯一、范围明确且可恢复的执行方案', '我同意你的做法', '不因缺少固定授权句式', '不得要求操作者改用固定授权口令']],
  ['affirmative authorization preserves scoped gates', read('09-自动化授权与风险分级.md'), ['多个方案或母任务', '肯定只针对判断而非执行', '方案外后来新增的动作', '可以作为这次最终确认', '分次或双重确认', '其他独立且已授权的工作继续推进']],
  ['complexity budget replaces patch accumulation', `${read('00-第二代工作流总览.md')}\n${read('06-复盘与优化规则.md')}`, ['默认复杂度预算不得增加', '先删除、替换或合并旧机制', '连续两次采用相近补丁仍未改善', '停止继续叠加']],
  ['navigation registers support docs', read('00-第二代工作流总览.md'), ['交接阶段矩阵.md', '规则刷新广播包.md', '项目配置迁移清单.md', '规则刷新接收回执模板.md']],
  ['state index separates logical phase from seal phase', read('10-自动状态索引规范.md'), ['逻辑交接阶段', '封条 `handoff_phase`', 'RECEIVED_VERIFIED']],
  ['schema v3 requires source root_ref', fs.readFileSync(path.join(workflow, 'templates', 'HANDOFF_STATE.schema.json'), 'utf8'), ['sourceV3', '"root_ref"']]
];
const handoffRefresh = read('04-状态、目标变更与交接规范.md').split('#### 已启用工作流的交接前规则刷新')[1]?.split('正式总指挥材料准备前')[0] || '';
checks.push(['handoff refresh is scoped to enrolled windows and authoritative current rules', handoffRefresh, ['项目已明确启用且当前窗口已接入', '场景1C或1E冻结候选、生成主快照前', '权威公共规则根', '不能只比较版本号', '未启用工作流的普通任务仍按原1E/1F续接']]);
checks.push(['inline refresh returns to handoff without importing permission or completion boundaries', handoffRefresh, ['同一轮次', '复用本实例实际完整读过且字节未变', '变化文件完整补读', '不复制0A提示词中的通信预授权', '不因0A的纯刷新收口而遗忘交接主线', '一次重读上限', '严格指纹']]);
checks.push(['transfer refresh preserves specialist write limits and independent receiver checks', handoffRefresh, ['1E只更新有权维护的本任务记录和主快照', '不代写中央CURRENT、身份或封条', '交付前再次核对规则截点', '1D/1F仍独立核验', '尚未加载新版的旧窗口不会自动获得此行为']]);
for (const anchor of ['scenario-commander-prepare', 'scenario-ordinary-handoff']) {
  const entry = read('01-操作者操作手册.md').split(`<a id="${anchor}"></a>`)[1]?.split('\n<a id=')[0] || '';
  checks.push([`${anchor} explicitly routes same-round refresh back to the original handoff`, entry, ['已启用工作流的交接前规则刷新', '本轮完成0A规则刷新', '不复制0A中的额外授权']]);
}
checks.push(['rule adoption timing separates supported urgent risk from broadcast authority', read('06-复盘与优化规则.md').split('### 规则更新的采用时机与紧急通知')[1]?.split('### 工作流改动与原有功能保留')[0] || '', ['具体旧规则缺陷', '继续使用旧版至下次交接的后果', '普通未验证项不单独构成紧急理由', '可等待交接时检查', '须立即通知受影响窗口', '不要求先发生真实损害', '通知紧迫性与发送权限分别核验', '不能把公共规则落盘当作所有窗口已更新']]);
checks.push(['one-time event outputs bind to their triggering round', `${read('02-总指挥核心规则.md')}\n${read('01-操作者操作手册.md')}`, ['一次性事件限定输出只在该轮生效', '只在触发事件实际发生的那一轮输出一次', '后续业务轮、维护轮、规则修改轮或上下文压缩恢复中', '该提醒只在触发正式完成的那一轮输出一次，后续业务轮、维护轮或上下文压缩不重复']]);
checks.push(['local-to-remote route keeps release separate', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['场景 4K：将本地最新成果同步到远端', '不必先决定是否提 PR', '同步源码不会自动生成下载页中的新 Release', '精确纳入/排除范围']]);
checks.push(['local-to-remote sync checks public entry freshness without adding publication permission', read('02-总指挥核心规则.md').split('### 场景 4K：本地最新成果同步到远端')[1]?.split('### ')[0] || '', ['每次同步都检查首页与展示入口是否需要刷新', '中英文 README、SHOWCASE', '不为每次 Push 机械改页', '未实施方案', '本条不产生下一次远端写入、素材公开或发布权限']]);
checks.push(['PR scope and local sync follow project rules', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['操作者不必先划定可验收范围', '个人项目可以建议直接 Push', '团队项目必须先遵守团队规则', '多个功能不自动合成一个 PR', '不能绕过隐私、验证和远端最终确认']]);
checks.push(['handoff identity conflict has migration split', read('项目配置迁移清单.md'), ['CONTROL_PLANE_MIGRATION_REQUIRED', 'CONTROL_IDENTITY_CONFLICT', '操作者称呼或确认本身不能替代', '不覆盖旧记录、不生成新封条']]);
checks.push(['platform thread failure freezes handoff writes', read('04-状态、目标变更与交接规范.md'), ['thread not found', '暂停控制面写入、封条追加和正式切换', '不能据此证明或否定', '重新读取状态索引']]);
checks.push(['empty cross-task output is an explicit failure', read('09-自动化授权与风险分级.md'), ['目标任务完成但最终文本为空', '不得写成 `RECEIVED`、`COMPLETED`', '非空的 `BLOCKED` 或 `FAILED`', '空输出不能作为成功回执']]);
checks.push(['operator-visible receipt precedes tools and blocks empty closeout', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['首个可见文本', '只能记为 `OUTPUT_UNVERIFIED/BLOCKED`', '暂停恢复原主线', '本地反馈不产生对外发送权限']]);
checks.push(['core rules carry the cross-project closeout hard gate', read('02-总指挥核心规则.md'), ['总指挥核心收口硬门', '无对外回执授权', '必须先向当前操作者输出非空的收件状态', '所有启用本工作流的项目均适用', '`AGENTS.md` 只能作为本项目附加护栏']]);
checks.push(['same-window authority reuse preserves source and permission boundaries', `${read('规则刷新广播包.md')}\n${read('01-操作者操作手册.md')}`, ['当前窗口已核验且仍有效的权威来源绑定', '可回源', '未被撤销、替换', '不要求操作者重复确认路径', '裸历史路径和其他窗口声明仍不可用']]);
checks.push(['refresh continuity preserves exact reading and real stop conditions', `${read('规则刷新广播包.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['真实停止条件触发后正文没读完', '下一位置', '正常分段', '不能替代正文理解', 'NOT_ATTESTED', '--offset 0 --length 2000', '规则来源故障仅指规则根本身', '必须注明停止原因，不得写成规则来源故障', '状态的缺口不否定纯规则加载']]);
checks.push(['refresh result belongs to its current event rather than old business', `${read('规则刷新接收回执模板.md')}\n${read('09-自动化授权与风险分级.md')}`, ['最终结果必须对应当前刷新事件', '旧业务答复', 'MESSAGE_ID', '待确认', '平台完成']]);
checks.push(['rule refresh separates source authority, adoption record and identity control', `${read('规则刷新广播包.md')}\n${read('规则刷新接收回执模板.md')}\n${read('09-自动化授权与风险分级.md')}`, ['规则来源选择门禁', 'RULE_SOURCE_LOCATOR', 'SOURCE_NOT_LOCATED', 'STALE_SOURCE_UNCONFIRMED', '规则采用记录', 'RULE_ADOPTION=PASS', 'PROJECT_REGISTRATION=SYNC_PENDING', '本次不需要额外处理', '自动原子更新', '不得修改总指挥、唯一写者、CURRENT']]);
checks.push(['rule drift has automatic rebase without operator version choice', `${read('规则刷新广播包.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['rule_baseline', 'RULE_REBASE_PENDING', 'SUPERSEDED_BY_RULE_REBASE', '不要求操作者选择版本', '只暂停受影响阶段', 'PINNED_CURRENT / RULE_REBASE_PENDING / REBASED / REBASE_BLOCKED']]);
checks.push(['feedback triages before costly 2C and repairs within scope', `${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['先描述现象；AI 定点核对后决定是否进入 2C', '最小定点核对后仍无法定位', '原因及修复边界已有可靠证据的，在现有授权内局部修复与回归', '已有同一问题的修复授权时直接修复与回归', '仅报结果且没有开放目标', '一次列明拟改范围、影响和验证以请求差额授权']]);
checks.push(['workflow entry points load triage before full diagnosis', `${read('00-第二代工作流总览.md')}\n${read('02-总指挥核心规则.md')}\n${read('docs/WORKFLOW_OVERVIEW.md')}`, ['先读 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 做最小分流', '先读取 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1 并完成最小定点核对', '2E 失败反馈先按 2.1 最小分流']]);
checks.push(['diagnosis keeps node-level evidence while reporting results first', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['逐项核对输入、处理、输出、不变量、观测证据和失败信号', '可证伪对照验证根因', '默认先报告复现和版本', '完整节点和证据留在工作项中供回查', '复杂分叉、证据争议']]);
checks.push(['diagnosis references resolve to the current section', `${read('02-总指挥核心规则.md')}\n${read('06-复盘与优化规则.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`, ['#21-2e-分流与-2c-连续执行', '<a id="21-2e-分流与-2c-连续执行"></a>']]);
checks.push(['bounded test scenario is distinct from feedback, diagnosis and legacy 2G', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['场景 2G：用真实数据做有界自动测试、修复和复测', '旧版精简提示词的“2G”按内容和规则版本映射到当前 2B', '2E 用于反馈你已经观察到的结果；2C 是原因不明时的逐节点查因方法', '收到当前版 2G 的真实数据有界测试请求时走 2G', '可终止本轮进程及其子进程', '不因重试、换卡或切换窗口重置', '质量标准无法直接核验、又无可靠真值或必要人工确认时']]);
checks.push(['cross-task receipt is an executable hard gate', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['两阶段首步', '首个可见文本', '首个工具动作', '回执先行硬门禁（事故回归）', '实际跨任务发送工具', '缺少真实发送证据的事件不得收口', '不得写成已回执']]);
checks.push(['receipt threshold explains content signals and inbound events', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['场景五/场景 5A–5D', '对抗式反馈', '希望征求建议', '希望帮忙分析', '需要回执', '通信授权', '入站事件']]);
checks.push(['delegated tool-result ingress is normalized and source-isolated', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['宿主转交载体解析硬门', 'functionCallOutput', '<codex_delegation>', '独立 `INBOUND_EVENT`', '不得从上一轮 Kaggle、Cargo', '不得输出符号', 'RECEIVED_LOCAL_PENDING', 'RECEIPT_RESULT_RECORDED', '来源错配']]);
checks.push(['cross-task completion separates local work from source confirmation', `${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('09-自动化授权与风险分级.md')}`, ['local_processing_status', 'source_delivery_status', 'SENT_PENDING_CONFIRMATION', 'RECEIVED_CONFIRMED', '不得把“状态=COMPLETED，等待对方确认”', '事件总状态才可为 `COMPLETED`']]);
checks.push(['in-app reply policy reuses direct user authorization within scope', read('09-自动化授权与风险分级.md'), ['同一应用内的来源回复预授权', '不再逐次询问', '其他使用者须有自己的授权依据', '发送方不能代授权限', '新来信或范围内的不同来源不自动使其失效', '恢复或换窗时回读核验']]);
checks.push(['in-app reply decision keeps opt-out, privacy and local feedback', read('09-自动化授权与风险分级.md'), ['未说明是否需要回执时，自主判断', '明示“无需回复”时不回', '纯确认、重复知悉且没有新问题时不启动互答', '不转发私聊全文', '无论已回复、决定不回、排队还是受阻', '只暂停发送和依赖回执的动作']]);
checks.push(['bootstrap grants scoped replies without proactively contacting tasks', `${read('01-操作者操作手册.md')}\n${read('10-自动状态索引规范.md')}`, ['同时授权你按09的同应用回复预授权', '无需逐次向我确认', '本条0A只登记该预授权', '直接授权依据', '通信政策与业务动作授权分开记录']]);
const sceneFiveReceipt = read('09-自动化授权与风险分级.md').split('14. **场景五请求必须闭环。**')[1]?.split('15. **回执先行硬门禁')[0] || '';
checks.push(['scene-five follow-ups respect opt-out and the agreed round limit', sceneFiveReceipt, ['明示“无需回复”优先于场景标签', '纯确认且未要求回复只登记并向操作者反馈', '到轮次上限或明确收口即停止本批互答', '到限仍有未决项不写通过', '单方完成审查不冒充对方确认']]);
checks.push(['cross-task workflow review routes separately from source business', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['公共工作流审查的正向分流', '按 FIFO 在取得处理时隙后完成最小只读核对', '只提取判断工作流缺陷所需的最小事实', '工作流部分继续处理，专项业务部分单独标记 `BLOCKED`', '没有回执要求时不强制向来源发送消息', '公共工作流审查与来源业务二分', '混合消息必须拆分处理']]);
checks.push(['Goal input boundary is explicit', read('01-操作者操作手册.md'), ['Goal 模板怎么用', '完整正文并提交', '不要重复粘贴', '一、最终目标：', '二、细节描述：', '三、素材提供：', '四、角色配置：', '五、操作许可：', '明确允许：', '明确禁止：', '未写明的普通低风险本地动作，不自动视为禁止，也不自动视为允许', '即使没有写“禁止”，也不得按“未禁止”执行', '六、默认规则约束（仅限 Goal 启动前由操作者决定是否删减', 'Goal 正式启动后，本栏约束保持不变', '不得自行删除、放宽或改写', '七、平台状态硬门：', '八、能力剖面：', '九、自动化验证：', '十、停止条件：', '十一、额度保护', '十二、执行要求：', 'Agency Agents', '不是 Goal 启动的前置条件', '审查意见按模板从“一、最终目标”到“十二、执行要求”的顺序输出', '原文10—20字短摘录', '动作（保留/删除/替换/新增）', '可复制替换文本', '影响', '验证方式', '不得为了凑齐清单虚构问题']]);
checks.push(['Goal closeout receipt separates cycle stop from completion', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['目标类型（由 Gen1.2 核对）', 'PLAN_ONLY / IMPLEMENT_AND_VERIFY / HYBRID', '每次停止后的固定回执', '本轮实际完成的目标与动作', '停止条件编号、具体原因及触发证据', '未完成/待确认事项、精确断点和下一行动方', '阶段性方案完成不等于最终 Goal 完成', '`CYCLE_STOPPED`、`PAUSE_REQUIRED`、`BLOCKED` 不等于取消或清除 Goal', '只有操作者明确取消或替换且平台实际回读已清除']]);
checks.push(['complex preflight groups known questions without expanding authorization', read('02-总指挥核心规则.md'), ['复杂指令的启动前预检与集中询问', '不为预检全仓扫描', '前两类自行解决', '没有必问项时直接按既有授权执行', '只询问差额并暂停受影响动作', '不能靠启动时概括同意替代', '不保证所有问题都能提前发现']]);
checks.push(['necessary questions include supported recommendations, not implied consent', read('09-自动化授权与风险分级.md'), ['名称末尾标注“（推荐）”', '不虚构最优解', '预选、跳过、未回复和超时都不构成授权', '不能用低风险分类绕过']]);
checks.push(['Goal review and execution both front-load necessary decisions', read('01-操作者操作手册.md'), ['② 启动预检与路线选择', '将当前可预见且必须由我回答的问题集中提前提出', '已有选择不因阶段变化重复询问', '执行中新发现的问题只询问新增差额']]);
checks.push(['Goal review distinguishes valid permissions, draft grants and substantive revisions', read('01-操作者操作手册.md'), ['不包含高资源运行授权', '不把草稿候选说成已经授权', '拟随正式正文授予的范围', '对照模板版本（无法核验时写待确认）', '实质改动', '没有特殊权限需求时不生成空授权卡']]);
checks.push(['bounded resource permission preserves scope, limits and project gates', read('09-自动化授权与风险分级.md'), ['本地高资源运行的有界授权与复用', '预计耗时', '并发/浏览器/模型实例上限', '累计时限上限', '准备事项', '终止方式', '直接确认后才生效', '新脚本仍须核验实际动作和资源风险', '已有明确单次授权不得扩大成整个 Goal 的长期许可', '项目规定每次高资源运行前另行确认时']]);
checks.push(['Goal resource permission reuse does not reset the resource budget', read('05-模型选择与资源策略.md'), ['准备稿和授权候选不自动生效', '已有范围未变且仍有效时不重复询问', '允许运行与剩余资源限额分别核验', '不以本周期8小时或总迭代预算替代高资源授权']]);
// These prose checks preserve the policy boundaries; they do not run a scheduler.
const resourcePolicy = read('05-模型选择与资源策略.md');
const resourceWait = resourcePolicy.split('### 6.6 资源不足时的推进与有限等待')[1] || '';
checks.push(['resource deferral preserves dependencies and existing side effects', resourceWait, ['尚未启动、无待确认既有副作用', '已授权、可回滚范围', '结果未知或可能已产生副作用时先核账', '权限、参数、依赖错误也不是等待内存的理由', '确实不依赖该重步骤且低开销', '立即轻量复查资源', '这次检查不占后续四次', '不把旧包冒充新包']]);
checks.push(['resource waiting has finite preferences and original budget gates', resourceWait, ['第15、30、45、60分钟最多复查4次', '等待偏好，不是科学资源阈值', '约60分钟窗口的绝对截止', '第四次仅在仍有效的窗口内', '原预算按原计时口径', '实际复查尝试开始即计数，失败不返还次数', '剩余预算须容纳运行、验证和清理', '取消后续复查']]);
checks.push(['resource recovery cannot reset waits or manufacture capability', resourceWait, ['不新建中央资源登记文件或平行账本', '不重置次数与截止、不叠加等待器', '不密集补打或从恢复时重排一小时', '超过原截止直接收口', '无法核验旧等待状态时保留未知，不新领四次', '不能自动复查', '不为等待新建跨回合自动化', '不写任务完成、永久取消或后台无限续期']]);
checks.push(['resource admission does not claim global exclusion or installed protection', resourcePolicy, ['没有统一执行入口时，不声称已实现全机互斥', '资源查询不启动浏览器、编译器或新 Agent', '提交余量按同次采样的提交上限减已提交量计算', '工作集是当前驻留物理内存的可分页页', '不把其他项目实验数值变成统一GB门槛', '不能保证严格互斥、预留或公平', '压力恶化或卡顿时停止新重步骤', '保护入口未实现或未验证时如实说明', '不是已验证的Windows本机调度算法']]);
checks.push(['resource wait entry preserves high-resource authorization', read('09-自动化授权与风险分级.md'), ['05-模型选择与资源策略.md#resource-wait', '等待许可不产生重操作权限', '不因查询次数增加运行尝试', '不恢复暂停、撤销或过期事项']]);
checks.push(['external tool scenario is operator-facing and path-addressable', read('01-操作者操作手册.md'), ['可选功能场景：外部工具调用', '### 外部工具总体接入规则', '[EXT-001：Agency Agents]', '### EXT-001：Agency Agents', '[EXT-002：CLI-Anything]', '### EXT-002：CLI-Anything', '它是做什么的：', '操作者入口：', '工具子目录的 `README.md` 是该工具唯一的操作者入口', 'agency agents/README.md', 'cli-anything/README.md', 'CLI-Hub', 'ChatGPT-Workflows/引用的外部工具/agency agents/README.md', 'ChatGPT-Workflows/引用的外部工具/cli-anything/README.md']]);
checks.push(['operator manual defines the natural-language update and path-check contract', read('01-操作者操作手册.md'), ['01 手册的场景编写与路径变更规范', '一个场景只解决一个操作者目标', '正文固定按四段写', '入口必须完整可寻址', '自然语言改手册的固定动作', '路径检查在三处触发']]);
checks.push(['scenario zero has only two entries and scoped commander broadcast', `${read('01-操作者操作手册.md')}\n${read('规则刷新广播包.md')}\n${read('09-自动化授权与风险分级.md')}`, ['场景 0A：统一接入与规则更新', '场景 0B：总指挥广播最新工作流', 'broadcast_scope', 'ALL', 'SELECTED', '逐目标', '强制接收', '不保证平台一定送达', '场景零只保留0A和0B']]);
checks.push(['scenario 0B operator prompt has selector and exclusions', read('01-操作者操作手册.md'), ['广播筛选对象：【任务名或ID', '广播排除对象：【任务名或ID', '允许混填', '所有活跃的总指挥', '最终广播对象 = 广播筛选对象 - 广播排除对象']]);
const manual = read('01-操作者操作手册.md');
const scene0A = manual.split('### 场景 0A：')[1]?.split('### 场景 0B：')[0] || '';
const scene0B = manual.split('### 场景 0B：')[1]?.split('<a id="scenario-lifecycle"></a>')[0] || '';
const scene0 = manual.split('## 场景零：')[1]?.split('<a id="scenario-lifecycle"></a>')[0] || '';
const zeroHeadings = [...scene0.matchAll(/^### (.+)$/gm)].map(match => match[1]);
if (zeroHeadings.length !== 2 || !zeroHeadings[0].startsWith('场景 0A：') || !zeroHeadings[1].startsWith('场景 0B：') || scene0.includes('兼容分支')) {
  throw new Error('scenario zero must contain only 0A and 0B, without legacy copy blocks');
}
for (const [text, fields] of [[scene0A, ['当前任务身份', '当前工作流路径']], [scene0B, ['广播筛选对象', '广播排除对象']]]) {
  const prompt = text.match(/```text\n([\s\S]*?)\n```/)?.[1] || '';
  const actual = [...prompt.matchAll(/^([^\n：]+)：【[^\n]*】$/gm)].map(match => match[1]);
  if (JSON.stringify(actual) !== JSON.stringify(fields)) throw new Error(`unexpected scene-zero operator fields: ${actual}`);
}
checks.push(['0A parameters preserve verified identity and source reuse', scene0A, ['身份已登记', '路径已登记', '新专项首次接入须填写规则实际路径', '总指挥应已通过1A', '未建立身份不能用本条升级', '不接受裸历史路径', '不把缺参说成来源损坏', '已接入的普通任务']]);
checks.push(['0A acts only on its direct receiver', scene0A, ['这条指令只针对当前正在与我对话的 AI', '无论你是总指挥、普通任务还是专项任务', '不需要我提供总指挥名字或任务 ID', '名字或 ID 只能用于核对，不能作为身份或写入授权', '不要替其他对话更新，也不要盘点其他对话、向它们广播或转达指令', '只暂停需要确认身份才能执行的动作，仍可完成普通规则刷新', 'RULE_SOURCE_STATUS', 'PROJECT_ADOPTION_RECORD', 'live_rule_epoch', '不要让我在版本之间选择']]);
checks.push(['0A keeps operator output human-first and bounded', `${scene0A}\n${read('规则刷新接收回执模板.md')}`, ['最终主答复按五项输出', '默认不向操作者展示 manifest 摘要', '逐文件哈希', '维护窗口', '完整技术字段写入既有加载记录', '项目登记无法安全同步时']]);
checks.push(['0A cannot close before required text is read', `${scene0A}\n${read('10-自动状态索引规范.md')}`, ['硬完成门', '同一回合继续按有界分段读取', '不得以“部分完成”“规则刷新未完成”或“请继续发送”收口', '可举证的终止条件', '尚未读完”不能单独作为阻断原因']]);
checks.push(['0A preserves only the active event cursor across compaction', read('规则刷新广播包.md'), ['rule_version', '不得用猜测的', 'version', 'reading_plan', '实际已呈现且未截断的范围', 'next_offset', '先核请求、事件、回合、终态和待交付', '有缺口继续读', '待执行步骤，不是全局阻断', '不能因残留游标倒退到旧0A']]);
checks.push(['compaction recovery binds the actual event before plans and output', read('02-总指挥核心规则.md'), ['恢复首动作先核实际入站事件', '不能只取最后一条直接用户原文', '仍有效的非终态计划', '待交付的只补原结果', '不能冒充新请求的主答复', '压缩不重置预算', '不以旧成功抹掉未完']]);
checks.push(['repository restore pointer triggers event recovery before cursor reuse', fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), ['压缩或恢复后，先按[02恢复入口]', '核活动事件、终态与待交付', '旧刷新成功不能代签当前请求']]);
checks.push(['refresh activity reuses the existing record and distinguishes turn rebinding from replay', read('10-自动状态索引规范.md'), ['rule_refresh_activity', '不新建平行账本', '当前取得的处理时隙', '不能从旧刷新记录反向编造', '合法跨回合续接', 'COMPLETED/CANCELLED/SUPERSEDED', '包括已收口的失败', '不是ACK', '不把已终态事件改回', 'REQUEST_RECOVERY=BLOCKED', 'activity_guard=NOT_REQUESTED', '其他读取路径不会被自动拦住']]);
checks.push(['refresh routing connects capture, reads and delivery to the real CLI', read('规则刷新广播包.md'), ['--activity-record', '--activity-operation capture', '--activity-operation deliver', '仅返回计划与摘要', '实际最终输出后才登记', '拒绝后不能删绑定参数绕过', '不自动退回兼容模式', '不代签授权或宿主拦截']]);
checks.push(['refresh bootstrap keeps record compatibility and memory recovery boundaries', read('10-自动状态索引规范.md'), ['RULE_REFRESH_ACTIVITY:BEGIN', 'RULE_REFRESH_ACTIVITY:END', '--activity-json', '同回合只读刷新', '内存不是耐久记录', '不重开已结束事件', '不清零累计次数']]);
checks.push(['0A handles its own progress instead of asking for internal format confirmation', read('01-操作者操作手册.md'), ['本回合临时进度继续只读刷新', '不要求我确认内部格式', '另建账本或修改中央状态']]);
checks.push(['bounded local metadata lookup remains a candidate with no messaging authority', read('09-自动化授权与风险分级.md'), ['Find-CodexThread.mjs', '任务列表未返回不等于不存在', 'name为显示名称', '平台read_thread', '获得通信授权', '不自动遍历其他状态文件']]);
const planCapture = captureRuleRefresh(workflow);
const isImplementation = ref => /\.(mjs|py)$/.test(ref);
const expectedPlan = Object.keys(planCapture.texts).filter(ref => !isImplementation(ref));
const actualPlan = planCapture.report.reading_plan;
if (actualPlan.length !== expectedPlan.length || expectedPlan.some(ref => {
  const item = actualPlan.find(row => row.path_ref === ref);
  return !item || item.total !== Array.from(planCapture.texts[ref]).length || item.offset_unit !== 'unicode_code_point';
}) || actualPlan.some(item => isImplementation(item.path_ref)) || planCapture.report.text_reading !== 'NOT_ATTESTED') {
  throw new Error('Rule reading plan must cover every required text without attesting Agent reading');
}
const expectedImplementations = Object.keys(planCapture.texts).filter(isImplementation).sort();
if (JSON.stringify([...planCapture.report.implementation_on_demand].sort()) !== JSON.stringify(expectedImplementations)) {
  throw new Error('Implementation integrity coverage must retain both JavaScript and Python sources');
}
checks.push(['0B is commander-only and operator-scope-bound', scene0B, ['只发给已核验的本项目现任总指挥', '可以只指定一个专项', '跨项目只允许本次规则通知', '不是或无法确认时停止转达', '由AI核对唯一对象', '未归档、未注销且仍有效', '每批最多5个', '没有对象时报告空名单并结束', '不先发再补排除', '每批收口后自动继续下一批']]);
checks.push(['0A requires source locator and task-id discovery evidence', `${scene0A}\n${read('10-自动状态索引规范.md')}`, ['本条指令明确路径 > 当前项目启用声明', 'RULE_SOURCE_LOCATOR', 'SOURCE_NOT_LOCATED', 'STALE_SOURCE_UNCONFIRMED', 'PLATFORM_TASK_ID_STATUS=UNAVAILABLE_AFTER_PROBES', '没有执行探针不得写“平台未暴露”']]);
checks.push(['dual-root resolution cannot report false missing files', read('规则刷新广播包.md'), ['repository_root_ref', '解析后的根（规则根或仓库根）', '禁止把仓库根条目直接拼到规则根后再报告缺失']]);
checks.push(['broadcast serializes refreshes and stops on rate limits or empty output', read('规则刷新广播包.md'), ['默认串行发送', '一次只保持一个规则刷新请求', '429', 'Too Many Requests', 'RATE_LIMITED', 'OUTPUT_UNVERIFIED', '停止新增发送和盲目重试']]);
checks.push(['broadcast resolution handles latest names, exclusions and incomplete coverage', read('规则刷新广播包.md'), ['中文或英文分号分隔', '平台最新任务名', '唯一任务 ID 去重和发送', '标题中的“总指挥”不证明角色', '列表分页未取全', '归档状态未知不得发送', '暂停所有可能命中该排除项的对象', '暂停整份受影响名单', '最终为空就报告空名单', '新出现的任务不自动加入', '更名导致自然语言筛选/排除或项目归属改变时重核']]);
checks.push(['broadcast batches are bounded, acknowledged and resumable', read('规则刷新广播包.md'), ['每批最多5个目标', '未收口批次至多一个', '并行在途请求总数也不得超过5个', '不向自己重复发消息', '本轮合格采用回执', '没有仍在执行的请求', '运行状态不可观察时不得假称批次结束', '不新增无限轮询', '有待确认不能宣称全体完成', '只处理仍为 `NOT_SENT` 且权限有效的对象', '不将旧成功回执计为新批成功']]);
const dispatchGuards = ['每个目标实际发送前，就近复核', '归档状态、有效性、权限、目标绑定及筛选/排除匹配', '状态未知只暂停受影响对象'];
checks.push(['each actual dispatch rechecks state after earlier targets waited', scene0B, dispatchGuards]);
checks.push(['broadcast counterexample forbids stale batch-start authorization', read('规则刷新广播包.md'), [...dispatchGuards, '等待前一目标回执期间，后一目标被归档或进入排除范围', '不能凭批次开始时的状态发送', '不因此开启后台监听或持续轮询']]);
// Mutation checks protect the written contract; they do not simulate live dispatch.
for (const text of [scene0B, read('规则刷新广播包.md')]) {
  for (const guard of dispatchGuards) {
    const mutated = text.replaceAll(guard, '');
    if (dispatchGuards.every(required => mutated.includes(required))) throw new Error(`missing dispatch guard was not detected: ${guard}`);
  }
}
checks.push(['identity reference does not confer authority or require manual IDs', read('10-自动状态索引规范.md'), ['接收本条指令的对话', '中央登记的现任总指挥', '原/旧对话', '平台任务ID、逻辑 `writer_id`、总指挥世代和任务标题分别记录', '不能冒充平台ID', '不要求操作者手填技术ID', '不自动产生世代切换、中央写权、旧授权继承或远端权限', '已证明平台不可见时，ID UNKNOWN 不单独撤销已有中央证据确认的身份或切换状态', '普通规则刷新可以独立PASS', '在旧对话发送', '在新对话发送', '在接收对话发送']]);
checks.push(['handoff and task continuation distinguish receiver from source', manual, ['本次拟建立或恢复的总指挥是接收本条指令的对话', '这里的当前窗口指接收本条指令、拟移交职责的旧对话', '调度权移交给当前接收这条指令的对话', '真实接收身份', '你是准备移交工作的旧任务窗口', '你是接收续接材料的新任务窗口', '原对话与接收对话分别定位']]);
checks.push(['4K resolves reversible preparation problems without weakening publish gates', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['4K简单问题自主处理', '无法在原范围安全修复的验证失败', 'Push前完成候选本地必要验证', 'Push后回读精确新Head的全部Checks和Actions', '失败项默认全部进入本轮处理清单', '不得以取消测试、降低验收', '关闭检查或空提交掩盖失败', '同类修复连续两次无改善', '修复改变纳入内容时', '结果未知不重复副作用', '先完成可审阅候选', '最终远端确认仍适用', '已有有效精确确认不重复索权']]);
checks.push(['cross-project route separates affiliation from operator authorization', `${read('09-自动化授权与风险分级.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['跨项目默认路由', '本项目 AI / 其他项目 AI / 归属未知', '当前操作者在接收窗口直接明确要求处理来源业务', '来源归属与通信授权分开核验', '其他项目或归属未知的 AI 来信默认进入 `WORKFLOW_FEEDBACK`']]);
checks.push(['cross-window feedback reads accessible material before execution gating', `${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('09-自动化授权与风险分级.md')}\n${read('06-复盘与优化规则.md')}`, ['完整取得并阅读当前消息提供的可访问材料', '只读范围内检索互联网', '读取、核验和总结不等于接管来源业务', '来源业务未授权', '缺失材料仍需标为 `INPUT_REQUIRED`']]);
checks.push(['cross-task operator report has six explicit sections', `${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('01-操作者操作手册.md')}\n${read('09-自动化授权与风险分级.md')}`, ['跨任务事件的操作者可见六段汇报', '来源与要求', '读取与分析', '执行决定', '来源回执', '操作者干预', '处理状态与主线', '恢复原主线断点', '已发送待确认', '尚未向来源回执', '事件阻断或待回调时，不得写“处理完毕”']]);
checks.push(['automation capability is layered before human handoff', `${read('09-自动化授权与风险分级.md')}\n${read('06-复盘与优化规则.md')}`, ['命令行层', '浏览器层', '原生窗口层', '项目专用层', '`ADAPTER_FAILURE`', '`CAPABILITY_UNAVAILABLE`', '`TEST_ASSET_MISSING`', '`HUMAN_JUDGMENT_REQUIRED`', '读取适用 Skill', '首选路径和一个明确备用路径', '能力证据表', '单个适配器错误或缺少测试资产不得单独结束 Goal']]);
checks.push(['natural-language routing uses a minimal scenario pack', `${read('00-第二代工作流总览.md')}\n${read('02-总指挥核心规则.md')}\n${read('10-自动状态索引规范.md')}`, ['自然语言入口与场景提示词按需加载', '只加载一个最匹配的场景提示词包', '有限候选', '无法判断', 'loaded_sections', 'route_confidence']]);
checks.push(['legacy tasks migrate with dual-read single-write', `${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['场景路由与旧任务兼容过渡', '双读、单写', 'LEGACY_READABLE', 'MIGRATION_REQUIRED', 'MIGRATED', 'MIGRATION_BLOCKED', '不得被静默重启']]);
checks.push(['independent review requires evidence-complete reading', `${read('docs/EXECUTION_AND_INDEPENDENT_REVIEW.md')}\n${read('06-复盘与优化规则.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['必要正文', '`UNKNOWN/INCOMPLETE_REVIEW`', '读取清单、证据指针', 'REVIEW_COMPLETED', '不得输出“审查通过”']]);
checks.push(['recurrence triage requires a permanent measure', `${read('02-总指挥核心规则.md')}\n${read('06-复盘与优化规则.md')}`, ['故障复发性与永久修复门禁', '一次性环境因素', '可复现的操作失误', '系统性流程缺口', '永久措施', '回归验证']]);
checks.push(['Goal acceptance evidence and raw platform states stay bounded', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}`, ['AUTO_VERIFIABLE', 'VISUAL_REVIEW', 'PROXY_ONLY', 'HUMAN_OR_PROFESSIONAL_GATE', '没有严格量化定义的自然语言目标', '有界试验或可逆替代', '平台原始状态：保留客户端或工具实际返回值', '来源项目归属核验']]);
checks.push(['handoff obeys current-turn precedence and formal route', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}`, ['自然语言在这里仅是路由信号，不是交接快照授权', '上一轮“下一轮再交接”等说法只保留为背景', '不得仅凭历史意图生成正式快照', '当前轮优先于历史时序约定', '自然语言不构成捷径', '必须补齐 1C/1D 的预检、收口核账、快照交付', '不存在“场景 EC”', '1B 预处理']]);
checks.push(['handoff closeout distinguishes pending work from blockers', read('04-状态、目标变更与交接规范.md'), ['收口”是把执行中或结果未知的动作停在安全原子边界', '普通未完成项只要有状态、责任对象、精确断点、下一行动和失效条件', '高风险动作未安全停止', '必须 `BLOCKED`']]);
checks.push(['handoff content reconciles before sealing', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}`, ['内容一致性回读', '中央 CURRENT、AI 状态索引、实际 Git/工作区/远端', '旧编号、旧世代、旧工作区计数或交付状态残留', '封条或哈希通过不能代替', '以候选当前消息实际收到附件作为送达事实']]);
checks.push(['handoff preflight closes before snapshot', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['场景 1B：交接预处理与收口判断', '不生成 `final-*`', '不存在“场景 EC”', '1B→1C', '本地与远端尚未同步', '低风险、可回滚']]);
checks.push(['handoff identity gate rejects mis-sent commander prompt', `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['1C 是总指挥必经入口并自带最小可行性预检和身份硬门禁', '当前窗口不是总指挥，可能误发了场景 1C', '不得生成、覆盖、删除 `final-*`', '普通或专项任务即使收到 1C 提示词，也不得升级身份', '改用场景 1E/1F']]);
checks.push(['handoff preparation does not require a successor', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('交接阶段矩阵.md')}`, ['继任窗口、继任者身份和接收任务由操作者在后续交付阶段自行指定', '尚未指定继任者而全局阻断', '准备阶段不要求填写或核验继任者、接收窗口或候选任务 ID', '接收位置可访问、实际接手和复现由操作者指定接收方后', '候选任务 ID：不需要']]);
checks.push(['handoff continuation and scoped automation', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}`, ['“继续”只有在上一轮明确给出可进入下一阶段且当前基线未漂移时才沿用', '只记录与本任务或项目有明确绑定证据的自动化', '不得扫描或列出账户级、其他项目或无绑定证据的自动化', '无；未扫描账户级任务']]);
checks.push(['handoff baseline separates pinned snapshot, live epoch and adoption record', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}\n${read('交接阶段矩阵.md')}\n${read('07-总指挥交接记录模板.md')}`, ['候选 `rule_baseline` 快照', '公共规则源 `live_rule_epoch`', '项目登记采用记录', '`RULE_REBASE_PENDING`', '`NEWER_COMPATIBLE`', '`AFFECTED_RECHECK`', '`SUPERSEDED_BY_RULE_REBASE`', '不要求操作者选择旧/新版本']]);
checks.push(['workflow enablement does not confuse rule source with project adoption', `${read('../工作流启用声明.md')}\n${fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')}\n${read('规则刷新广播包.md')}\n${read('规则刷新接收回执模板.md')}`, ['RULE_SOURCE_STATUS', 'PROJECT_ADOPTION_RECORD', '项目登记旧指纹或待同步不否定规则刷新', 'RULE_ADOPTION_RECORD：SYNCED/SYNC_PENDING', '只有依赖控制面的动作标记 `UNKNOWN/BLOCKED`']]);
checks.push(['handoff verification is executable and layered', `${read('07-总指挥交接记录模板.md')}\n${read('01-操作者操作手册.md')}`, ['封条验证入口', '直接使用其中的完整命令', '`INPUT_REQUIRED`', '不得把调用缺参写成来源损坏']]);
checks.push(['handoff candidate reply is human-first', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}\n${read('07-总指挥交接记录模板.md')}`, ['统一使用 02 规定的五项外壳', '真正阻断', '默认不展示机器字段', '只有操作者明确要求详细核验', '不得把 `NOT_RUN`、`GENERATED_NOT_DELIVERED`', '写入第 2 或第 3 项的人话说明', '下列字段只供机器记录和异常定位']]);
checks.push(['handoff preflight is first gate and candidate is unique', `${read('04-状态、目标变更与交接规范.md')}\n${read('10-自动状态索引规范.md')}\n${read('06-复盘与优化规则.md')}`, ['把 `preflight_only` 当作第一道机器门', '固定 `fact_cutoff`', 'SUPERSEDED', '有限重试和退避', '当前唯一 active candidate', '附件与封条保持两阶段']]);
checks.push(['handoff preflight matches append and templates fail before seals', `${fs.readFileSync(path.join(root, '.github', 'scripts', 'Prepare-Handoff.mjs'), 'utf8')}\n${fs.readFileSync(path.join(root, '.github', 'scripts', 'HandoffSeal.mjs'), 'utf8')}\n${read('04-状态、目标变更与交接规范.md')}`, ['validateSealDraftForAppend', 'draft preflight validation failed', 'missing verification command placeholder or entry', '追加前完成', '追加后只做封条回读']]);
checks.push(['handoff scoring separates control confidence from switch and acceptance states', `${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['控制面必要证据全部通过且没有真实控制面冲突或缺口时必须记为 `HIGH`', '候选阶段旧写者 `IDLE/UNKNOWN`', '运行/专业状态 `UNKNOWN/NOT_RUN/FAIL` 不得降低控制面评分', '“尚未正式切换”本身不是降分理由']]);
checks.push(['goal handoff stops business execution and verifies available platform controls', read('01-操作者操作手册.md'), ['不得开始新的业务步骤', '平台恢复成功', '不能把该命令作为跨版本通用恢复方式', '确认平台已暂停', '暂停后才执行收口', '没有我的“恢复 Goal”或“从断点继续”指令及平台恢复证据，不得恢复']]);
checks.push(['goal preparation separates draft permissions and optional role use from launch', read('01-操作者操作手册.md'), ['场景 Gen1.1', '场景 Gen1.2', '场景 Gen1.3：暂停、恢复与交接收口', '不把草稿或附件中的允许操作当成本轮业务授权', '不在本轮安装', '不因此阻断审查', '已激活或已执行角色任务', '登记缺项不等于未安装', '旧模板仍叫“身份赋予”', '不是 Goal 启动的前置条件']]);
checks.push(['goal handoff has a platform pause gate', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('交接阶段矩阵.md')}\n${read('07-总指挥交接记录模板.md')}\n${read('10-自动状态索引规范.md')}`, ['PAUSE_REQUIRED', 'PAUSED', 'Goal 交接权限', 'CLOSEOUT_ONLY', '交接材料生成并回读成功后必须为 `NONE`', '不能覆盖上述平台状态']]);
checks.push(['final status separates exclusions from open work', `${read('02-总指挥核心规则.md')}\n${read('03-专项任务卡模板.md')}\n${read('06-复盘与优化规则.md')}`, ['排除项反查', '`EXCLUDED`', '`CANCELLED`', '`SUPERSEDED`', '不得出现在“未完成项、待办或下一步”中']]);
const goalBudget = read('05-模型选择与资源策略.md');
checks.push(['Goal continuation has a usable operator entry', read('01-操作者操作手册.md'), ['问题解决后恢复', '周期到限后继续', '追加预算也用完时', '只准备下一周期，不立即执行', '不记为违规的“14/10”']]);
checks.push(['Goal repeated limits require bounded approval and preserve history', goalBudget, ['追加周期也到限时重复审查与批准流程', '不混用两种记账方式', '执行前在既有获准记录保存批准依据', '最新明确批准的新周期预算约束当前执行']]);
checks.push(['Goal approval and platform recovery are separate', read('01-操作者操作手册.md'), ['文本批准不保证平台自动恢复', '客户端独立硬限额', '只说“继续”或点击恢复按钮，不自动增加预算', '状态未知时不声称已恢复']]);
checks.push(['unselected permission menu is not an authorization', goalBudget, ['旧权限菜单未选择而原样发送时', '不视为全选', '删除整个栏目仍只沿用已有授权']]);
checks.push(['Goal recovery or window change does not reset a cycle', goalBudget, ['都不自动开始新工作周期', '不默认归零', '明确暂停不计时但不清零', '不能修改平台 Goal 的持久预算']]);
checks.push(['new cycle cannot repeat exhausted failed methods', goalBudget, ['操作者明确批准新工作周期的目标与预算后', '保留上周期记录及关联', '不因周期预算更新获准重复旧失败方法', '硬上限不得绕过']]);
checks.push(['manual step pauses only dependent work', read('01-操作者操作手册.md'), ['只暂停依赖该问题的步骤', '没有安全且有意义的已授权工作可继续时才收口', '总预算到限按各自规则停止']]);
checks.push(['prompt language review stays in the existing workflow', read('06-复盘与优化规则.md'), ['文档质量检查并入现有生成、验证和审查流程，不新增审批层', '谁执行、执行什么、针对什么对象、在什么条件下执行', '作者从操作者角度完整读一遍实际复制块', '润色没有改变权限、停止条件和验证义务', '不能证明语言正确']]);
checks.push(['unavailable quota opt-out is explicit and scoped', `${read('01-操作者操作手册.md')}\n${read('05-模型选择与资源策略.md')}`, ['当无法查看额度时，允许忽略依赖额度读数的停止项', '不能仅因API登录或读取失败推定已有许可', '没有这项许可时，按原额度保护约定安全收口', '不新增费用或高资源权限', '不把缺失期间的用量记为零', '额度读取失败时按上面的明确许可处理，不因此单独停止']]);
checks.push(['quota direction and reset preserve task budget', read('05-模型选择与资源策略.md'), ['usedPercent', '100-usedPercent', 'rateLimitsByLimitId', 'windowDurationMins', 'resetsAt', '禁止取绝对差', '已用22%→42%等于剩余78%→58%', '剩余22%→100%不构成78个百分点消耗', '不把不同池差值相加', '不能清零预算', '新观测段不重复计算此前增量', '重置间未采到的消耗记 `UNKNOWN`', '已知累计已到限仍停止', '有限数值必须在0至100范围内']]);
checks.push(['quota inspection preserves fixed epoch and recovery boundaries', read('05-模型选择与资源策略.md'), ['Inspect-QuotaProtection.mjs', '固定锚点不能随相邻读数滑移', '同时间不同读数', '恢复必须提供原 `nextState`', '不得用初始化清零', '`nextState:null` 不覆盖旧可靠状态', '数值归一、比较及累计统一到小数点后9位', '不能覆盖可核到限、冻结、权限或其他停止门', '省略账号/池的终点不能写成这些字段也已直接核到']]);
checks.push(['Goal quality gates calibrate early and pause only dependent work', read('02-总指挥核心规则.md'), ['### Goal质量反馈节点', '大量迭代前校准质量', '不固定每轮问人', '确需人的判断才转2E', '等待标签不证明平台暂停', '必需验收未满足不complete', '累计预算与终止交付仍按05']]);
checks.push(['verification cadence preserves real runtime, counterexamples and valid evidence', read('docs/AUTOMATED_TESTING_LESSONS.md'), ['### 2.5 验证时机与证据复用', '不等于每消息、每命令或每轮全量重测', '无关版本标签变化不使全部证据失效', '对应真实产物/入口核验', 'Bug修复后立即匹配回归', '不代签自然路径', '受影响旧结论暂不作为验收依据', '不新增平行账本或固定测试轮']]);
checks.push(['Goal templates plan quality nodes and distinguish active continuation from paused recovery', read('01-操作者操作手册.md'), ['详细触发与最小判断包见02', '准备可预见的质量校准、自动验证和人工触发节点', '每个完整工作批次按变更影响和证据缺口', '且没有人工暂停、交接或等待你明确继续的要求时', '只有你明确要求继续、平台恢复已实际核验', '不代替你解除暂停，不清零预算']]);
checks.push(['5A shares all operator inputs with readable originals and transparent exceptions', read('docs/EXECUTION_AND_INDEPENDENT_REVIEW.md'), ['### 1.4 场景5A的原始要求与参考资料对等', '全部附件、本地路径、网页链接、截图及其他参考资料', '作者的分析、推断与原文分开', '共享原件，不只共享总结', '逐项说明收到、可读取或具体缺口', '不证明材料已读', '新增资料同步，稳定材料复用', '不清零轮次', '不新建平行账本', '资料可读不等于可外发', '只限制依赖部分']]);
checks.push(['5A template and dispatch distinguish minimal authorization evidence from full reference sharing', `${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['按协作规范1.4', '对方实际可读且版本绑定的入口', '不能只转述你的总结', '新增资料及时同步', '不转发受禁止外发的原件', '不以摘要代原件', '授权核验的最小摘录不替代讨论所需原件共享']]);
let failed = 0;
const ordinaryDelivery = read('04-状态、目标变更与交接规范.md').split('### 6.0.1 交接主快照与材料入口')[1]?.split('### 外部专业职责的续接')[0] || '';
const ordinaryManual = read('01-操作者操作手册.md');
const ordinaryPrepare = ordinaryManual.split('### 场景 1E：')[1]?.split('### 场景 1F：')[0] || '';
const ordinaryTakeover = ordinaryManual.split('### 场景 1F：')[1]?.split('### 场景 1G：')[0] || '';
checks.push(['shared delivery contract has one named main entry and bounded links', ordinaryDelivery, ['唯一主快照', '任务名称', '交接快照', 'Handoff', '合法 slug 必须包含已核实任务名称', '可点击链接', '必读', '用途', '访问条件', '辅助文件', '不自动携带', '原记录的投影', '无待续任务', '材料可安全交付', '不等于接收方已接手', '只暂停依赖缺口的动作', '不增加', '受限资料', '重新联系旧窗口']]);
checks.push(['ordinary sender copy block delivers the main file and next scene', ordinaryPrepare.split('```text')[1]?.split('```')[0] || '', ['唯一主快照', '任务名称', '可点击链接', '准备阶段不要求继任者、接收窗口或候选任务 ID', '是否可以安全交接', '只转交主快照', '场景 1F', '阻断项', '最小解决动作']]);
checks.push(['ordinary recipient copy block consumes bounded main entry without rotation tickets', ordinaryTakeover.split('```text')[1]?.split('```')[0] || '', ['唯一主快照', '明确用途', '必读链接', '不递归', '只暂停依赖缺口的动作', '不要求中央轮换票据', '不得继承旧窗口的远端写入']]);
checks.push(['ordinary recipient ignores operator-assigned title during handoff', `${ordinaryTakeover}\n${read('04-状态、目标变更与交接规范.md')}`, ['不要读取或比较当前对话标题', '人工任务名称', '只是显示文字', '不能改变专项/普通任务身份', '不因此暂停', '不作为身份匹配、授权或交接成败依据', '平台实际任务 ID 只用于运行时定位和首次回执']]);
checks.push(['manual provides one explicit stop-and-transfer input', read('01-操作者操作手册.md'), ['正常换任只发一次', '我已根据交接来源记录确认并停止旧总指挥的调度', '仅取得本次交接准备与提交权限', '完成回读前没有业务调度权', '不要求我另取唯一票据', '请保持旧总指挥停止接收和执行新任务']]);
checks.push(['takeover mints a fresh identity and never reuses outgoing writer or platform id', `${read('01-操作者操作手册.md')}\n${read('04-状态、目标变更与交接规范.md')}\n${read('总指挥轻量交接启动配置.md')}`, ['附件来源世代必须等于中央当前世代', '三者都禁止沿用附件或中央 CURRENT 中的旧值', '中央登记必须铸造全新身份', '禁止复用交接包或中央 CURRENT 中的旧值', 'RESOLVED_FROM_CURRENT_CONTROL_PLANE', '中央回读必须显示新世代、新写者和本窗口平台任务 ID', '仍指向旧窗口身份时只报告具体阻断', '新身份登记：<新世代、新 writer_id、本窗口平台任务 ID；三者均不得沿用旧值>', '中央仍指向旧窗口身份时只报受阻，不得显示完成']]);
checks.push(['compaction resumes from durable state without full re-read or identity re-verification', `${read('02-总指挥核心规则.md')}\n${read('10-自动状态索引规范.md')}`, ['上下文压缩后的恢复与增量读取', '不重复全文读取，也不重复确认身份', '重核范围限于受影响部分', '不逐文件全文重读', '不为修复一个缺陷引入新缺陷', '不损害其他功能']]);
checks.push(['lightweight entry separates readiness from authority and hides internal preparation', read('总指挥轻量交接启动配置.md'), ['只表示材料通过', 'DIRECT_PREPARE_AVAILABLE', 'can_stop_old=true', '没有独立票据不称材料失败', '操作者只实际停旧并一次发送附件与1D', '不转交正常准备请求或票据']]);
checks.push(['lightweight handoff reuses deterministic checks without weakening control gates', read('总指挥轻量交接启动配置.md'), ['先定位唯一CURRENT', 'HISTORY仅在来源冲突或必要恢复时定点展开', '同实例已完整读取', '新实例独立读必要正文并核权', '无变化不再先重复运行组合入口', '--summary', '仍执行完整核验并保留全部错误', '锁内前后复核及完成回读保持', '历史日志按原渲染版本核验']]);
checks.push(['shared role loading reuses only verified evidence from the same instance', fs.readFileSync(path.join(root, '引用的外部工具/外部工具自动对接规范.md'), 'utf8'), ['新实例独立读取所需角色正文', '同实例已有可核的完整读取记录', '实物、适用职责和依赖未变', '核目标、版本、实物、当前权限及原消费', '不继承其他实例“已读”']]);
checks.push(['direct protocol preserves legacy intent and interrupted writes', read('04-状态、目标变更与交接规范.md'), ['接收方直接准备、受控提交与中断恢复', 'handoff-direct-transition-intent', 'schema v4', '所有受支持v3 prepare/recover/append', '第三种字节保留现场', '不自行授予跨任务发送权限', '不能代替修复后的新确认']]);
checks.push(['workflow regression is wired into the real repository quality entry', fs.readFileSync(path.join(root, '.github/scripts/Test-Repository.ps1'), 'utf8'), ["& node (Join-Path $PSScriptRoot 'Test-Verify-Handoff-Candidate.mjs')", "if ($LASTEXITCODE -ne 0) { throw '候选材料与停旧前轮换准备组合检查失败。' }"]]);
checks.push(['in-flight scope preserves strict defaults and live source separation', read('04-状态、目标变更与交接规范.md'), ['在途专项与交接保护范围', 'git-scoped-index-worktree-sha256-v2', 'ownership_source_ref', '候选不能临时扩大排除范围', '分别核验 Git 索引与工作树', '旧票据恢复只登记旧来源漂移', '旧封条、票据及恢复记录不改签', '交接保存可靠阶段观察']]);
checks.push(['scope behavioral regression is part of repository quality', fs.readFileSync(path.join(root, '.github/scripts/Test-Repository.ps1'), 'utf8'), ["& node (Join-Path $PSScriptRoot 'Test-HandoffWorkspaceScope.mjs')"]]);
checks.push(['handoff final applies only to current undelivered takeover', read('总指挥轻量交接启动配置.md'), ['本轮正在办理的切换/接管', '已完成但尚未向操作者最终交付', '已完成且已最终交付的交接仅是业务前置事实', '业务途中压缩恢复', '不得再次输出旧交接结论']]);
checks.push(['handoff output defaults to human summary with optional technical template', read('总指挥轻量交接启动配置.md'), ['统一使用 02 规定的五项外壳', '前四项人话是默认最终出口', '以下四标题技术模板仅在操作者明确要求技术详情或真实异常需要定位时使用']]);
checks.push(['core entry uses scoped human final source', read('02-总指挥核心规则.md'), ['轻量启动配置第 8 节', '所有执行型场景默认使用同一套人话外壳', '普通业务压缩恢复不套用交接汇报']]);
checks.push(['recovery entry does not close an already delivered takeover again', read('04-状态、目标变更与交接规范.md'), ['轻量启动配置第 8 节', '统一按五项人话外壳输出', '已最终交付的交接不因中断恢复而重新收口']]);
checks.push(['cross-task final verifies current substance rather than a nonempty shell', read('09-自动化授权与风险分级.md'), ['当前请求—实际动作—证据—状态', '本事件的实质判断和剩余交付', '来源回信成功或已经采纳不能代替', '已完成且已交付的交接', '新来信插入原任务']]);
checks.push(['current-request output rule rejects stale final conclusions', read('02-总指挥核心规则.md') + '\n' + read('09-自动化授权与风险分级.md'), ['当前请求的对象', '上一回合的 PRIMARY_OUTPUT、工具结果和未执行计划只能作为历史证据', 'OUTPUT_MISROUTED', '当前用户消息优先于迟到的工具结果']]);
checks.push(['in-flight steering merges additions and reports scoped cancellations', read('02-总指挥核心规则.md'), ['在途“调整方向”输入的增量合并与局部取消门禁', '中途 steering 输入', '不会自动重写已经输出的内容', '不会替 AI 把原请求标记为完成', '增补 / 纠正 / 细化（默认）', '保留原有未完成项', '明确局部取消 / 替代', '`CANCELLED` 或 `SUPERSEDED`', '提问 / 状态询问', '回到原执行账继续', '无法判定', '原请求项 + 新增项—实际动作—证据—状态', '已取消，未执行', '不声称客户端已有宿主级拦截器']]);
checks.push(['cross-task substantive reports preserve requirements and evidence', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['跨任务实质汇报的信息保真门禁', '逐项映射', 'REPORT_INCOMPLETE', 'INPUT_REQUIRED', 'NOT_RUN', '证据入口', '下一行动方', '`part i/n`', '合理推断']]);
checks.push(['visible cross-task receipt is required before continuation', `${read('02-总指挥核心规则.md')}\n${read('09-自动化授权与风险分级.md')}`, ['跨任务入站的操作者可见收件硬门禁', '下一次可以产生的操作者可见文本', 'operator_feedback_status', 'HOST_NO_VISIBLE_TURN/UNKNOWN', '不能声称已读取', '来源写明“无需回复”只免除向来源回传']]);
checks.push(['phase closeout does not invent a new budget', read('02-总指挥核心规则.md'), ['阶段收口本身不自动产生新预算或新授权请求', '周期或预算到限', '范围/权限/风险发生变化', '明确停止条件命中', '新增高风险依赖']]);
const reportScope = read('总指挥轻量交接启动配置.md').split('## 8. 统一接管汇报模板')[1];
const staleReportDirectives = [
  [reportScope, /适用于正常交接、已确认总指挥身份的中断恢复/],
  [reportScope, /固定保留以下四个标题、顺序和字段/],
  [read('02-总指挥核心规则.md'), /正式换任最终回复按轻量启动配置第 [78] 节的四段模板输出/],
  [read('04-状态、目标变更与交接规范.md'), /正常换任和已确认总指挥身份的中断恢复均按该格式输出/]
];
checks.push(['old overbroad or mandatory technical final directives cannot coexist with the scoped outlet', staleReportDirectives.every(([text, pattern]) => !pattern.test(text)) ? 'NO_STALE_REPORT_DIRECTIVE' : '', ['NO_STALE_REPORT_DIRECTIVE']]);
const scene4J = manual.split('### 场景 4J：')[1]?.split('<a id="scenario-local-to-remote">')[0] || '';
const scene4K = manual.split('### 场景 4K：')[1]?.split('<a id="场景-2f')[0] || '';
const prStandard = read('docs/PR_SUBMISSION_AND_REVIEW_STANDARD.md');
const syncChecks = read('09-自动化授权与风险分级.md').split('### 4K简单问题自主处理')[1]?.split('### ')[0] || '';
// These assertions guard the public routing contract, not a live model's decisions.
const permissionRules = read('09-自动化授权与风险分级.md');
const directPermission = permissionRules.split('直接执行请求与准备请求分流：')[1]?.split('\n1. ')[0] || '';
const scene4A = manual.split('### 场景 4A：')[1]?.split('### 场景 4B：')[0] || '';
const prPreparation = prStandard.split('### 3.2 ')[1]?.split('## ')[0] || '';
checks.push(['direct remote execution reuses operator authority without requiring technical IDs', directPermission, ['直接执行请求', '仅准备或预览', '已有有效授权不重复索权', '首次远端写入前', '由AI补齐', '不是新的授权缺口']]);
checks.push(['direct remote authority preserves actual drift and dedicated confirmation gates', directPermission, ['已绑定的Head或载荷', '实质变化', '明确要求先展示最终载荷后另行确认', '分次或双重确认', '人工通读', '只暂停受影响动作']]);
checks.push(['remote write scope does not silently include merge or side effects', directPermission, ['Push、创建/更新PR不包含', 'Merge', 'Approve', 'Tag', 'Release', '部署', '删除', '先回读实际结果']]);
checks.push(['4A and 4K route direct requests through the same authorization branch', `${scene4A}\n${scene4K}`, ['4A先按09的直接执行请求与准备请求分流', '4K先按09的直接执行请求与准备请求分流', '已有有效执行授权时连续完成', '仅准备或预览']]);
checks.push(['core route and PR preparation reuse the same permission rule', `${read('02-总指挥核心规则.md')}\n${prPreparation}`, ['远端授权按09的直接执行请求与准备请求分流核验', '按09的直接执行请求与准备请求分流', '核验并复用远端授权']]);
checks.push(['PR gates permit authorized draft progress without certifying human review', prStandard, ['授权已覆盖的Push或Draft不因', '不代填“已通读”', '先展示后另确认', '远端写入确认或合并门禁']]);
const staleRemoteDirectives = [
  [scene4K, /它们只表示进入盘点和候选准备，不直接授权 Push/],
  [scene4A, /候选稳定后只展示一次最终 PR 内容与远端执行卡，操作者确认后才 Push/],
  [prPreparation, /后一阶段仍须绑定最终候选单独确认|只在候选稳定后申请远端确认/],
  [prStandard.split('### 6.1 ')[1]?.split('### 6.2 ')[0] || '', /操作者确认同一成果范围、输入基线、动作顺序和验证范围后/],
  [permissionRules, /达到该状态后再生成一次最终远端执行卡，由操作者集中确认实际远端动作|先完成可审阅候选，再集中展示并确认精确远端动作/],
];
checks.push(['old unconditional preparation-only directives cannot reset direct execution authority', staleRemoteDirectives.every(([text, pattern]) => !pattern.test(text)) ? 'NO_STALE_REMOTE_DIRECTIVE' : '', ['NO_STALE_REMOTE_DIRECTIVE']]);
checks.push(['4J loads existing reproduction contract for every source type', scene4J, ['按同步目的接入04', '成果连续性与运行复现契约', '已读且未变化的证据按有效范围复用']]);
checks.push(['4J separates code inclusion, actual runtime and accepted effect', scene4J, ['代码已同步', '运行已采用', '效果已验收', '前一项不能代签后一项', '实际进程采用新成果', '代码已同步，运行效果未验证']]);
checks.push(['source-only sync avoids unrelated runtime mutations', scene4J, ['仅更新源码时运行和效果可不适用', '不机械重装依赖、清缓存或杀进程', '生产、费用、数据库及他人进程另核权限', '干净环境验证不能代签队友实际复现']]);
checks.push(['4J retains local protection and scope boundaries', scene4J, ['停止 4J 并转 4I', '禁止 `git reset --hard`', '已有未完成的 Merge/Rebase/Cherry-pick', '本场景不自动修改产品代码', '只有操作者确认']]);
checks.push(['4K direct push loads the same completeness contract', scene4K, ['从已核工作流根读取PR提交与审查标准', '直推同样使用', '全部待上传历史', '参与原验收的忽略配置与资产', '排除后重验受影响行为', '目标内仍有待定成果时不声称“全部完成”']]);
checks.push(['accepted local result maps to the actual delivery candidate', prStandard, ['本地已认可成果及运行条件 → 必要文件、依赖和资源 → 最终提交候选 → 远端可取得的交付内容', '候选能启动不能证明保留了原认可效果', '不因复现需要取得公开权限']]);
checks.push(['remote checks follow push readiness and merge timing', syncChecks, ['Push前完成候选本地必要验证', '未来新Head尚无检查不循环阻断Push', 'Push后回读精确新Head', '未触发、运行中、失败、通过与不可观察', '网络不可观察记未知', 'Ready与合并前遵守实际团队门禁', '旧Head通过不能代签新Head', '结果待实际合并后回读']]);
checks.push(['reviewer checklist keeps necessary steps without copying CI', prStandard, ['检查目的、前提与输入、具体操作、预期结果或事先约定的容差、明确失败条件', '无此需求时说明不适用', 'CI引用精确Head的实时检查入口', '复现所需的环境准备和操作命令不能因去重省略', '干净环境验证与接收成员实际复现分别记录', '| 检查目的 | 前提与输入（含入口/准备） | 具体操作 | 预期结果或约定容差 | 失败条件 |']]);
checks.push(['unconditional pre-push future checks requirement is removed', [scene4K, syncChecks].every(text => !/远端动作前(?:还)?必须(?:逐项)?读取目标 Commit\/Head/.test(text)) ? 'NO_FUTURE_CHECK_DEADLOCK' : '', ['NO_FUTURE_CHECK_DEADLOCK']]);
const deploymentGate = read('02-总指挥核心规则.md').split('### 低信息部署请求与运行身份交付门禁')[1]?.split('\n### ')[0] || '';
const deploymentEntry = read('01-操作者操作手册.md').split('### 场景 2D：展示最新修改的运行效果')[1]?.split('\n### ')[0] || '';
checks.push(['latest deployment accounts for the full effective scoped outcome', deploymentGate, [
  '本次应交付的最终有效内容', '04成果契约', '相关已提交、暂存、未暂存、必要未跟踪成果及删除/重命名',
  '未提交、未存档或晚于恢复包不是排除理由', '明确删除、回退和替代决定仍保留',
  '无关实验、私有素材和未授权改动不自动纳入', '先核对本次应包含的功能及后续修改',
  '不能静默部署较旧可靠候选并称“最新”', '操作者明确指定旧版或对照版本时按指定范围核验'
]]);
checks.push(['deployment gaps preserve save, integration and permission boundaries', deploymentGate, [
  '编辑器未落盘内容不计为已包含', '不可观察时保持未知', '明确需要的未保存内容只暂停依赖它的动作',
  '多工作区尚未汇合', '在已有权限内处理必要的登记、保存、集成与验证',
  '不绕过门禁、不擅自提交或存档，也不自动合并工作区', '本门禁不自动授权公网/共享部署',
  '不能代签算法效果、设备或专业验收'
]]);
checks.push(['deployment reports whole identity and actual loaded content', deploymentGate, [
  '绑定本次整体源码、配置、必要资源及实际涉及的各组件身份',
  '不能由单个算法版本、提交或恢复包标签代替整体包含性', '核对服务和客户端加载内容',
  '汇报复用“用户可见输出契约”', '开头用一到两句人话说明实际包含的功能和本轮最新修改',
  '保留颜色、实线/虚线等影响理解的差别', '缺失和未验证项紧接说明',
  '必要强制出口字段仍按原规则交付'
]]);
checks.push(['deployment manual and PR entry consume the same contract', `${deploymentEntry}\n${prStandard}`, [
  '低信息部署请求与运行身份交付门禁', '从任务记录和实际工作区确认本次相关最新成果的完整范围',
  '先用一到两句人话告诉我实际包含哪些功能和最新修改', '效果是否通过，由我实际查看后确认',
  '实际代码提交/tree及本次相关工作区增量', '本地相关未提交成果不能只由HEAD代表',
  '“最新”的范围与缺口处理沿[02部署门禁]', '不因本条扩大PR最终提交树或远端授权'
]]);
// These checks bind public prose and entry references, not a real deployment or
// a guarantee that an agent, server or client actually used the intended files.
for (const [name, text, needles] of checks) {
  const missing = needles.filter(needle => !text.includes(needle));
  if (missing.length) { failed += 1; console.error(`FAIL: ${name}: missing ${missing.join(', ')}`); }
  else console.log(`PASS: ${name}`);
}
const syntheticCurrentReply = ({ currentRequest, candidateRequest, candidateOrigin, currentMessagePresent = true }) => {
  if (!currentMessagePresent || !currentRequest) return 'OUTPUT_UNVERIFIED/BLOCKED';
  if (candidateOrigin === 'previous-turn' || candidateRequest !== currentRequest) return 'OUTPUT_MISROUTED';
  return 'MATCHED';
};
const currentReplyCases = [
  ['previous remote-sync conclusion cannot answer a new cross-task request', { currentRequest: 'cross-task-dialogue', candidateRequest: 'remote-sync', candidateOrigin: 'previous-turn' }, 'OUTPUT_MISROUTED'],
  ['current request with matching candidate remains usable', { currentRequest: 'cross-task-dialogue', candidateRequest: 'cross-task-dialogue', candidateOrigin: 'current-turn' }, 'MATCHED'],
  ['missing current request cannot close with an old success', { currentRequest: '', candidateRequest: 'remote-sync', candidateOrigin: 'previous-turn' }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['late tool result cannot replace current user request', { currentRequest: 'cross-task-dialogue', candidateRequest: 'remote-sync', candidateOrigin: 'late-tool-result' }, 'OUTPUT_MISROUTED']
];
for (const [name, input, expected] of currentReplyCases) {
  const actual = syntheticCurrentReply(input);
  if (actual !== expected) { failed += 1; console.error('FAIL: synthetic current-request output ' + name + ': ' + actual + ' <> ' + expected); }
  else console.log('PASS: synthetic current-request output ' + name);
}
if (!failed) console.log('PASS: current-request output cases are synthetic contract checks, not host interception');
const syntheticRoute = ({ workflowReview, sourceBusiness, operatorAuthorized = false }) => ({
  workflow: workflowReview ? 'PROCESS_READ_ONLY' : 'NONE',
  business: sourceBusiness ? (operatorAuthorized ? 'AUTHORIZED_SCOPED' : 'BLOCKED') : 'NONE'
});
const routeCases = [
  ['pure source business', { workflowReview: false, sourceBusiness: true }, { workflow: 'NONE', business: 'BLOCKED' }],
  ['pure public workflow review', { workflowReview: true, sourceBusiness: false }, { workflow: 'PROCESS_READ_ONLY', business: 'NONE' }],
  ['mixed workflow and source business', { workflowReview: true, sourceBusiness: true }, { workflow: 'PROCESS_READ_ONLY', business: 'BLOCKED' }],
  ['direct operator authorization scopes source business', { workflowReview: false, sourceBusiness: true, operatorAuthorized: true }, { workflow: 'NONE', business: 'AUTHORIZED_SCOPED' }],
  ['direct operator authorization may accompany workflow review', { workflowReview: true, sourceBusiness: true, operatorAuthorized: true }, { workflow: 'PROCESS_READ_ONLY', business: 'AUTHORIZED_SCOPED' }]
];
for (const [name, input, expected] of routeCases) {
  const actual = syntheticRoute(input);
  if (actual.workflow !== expected.workflow || actual.business !== expected.business) {
    failed += 1;
    console.error(`FAIL: synthetic cross-task route ${name}`);
  } else console.log(`PASS: synthetic cross-task route ${name}`);
}
if (!failed) console.log('PASS: cross-task route cases are synthetic contract checks, not live Agent behavior');
const receiptOutcome = ({ operatorFeedback, sourceReplyAuth, sourceReplyResult, finalText }) => {
  if (!operatorFeedback || !finalText?.trim()) return 'OUTPUT_UNVERIFIED/BLOCKED';
  if (sourceReplyAuth && !sourceReplyResult) return 'BLOCKED';
  if (!sourceReplyAuth) return 'LOCAL_FEEDBACK_ONLY';
  return sourceReplyResult;
};
const receiptCases = [
  ['no source authorization still reports locally', { operatorFeedback: true, sourceReplyAuth: false, finalText: '已收到，未向来源回执。' }, 'LOCAL_FEEDBACK_ONLY'],
  ['missing operator feedback blocks even with tool success', { operatorFeedback: false, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '' }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['blank final text cannot close a successful tool call', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '   ' }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['send tool failure remains a failed source route', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'FAILED', finalText: '已收到，向来源回执失败。' }, 'FAILED'],
  ['valid two-channel completion remains reportable', { operatorFeedback: true, sourceReplyAuth: true, sourceReplyResult: 'COMPLETED', finalText: '已收到并完成处理。' }, 'COMPLETED']
];
for (const [name, input, expected] of receiptCases) {
  const actual = receiptOutcome(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic cross-task receipt ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic cross-task receipt ${name}`);
}
if (!failed) console.log('PASS: cross-task receipt cases are synthetic contract checks, not live Agent behavior');
const syntheticReportCompleteness = ({ requirements, rows, multipartComplete = true }) => {
  if (!multipartComplete || !Array.isArray(requirements) || !requirements.length || !rows || typeof rows !== 'object') return 'REPORT_INCOMPLETE';
  for (const requirement of requirements) {
    const row = rows[requirement];
    if (!row || !row.status || !row.evidence || !row.nextOwner || !row.classification) return 'REPORT_INCOMPLETE';
  }
  return 'REPORT_COMPLETE';
};
const reportCompletenessCases = [
  ['missing requirement mapping blocks closeout', { requirements: ['R1', 'R2'], rows: { R1: { status: 'COMPLETED', evidence: 'e1', nextOwner: 'A', classification: 'FACT' } } }, 'REPORT_INCOMPLETE'],
  ['complete requirement mapping is reportable', { requirements: ['R1', 'R2'], rows: { R1: { status: 'COMPLETED', evidence: 'e1', nextOwner: 'A', classification: 'FACT' }, R2: { status: 'NOT_RUN', evidence: 'e2', nextOwner: 'B', classification: 'FACT' } } }, 'REPORT_COMPLETE'],
  ['incomplete multipart payload cannot close', { requirements: ['R1'], rows: { R1: { status: 'COMPLETED', evidence: 'e1', nextOwner: 'A', classification: 'FACT' } }, multipartComplete: false }, 'REPORT_INCOMPLETE'],
  ['inference must be explicitly labeled', { requirements: ['R1'], rows: { R1: { status: 'UNKNOWN', evidence: 'e1', nextOwner: 'A', classification: 'INFERENCE' } } }, 'REPORT_COMPLETE']
];
for (const [name, input, expected] of reportCompletenessCases) {
  const actual = syntheticReportCompleteness(input);
  if (actual !== expected) { failed += 1; console.error('FAIL: synthetic cross-task report completeness ' + name + ': ' + actual + ' <> ' + expected); }
  else console.log('PASS: synthetic cross-task report completeness ' + name);
}
if (!failed) console.log('PASS: cross-task report completeness cases are synthetic contract checks, not live Agent behavior');
const syntheticVisibleReceipt = ({ eventArrived, nextVisibleText, firstTextIsReceipt, hostProducedTurn = true }) => {
  if (!eventArrived) return 'NO_EVENT';
  if (!hostProducedTurn) return 'HOST_NO_VISIBLE_TURN/UNKNOWN';
  if (!nextVisibleText || !firstTextIsReceipt) return 'OUTPUT_UNVERIFIED/BLOCKED';
  return 'VISIBLE_RECEIPT';
};
const visibleReceiptCases = [
  ['queued event must surface before business continuation', { eventArrived: true, nextVisibleText: '已收到，排队处理', firstTextIsReceipt: true }, 'VISIBLE_RECEIPT'],
  ['business output without receipt is not a valid closeout', { eventArrived: true, nextVisibleText: '主线已完成', firstTextIsReceipt: false }, 'OUTPUT_UNVERIFIED/BLOCKED'],
  ['host without a visible turn remains unknown', { eventArrived: true, nextVisibleText: '', firstTextIsReceipt: false, hostProducedTurn: false }, 'HOST_NO_VISIBLE_TURN/UNKNOWN'],
  ['no event does not require a receipt', { eventArrived: false, nextVisibleText: '', firstTextIsReceipt: false }, 'NO_EVENT']
];
for (const [name, input, expected] of visibleReceiptCases) {
  const actual = syntheticVisibleReceipt(input);
  if (actual !== expected) { failed += 1; console.error('FAIL: synthetic visible cross-task receipt ' + name + ': ' + actual + ' <> ' + expected); }
  else console.log('PASS: synthetic visible cross-task receipt ' + name);
}
if (!failed) console.log('PASS: visible cross-task receipt cases are synthetic contract checks, not host interception');
const syntheticBudgetBoundary = ({ phaseClosed, budgetAtLimit, scopeChanged, highRiskDependency }) => {
  if (!phaseClosed) return 'CONTINUE_OR_REPORT';
  if (!budgetAtLimit && !scopeChanged && !highRiskDependency) return 'NO_NEW_BUDGET';
  return 'NEW_CANDIDATE_REQUIRED';
};
const budgetBoundaryCases = [
  ['phase closeout within current bounds does not request budget', { phaseClosed: true, budgetAtLimit: false, scopeChanged: false, highRiskDependency: false }, 'NO_NEW_BUDGET'],
  ['budget limit requires a new candidate', { phaseClosed: true, budgetAtLimit: true, scopeChanged: false, highRiskDependency: false }, 'NEW_CANDIDATE_REQUIRED'],
  ['scope change requires a new candidate', { phaseClosed: true, budgetAtLimit: false, scopeChanged: true, highRiskDependency: false }, 'NEW_CANDIDATE_REQUIRED']
];
for (const [name, input, expected] of budgetBoundaryCases) {
  const actual = syntheticBudgetBoundary(input);
  if (actual !== expected) { failed += 1; console.error('FAIL: synthetic budget boundary ' + name + ': ' + actual + ' <> ' + expected); }
  else console.log('PASS: synthetic budget boundary ' + name);
}
if (!failed) console.log('PASS: budget boundary cases are synthetic contract checks, not live Agent behavior');
const rebaseOutcome = ({ sourceStable, impact, rebasePass }) => {
  if (!sourceStable) return 'REBASE_BLOCKED';
  if (!rebasePass) return 'REBASE_BLOCKED';
  return impact === 'identity-permission-security' ? 'REBASE_REQUIRED' : 'REBASED';
};
const rebaseCases = [
  ['stable compatible update rebases automatically', { sourceStable: true, impact: 'documentation', rebasePass: true }, 'REBASED'],
  ['identity or security change requires affected-stage recheck', { sourceStable: true, impact: 'identity-permission-security', rebasePass: true }, 'REBASE_REQUIRED'],
  ['unstable source blocks only rebase-dependent stage', { sourceStable: false, impact: 'documentation', rebasePass: false }, 'REBASE_BLOCKED'],
  ['failed rebase never preserves old ready state', { sourceStable: true, impact: 'documentation', rebasePass: false }, 'REBASE_BLOCKED']
];
for (const [name, input, expected] of rebaseCases) {
  const actual = rebaseOutcome(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic rule rebase ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic rule rebase ${name}`);
}
if (!failed) console.log('PASS: rule rebase cases are synthetic contract checks, not live Agent behavior');
if (failed) process.exit(1);
const scoreControlConfidence = ({ controlEvidence, switchStatus, oldWriterStatus, editorBuffer, runtime, professional }) => {
  if (controlEvidence !== 'PASS') return 'MEDIUM';
  return 'HIGH';
};
const scoreCases = [
  ['complete control evidence with candidate-only restrictions stays HIGH', {
    controlEvidence: 'PASS', switchStatus: 'READY_WITH_RESTRICTIONS', oldWriterStatus: 'IDLE', editorBuffer: 'UNKNOWN', runtime: 'UNKNOWN', professional: 'FAIL'
  }, 'HIGH'],
  ['control evidence conflict is not promoted to HIGH', {
    controlEvidence: 'CONFLICT', switchStatus: 'READY_WITH_RESTRICTIONS', oldWriterStatus: 'IDLE', editorBuffer: 'UNKNOWN', runtime: 'UNKNOWN', professional: 'NOT_RUN'
  }, 'MEDIUM']
];
for (const [name, input, expected] of scoreCases) {
  const actual = scoreControlConfidence(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic handoff score ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic handoff score ${name}`);
}
if (failed) process.exit(1);
console.log('PASS: handoff score cases are synthetic contract checks, not live Agent behavior');
const goalHandoffDecision = ({ platform, permission, output }) => {
  if (platform === 'ACTIVE' || platform === 'UNKNOWN') return 'PAUSE_REQUIRED';
  if ((output === 'MATERIAL_PREPARED' || output === 'GENERATED_NOT_DELIVERED') && platform !== 'PAUSED' && platform !== 'CLEARED') return 'PAUSE_REQUIRED';
  if (output === 'MATERIAL_PREPARED' && platform === 'PAUSED' && permission === 'CLOSEOUT_ONLY') return 'CLOSEOUT_ONLY';
  if (output === 'GENERATED_NOT_DELIVERED' && permission === 'BUSINESS_ALLOWED') return 'INVALID';
  if (output === 'GENERATED_NOT_DELIVERED' && permission === 'NONE') return 'NONE';
  return permission;
};
const goalHandoffCases = [
  ['active platform cannot continue after handoff request', { platform: 'ACTIVE', permission: 'BUSINESS_ALLOWED', output: 'MATERIAL_PREPARED' }, 'PAUSE_REQUIRED'],
  ['paused platform may only close out', { platform: 'PAUSED', permission: 'CLOSEOUT_ONLY', output: 'MATERIAL_PREPARED' }, 'CLOSEOUT_ONLY'],
  ['generated material leaves old Goal terminal', { platform: 'PAUSED', permission: 'NONE', output: 'GENERATED_NOT_DELIVERED' }, 'NONE'],
  ['unknown platform state cannot authorize continuation', { platform: 'UNKNOWN', permission: 'BUSINESS_ALLOWED', output: 'GENERATED_NOT_DELIVERED' }, 'PAUSE_REQUIRED']
];
for (const [name, input, expected] of goalHandoffCases) {
  const actual = goalHandoffDecision(input);
  if (actual !== expected) { failed += 1; console.error(`FAIL: synthetic Goal handoff gate ${name}: ${actual} <> ${expected}`); }
  else console.log(`PASS: synthetic Goal handoff gate ${name}`);
}
if (failed) process.exit(1);
console.log('PASS: Goal handoff gate cases are synthetic contract checks, not live platform control');
const diagnosticDocs = `${read('00-第二代工作流总览.md')}\n${read('01-操作者操作手册.md')}\n${read('02-总指挥核心规则.md')}\n${read('docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md')}`;
if (diagnosticDocs.includes('默认交付紧凑文本执行图') || diagnosticDocs.includes('排查的基础交付必须先确认实际运行身份，再给')) {
  console.error('FAIL: diagnosis still requires a diagram before the finding or repair');
  process.exit(1);
}
console.log('PASS: diagnosis does not require a diagram before findings or repair');
const coreRules = read('02-总指挥核心规则.md');
const operatorManual = read('01-操作者操作手册.md');
if (!coreRules.includes('### 用户可见输出契约') ||
    !coreRules.includes('均登记为本轮 `PRIMARY_OUTPUT`') ||
    !coreRules.includes('必须在面向操作者的主答复正文中直接呈现') ||
    !coreRules.includes('明文要求的解释、未完成状态、影响和恢复条件必须在主答复直接交付，不能只留在记录中') ||
    !operatorManual.includes('提示词中明文要求的结果必须直接出现在 AI 面向你的主答复里')) {
  console.error('FAIL: explicit prompt outputs must be delivered in the visible primary response');
  process.exit(1);
}
console.log('PASS: explicit prompt outputs have a visible primary-response gate');
const workflowOverview = read('00-第二代工作流总览.md');
const riskRules = read('09-自动化授权与风险分级.md');
if (!coreRules.includes('对执行型指令（包括规则刷新、读取核验、修改、测试、交接、回执和外部动作）') ||
    !coreRules.includes('1. 执行结果：成功 / 执行了一部分 / 失败 / 待确认 / 未执行 / 不适用 / 受阻') ||
    !coreRules.includes('4. 下一步操作建议：只给最推荐的一条，并写明行动方') ||
    !coreRules.includes('5. 执行细节：放验证依据、错误、恢复条件和场景要求的技术字段') ||
    !workflowOverview.includes('统一引用[02 用户可见输出契约]') ||
    !operatorManual.includes('这些内容可以合并成简短段落，不要求固定五个标题') ||
    !riskRules.includes('执行型动作的操作者主答复统一引用[02 用户可见输出契约]')) {
  console.error('FAIL: execution-oriented scenes must lead with a human result summary');
  process.exit(1);
}
console.log('PASS: execution-oriented scenes have a human result-summary gate');
const returnRules = read('03-专项任务卡模板.md');
const retrospectiveRules = read('06-复盘与优化规则.md');
for (const needle of [
  '下列十二项是内部核账目录', '五项是信息覆盖要求，不是强制五个标题或五段',
  '开头先对照操作者原目标说明本轮实际得到什么、整体目标达到哪一步',
  '不以阶段完成、多方意见一致或检查通过代替整体完成',
  '原目标只要方案或文档且验收已满足时，就按该边界报告完成',
  '原因或修复办法尚未知时如实说明', '排除、取消和被替代事项与真实未完项分开',
  '说明谁做什么、为什么能推进原目标', '已有授权、前提满足的AI工作直接继续',
  '纯问答直接回答', '操作者本轮明确的输出顺序和紧急安全提示优先',
  '既有交接、发布等强制出口字段仍保留', '不为每次工具调用重复整份结果'
]) {
  if (!coreRules.includes(needle)) throw new Error(`Missing human result contract: ${needle}`);
}
if (coreRules.includes('每次汇报尽量使用以下顺序：') ||
    !returnRules.includes('统一引用[02 用户可见输出契约]') ||
    !retrospectiveRules.includes('汇报顺序、完成边界与段落合并统一引用[02 用户可见输出契约]') ||
    retrospectiveRules.includes('结论与下一步 → 必要操作 → 按需证据')) {
  throw new Error('Conflicting operator report order or missing unique 02 reference');
}
console.log('PASS: one report contract covers completion boundaries, concise prose and goal-linked next action (static contract, not live model behavior)');
for (const needle of ['先说明它为什么与当前目标有关', '是否只用假数据', '不等于正在交接对话', '测试目录选错不等于产品功能失败', '不能把本地检查要求说成远端平台的新要求', '请求授权时只列真实权限差额', '这不放宽仓库外写入、隐私、远端和其他安全门禁']) {
  if (!coreRules.includes(needle)) throw new Error(`Missing goal-bound validation explanation: ${needle}`);
}
console.log('PASS: internal validation explanations distinguish synthetic tests from real actions (document contract, not live behavior)');
const diagnosisEntry = coreRules.match(/^9\. 命中“输出异常的链路排查触发门禁”时，(.+)$/m)?.[1];
const diagnosisMethod = coreRules.match(/^1\. 输出质量不符合预期时，(.+)$/m)?.[1];
const diagnosisCollaboration = coreRules.match(/^5\. 操作者可以只用日常语言描述现象或“不确定”。(.+)$/m)?.[1];
const diagnosisGraph = coreRules.match(/^7\. 排查时先确认实际运行身份；(.+)$/m)?.[1];
if (!diagnosisEntry?.includes('先读取 `docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md` 的 2.1') ||
    !diagnosisEntry.includes('进入完整 2C 时再完整读取该标准') ||
    diagnosisEntry.startsWith('完整读取') ||
    !diagnosisMethod?.includes('以下第 2-4 条仅在进入完整 2C 后适用') ||
    !diagnosisCollaboration?.includes('进入完整 2C 时逐节点补齐') ||
    !diagnosisGraph?.includes('2E 定点路径记录与异常有关的节点和证据，进入完整 2C 后再建立')) {
  console.error('FAIL: output anomalies must triage through 2.1 before full 2C loading');
  process.exit(1);
}
console.log('PASS: output anomalies do not force full 2C loading');
const bilateralRoute = coreRules.match(/^\| 双方有尚未相互包含且需保留的有效成果，当前确需汇合 \| (.+) \|$/m)?.[1];
if (!bilateralRoute?.startsWith('进入 4I 方案') ||
    !coreRules.includes('不调用 4I') ||
    !coreRules.includes('评估是否调用 4I') ||
    !coreRules.includes('旧 2D 汇合归入 4I') ||
    !coreRules.includes('按证据进入完整 2C 时再完整读取该标准')) {
  console.error('FAIL: bilateral integration must route to 4I while legacy aliases and full 2C remain available');
  process.exit(1);
}
console.log('PASS: bilateral integration routes to 4I with legacy compatibility');
const modelSuggestions = read('01-操作者操作手册.md').split(/\r?\n/).filter(line => line.includes('**模型建议：**'));
const tiers = ['快速档', '标准档', '高质量档', '极限档'];
const brandedSuggestions = modelSuggestions.filter(line => /GPT-\d|Luna|Sol|Astra|Terra/.test(line));
const tierlessSuggestions = modelSuggestions.filter(line => !tiers.some(t => line.includes(t)));
if (modelSuggestions.length < 40 || brandedSuggestions.length || tierlessSuggestions.length) {
  console.error(`FAIL: model suggestions must use neutral tiers without brand names (${modelSuggestions.length} found, ${brandedSuggestions.length} branded, ${tierlessSuggestions.length} missing tier)`);
  process.exit(1);
}
console.log(`PASS: model suggestions use neutral tiers (${modelSuggestions.length} scenarios)`);
const v3SourceRef = schema.allOf?.find(rule => rule.if?.properties?.schema_version?.const === 3)?.then?.properties?.sources?.additionalProperties?.$ref;
if (schema.properties?.sources?.additionalProperties?.$ref !== '#/$defs/source' || v3SourceRef !== '#/$defs/sourceV3') {
  console.error('FAIL: schema must keep legacy source compatibility and bind v3 sources to sourceV3');
  process.exit(1);
}
const matrix = read('交接阶段矩阵.md');
if (matrix.includes('候选材料状态') || !matrix.includes('只能描述第六行')) {
  console.error('FAIL: matrix retains mixed status dimensions or stale row reference');
  process.exit(1);
}
const broadcast = read('规则刷新广播包.md');
if (broadcast.includes('发送方事件封套模板') || broadcast.includes('规则 manifest SHA-256：<预期摘要>')) {
  console.error('FAIL: operator broadcast still requires a technical event envelope');
  process.exit(1);
}
const manifestPath = path.join(workflow, '规则刷新manifest.json');
for (const [file, needles] of [
  ['02-总指挥核心规则.md', ['生命周期沿同一记录闭环', '业务任务状态、对话归档与物理资源去留分别记录', 'Inspect-WorktreeLifecycle.mjs', '不默认force', '同步/合并回读完成即触发']],
  ['03-专项任务卡模板.md', ['用途被替代时', '02 Worktree生命周期']],
  ['09-自动化授权与风险分级.md', ['物理清除仍绑定精确对象及有效权限', '缺口仅阻断对应对象']],
  ['10-自动状态索引规范.md', ['不为此另建平行台账', 'semantic_verification=NOT_PERFORMED', 'deletion_authorized=false', '不是完整源码/忽略资产内容哈希']]
]) {
  for (const needle of needles) if (!read(file).includes(needle)) throw new Error(`Lifecycle trigger/authority contract missing in ${file}: ${needle}`);
}
if (!fs.readFileSync(path.join(root, '.github/scripts/Test-Repository.ps1'), 'utf8').includes("& node (Join-Path $PSScriptRoot 'Test-Inspect-WorktreeLifecycle.mjs')")) throw new Error('Lifecycle regression is not wired to the real quality entry');
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const versionedRules = ['00-第二代工作流总览.md', '02-总指挥核心规则.md', '09-自动化授权与风险分级.md', '10-自动状态索引规范.md', '总指挥轻量交接启动配置.md'];
const versions = versionedRules.map(name => read(name).match(/^版本：(\d{4}-\d{2}-\d{2}\.\d+)$/m)?.[1]);
if (manifest.schema_version !== 1 || !Array.isArray(manifest.rules) || !manifest.rule_version || manifest.scope !== 'core_workflow_full' || manifest.path_base !== 'rule_root' || manifest.repository_root_ref !== '../..' || !Array.isArray(manifest.repository_root_prefixes) || !['.github/', '引用的外部工具/'].every(prefix => manifest.repository_root_prefixes.includes(prefix))) {
  console.error('FAIL: rule refresh manifest must declare schema, version, full core scope, dual-root path bases and a rules array');
  process.exit(1);
}
if (versions.some(version => version !== manifest.rule_version)) {
  console.error(`FAIL: rule version and manifest version differ: ${versions.join(', ')} <> ${manifest.rule_version}`);
  process.exit(1);
}
for (const required of REFRESH_REQUIRED_RULES) {
  const item = required.endsWith('-')
    ? manifest.rules.find(entry => entry.path_ref.startsWith(required))
    : manifest.rules.find(entry => entry.path_ref === required);
  if (!item) {
    console.error(`FAIL: rule refresh manifest missing full workflow entry: ${required}`);
    process.exit(1);
  }
}
for (const item of manifest.rules) {
  const base = manifest.repository_root_prefixes.some(prefix => item.path_ref.startsWith(prefix))
    ? path.resolve(workflow, manifest.repository_root_ref)
    : workflow;
  const absolute = path.resolve(base, item.path_ref);
  if (!absolute.startsWith(`${base}${path.sep}`) || !fs.existsSync(absolute) || item.sha256 !== sha256(fs.readFileSync(absolute))) {
    console.error(`FAIL: rule refresh manifest digest mismatch: ${item.path_ref}`);
    process.exit(1);
  }
}
console.log(`Rule refresh manifest: PASS (${sha256(manifestBytes)})`);
const managedPaths = manifest.rules.map(item => manifest.repository_root_prefixes.some(prefix => item.path_ref.startsWith(prefix))
  ? item.path_ref : `总指挥工作流/第二代总指挥的工作模式/${item.path_ref}`);
managedPaths.push('总指挥工作流/第二代总指挥的工作模式/规则刷新manifest.json');
const attrs = spawnSync('git', ['check-attr', '-z', '--stdin', 'eol'], { cwd: root, input: `${managedPaths.join('\0')}\0`, encoding: 'utf8' });
const fields = attrs.stdout?.split('\0') || [];
if (attrs.status !== 0 || fields.length !== managedPaths.length * 3 + 1 || managedPaths.some((file, index) =>
  fields[index * 3] !== file || fields[index * 3 + 1] !== 'eol' || fields[index * 3 + 2] !== 'lf' ||
  fs.readFileSync(path.join(root, file)).includes(13))) {
  console.error('FAIL: every raw-hash-managed file must use LF bytes and an explicit LF checkout attribute');
  process.exit(1);
}
console.log(`Managed checkout line endings: PASS (${managedPaths.length} files)`);
console.log(`Workflow refresh contract: PASS (${checks.length} cases)`);
// These offline fixtures demonstrate observable Git/runtime counterexamples;
// they do not prove a live agent or another member followed the prose above.
const syncFixture = spawnSync(process.execPath, [path.join(root, '.github/scripts/Test-SyncScenarios.mjs')],
  { cwd: root, encoding: 'utf8' }); // Fixture bounds Git/IPC by its deadline and cleans up in finally.
if (syncFixture.status !== 0) {
  console.error(`FAIL: offline sync fixtures: ${syncFixture.error?.message ?? ''}\n${syncFixture.stdout ?? ''}${syncFixture.stderr ?? ''}`);
  process.exit(1);
}
console.log(syncFixture.stdout.trim());

// The steering fixture is a small executable contract for the three regression
// cases: additive steering, scoped cancellation, and a question that must
// return to the original queue. It does not claim to intercept a live client.
const applySteering = (ledger, event) => {
  const next = ledger.map(item => ({ ...item }));
  if (event.kind === 'ADD') next.push({ id: event.id, status: 'OPEN' });
  if (event.kind === 'CANCEL') {
    const item = next.find(candidate => candidate.id === event.id);
    if (!item) throw new Error(`unknown cancellation target: ${event.id}`);
    item.status = 'CANCELLED';
  }
  if (event.kind === 'QUERY') return next;
  return next;
};
const additive = applySteering([{ id: 'A', status: 'OPEN' }, { id: 'B', status: 'OPEN' }], { kind: 'ADD', id: 'C' });
if (additive.map(item => `${item.id}:${item.status}`).join(',') !== 'A:OPEN,B:OPEN,C:OPEN') {
  console.error('FAIL: additive steering replaced or lost an original request item');
  process.exit(1);
}
const cancellation = applySteering([{ id: 'A', status: 'OPEN' }, { id: 'B', status: 'OPEN' }], { kind: 'CANCEL', id: 'B' });
if (cancellation.map(item => `${item.id}:${item.status}`).join(',') !== 'A:OPEN,B:CANCELLED') {
  console.error('FAIL: scoped cancellation changed an unrelated request item');
  process.exit(1);
}
const query = applySteering([{ id: 'A', status: 'OPEN' }, { id: 'B', status: 'OPEN' }], { kind: 'QUERY' });
if (query.map(item => `${item.id}:${item.status}`).join(',') !== 'A:OPEN,B:OPEN') {
  console.error('FAIL: a status question altered the original request queue');
  process.exit(1);
}
console.log('Active-request steering fixtures: PASS (additive, scoped cancellation, query-resume)');
