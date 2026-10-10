---
name: build-rag-assistant
description: 从零搭建一个 RAG 知识库问答 AI 助手(后端检索增强管线 + 前端悬浮对话框)。何时用——想做一个 AI 问答助手 / 知识库 chatbot / RAG agent / AI 精灵 / 智能客服,或说"搭一个 AI 助手""做个知识库问答""检索增强问答""给系统加个 AI 问答"。用于在应用里从零建一个带悬浮对话框的 RAG 助手;不用于一次性 LLM 调用、纯聊天 API 集成、或搭 MCP 服务端(那用 mcp-builder / build-mcp-server)。
---

# 从零搭建 RAG 知识库问答 AI 助手

一套经实战验证的建法。按下面的层从底往上垒;每层附「为什么」——这些是踩过坑后定的口径,不是默认配置。**详细实现与可替换的参考技术栈在 `references/` 下对应篇章,按需 Read,不必一次全读。**

> **范围边界**:本 skill 以**纯文本**知识库问答为主(业务表 / 文档文本 → 切块嵌入);**PDF / 图片经预处理转文本后可纳入**(可选前置层,见 `references/multimodal-preprocessing.md`)。**不做**:OCR 引擎内部调参、版面深度还原、cell 级表格结构化、语音——那是文档解析引擎的活,自行立项或用现成方案,别默认开箱支持。
>
> **非文本输入的硬边界(别静默处理)**:用户若传入图片 URL / PDF / 语音等非文本,**作答前必须拦截**——检测到非文本 → 返回固定提示(如「当前仅支持文本问答」),不要把非文本静默塞给嵌入 / 作答模型(行为未定义、可能空答或报错)。这是代码层边界,不只靠说明。
>
> ⚠️ **"非文本"不止看 Content-Type**:用户在**纯文本里贴图片 / PDF 的 URL**(如「分析这张图 https://x/a.png」)也要拦——扫 query 里的 URL + 文件后缀(`.png/.jpg/.pdf/.mp3…`),命中即按非文本处理、回固定提示(「暂不支持图片 / PDF,请用文字描述」),否则模型会拿 URL 当文本瞎答。
>
> **PDF / 图片知识源(可选预处理层)**:知识源若含 PDF / 扫描件 / 图片,在切块嵌入**前**加一层预处理——类型分流(数字 PDF 直接抽文本、扫描件 / 图片走 OCR、表格保结构)→ 质量过滤 → 产出文本块,下游检索 / 作答全复用、不污染。完整骨架 + 选型 + 质量闸门见 `references/multimodal-preprocessing.md`。⚠️ **OCR 引擎内部调参 / 版面深度还原 / cell 级表格结构化 / 语音不在范围**——那是文档解析引擎的活,本层只调现成库把非文本变成文本,不重造轮子。

> **已有半成品 / 做过 RAG 卡住了?** 别从头读——直接跳 `references/troubleshooting.md` 按症状查:0 命中 / 跨租户串读 / 命中却答非所问 / 越界被正经答 / topK 被一篇霸占 / 计数答陈旧数字 / 报通用知识其实是服务挂了 / 第 2 问起变慢 / 换账号 fab 位置历史串。9 个症状各有一条排查路径。

## 开工前:先跟用户对齐,再动手(别默认全铺 / 全跳)

本 skill 可选层多(多模态预处理 / 多轮记忆 / 通用兜底 / 安全合规)。**别埋头按默认全铺、也别擅自全跳**——开工前先用几个关键问题跟用户对齐,再定路径。

**真正要问用户的(改变主干路径,别替用户做主)**:
- **知识源是纯文本 / 业务表,还是含 PDF / 图片 / 扫描件?** → 含 → 加多模态预处理层(`multimodal-preprocessing.md`);纯文本 → 跳过。
- **后端什么语言 / 栈?**(Java / Python / Node / Go)→ 决定参考实现怎么对应,不改编排。
- **知识量级?**(几百 / 几千 / 数万以上)→ 决定内存检索够不够、要不要独立向量库。
- **在线 API 还是本地模型?**(数据出不出域 / 有无外网)→ 云端 OpenAI 兼容,或本地 vLLM / Ollama。

**下面这些可选层走默认 + 声明即可,不必逐个追问**(用户没特别说就按推荐做,做没做都在输出里显式声明——见「跳过可见性」):多轮记忆(默认做)、通用兜底(默认做)、安全 / 合规基线(生产必补、声明待补)。

下表是上面几个问题的**默认答案 + 非默认时的跳转路径**,供参照,不必逐行问用户。本 skill 参考实现是 Java/Spring,但**算法与编排语言无关**,换语言照抄结构即可。

| 要摸清 | 默认 / 推荐 | 若你不是默认情况 |
|---|---|---|
| **语言 / 后端栈** | 参考实现 Java/Spring | 检索 = 余弦排序、作答 = prompt 拼接,Python / Node / Go 照抄骨架(`skeleton-and-assembly.md`),换语法不改编排 |
| **向量存哪 / 现有库** | 关系库存档 + 内存检索(零新依赖) | 已有 MySQL / PostgreSQL / SQLite 都能直接用;只有量级大或多实例共享才上独立向量库(`vector-store.md` 判定线) |
| **知识量级** | 几百~几千条 → 内存检索够 | 数万以上、或单次检索 >50ms → 看 `vector-store.md` 多维判定线 |
| **在线 API 还是本地模型** | MVP 先 stub(不接任何模型跑通管线);接真实模型时云或本地都行 | 数据不出域 / 内网 / 无外网 → 本地 Ollama(OpenAI 兼容端点),与云端走同一个 Provider 抽象,只换 `base_url`(`providers-and-stack.md`) |

> 这 4 条摸清后,「决策先定」给的就是对应默认答案;和默认不同时按右列跳对应篇章,不必通读全部。

## 决策先定(基于上表的默认推荐)

- **嵌入 + 作答同源**(同一家云平台、或同一套本地服务),走 **OpenAI 兼容**端点——**云端或本地模型都行**,只换 `base_url`。用 `Provider` 接口抽象 + `impl` 配置 opt-in,换实现不动业务。详见 `references/providers-and-stack.md`。
- **向量库别上重武器**:应用内存检索 + 关系库存档就够(几百~几千文档);不到万不得已不引独立向量库。详见 `references/vector-store.md`。
- **scope 行级隔离是安全底线**,不是优化——检索前过滤、绝不检索后过滤。详见 `references/vector-store.md`。

## 怎么动手(落地主线)

别一上来铺全部 12 层——按「先跑通最小闭环,再逐层加」推进,每加一层**先验收再加下一层**,避免「全铺开却每层都没验」。**可抄骨架代码**见 `references/skeleton-and-assembly.md`。

> **知识源含 PDF / 图片 / 扫描件?** 先加可选的**多模态预处理层**(`references/multimodal-preprocessing.md`),把非文本转成文本块,再喂下面的建库切块——下游全复用、一行不改。纯业务表 / 纯文本知识源跳过这层。

**最小可用闭环(MVP)**:Provider stub(hashing 嵌入 + templated 作答,不接真实模型也能端到端跑)→ 自动建库(1 张业务表切块→嵌入→入库)→ 裸检索(query 嵌入→余弦 topK→作答,**先不要** scope/min-score/三分支)。
> 验收:能问一个问题、拿到基于资料的答案(stub 也行)——证明管线通了。

**然后迭代加层(每层单独验收,再加下一层)**:
1. **scope 前置过滤** → 验收:换租户只看到自己数据(**串读=红线,必测**)→ `vector-store.md`
2. **接真实 Provider** → 验收:控制台见嵌入/作答调用记录 → `providers-and-stack.md`
3. **min-score 门槛** → 验收:垃圾话不再满 topK(看诊断日志 scores)→ `vector-store.md`
4. **三分支作答 prompt** → 验收:越界回固定拒答句、无数据回「暂无该数据」、措辞不同 → `answer-strategy.md`
5. **拒答检测 + 清来源** → 验收:拒答时来源面板空 → `answer-strategy.md`
6. **无数据引导跳转** → 验收:查不到的出 1 个跳转(限当前角色可见页)→ `answer-strategy.md`
7. **计数问题注入实时规模** → 验收:答实时 count 非旧文档数 → `answer-strategy.md`
8. **多轮记忆**(可选)→ 追问「它」能消解 → `conversation-and-fallback.md`
9. **通用知识兜底**(可选)→ 本地 0 命中标「通用知识」→ `conversation-and-fallback.md`
10. **对话日志治理** → 每条落库、异常正确标记 → `conversation-and-fallback.md`
11. **失败 / 降级路径** → 验收:空库首启跳作答显「建设中」;配额耗尽 / 超时显 `mode=error`、**不混入**通用兜底 → `answer-strategy.md`

**MVP 跑通就埋**(后续每层验收都靠它):检索诊断日志 + 对话日志;**接真实 Provider 前就配**:成本开关。

**调参 / 出问题别凭感觉**:按 `references/troubleshooting.md` 的「症状 → 排查路径」查(0 命中 / 串读 / 答非所问 / 计数陈旧 / 服务异常 …)。

## 后端 RAG 管线

1. **scope 隔离先行(安全底线)**:定义租户 scope,检索前过滤、绝不检索后过滤。→ `references/vector-store.md`
2. **自动建库(seeding)**:优先从已有业务表生成知识文档(主数据→切块→嵌入→入库),一键重建。→ `references/vector-store.md`
3. **检索**:query 嵌入 → 余弦 top-k → **min-score 门槛**(挡垃圾话/弱命中)→ 命中片段编号 `[1][2]` 供引用。→ `references/vector-store.md`
4. **三分支作答 prompt(关键)**:① 非业务问题→固定拒答句;② 资料能答→作答标来源;③ 资料答不了→「暂无该数据」。措辞刻意分流。→ `references/answer-strategy.md`
5. **越界 / 拒答检测(确定性)**:按①的固定拒答句做 `contains` 判定,不靠 LLM 自觉。→ `references/answer-strategy.md`
6. **无数据 → 挂引导跳转**:branch③ 时按 query 主题词挂 1 个跳转按钮,把用户送去能查到数据的页。→ `references/answer-strategy.md`
7. **来源回传(可溯源)**:命中片段回传 `{title, snippet, docId, score}`,序号对齐正文;拒答时清空来源。→ `references/answer-strategy.md`
8. **多轮记忆**:最近 N 轮按用户持久化,作答带 history 消解追问指代;历史要瘦身。→ `references/conversation-and-fallback.md`
9. **通用知识兜底(可选)**:本地 0 命中 → 回退模型通用知识,前端显标识;约束不臆造平台专属数据。→ `references/conversation-and-fallback.md`
10. **对话日志治理**:每条提问落库,异常规则(无效/越界/0命中/高频/重复);第一天就埋。→ `references/conversation-and-fallback.md`
11. **Provider 抽象 + 成本开关**:`ChatProvider`/`EmbeddingProvider` 接口 + 管理员一键关停开关。→ `references/providers-and-stack.md`

## 前端悬浮对话框

12. **悬浮精灵对话框**:可拖 fab + 面板、位置会话内有效(重进重置)、历史按用户隔离、Markdown 渲染打包不引 CDN、三分支显示各异、尊重 `prefers-reduced-motion`。→ `references/frontend-floating-chat.md`

## 跳过可见性(必做)

本 skill 的层是这套助手的完整骨架。若某层这次不做(如不做多轮、不做通用兜底、不做日志治理),**输出里必须显式声明"跳过了层 X,因为 Y"**。silent skip = 看不见的缺口;declared skip = 可审的决策。

做完自检:scope 是否前置过滤?三分支措辞是否分流?拒答是否清来源?无数据是否挂了引导?位置是否重进重置?历史是否按用户隔离?MD 渲染是否打包不引 CDN?
