#!/bin/sh
cd "$(dirname "$0")"
node "./_internal/repair-launch.mjs"
printf "\n按回车退出。"
read -r _
