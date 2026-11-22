import json, re, subprocess, sys, pathlib
ROOT = pathlib.Path.home() / "tools/physics-3d"
built = ROOT / "tests" / "out_t9.html"
subprocess.run([sys.executable, str(ROOT / "tools/build.py"),
                str(ROOT / "templates/t9-instruments.html"), str(built)], check=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
dom = subprocess.run([CHROME, "--headless=new", "--virtual-time-budget=4000",
                      "--enable-unsafe-swiftshader", "--dump-dom", f"file://{built}"],
                     capture_output=True, text=True).stdout
assert "<title>质谱仪·回旋加速器_OK</title>" in dom, "页面未完成初始化"
expect = json.loads(re.search(r'<script id="expect"[^>]*>(.*?)</script>', dom, re.S).group(1))
for key, want in expect.items():
    raw = re.search(rf'id="ro-{key}"[^>]*>(.*?)<', dom).group(1).strip()
    got = float(raw.replace('×10⁶', '').replace('×10⁷', ''))
    assert abs(got - float(want)) <= max(1e-2, abs(float(want)) * 1e-2), \
        f"读数 #{key} = {raw}，期望 {want}"
print("PASS")
