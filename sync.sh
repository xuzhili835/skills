#!/usr/bin/env bash
# skills 备份一键同步：本机镜像 → 仓库快照（含自动脱敏）→ commit + push
# 用法：在仓库根目录 bash sync.sh
# 脱敏规则放本地 redact.sed（gitignored，不入库，格式=逐行 sed 表达式；
# 模板见 redact.sed.example）。仓库内永不出现姓名/客户名的字面量。
set -euo pipefail
cd "$(dirname "$0")"

SRC_SKILLS="$HOME/.zcode/skills"
SRC_TASTE="D:/Desktop/skill-主源/skill-copy-taste"

[ -d "$SRC_SKILLS" ] || { echo "找不到 $SRC_SKILLS"; exit 1; }

rm -rf skills sources
cp -r "$SRC_SKILLS" skills
mkdir -p sources
if [ -d "$SRC_TASTE" ]; then
  cp -r "$SRC_TASTE" sources/skill-copy-taste
else
  echo "提示：主源 $SRC_TASTE 不存在，跳过 sources 快照"
fi

# 剥离快照里的内嵌 .git（避免被当成 gitlink 导致内容为空）
find skills sources -depth -name ".git" -exec rm -rf {} + 2>/dev/null || true

# 脱敏（只动仓库副本，本地原件不碰）
if [ -f redact.sed ]; then
  find skills sources -type f \( -name "*.md" -o -name "*.js" -o -name "*.py" \
    -o -name "*.txt" -o -name "*.html" -o -name "*.json" \) \
    -exec sed -i -f redact.sed {} +
else
  echo "警告：无 redact.sed，跳过脱敏（公开仓库请务必配置）"
fi

git add -A
if git diff --cached --quiet; then
  echo "无变化，不需要提交"
else
  git commit -m "sync: skills snapshot $(date +%F)"
  git push
  echo "已提交并推送"
fi
