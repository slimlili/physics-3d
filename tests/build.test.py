import subprocess, sys, pathlib
ROOT = pathlib.Path.home() / "tools/physics-3d"
out = ROOT / "tests" / "out_shell.html"
subprocess.run([sys.executable, str(ROOT / "tools/build.py"),
                str(ROOT / "templates/shell.html"), str(out)], check=True)
html = out.read_text(encoding="utf-8")
assert "https://" not in html and "http://" not in html, "仍引用网络地址"
assert '"../lib/' not in html, "仍有未内联的本地模块路径"
assert "data:text/javascript;base64," in html, "three 未内联"
assert out.stat().st_size > 1_200_000, "产物过小，疑似未内联"
print("PASS")
