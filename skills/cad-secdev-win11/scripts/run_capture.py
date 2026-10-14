# -*- coding: utf-8 -*-
"""运行 bat/命令：输出落文件，再逐行探测解码（utf-8 / gbk）打印。

为什么需要它：中文 Windows 11 上，Python 3.12 重定向输出是 UTF-8，
bat 的 echo 回显是 GBK，两种编码混在同一个流里。整体过 iconv 会
cannot convert 并杀掉管道；直接看会乱码。唯一稳的读法就是落文件后
逐行尝试两种编码解码。

用法：
    python run_capture.py 日志.log <要跑的命令...>
    python run_capture.py _run.log cmd /c my.bat
    python run_capture.py _run.log python 02_脚本/xxx.py

行为：
- stdin 接 nul（防止脚本里有 pause 卡死等待）；
- stdout+stderr 合并写日志，同时逐行解码打印到控制台；
- 无法用 utf-8/gbk 解码的行按 replace 兜底并加 [?] 标记；
- 退出码与被跑命令一致。
"""

import subprocess
import sys


def decode_line(raw):
    """一行 bytes：先试 utf-8，再试 gbk，都失败按 replace 兜底。"""
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc), ""
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace"), "[?]"


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)

    log_path = sys.argv[1]
    cmd = sys.argv[2:]

    proc = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # subprocess 拿到的是原始字节，逐行探测解码；日志文件写解码后的文本
    lines = []
    for raw in proc.stdout.splitlines():
        text, mark = decode_line(raw)
        lines.append(mark + text if mark else text)

    with open(log_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    for line in lines:
        print(line)
    print("[run_capture] 退出码=%d, 日志=%s" % (proc.returncode, log_path))
    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
