#!/bin/sh
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '未找到 Node.js，工具无法启动。'
  printf '%s' '按回车键关闭...'
  read -r _
  exit 1
fi

node "$SCRIPT_DIR/_internal/handoff.mjs"
HANDOFF_EXIT=$?
printf '\n%s' '按回车键关闭...'
read -r _
exit "$HANDOFF_EXIT"
