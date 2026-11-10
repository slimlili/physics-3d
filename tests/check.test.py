import pathlib, subprocess, sys
ROOT = pathlib.Path.home() / "tools/physics-3d"
good = ROOT / "tests" / "out_t1.html"
bad = ROOT / "tests" / "out_t1_bad.html"
assert good.exists(), "先跑 Task 5 生成 out_t1.html"
# 正例
r = subprocess.run([sys.executable, str(ROOT / "tools/check.py"), str(good)])
assert r.returncode == 0, "正常页面应通过"
# 反例：把期望值改坏
html = good.read_text(encoding="utf-8").replace('{"r": 1, "T": 6.2832}', '{"r": 9, "T": 6.2832}')
assert '{"r": 9' in html, "替换失败，检查 expect 内容"
bad.write_text(html, encoding="utf-8")
r = subprocess.run([sys.executable, str(ROOT / "tools/check.py"), str(bad)])
assert r.returncode == 1, "读数不符时必须以非零退出"
print("PASS")
