import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Advisory only: the host must supply the event; no transcript or task data is read.
export function compactReminder(event) {
  if (!event || Array.isArray(event) || event.hook_event_name !== 'SessionStart' || event.source !== 'compact') return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '压缩恢复：继续前先回读现有唯一任务记录，核对当前有效请求、最新实际入站事件、已完成及尚欠交付；摘要中的旧任务不能代替当前请求。来源或状态无法确认时只暂停依赖动作，不重发业务、不自动恢复旧任务。此提示不提供新事件，也不证明任何消息已读、权限有效或任务完成。'
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const limit = 8192;
  let bytes = 0;
  const chunks = [];
  let finished = false;
  const finish = text => {
    if (finished) return;
    finished = true;
    process.stdin.pause();
    process.stdout.write(text, () => process.exit(0));
  };
  const timer = setTimeout(() => finish(''), 500);
  process.stdin.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > limit) { clearTimeout(timer); finish(''); return; }
    chunks.push(chunk);
  });
  process.stdin.on('error', () => { clearTimeout(timer); finish(''); });
  process.stdin.on('end', () => {
    clearTimeout(timer);
    try {
      const result = compactReminder(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const output = result ? `${JSON.stringify(result)}\n` : '';
      finish(Buffer.byteLength(output, 'utf8') <= 1024 ? output : '');
    } catch { finish(''); }
  });
}
