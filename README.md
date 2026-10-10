# skills — 个人 AI Skills 全量备份

个人工具 skill 备份仓库。本机 Claude Code / ZCode / Codex 等工具的用户级 skills，按四镜像同源方式维护，此处为其公开备份与迭代主入口。

> 注：仓库副本内个人姓名与客户项目名做了通用化替换（姓名→「本人」、项目代号→通用词），本地原件未动；替换规则在本地 `redact.sed`（不入库，模板见 `redact.sed.example`），每次同步自动执行。

## 结构

```
skills/                  ← ~/.zcode/skills 的完整快照（9 个 skill）
sources/
  skill-copy-taste/      ← copy-taste 的编辑主源（改动从这里出发）
sync.sh                  ← 一键同步：重新快照 + 自动脱敏 + commit + push
redact.sed.example       ← 脱敏规则模板（真实规则文件 redact.sed 不入库）
```

## 四镜像同源

本机四个工具目录的 `skills/` 内容保持逐字一致，互为镜像：

| 工具 | 目录 |
|---|---|
| ZCode | `~/.zcode/skills/` |
| Claude Code | `~/.claude/skills/` |
| 通用 | `~/.agents/skills/` |
| Codex | `~/.codex/skills/` |

仓库快照取 `~/.zcode/skills` 一份即可（四方 diff 已验证一致）。

## 更新流程（迭代方法）

1. 改动 skill：统一改**主源**（若有，如 `sources/skill-copy-taste` 对应本地 `D:\Desktop\skill-主源\`），或直接改任一镜像目录；
2. 把改动同步到其余镜像（本机流程：改完一处 `cp` 到另外三处）；
3. 在本仓库根目录跑：

   ```bash
   bash sync.sh
   ```

   脚本做四件事：重新快照 `~/.zcode/skills` → 重新快照主源 → 执行脱敏替换 → 有差异才 commit + push。
4. 新机器恢复：把 `skills/` 下各目录拷回任一工具的 `skills/` 即可（skill 为自包含目录：SKILL.md + references/ 等附件）。

## skill 清单（9 个）

| skill | 用途 |
|---|---|
| audit-data-model | 数据库模型自洽性审计 |
| autopilot | 托管式自主工作模式 |
| build-rag-assistant | 从零搭建 RAG 知识库问答助手 |
| copy-taste | 中文文案审判与改写（去 AI 味 + 槽位治理） |
| db-migrate | 版本化数据库迁移自动应用 |
| find-bug-skill | 托管式独立找 bug（端到端业务闭环测试） |
| iterate-model | 工业 AI 模型长程迭代与冲分方法论 |
| playwright-cli | 浏览器自动化 |
| project-doc | 实训/项目工作文档三线分流（周报/技术方案/讲解文档） |

## 版权

内容为个人工作沉淀，未附开源许可证（保留所有权利）；`copy-taste` 的规则体系借鉴 [jiji262/humanizer-chinese](https://github.com/jiji262/humanizer-chinese)（MIT）的实测思路，未包含其文件。
