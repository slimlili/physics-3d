#!/usr/bin/env python3
"""把模板打包成单文件 HTML：内联 three.js 与本地脚本，产物不联网。

用法：python3 tools/build.py templates/t1-circular.html out.html
"""
import base64
import pathlib
import re
import sys


def data_url(p: pathlib.Path) -> str:
    return "data:text/javascript;base64," + base64.b64encode(p.read_bytes()).decode()


def build(src: pathlib.Path, out: pathlib.Path) -> None:
    root = src.parent
    html = src.read_text(encoding="utf-8")

    # 1) importmap：本地路径 → data URL
    def repl(m: re.Match) -> str:
        key, val = m.group(1), m.group(2)
        p = (root / val).resolve()
        if not p.exists():
            raise FileNotFoundError(f"importmap 指向的文件不存在: {val} -> {p}")
        return f'"{key}":"{data_url(p)}"'

    html = re.sub(r'"([^"]+)"\s*:\s*"([^"]+\.js)"', repl, html)

    # 2) <script src="..."></script>：内联
    def inline(m: re.Match) -> str:
        p = (root / m.group(1)).resolve()
        if not p.exists():
            raise FileNotFoundError(f"脚本不存在: {m.group(1)} -> {p}")
        return "<script>\n" + p.read_text(encoding="utf-8") + "\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

    out.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    build(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
