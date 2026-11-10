import json, re, subprocess, sys, pathlib
ROOT = pathlib.Path.home() / "tools/physics-3d"
built = ROOT / "tests" / "out_t3.html"
subprocess.run([sys.executable, str(ROOT / "tools/build.py"),
                str(ROOT / "templates/t3-helix.html"), str(built)], check=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
dom = subprocess.run([CHROME, "--headless=new", "--virtual-time-budget=4000",
                      "--dump-dom", f"file://{built}"], capture_output=True, text=True).stdout
assert "<title>T3_OK</title>" in dom, "页面未完成初始化"
r_text = re.search(r'id="ro-r"[^>]*>([-0-9.]+)<', dom).group(1)
p_text = re.search(r'id="ro-p"[^>]*>([-0-9.]+)<', dom).group(1)
expect = json.loads(re.search(r'<script id="expect"[^>]*>(.*?)</script>', dom, re.S).group(1))
assert abs(float(r_text) - expect["r"]) < 1e-2, f"半径 {r_text} != {expect['r']}"
assert abs(float(p_text) - expect["p"]) < 1e-2, f"螺距 {p_text} != {expect['p']}"
print("PASS")
