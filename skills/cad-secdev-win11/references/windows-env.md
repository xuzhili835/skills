# Windows 11 中文环境：编码、双 Python、路径与幂等

> 本机环境事实（2026-10-14 实测确认，升级后需复核）：
> - 中文 locale，cmd 控制台代码页 936（GBK）
> - cmd / 双击 PATH → Python 3.12.6（`F:\SOFTWARE`，ezdxf 1.4.4，依赖齐全）
> - Git Bash PATH → Python 3.8.6（ezdxf 1.1.4）
> - AutoCAD 2026

## ⚠️ Win11 易错 1：含中文的 .bat 用 UTF-8 保存

- **现象**：bat 用 UTF-8 保存（哪怕加了 `chcp 65001`），双击运行时行被拆成 `'1'`、`'cho.'` 之类的碎片命令，报"不是内部或外部命令"。
- **根因**：cmd 解析器在多字节场景对 UTF-8 + 65001 有解析错位 bug，中文注释/echo 的字节会把后续行弄乱。
- **处理**：**bat 必须存成 GBK + CRLF**。工作流：先用 UTF-8 写源文件（方便版本管理），再用 `scripts/make_gbk_bat.py` 转换出成品：

```bash
python make_gbk_bat.py 启动标注_源.bat 启动标注.bat   # 或省略第二个参数原地转换
```

- 换行必须是 CRLF：LF-only 的 bat 在部分 cmd 场景（goto/label）会出问题，make_gbk_bat.py 已自动把 `\n` 统一替换为 `\r\n`。
- 项目实例：`G:\研究院项目\10.13 标注识别与归并\启动标注.bat`（GBK+CRLF，含中文 echo、errorlevel 分支、`cd /d "%~dp0"`、pause），是验证过的模板。

### bat 模板要点（全部经过验证）
```bat
@echo off
setlocal
cd /d "%~dp0"                REM 永远先切到 bat 所在目录，防双击工作目录漂移
where python >nul 2>nul      REM 先探环境再干活
if errorlevel 1 (
    echo [错误] 未找到 python...
    pause
    exit /b 1
)
python "02_脚本\xxx.py"      REM 相对路径基于 %~dp0
if errorlevel 1 (
    echo [失败] ...（提示哪些中间结果仍有效、可单独重跑哪一步）
    pause
    exit /b 1
)
pause                        REM 双击场景结束不停窗
```

## ⚠️ Win11 易错 2：双 Python 环境，Git Bash 里跑≠用户双击跑

- **现象**：脚本在 Git Bash 里验证一切正常，用户双击 bat 却行为不同（或反之）。
- **根因**：两套 PATH 解析到不同 Python（3.12.6+ezdxf1.4.4 vs 3.8.6+ezdxf1.1.4），第三方库版本行为有差异。
- **处理**：
  - 交付验证一律走 cmd 那套：`cmd //c "python xxx.py"`（Git Bash 里 `//c` 双斜杠防路径转换）。
  - **版本敏感 API 先测版本**：如 `ezpath.make_path()` 在 ezdxf 1.4.4 不支持 LEADER 实体；`.vertices` 访问两版都可用。不确定就 `try/except` 给出降级路径。
  - 代码里不要硬编码 Python 路径；用 `where python` 的解析结果与用户环境保持一致。

## ⚠️ Win11 易错 3：复杂参数经 cmd 转发被引号转义弄乱

- **现象**：`cmd //c "python -c \"...多行代码...\""` 引号层层转义后参数被拆散。
- **处理**：任何超过一行逻辑的验证代码，写成临时 .py 文件再 `cmd //c "python _tmp_check.py"`；跑完删除。

## ⚠️ Win11 易错 4：混合编码输出不能过 iconv 管道

- **现象**：`xxx.bat | iconv -f gbk -t utf-8` 报 cannot convert，并杀掉管道，输出丢失。
- **根因**：Python 3.12 重定向输出是 UTF-8，bat 的 echo 回显是 GBK，同一个流里两种编码，整体转码必失败。
- **处理**：落文件再逐行探测解码（utf-8 失败试 gbk，都失败按 replace 兜底）：

```bash
cmd //c "xxx.bat < nul > _run.log 2>&1"      # nul 喂 stdin 防 pause 卡死
python run_capture.py _run.log               # 逐行解码打印
```
- 或一步到位：`python run_capture.py _run.log xxx.bat`（脚本内部负责重定向与解码）。
- **双击（真控制台）不受此影响**：Python 3.12 走 Unicode 控制台 API，中文正常显示。所以"用户双击正常、Agent 重定向乱码"不是 bug，是两套输出通道。

## 无害噪音（不要浪费时间去修）

控制台偶见 `cannot open font 'C:\WINDOWS\Fonts\mstmc.ttf'`——AutoCAD 字体探测噪音，不影响结果。

## 路径与幂等设计（脚本工程约束）

二次开发脚本面对的是"用户会同时动手改目录"的活项目，必须满足：

1. **路径自举**：`BASE = os.path.dirname(os.path.abspath(__file__))`，输入输出都从脚本自身位置推导（如 `os.path.join(BASE, "..", "01_原图", "x.dxf")`），用户把整个目录树搬走/重组后脚本仍然能跑。
2. **跟随用户整理**：用户会把中间产物移到新目录（案例：`03_识别数据` 被移进 `04_标记结果\03_识别数据`）。发现输入缺失时，报错信息里写清"期望路径"，由人决定改哪边，不要自作主张全盘重建。
3. **幂等可重跑**：输出前先删同名旧产物（或按内容跳过）；中间 JSON 被用户删掉时，上游脚本能重新生成。
4. **阶段耗时统计**：关键脚本用 `time.perf_counter()` 记每阶段 lap 并打印【阶段耗时统计】块，用户已经依赖它判断性能。
5. **失败可分段重跑**：流程拆成"纯计算"和"COM 实机操作"两段，第二段失败不污染第一段结果（bat 里分别提示）。
