# pywin32 COM 操作 AutoCAD：稳定写法（AutoCAD 2026 实测）

> 本机：AutoCAD 2026，ProgID `AutoCAD.Application.25.1`。其他版本 ProgID 主版本号随发行版变化，连不上时先用 `win32com.client.GetObject` 族或注册表确认，不要硬编码猜。
> 通用工具：`scripts/com_retry.py`（重试装饰器 + 早期绑定连接）。

## ⚠️ 易错 1：动态绑定下属性赋值失败

- **现象**：`ent.Layer = "xxx"` 报 `Property can not be set`；读取却正常。
- **根因**：win32com 动态绑定(IDispatch late binding)对 AutoCAD 属性 put 操作不可靠。
- **处理**：一律用 `gencache.EnsureDispatch` 转早期绑定：

```python
import win32com.client
acad = win32com.client.gencache.EnsureDispatch("AutoCAD.Application.25.1")
```
- 通用经验（未在本机逐项验证）：升级 AutoCAD 后 gencache 缓存可能与新类型库不匹配，出现诡异类型错误时清 `%TEMP%\gen_py` 目录再连。
- **补充（2026-10-14，DispatchEx 实例实测）**：`DispatchEx("AutoCAD.Application")` 起的新实例上 `app.Visible = False` 必报 `Property can not be set`，而 `Dispatch` 动态绑定下同一句却可用——动态绑定是否拒绝属性 put 与实例获取方式有关，不可凭"昨天 Dispatch 能跑"推断 DispatchEx 也行；修法不变，对现有实例包一层即可（保留 DispatchEx 的独立实例语义）：

```python
app = win32com.client.DispatchEx("AutoCAD.Application")   # 强制新实例
app = win32com.client.gencache.EnsureDispatch(app)        # 转早期绑定
```

## ⚠️ 易错 2：AutoCAD 忙时所有 COM 调用被拒

- **现象**：`com_error: (-2147418111, '呼叫被呼叫方拒绝', ...)`（RPC_E_CALL_REJECTED），时好时坏。
- **根因**：AutoCAD 单线程 COM，界面忙（打开文件、重生成、弹窗）时拒绝调用。
- **处理**：**每一个** COM 调用点都要有重试保护，用装饰器统一处理：

```python
from com_retry import com_retry

@com_retry(times=60, interval=0.25)
def add_circle(doc, x, y, r):
    return doc.ModelSpace.AddCircle(APoint(x, y), r)
```
- 手写循环也可以，但要区分错误码：重试类（RPC_E_CALL_REJECTED -2147418111、RPC_E_SERVERCALL_RETRYLATER -2147417846）才重试，其他 com_error 直接抛。

## ⚠️ 易错 3：新实体颜色被会话 CECOLOR 污染

- **现象**：脚本画的标记实体颜色不对（如继承用户会话留下的红色）。
- **处理**：画图前先归零，或逐实体显式设色，双保险：

```python
doc.SetVariable("CECOLOR", "256")   # ByLayer
ent.Color = 1                        # 需要强调的实体再显式设 ACI 色号
```

## ⚠️ 易错 4：大图纸逐实体遍历（性能悬崖）

- **现象**：清理/查找实体时遍历 `ModelSpace`（2.7 万实体）极慢，且期间频繁 RPC 被拒。
- **处理**：批量操作用带 DXF 过滤器的选择集；按已知句柄取实体用 `HandleToObject`：

```python
# 批量删除某层残留实体（Select 模式 5 = acSelectionSetAll）
ss = doc.SelectionSets.Add("tmp_clean")
ss.Select(5, None, None, None, [(0, ["LINE"], ["引线目标标记"])])  # 过滤器三元组按版本确认
ss.Erase()
# 按句柄直取（来自 JSON 计划数据时）
ent = doc.HandleToObject(handle_str)
```
- 选择集名会残留：创建前先按名删除旧选择集（try 删 except 过）。

## ⚠️ 易错 5：多个 acad.exe 进程 / 文档索引漂移

- **现象**：`GetActiveObject` 连上的不是目标实例；或关闭一个文档后 `Documents.Item(i)` 索引变化，导致关错/删错文档。
- **根因**：ROT 只注册一个实例；COM 文档集合按索引动态重排。
- **处理**：
  - 不缓存索引，**循环重扫**直到目标文档不存在：

```python
while True:
    hit = [d for d in doc_list_by_name(acad, "FSCC111352.dxf")]
    if not hit:
        break
    hit[0].Close(False)   # 循环内重新解析名字，不持有旧引用
```
  - 多实例场景先让用户确认/关闭多余 acad.exe，再跑脚本。

## ⚠️ 易错 6：ZoomWindow 参数挑剔

- **现象**：`Application.ZoomWindow(p1, p2)` 对变体类型挑剔，且作用对象受"当前活动文档"影响，容易缩错窗口。
- **处理**：用命令行方式，稳：

```python
doc.SendCommand('_.ZOOM _Window %.4f,%.4f %.4f,%.4f ' % (x1, y1, x2, y2))
```
- SendCommand 的通用注意（来自 autocad-automation 技能）：命令是**异步**的，发完不等于执行完，保存/导出前要留有余量或随后复核；命令用 `_.` 前缀降低界面语言影响。

## ⚠️ 易错 7：保存与另存

- 原文件只读时 Save/SaveAs 原路径会被拒绝访问 → **另存新路径**：`doc.SaveAs(out_path, 61)`，61 = ac2013_dxf（AutoCAD 2026 实测，可输出 2013 DXF）。
- 修改用户原图前先另存副本；覆盖必须有明确授权。
- SaveAs 之后 **handle 会重排**：任何"跑两次对比结果"的验收都不能按 handle 配对，用几何签名（类型+中心+尺寸，容差如 1.2）。

## ⚠️ 易错 8：PlotToFile 中文输出路径静默失败（B-rep3转2 线回写 2026-10-14）

`doc.PlotToFile("D:\\带中文目录\\图.png")` **返回 True 但磁盘上没有文件**（AutoCAD 2023 实测）——中文输出路径不报错、直接不出图。正解：先输出到 ASCII 路径（如 `D:\plot_tmp.png`），再用 Python `shutil` 挪到中文位置。验证图配置可用 PublishToWeb PNG.pc3 + monochrome.ctb + acExtents。附带：被 CAD 占用的文件先 `tasklist` 确认 acad.exe 进程归属再清理，防误杀用户实例。

## ⚠️ 易错 9：Plot.SetWindow 窗口出图报"输入无效"（B-rep3转2 线回写 2026-10-14）

想局部放大出图（一张大图的某个视图吃满输出分辨率）：`layout.PlotType = 3`（acWindow）后 `doc.Plot.SetWindow(x1, y1, x2, y2)` 直接抛 com_error `-2145386493 输入无效`（AutoCAD 2023，坐标本身就是合法的左下/右上）。COM 窗口出图此路不通时，**改走几何裁剪**，效果等同且确定性：

1. ezdxf `readfile` 开原件，遍历 modelspace，用 `ezdxf.bbox.extents([e], fast=True)` 取每实体包围盒（注意它收的是**集合**，单实体要包 `[e]`）；
2. 只保留包围盒完整落在目标窗口内的实体（越界的长线一并删，否则 extents 会被撑出去），其余 `msp.delete_entity`；
3. 另存 ASCII 副本 → 常规 acExtents 打印，白边用 PIL `ImageOps.invert(img).getbbox()` 自动裁。

11 万实体裁剪约 1 分钟，裁后保留数须断言 >100（窗口坐标写错会裁出空图）。

## ⚠️ 易错 10：要"像从 CAD 里截的"界面图——PrintWindow 整窗截屏（B-rep3转2 线回写 2026-10-15）

Plot/出图管线给的是白底、无界面的图；要黑底模型空间 + Ribbon/状态栏的"真 CAD 截图"观感，走窗口位图截取：

```python
import ctypes
ctypes.windll.shcore.SetProcessDpiAwareness(2)          # 截屏前必设（物理像素），否则坐标全错
ok = ctypes.windll.user32.PrintWindow(hwnd, hdc, 2)     # 2 = PW_RENDERFULLCONTENT
```

- **PrintWindow(…, 2) 抓窗口自身渲染位图：被其他窗口完全遮挡也能抓全**（DirectX 渲染的 AutoCAD 实测可抓）；**最小化不可抓**——无渲染表面，得黑帧/旧帧。"无头不打扰用户"的正确姿势 = 窗口摆屏幕角落 + 不抢焦点，用户拿别的窗口盖住它也不影响，但别最小化。
- 不抢焦点显示：`win32gui.SetWindowPos(hwnd, 0, x, y, w, h, win32con.SWP_NOACTIVATE | win32con.SWP_NOZORDER)`——窗口可见但绝不夺前台（实测开档后 `GetForegroundWindow() != hwnd`）。
- 用户可同时用自己的 CAD：`DispatchEx` 起的实例与用户实例完全隔离，互不干扰。
- Visible put 不对称（接易错 1 的补充条目）：DispatchEx 实例上 `app.Visible = True` 的 put 是**允许**的（False 才被拒）——别因为设 False 报错就以为 True 也不行。
- 位图回读链：GetWindowDC → CreateCompatibleDC → CreateCompatibleBitmap(w,h) → PrintWindow → PIL `Image.frombuffer("RGB", (w,h), bits, "raw", "BGRX", 0, 1)`；收尾 `mfc.DeleteDC()` / `save.DeleteDC()` / ReleaseDC / DeleteObject 一个不能少——漏 DeleteDC 曾让整轮截图全部未落盘（异常发生在 img.save 之前）。
- 标题栏真实感：开**同名副本**（标题栏显示真实文件名而不是临时名），截屏前 `doc.Save()` 消掉未保存星号。
- 绘图区子窗枚举不可信："Intermediate D3D Window" 的 GetWindowRect 坐标可超出窗口实际宽（实测 2831 > 1560）——别按子窗裁剪；要局部放大就整窗截 + `SendCommand('_.ZOOM _W …')`（易错 6 的绕法）让目标内容充满绘图区。
- 收尾杀进程：Git Bash 下 `taskkill /PID` 的 /PID 会被转成路径——用 `powershell Stop-Process -Id <pid> -Force`。

## ⚠️ 易错 11：批量改色的三重坑——筛选器说谎、文档拒访、同名串图（B-rep3转2 线回写 2026-10-15）

批量"把红色实体改回去"的场景，逐实体 COM 太慢（11 万实体×4 调用≈半小时），快路径全部有坑：

- **SelectionSet.Select 的颜色筛选器会返回全集**：`ss.Select(5, [62], [1])`（全部+颜色=红）实测返回 113,934=全部实体，筛选拒绝生效但**不报错**——按它逐条改色会把整张图逐条"改"一遍（巨慢且账目全错）。**COM 侧的筛选结果不能当地面真值**。
- **Documents.Item(i) 对部分文档拒访**：`Documents.Count=2` 但 `Item(2)` 恒抛 com_error（动态/早期绑定都一样），那一张图 COM 完全摸不到。
- **同名文档按名匹配串图**：工具按"全路径或文件名"匹配已开文档——两个目录的同名 DXF 同时开着，染红/恢复会在两张图之间串门；状态文件只记一份账，结果一边清了另一边还红着，恢复工具却说"没有被染红的图元"。**铁律：测试时同一时间只开一张同名图。**

**可靠终案 = SendCommand 一条 LISP + 文件回读**（`ssget "_X"` 是数据库级扫描，毫秒级、不经 COM 枚举）：

```python
LISP = ('(progn (setq ss (ssget "_X" (list (cons 62 1)))) '
        '(setq n1 (if ss (sslength ss) 0)) '
        '(if (> n1 0) (command "_.CHANGE" ss "" "_P" "_C" "_BYLAYER" "")) '
        '(setq f (open "D:/tmp/red.txt" "w")) '   # ASCII 路径；中文路径 open 不可靠
        '(write-line (itoa n1) f) (close f) (princ)) ')
doc.Activate(); time.sleep(0.8)
doc.SendCommand(LISP)      # 异步入队，轮询结果文件等它跑完
```

逐文档"数红→CHANGE ByLayer→再数→写结果文件"，数字从文件回读，绕开 COM 一切筛选/枚举。清色前先用 ezdxf 数**磁盘文件**的 `e.dxf.get('color',256)` 分布定"正确的还原终点"（本项目=全 256，故改 ByLayer 即完整还原）；磁盘文件自始未被 COM 改过，关文档选"不保存"即净。


## 通用工程规则

- COM 桌面会话**串行执行**，不要并行跑两个连 AutoCAD 的脚本。
- 每个脚本 `try/finally` 里做清理（选择集、临时文档），失败时打印已完成的阶段。
- 检查每个返回对象是否为 None、保存后确认文件存在且大小合理。
- 验收必渲染：把目标区域导出 PNG 目视检查，不要只统计实体数。

## 迁移到其他 COM 软件（SolidWorks / Office 等）

AutoCAD 上验证过的模式大部分可平移，差异点如下：

| 模式 | AutoCAD | 其他软件注意 |
|---|---|---|
| 早期绑定 | EnsureDispatch 解决属性赋值 | SolidWorks 同样适用 |
| 忙重试 | RPC_E_CALL_REJECTED | 同类错误码通用 |
| by-ref 参数 | 少见 | SolidWorks 长参数 API 必须 `VARIANT(pythoncom.VT_BYREF \| VT_I4, 0)` 包装；数组用 SAFEARRAY |
| 单位 | 无单位数值（图纸自定） | SolidWorks API 统一米；Office 各有各的枚举 |
| 串行 | 必须 | SolidWorks 同样必须（桌面 COM 会话） |

SolidWorks 侧的完整已验证封装（连接、草图、装配、导出、审查）直接用 `solidworks-automation` 技能的 `scripts/sw_*.py`，不要重复造轮子。
