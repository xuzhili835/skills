# 排障决策树(症状 → 排查路径)

> 对应正文:**怎么动手(落地主线)** + 各层验收。RAG 实战最费时的不是搭,是「为什么不对」。把散在各篇的排障经验集中成决策树——**按症状进,按路径查**,别凭感觉。

## 先看检索诊断日志(一切的入口)

每条检索应打 `q | minScore | scores@docId | kept`。90% 的问题先看这条:
- `kept=0` 且 scores 全低于 minScore → 门槛 / 嵌入 / 建库(症状 1)
- `kept>0` 却答非所问 → 作答 prompt / 资料脏(症状 3)
- scores 里同 docId 霸占 → 没做同文档去重(症状 5)
- 日志没打 → 诊断没埋,**先补**(没它等于瞎调)

## 症状 → 路径

### 1. 正经问题却 0 命中(kept=0)
- scores 全低于门槛?→ minScore 是否调太高(语义嵌入别 >0.50,会误伤沾边的正经问题)→ `vector-store.md` 调参 ②
- scores 全极低?→ `embedding.impl` 没真切到语义模型(stub hashing 下分数无意义)→ `providers-and-stack.md`
- 换个同义问法就命中?→ 模型该能处理同义;不能则模型太弱 / 向量没 L2 归一化

### 2. 跨租户串读(A 看到 B 的数据)—— 红线,必查
- retrieve 里 scope 是不是**前置过滤**?(检索后再过滤 = 泄漏)→ `skeleton-and-assembly.md` 骨架 1 ①
- `visibleScopes(user)` 算对没?(漏 GLOBAL 会丢公共数据,多挂别人 id 就串)
- 建库时每条向量带对 scope 没?(seeder 给每条业务数据挂正确 scope)→ `vector-store.md` 层 2

### 3. 命中了却答非所问 / 复述无关资料
- system prompt 没三分支?(没分流 → 对沾边资料硬编)→ `skeleton-and-assembly.md` 骨架 2
- temperature 太高?(贴资料作答调低 ~0.2)→ `answer-strategy.md`
- 资料文本本身脏?(看 `hit.snippet`)

### 4. 越界问题(闲聊 / 脏话)被正经作答
- ① 分支的固定拒答句在 prompt 里没?→ `skeleton-and-assembly.md` 骨架 2 ①
- `isRefusal` 没调 / `FIXED_REFUSAL` 拼错?→ 骨架 3
- ①③ 措辞撞了?(同句 → ③ 无数据被误判越界,或反之)→ `answer-strategy.md` 层 4 坑

### 5. topK 被同一篇文档霸占、来源单一
→ 没做同文档去重。`dedupByDoc`:同 docId 只留最高分 → 骨架 1 ④

### 6. 计数问题答了陈旧数字
→ 没注入实时规模。识别计数类(多少 / 几个 / 规模)→ 实时 count 前置注入 → `answer-strategy.md` 计数类

### 7. 报「通用知识」但其实是服务挂了
→ 作答 API 异常被当成「本地 0 命中 → 通用兜底」。Provider 失败应抛异常 → 编排层标 `mode=error`,而非 `mode=general` → `providers-and-stack.md`「作答异常 ≠ 通用兜底」

### 8. 第 2 问起越来越慢
→ 多轮历史膨胀没瘦身。取最近 N 轮、每条截断 → `conversation-and-fallback.md` 层 8

### 9. 换账号 fab 位置 / 历史串了
→ 前端位置 / 历史没按用户隔离(位置别落全局 localStorage、历史 key 带 userId)→ `frontend-floating-chat.md`

## 通用排障纪律
- **先读诊断日志再调参**,别凭感觉(没日志 = 瞎调)。
- **一次只改一个变量**,改完看日志再下一步(系统性调试,别堆改动)。
- **stub → 真实模型**切换前,先确认 stub 下管线通,再换——否则分不清是管线 bug 还是模型问题。
