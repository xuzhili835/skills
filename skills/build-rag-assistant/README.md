# build-rag-assistant

[中文](#中文) | [English](#english)

---

## 中文

> 一个 Claude Code skill:从零搭建能上生产的 RAG 知识库问答助手——检索增强管线 + 悬浮对话框,附可抄骨架与踩坑口径。

**build-rag-assistant** 是一个**指导型 Claude Code skill**——告诉 Claude(或任何照着做的人)**怎么从零搭一个能上生产的 RAG 知识库问答助手**:后端检索增强管线 + 前端悬浮对话框。

它不是又一份"能跑的 demo",而是**编排决策 + 可抄骨架 + 踩坑口径**——每一层都附「为什么这么做」,是实战踩坑后定的口径,不是默认配置。

### 它解决什么

搭 RAG 助手的人通常卡在:

- 检索召回一堆垃圾话 / 弱命中,靠调 topK 没用
- 跨租户串读(看到别人的数据)
- 越界问题(闲聊 / 脏话)被一本正经地答了
- 答非所问、计数答陈旧数字、服务挂了却显示"通用知识"
- 拒答时还列着 5 条来源

本 skill 把这些坑逐个给了**确定性的、可审计的解法**。

### 特点

- **编排决策为主,代码为辅** —— 价值在"为什么 scope 前置过滤、为什么 min-score 挡垃圾话、为什么三分支 prompt",这些跨语言;骨架可抄,换语言照搬结构。
- **渐进式搭建** —— 先跑通最小闭环(stub 也能端到端),再逐层加,每层单独验收。
- **可选层显式** —— 多模态预处理、多轮记忆、通用兜底、安全合规,按需开;不开就声明跳过(silent skip = 看不见的缺口)。
- **失败 / 降级路径** —— 空库首启、配额耗尽、超时、熔断器,不只画正常流。

### 快速开始

**装到 Claude Code** —— clone 到 skills 目录(一行搞定):

**macOS / Linux**

```bash
git clone https://github.com/xuzhili835/build-rag-assistant-skill.git ~/.claude/skills/build-rag-assistant
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/xuzhili835/build-rag-assistant-skill.git "$env:USERPROFILE\.claude\skills\build-rag-assistant"
```

**触发** —— 在 Claude Code 里说「搭一个 AI 知识库问答助手」「给系统加个 RAG 助手」「做个知识库 chatbot」,Claude 会自动加载本 skill。

**不用 Claude Code 也行** —— 它也是一份独立的 RAG 搭建方法论。直接读 `SKILL.md`,按层从底往上垒;`references/` 是各层详细实现与可抄骨架。

### 结构

```
build-rag-assistant/
├── SKILL.md                            # 入口:开工确认 → 决策 → 落地主线 → 后端 11 层 → 前端
└── references/
    ├── providers-and-stack.md          # 嵌入/作答 Provider 抽象 + 成本开关(云/本地,OpenAI 兼容)
    ├── vector-store.md                 # 向量库选型 + scope 隔离 + 建库/增量更新 + min-score 调参
    ├── answer-strategy.md              # 三分支作答 + 拒答检测 + 无数据引导 + 失败/降级路径
    ├── conversation-and-fallback.md    # 多轮记忆 + 通用兜底 + 对话日志治理 + 安全/合规基线
    ├── frontend-floating-chat.md       # 悬浮对话框:portal/样式隔离/四态显示/移动端
    ├── skeleton-and-assembly.md        # 可抄骨架(检索/三分支prompt/拒答检测/动作闸门)
    ├── multimodal-preprocessing.md     # (可选)PDF/图片 → 文本 前置预处理
    └── troubleshooting.md              # 9 个症状 → 排查路径
```

### 适用 / 不适用

**适用**:在业务系统里嵌一个知识库问答助手(企业内部知识、智能客服、政策 / 产品问答),几百~几千文档规模,文本为主。

**不适用**(需在此基础上另行扩展,文档里标了边界与扩展点):大规模(数万+)向量检索、纯多模态场景(重度 OCR / 表格还原)、长对话 / 陪伴式助手、独立 RAG 微服务产品。

### 许可证

MIT —— 见 [LICENSE](LICENSE)。

---

## English

> A Claude Code skill for building a production-grade RAG knowledge-base Q&A assistant — retrieval pipeline + floating chat UI, with copyable skeletons and battle-tested decisions.

**build-rag-assistant** is a **procedural Claude Code skill** — it tells Claude (or anyone following along) **how to build a production-ready RAG knowledge-base Q&A assistant from scratch**: a backend retrieval-augmented pipeline plus a frontend floating chat widget.

It's not another runnable demo. It's **orchestration decisions + copyable skeletons + hard-won gotchas** — every layer comes with the *why*, distilled from real production experience rather than default config.

### The pain it solves

People building RAG assistants usually get stuck on:

- Retrieval returning junk / weak hits; tuning topK doesn't help
- Cross-tenant data leakage (seeing someone else's data)
- Off-topic input (chitchat / profanity) answered with a straight face
- Wrong answers, stale counts, "general knowledge" shown when the service is actually down
- Sources still listed on a refusal

This skill gives each of these a **deterministic, auditable** fix.

### Features

- **Decisions over code** — the value is *why* scope is pre-filtered, *why* min-score gates junk, *why* a three-branch prompt. These are language-agnostic; skeletons are copyable, swap languages and keep the structure.
- **Progressive build** — get the minimal loop working first (stubs are fine), then add layers, validating each before the next.
- **Explicit optional layers** — multimodal preprocessing, multi-turn memory, general-knowledge fallback, security/compliance. Turn on as needed; if skipped, declare it (silent skip = invisible gap).
- **Failure / degradation paths** — empty KB on first boot, quota exhausted, timeout, circuit breaker. Not just the happy path.

### Quick start

**Install into Claude Code** — clone straight into the skills folder:

**macOS / Linux**

```bash
git clone https://github.com/xuzhili835/build-rag-assistant-skill.git ~/.claude/skills/build-rag-assistant
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/xuzhili835/build-rag-assistant-skill.git "$env:USERPROFILE\.claude\skills\build-rag-assistant"
```

**Trigger** — in Claude Code, say "build an AI knowledge-base assistant" / "add a RAG assistant to my app" / "make a chatbot for my docs", and Claude auto-loads this skill.

**Without Claude Code** — it's also a standalone RAG methodology. Read `SKILL.md`, build the layers from the bottom up; `references/` holds per-layer details and skeletons.

### Structure

```
build-rag-assistant/
├── SKILL.md                            # Entry: kickoff questions → decisions → build path → backend 11 layers → frontend
└── references/
    ├── providers-and-stack.md          # Embedding/chat Provider abstraction + cost switch (cloud/local, OpenAI-compatible)
    ├── vector-store.md                 # Vector store selection + scope isolation + seeding/incremental + min-score tuning
    ├── answer-strategy.md              # Three-branch answering + refusal detection + no-data guidance + failure/degradation
    ├── conversation-and-fallback.md    # Multi-turn memory + general-knowledge fallback + log governance + security/compliance baseline
    ├── frontend-floating-chat.md       # Floating chat: portal/style isolation / four-state UI / mobile
    ├── skeleton-and-assembly.md        # Copyable skeletons (retrieve / 3-branch prompt / refusal detect / action gate)
    ├── multimodal-preprocessing.md     # (optional) PDF/image → text preprocessing
    └── troubleshooting.md              # 9 symptoms → diagnostic paths
```

### Scope

**Fits**: embedding a knowledge-base assistant into a business app (internal knowledge, support, policy/product Q&A), hundreds-to-thousands of docs, mostly text.

**Doesn't fit** (extend on top — boundaries & extension points are marked in the docs): very large-scale (100k+) retrieval, heavily multimodal (heavy OCR/table), long-conversation companions, standalone RAG microservice products.

### License

MIT — see [LICENSE](LICENSE).
