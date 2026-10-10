# 组装顺序与可抄骨架代码

> 对应正文:**怎么动手(落地主线)**。把散在各篇的核心编排逻辑收成**可复制骨架**——换语言 / 换栈照抄**结构**,换实现不改编排。标 `[可替换]` 的是技术栈钩子。代码以 Java 作参考实现,算法本身语言无关。
>
> **换 Python / Node / Go 怎么对应**:同结构照抄,只换语法。本 skill 的价值在**编排决策**(为什么前置过滤、为什么 min-score、为什么三分支),这些跨语言不变;检索函数本身是几行余弦,谁都会写,故**不另起一套**。唯一可能卡的是语言习惯——Python 用 `numpy.dot` 算 L2 归一化后的余弦、`numpy.argpartition` 取 topK、列表推导做 scope 过滤;Node / Go 用各自数组库。逐行对应即可,不会因换语言丢任何编排价值。

## 编排主线(一张顺序图)

```
[可选] 多模态预处理:  PDF/图片 → 类型分流 → 抽取/OCR → 质量过滤 → 文本块
建库 seeding:  (业务表 | 预处理文本块) → 切块 → 嵌入 → 入库(每条带 scope)
─────────────────────────────────────────────────────
提问 ask:
  scope 解析 → query 嵌入
  → [scope 前置过滤] 余弦 topK(=点积)
  → min-score 门槛 → 同文档去重 → 分数断崖 → 回表取块
  → 计数类? 注入实时规模
  → 三分支作答(① 越界 / ② 资料答 / ③ 无数据)
  → 拒答检测 → 清/留来源 → 动作解析闸门 → 回传
```

## 骨架 1:检索(scope + min-score + 去重 + 断崖)—— 核心,可抄

```java
List<Hit> retrieve(String query, CurrentUser user, RetrieveOpts opts) {
    // [可替换] scope 定义:GLOBAL / ORG:id / USER:id ...
    Set<String> scopes = scopeResolver.visibleScopes(user);
    float[] q = embeddingProvider.embed(query);     // 须 L2 归一化 → 余弦=点积

    // ① scope 前置过滤 + 余弦(=点积)。绝不检索后过滤(慢 + 日志/缓存层泄漏)
    List<Hit> hits = store.all().stream()
        .filter(v -> scopes.contains(v.scope))
        .map(v -> new Hit(v, dot(q, v.vector)))
        .sorted(Hit.BY_SCORE_DESC)
        .toList();

    // ② min-score 门槛:挡垃圾话(语义嵌入下 ~0.40),职责是挡不是减命中
    hits = filter(hits, h -> h.score >= opts.minScore);
    // ③ topK
    hits = hits.subList(0, Math.min(opts.topK, hits.size()));
    // ④ 同文档去重:同 docId 只留最高分(防一篇霸占名额、来源更多样)
    hits = dedupByDoc(hits);
    // 顺序为什么是「先 min-score 再 dedup」:先门槛把弱命中挡掉,再去重——否则弱 chunk 会先占名额;
    //   而去重只在同 docId 内留最高分,不会丢"某文档唯一过门槛的那块"(它没有同 docId 竞争者)。
    // ⑤ 分数断崖:相邻分数显著落差处截断(如 0.65→0.54),丢突降弱命中
    hits = cliffCut(hits);

    diagnostics.log(query, opts.minScore, hits);    // 必埋:q|minScore|scores@docId|kept
    return hits;     // 命中编号 [1][2] 供作答引用
}
```
> `dot` = 点积(向量已 L2 归一化,=余弦,最快);`minScore` 语义嵌入默认 0.40、hashing stub 下意义弱;`dedupByDoc` / `cliffCut` 是见名知意的小辅助。每步的**为什么**(为什么前置过滤、为什么去重、为什么断崖)见 `vector-store.md` 的 min-score 调参实战——这里只给可抄的形。

## 骨架 2:三分支 system prompt(可抄文本)

```
你是 {平台} 的知识助手,只依据【资料】作答。按三分支判断:
① 输入不是清晰业务问题(闲聊/脏话/与业务无关)→ 只回这句,不改写不复述:
   "该内容不在知识库服务范围,请提出与{业务域}相关的具体问题"。
② 业务问题且【资料】能答 → 依据资料简明作答,[序号]标来源;资料未覆盖可用通用知识补充并注明"(通用知识,非本平台数据)"。
③ 业务问题但【资料】答不了(实时库存/营业额等平台动态数据)→ 回"知识库暂无该数据",可一句话引导去对应页面,不复述无关资料。
规则:①③ 措辞必须不同(供下面的拒答检测区分)。计数问题(多少/几个/规模)优先用注入的【实时规模】,不用文档里的旧数字。
```

## 骨架 3:拒答检测(确定性 contains,不靠 LLM 自觉)

```java
static final String FIXED_REFUSAL = "该内容不在知识库服务范围";   // ① 的固定句(③ 不含此句)
boolean isRefusal(String answer) { return answer.contains(FIXED_REFUSAL); }
```
> 因骨架 2 里 ①③ 措辞不同,③「暂无该数据」不含 ① 的固定句 → 不会被误标越界。这就是「措辞分流」落到代码的钩子。

## 骨架 4:动作解析闸门(防 LLM 硬塞无关按钮)

```java
Optional<Action> parse(String raw, CurrentUser user, List<Hit> hits, String query) {
    // LLM 末尾自标 [[ACTION|label|route]],正则抽出
    Match m = extractAction(raw);
    if (m == null) return empty();
    // 闸1:target 须是本角色合法路由(防臆造/越权)
    if (!visibleRoutes(user).contains(m.route)) return empty();
    // 闸2:label 用目录标准名覆盖 LLM 自拟(防张冠李戴)
    String label = catalogStandardName(m.route);
    // 闸3:主题词须出现在【最相关来源标题】或【原始 query】(只认来源会误杀,故双认)
    if (!topicIn(m.topic, hits, query)) return empty();
    return Optional.of(new Action(label, m.route));
}
```
> 用**原始 query** 做主题匹配,不能用拼了目录的 prompt 文本(后者含路由名会误命中)。
> `topicIn(topic, hits, query)` 语义:`topic` 出现在**任一命中来源的标题**或**原始 query** 文本里(大小写不敏感的 `contains`)即真——两边都认,避免只查来源标题而误杀合理的 query 主题词。

## 组装顺序(对应落地主线)

- **MVP**:骨架 1 去掉 scope/minScore/去重/断崖(裸 topK 检索)+ 骨架 2 只 ② 分支 + Provider stub。
- **迭代**:把骨架 1 的 scope → minScore → 去重 → 断崖**逐个**加回;骨架 2 的 ①③ 分支加回;骨架 3(拒答检测)、骨架 4(动作闸门)依次上;计数注入、多轮、兜底、日志按落地主线顺序补。

> 每个骨架加回来后**单独验收**(见 SKILL「怎么动手」的验收点),别一次铺全——铺全 = 每层都没验 = 出 bug 不知道是哪层。
