#!/usr/bin/env python3
"""演示自检：页面能跑、读数与解析解一致、画面不是黑屏。

用法：python3 tools/check.py path/to/demo.html
退出码 0 = 通过；1 = 有问题（问题打印到 stdout）。
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import pathlib

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TOL = 1e-2
SUP = {'⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'}


def parse_num(text: str):
    """把 '5.03×10⁻⁷' / '0.16' 解析成 float；无法解析返回 None。"""
    t = text.replace(' ', '')
    m = re.match(r'([-+]?\d+(?:\.\d+)?)(?:×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))?', t)
    if not m:
        return None
    val = float(m.group(1))
    if m.group(2):
        exp = int(''.join(SUP[c] for c in m.group(2)))
        val *= 10 ** exp
    return val


def run_dom(url: str):
    return subprocess.run(
        [CHROME, "--headless=new", "--virtual-time-budget=4000",
         "--enable-logging=stderr", "--log-level=0", "--dump-dom", url],
        capture_output=True, text=True,
    )


def ensure_pil():
    """系统 python 没有 Pillow 时，自动切到仓库内的 .venv 重跑。"""
    try:
        import PIL  # noqa: F401
        return True
    except ImportError:
        venv = pathlib.Path(__file__).resolve().parent.parent / ".venv" / "bin" / "python"
        if venv.exists() and os.environ.get("CHECK_REEXEC") != "1":
            env = dict(os.environ, CHECK_REEXEC="1")
            os.execve(str(venv), [str(venv), __file__] + sys.argv[1:], env)
        return False


def contrast(png: pathlib.Path) -> float:
    from PIL import Image, ImageStat
    im = Image.open(png).convert("L").resize((64, 64))
    return ImageStat.Stat(im).stddev[0]


def check(path: pathlib.Path) -> list[str]:
    problems: list[str] = []
    url = f"file://{path.resolve()}"
    res = run_dom(url)
    dom, err = res.stdout, res.stderr

    # 1) 未捕获的脚本错误
    for line in err.splitlines():
        if "Uncaught" in line or "SyntaxError" in line:
            problems.append(f"脚本错误: {line.strip()[:160]}")

    # 2) 初始化标记
    m = re.search(r"<title>([^<]*)</title>", dom)
    title = m.group(1) if m else ""
    if not title.endswith("_OK"):
        problems.append(f"页面未完成初始化（title={title!r}）")

    # 3) 读数 vs 解析解
    exp_m = re.search(r'<script id="expect"[^>]*>(.*?)</script>', dom, re.S)
    if not exp_m:
        problems.append("缺少 <script id=\"expect\">")
    else:
        try:
            expect = json.loads(exp_m.group(1))
        except json.JSONDecodeError:
            problems.append("expect JSON 解析失败")
            expect = {}
        for key, want in expect.items():
            got_m = re.search(rf'id="ro-{re.escape(key)}"[^>]*>(.*?)<', dom)
            if not got_m:
                problems.append(f"缺少读数 #ro-{key}")
                continue
            raw = got_m.group(1).strip()
            if 'NaN' in raw or 'Infinity' in raw:
                problems.append(f"读数 #ro-{key} 出现非数值：{raw}")
                continue
            got = parse_num(raw)
            if got is None:
                problems.append(f"读数 #ro-{key} 无法解析：{raw!r}")
                continue
            if abs(got - float(want)) > max(TOL, abs(float(want)) * 1e-2):
                problems.append(f"读数 #ro-{key} = {raw}，期望 {want}")

    # 4) 画面不能是黑屏
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        shot = pathlib.Path(f.name)
    subprocess.run(
        [CHROME, "--headless=new", "--hide-scrollbars", "--window-size=1280,800",
         "--virtual-time-budget=4000", f"--screenshot={shot}", url],
        capture_output=True, text=True,
    )
    if ensure_pil():
        try:
            c = contrast(shot)
            if c < 3:
                problems.append(f"画面几乎没有内容（灰度标准差 {c:.1f}）")
        except Exception as e:
            problems.append(f"截图检查失败: {e}")
    else:
        print("NOTE: 未安装 Pillow，跳过画面检查（用 .venv/bin/python 可启用）")
    shot.unlink(missing_ok=True)

    return problems


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = pathlib.Path(sys.argv[1])
    if not path.exists():
        print(f"文件不存在: {path}")
        return 1
    problems = check(path)
    if problems:
        for p in problems:
            print("FAIL:", p)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
