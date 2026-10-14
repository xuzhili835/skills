# -*- coding: utf-8 -*-
"""把 UTF-8 编写的 .bat 源文件转成 GBK + CRLF 成品。

为什么需要它：中文 Windows 11 的 cmd 控制台代码页是 936(GBK)。
含中文的 bat 如果存成 UTF-8（哪怕加 chcp 65001），cmd 的多字节解析
会错位，把行拆成 '1'、'cho.' 之类的碎片命令报"不是内部或外部命令"。
唯一稳的做法：成品 bat 必须是 GBK 编码 + CRLF 换行。

用法：
    python make_gbk_bat.py 源文件.bat            # 原地转换（先备份 .bak）
    python make_gbk_bat.py 源.bat 输出.bat       # 转换到新文件，源不动

转换前会检查是否有 GBK 编不出来的字符（如 emoji、生僻字），有则报错并
指出位置，而不是悄悄写坏文件。
"""

import shutil
import sys


def convert(src_path, dst_path):
    with open(src_path, "r", encoding="utf-8-sig") as f:
        text = f.read()

    # 找出 GBK 编不出来的字符，报错时给出行号
    bad = []
    for lineno, line in enumerate(text.splitlines(), 1):
        for ch in line:
            try:
                ch.encode("gbk")
            except UnicodeEncodeError:
                bad.append((lineno, ch, hex(ord(ch))))
    if bad:
        sample = "; ".join("第%d行 %r(%s)" % t for t in bad[:5])
        raise SystemExit(
            "[失败] 以下字符 GBK 编不了（bat 里不能用），请替换后再转换:\n%s" % sample
        )

    # 统一成 CRLF
    text = text.replace("\r\n", "\n").replace("\n", "\r\n")

    if dst_path == src_path:
        backup = src_path + ".bak"
        shutil.copy2(src_path, backup)
        print("[备份] 原文件 -> %s" % backup)

    with open(dst_path, "w", encoding="gbk", newline="") as f:
        f.write(text)
    print("[完成] %s  (GBK + CRLF, %d 行)" % (dst_path, text.count("\r\n")))


def main():
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        raise SystemExit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) == 3 else src
    convert(src, dst)


if __name__ == "__main__":
    main()
