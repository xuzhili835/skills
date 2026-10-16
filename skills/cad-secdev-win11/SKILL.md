---
name: cad-secdev-win11
description: "CAD 软件二次开发经验库（Windows 11 中文环境亲历验证）：pywin32 COM 稳定写法（动态绑定属性赋值失败、RPC_E_CALL_REJECTED 重试、CECOLOR 污染、SelectionSet 批量清理、多 acad.exe 进程）、中文 bat 必须 GBK+CRLF、cmd/GitBash 双 Python 环境差异、混合编码日志、DXF 图纸结构识别与标注算法教训、幂等可重跑脚本设计、几何签名验收。凡涉及 CAD 二次开发、COM 自动化开发、pywin32/win32com、ezdxf 处理 DXF、写 bat 启动 CAD 脚本、中文乱码、'Property can not be set'、'呼叫被拒'、引线/球标/标注识别、批量改图脚本、CAD 脚本验收对比，即使没点名本技能也应使用。执行型 AutoCAD 绘图/出图任务用 autocad-automation 技能；本技能负责'把二次开发代码一次写对'。"
metadata: { "os": ["win32"], "requires": { "anyBins": ["python"], "pythonPackages": ["pywin32"] } }
---

# CAD 二次开发 · Windows 11 经验库

本技能浓缩了在 Windows 11 中文环境（cmd 代码页 936/GBK）下做 CAD 软件二次开发的亲历经验：AutoCAD 2026 pywin32/COM 自动化、ezdxf 离线解析 DXF、bat 启动脚本、图纸识别算法与验收闭环。每条经验都来自真实踩坑，目标是让同类代码**一次写对**，不再重复交学费。

## 定位与分工

| 需求 | 用哪个技能 |
|---|---|
| **怎么把二次开发代码写对**（COM 稳定性、编码、算法教训、验收方法） | 本技能 |
| 执行型 AutoCAD 任务（画图、出图、批量改图，用现成脚本） | `autocad-automation`（`C:\Users\ASUS\.agents\skills\autocad-automation\SKILL.md`，实现在 `solidworks-automation\subskills\autocad-automation\`） |
| SolidWorks 原生建模/装配/工程图 | `solidworks-automation` |

本技能与 autocad-automation 不冲突：那边是"工具箱"，这边是"施工规范"。做任何 AutoCAD COM 开发前，先读完本技能的红线表和 `references/com-autocad.md`。

## 本机适配（B-rep3转2 工作机收录，2026-10-14）

本技能由队友在其机器上沉淀后收录，红线与模式通用；以下事实**因机器/项目而异**，冲突时以本节为准：

- **Python 环境**：本机统一显式路径 `D:/condaenv/brep/python.exe`（cadquery/OCP/ezdxf 1.4.4/pywin32 全）。"cmd 与 Git Bash 解析到不同 Python"是队友机器实测——本机一律写显式路径即可规避，不必按红线 #2 绕 cmd。
- **他人路径**：`C:\Users\ASUS\...` 下的 autocad-automation / solidworks-automation 是队友机器的技能，本机没有——本技能自洽使用，"工具箱"缺位不影响红线表与 references 的效力。
- **颗粒度边界**：`references/dxf-geometry.md` 的阈值与判据出自其图纸识别项目（LEADER/球标标注识别），**思路可借、数字不直接搬**——换项目先按"第一步永远是结构探查"重测自己的数据。
- **定位**：本技能=红线速查+踩坑案例库，防"重复交学费"，**不约束实现路径**；与项目自身的工具链约定冲突时，以项目 README / 工作区 AGENTS.md 为准。
- 本机已回写的追加坑：DXF 中文文字样式与 $EXTMIN 覆盖（见 dxf-geometry.md"ezdxf 使用注意"末两条）、PlotToFile 中文路径（见 com-autocad.md"易错 8"）、OCC 剖视图切盒中心化/剖面线精度口径/细线视觉验收（见 dxf-geometry.md 末节，2026-10-16）。

## ⚠️ Win11 红线速查表

中文版 Windows 11（控制台代码页 936/GBK）上最容易出错、且出错方式最迷惑的指令/步骤。**动工前扫一遍这张表**；细节和代码见对应 references。

| # | 场景 | 易错指令/步骤 | 典型现象 | 防错处理 |
|---|------|--------------|---------|---------|
| 1 | 写含中文的 .bat | UTF-8 保存 + `chcp 65001` | 行被拆成 `'1'`、`'cho.'` 等碎片，报"不是内部或外部命令" | **必须存 GBK + CRLF**，禁用 chcp 65001 方案；用 `scripts/make_gbk_bat.py` 转换 |
| 2 | 从 Git Bash 跑 Python | 直接 `python xxx.py` | 解析到旧环境（3.8.6/ezdxf 1.1.4），与双击 bat 行为不一致 | 交付验证用 `cmd //c "python ..."` 走 cmd 那套（3.12.6/ezdxf 1.4.4） |
| 3 | 传复杂命令行参数 | `cmd //c "python -c \"...\""` | 引号转义错乱、参数被拆 | 复杂逻辑写成临时 .py 文件再调用，不走 -c 内联 |
| 4 | 查看脚本输出 | `iconv` 管道转混合编码流 | cannot convert，并杀掉整个管道 | 落文件 `< nul > _run.log 2>&1`，再逐行尝试 utf-8/gbk 解码；用 `scripts/run_capture.py` |
| 5 | COM 属性赋值 | 动态绑定下 `ent.Layer = x` | 报 "Property can not be set" | `gencache.EnsureDispatch` 转早期绑定 |
| 6 | AutoCAD 忙时调用 | 任意 COM 调用 | RPC_E_CALL_REJECTED (-2147418111) | 所有 COM 调用套重试装饰器 `scripts/com_retry.py` |
| 7 | 画新实体 | 依赖会话默认颜色 | 新实体继承 CECOLOR（用户会话可能是红色） | 画前 `doc.SetVariable("CECOLOR","256")` 或给实体显式设 Color |
| 8 | 大图清理/取实体 | 逐个遍历 ModelSpace.Item(i) | 2.7 万实体极慢且频繁被拒 | `SelectionSet.Select(5, ..., DXF过滤器)` + Erase；按句柄取实体用 `doc.HandleToObject` |
| 9 | 缩放视图 | `Application.ZoomWindow` | 对参数变体挑剔，受活动文档影响 | `doc.SendCommand('_.ZOOM _Window x1,y1 x2,y2 ')` |
| 10 | 多个 acad.exe 进程 | `GetActiveObject` 后按索引取文档 | 只连上 ROT 注册的那个；关文档后索引漂移删错文档 | 循环重扫 Documents 直到没有目标文档，不缓存索引 |
| 11 | 保存只读文件 | 对原路径 Save/SaveAs | 拒绝访问 | `doc.SaveAs(新路径, 61)` 另存为 2013 DXF（61 = ac2013_dxf，AutoCAD 2026 实测） |
| 12 | 两次输出做对比验收 | 按 handle 配对实体 | handle 每次 SaveAs 重排，完全不可比 | 用几何签名（类型+中心+尺寸，容差 1.2）配对 |

## 标准工作流（五步）

### 第 1 步：环境预检
确认用的是哪套 Python、哪个 ezdxf、哪个 AutoCAD ProgID，不要凭感觉假设：

```bash
cmd //c "python -c \"import sys,ezdxf;print(sys.version);print(ezdxf.__version__)\""
```
- 本机事实（2026-10 确认）：cmd/双击 → Python 3.12.6（ezdxf 1.4.4）；Git Bash → 3.8.6（ezdxf 1.1.4）；AutoCAD 2026 ProgID = `AutoCAD.Application.25.1`。
- ezdxf 各版本行为有差异（如 1.4.4 的 `ezpath.make_path()` 不支持 LEADER 实体），用到版本敏感 API 前先在两套环境确认。

### 第 2 步：结构探查（先 dump 后编码）
写识别/修改逻辑前，先用 ezdxf 只读 dump 图纸：图层清单、各图层实体类型计数、各视图包围盒。不要看一眼截图就假设结构——引线存在哪层、球标圈是什么颜色半径、几何在哪层，都必须实测（案例见 `references/dxf-geometry.md`）。

### 第 3 步：编码
- COM 侧：早期绑定 + 重试 + CECOLOR + 批量选择集，模板见 `scripts/com_retry.py` 和 `references/com-autocad.md`。
- 算法侧：几何判定有大量反直觉陷阱（点到线段距离、顶点方向、聚类判据），先读 `references/dxf-geometry.md` 再动手。
- 工程侧：路径基于脚本自身目录推导（`os.path.dirname(os.path.abspath(__file__))`），脚本必须幂等可重跑——用户会并行手动整理目录、删除中间 JSON。

### 第 4 步：运行与日志
验证交付脚本时模拟用户真实路径：`cmd //c "xxx.bat < nul > _run.log 2>&1"`，落文件后逐行尝试 utf-8/gbk 解码（直接 `scripts/run_capture.py`）。**双击运行与重定向运行的控制台行为不同**：双击时 Python 3.12 走 Unicode 控制台 API，中文正常；重定向时输出是 UTF-8 而 bat 回显是 GBK，混在一起必须逐行探测解码。

### 第 5 步：验收闭环
生成/修改图纸后不要只看"保存成功"：
1. 渲染目标区域 PNG，做三查：闭合性、交叠、漏标；
2. 有人工基准时用几何签名逐实体配对对比（勿用 handle）；
3. 差异回写为阈值/规则/豁免表，重跑，直到收敛；
4. 给脚本加阶段耗时统计（`time.perf_counter` + lap 模式），性能退化能立刻发现。
完整闭环案例见 `references/dxf-geometry.md` 末节。

## 附带脚本

| 脚本 | 用途 | 用法 |
|---|---|---|
| `scripts/com_retry.py` | COM 重试装饰器 + AutoCAD 早期绑定连接 | `from com_retry import com_retry, connect_acad` |
| `scripts/make_gbk_bat.py` | UTF-8 bat 源 → GBK+CRLF 成品 | `python make_gbk_bat.py 源.bat [输出.bat]`（省略输出则原地转换） |
| `scripts/run_capture.py` | 运行命令并落日志、逐行探测解码 | `python run_capture.py _run.log <命令...>` |

三个脚本零第三方依赖（com_retry 的 win32com 仅在真正连接时才导入）。

## 渐进参考（按需读取，不要一次全读）

- `references/windows-env.md` — **写 bat、从 cmd/GitBash 跑脚本、看中文输出之前必读**。双 Python 环境、GBK 编码红线、路径与幂等设计。
- `references/com-autocad.md` — **连 AutoCAD COM 之前必读**。绑定/重试/颜色/选择集/多进程/保存的稳定写法，以及迁移到其他 COM 软件（SolidWorks 等）的通用模式。
- `references/dxf-geometry.md` — **做图纸识别、标注、几何算法之前必读**。LEADER 顶点方向、拟合 vs 本体、聚类判据、验收闭环的实战教训。

## 迭代维护协议（本技能是活文档）

二次开发每踩一个新坑，收敛后**必须回写**本技能，否则经验就丢了：

1. 判断坑的归属：编码/环境 → `windows-env.md`；COM/进程 → `com-autocad.md`；算法/验收 → `dxf-geometry.md`；足够通用且致命 → 提升进本文件红线表。
2. 回写格式：`⚠️ Win11 易错 | 现象 | 根因 | 处理（可运行的最小修正代码）| 首次踩坑日期`。
3. 已被证伪的旧条目直接修改或删除，不要留"另一种说法"。
4. 通用到可脚本化的坑，沉淀成 `scripts/` 下的小工具并在 SKILL.md 登记一行。
