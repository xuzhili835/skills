# find-bug-skill

> **让 AI 独立跑全栈、按业务闭环找真 bug 的托管式测试技能。**

你说一句"帮我找 bug"或"我去睡了你自己测"，它就自己拉起全栈环境，按业务闭环端到端验证逻辑正确性，打对抗用例，跨 API / UI / DB 三层对账，测完清残留还原基线，最后交一份普通人也能看懂的测试报告。

**核心信念："能跑" ≠ "业务正确"**——返回 200 的接口仍可能业务逻辑是错的：计数没涨、越权没拦、状态乱跳、客户端传的派生值被直接信任。这个技能断言的是规则，不是按钮能不能点。

**文档导读**：本 README 回答"是什么 / 怎么装 / 方法论出处可信吗"；`SKILL.md` 是 AI 的执行手册（人 10 分钟也能读完）；`references/` 只放模板——填好的实例永远在你自己被测项目的仓库里。

## 它测什么(方法论一瞥)

- **一致性/台账**:计数真涨了?派生值服务端算?关联表和聚合数一致?
- **隔离/所有权**:双普通账号+一管理员,互打越权矩阵。
- **状态机**:合法转移走通,非法转移逐个断言拒绝理由。
- **信任边界**:客户端上报负数/超大/0;禁用改密后旧 token 当场失效?
- **守卫一致性**:前端拦了的行为裸调后端绕得过吗?(前端强制 ≠ 后端强制)
- **对抗面**:伪造内部信任头、畸形 JSON、幂等去重、轮询风暴……
- **UI 五类动作**:弹窗闭环 / 双主题遮罩 / 切走切回保活 / 全局状态消费方同步 / 假控件识别。

完整清单见 [SKILL.md](SKILL.md)——它本身就是给 AI 读的执行手册,人读 5 分钟也能看懂打法。

## 快速安装

选你所用工具的那一行，点代码块右上角复制，粘进终端回车（需已装 git）：

```bash
# Claude Code
git clone https://github.com/xuzhili835/find-bug-skill.git ~/.claude/skills/find-bug-skill

# Codex
git clone https://github.com/xuzhili835/find-bug-skill.git ~/.codex/skills/find-bug-skill

# ZCode
git clone https://github.com/xuzhili835/find-bug-skill.git ~/.zcode/skills/find-bug-skill
```

Windows PowerShell 用户请把目标路径换成 `"$env:USERPROFILE\.claude\skills\find-bug-skill"`（其余工具同理换目录）。

装好后**新开一个会话**，说"帮我找 bug / 独立测一轮"即可触发；也可显式调用该技能。升级用 `git -C ~/.claude/skills/find-bug-skill pull`。

其它遵循 Agent Skills 规范的工具：把本仓库克隆进其 skills 目录即可，结构就是标准的 `SKILL.md + references/ + scripts/`。

## 使用流程(AI 视角)

1. **环境自举 + 基线快照**:摸清组件怎么拉起、拍各表行数基线、声明 API/DB/UI 三层可达性(缺哪层必须写明)。
2. **读源码定 ground-truth**:DTO 字段名/校验矩阵/错误码分段从源码确认,不猜;权限真相在入口白名单+服务层守卫两层对照。
3. **逐类断言业务规则 + 打对抗面**(SKILL.md 第 2/3 节清单)。
4. **跨层验证**:API 响应、DB 落库状态、UI 实况三方对账。
5. **清残留还原基线**,按固定格式产出《测试报告》(含覆盖声明/问题/观察项/已验证正确项/数据还原说明)。
6. 默认**只测不修**:问题写进报告等审查;用户明确令修才修,修完回归。

## 为什么不分发"回归校准单"

真实使用中,你会在 `references/` 攒出一张本项目专属的"症状→最小探针→规则"对照表(我们称它回归校准单):它既是下一轮找 bug 前的探针清单核对,又是修复后的冒烟回归单。但它**天然绑定项目内部细节**,公开毫无意义且可能泄露隐私——所以本仓库只提供 [模板](references/calibration-template.md),你的项目你自己攒。

## 兼容性说明

- 方法论与技术栈无关:任何系统都有「对外入口、持久化状态、业务不变量」三要素,变的只是拉起方式和观察手段。第 0 步的"先画像再动手"就是为此设计的。
- 正文若干工具坑(Git Bash 中文编码、Windows `/tmp` 映射等)来自 Windows 开发环境实测;其它平台可忽略对应条目。
- UI 驱动依赖有头浏览器自动化(如 playwright-cli),本技能只定义"抽检哪五类动作",不重复封装驱动命令。

## 方法论出处（2026-08-27 联网逐条核验）

软件测试没有单一圣经——不同层次由不同机构维护，多出处才是诚实地图。本技能各部分对应的权威如下；标注 ✅ 为当日实际访问核验过的活链接，⚠️ 为无法机读、以书目形式给出的引用：

| 本技能的部分 | 对应的成熟方法 | 出处 |
|---|---|---|
| 第 2 节断言类目的技术基础（等价类/边界值/判定表/**状态迁移**测试） | ISTQB CTFL 大纲第 4 章"测试设计与实现" | ✅ [istqb.org/certifications/certified-tester-foundation-level](https://www.istqb.org/certifications/certified-tester-foundation-level)（大纲 v4.0.1 PDF 页面可直接下载） |
| 托管式一轮的流程形态：章程 →限时探索 → 固定格式汇报 | **SBTM（Session-Based Test Management）会话式测试管理**，James Bach 与 Jon Bach 在惠普首创 | ✅ [satisfice.com/session-based-test-management](https://www.satisfice.com/session-based-test-management)（2000 年原创论文在此下载。注：原始论文署名是 Bach 兄弟二人，Michael Bolton 是其后续课程的长期合作者而非本文作者——这是常见的混称，已据原文纠正） |
| 第 3 节对抗面清单的安全部分 | **OWASP WSTG**（Web 安全测试指南），OWASP 旗舰文档项目 | ✅ [owasp.org/www-project-web-security-testing-guide](https://owasp.org/www-project-web-security-testing-guide/)（稳定版 v4.2，5.0 开发中；正式引用其条目时应带版本号如 `WSTG-v42-…`） |
| 条款准入用的质量量纲总图 | **ISO/IEC 25010** 产品质量模型（八大特性；2023 修订版增补 safety） | ⚠️ iso.org 对自动访问返回 403，本书目请自行检索 "ISO/IEC 25010" 于 iso.org 官方目录核实后引用 |
| "从缺陷分类推导攻击目录"的思想源头 | James A. Whittaker，《How to Break Software: A Practical Guide to Testing》（Addison-Wesley, 2002）；Elisabeth Hendrickson，《Explore It!》（Pragmatic Bookshelf, 2013，其 "bug magnets" 即探针思想的先声） | ⚠️ 两家出版社站均已改版无法直链，按书名+作者+ISBN 检索可查证（Whittaker: 978-0201796198；Hendrickson: 978-1937785024） |

### 与上述标准的分歧（如实记录，不粉饰）

- ISTQB 传统要求完整书面用例与需求追踪矩阵；本技能面向 AI 执行者，只保留轻量的"闭环×探针×预期"简表——取 SBTM 的章程精神而非重文档路线。哪边更对取决于执行者是人还是模型。
- 常规缺陷报告只列问题；本技能的报告额外强制"三、已验证正确的逻辑"清单——这是为跨轮回归对照服务的自定义约定，非任何标准要求。

## 原创部分（不声称源自任何标准）

- **回归校准单机制**：每个确认的缺陷沉淀为最小复现探针，存在被测项目仓库随仓库走，逐轮生长为该项目专属的冒烟回归单；
- **条款准入三道闸**（归轴→证据→去重）：把"检查清单从事故长出来、不从头脑风暴长出来"的行业通例写成硬性准入规则，防膨胀；
- **环境托管纪律**：默认"只测不修"、开工拍基线快照、收尾对账还原到行级一致；
- **AI 执行者的工具坑清单**：Windows/脚本栈下真实踩过才会收录的那一类（编码假 500、盘符映射、reactive 安全检查静默放行等）；
- **报告首行"现象（普通人版）"分层纪律**：让不懂技术的审查者也能审计测试产出。



## License

Apache License 2.0，全文见 [LICENSE](LICENSE)。
