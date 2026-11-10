# 物理三维演示生成流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一套可重复的流程：把一道高中物理题变成单文件三维演示 HTML，并装成 Claude Code 技能供日常使用。

**Architecture:** 三个部分——纯物理函数（`src/physics.js`，可脱离浏览器测试）、共用底座与模板（`templates/*.html`）、打包与自检脚本（`tools/*.py`）。技能文档（`~/.claude/skills/physics-3d-demo/SKILL.md`）是流程本身，规定每次生成按六步执行。

**Tech Stack:** three.js r169（本地化）、原生 JS、Python 3 标准库、JavaScriptCore（jsc）跑单元测试、Chrome headless 做渲染与读数自检。

**Spec:** `docs/superpowers/specs/2026-11-10-physics-3d-design.md`

## Global Constraints

- three.js 版本锁定 `0.169.0`，产物**不得引用任何网络地址**（无 CDN、无字体外链）
- 产物是**单文件 HTML**，双击即开，约 2MB；目标为电脑浏览器（Chrome / Safari / Edge）
- 界面全中文；视觉沿用现有演示（`#080F12` 背景、青绿主色、右下角卡片面板）
- 每个演示必须有：四档播放速度（¼× ½× 1× 2×）、暂停/重播、空格暂停、R 重置、答案面板（默认收起）
- 读数使用题目真实数值；题目只给符号时显示解析式，**不得编造数字**
- 生成物保存到 `~/磁场三维演示/`，命名 `<YYYYMMDD>-<题号或主题>-<slug>.html`

## Review Focus

- **只给符号、没有数值的题**：读数区显示公式而非数字，不能出现 NaN、Infinity 或凭空编的数。
- **负电荷（q<0）**：旋转方向必须反向，半径与周期取绝对值；页面不能崩。
- **速度与 B 平行或反平行（θ→0）**：不画圆、不除零，退化为直线并给出提示。
- **直线边界临界角（θ→0 或 θ→90°）**：圆心角与弦长必须连续、不出负值或大于 2π。
- **参数被拖到极端（B→0、v→0）**：所有读数保持有限值或切换为提示，不能出现 NaN。
- **题目配图模糊导致几何读错**：流程第一步必须复述模型与几何，交用户确认后才生成（属流程约束，不是代码测试）。

---

### Task 1: 仓库与本地化 three.js

**Files:**
- Create: `lib/three.module.js`, `lib/OrbitControls.js`
- Create: `tests/smoke.html`
- Create: `.gitignore`

**Interfaces:**
- Produces: 本地可用的 `lib/three.module.js`（ESM）与 `lib/OrbitControls.js`，后续所有模板通过 importmap 的 `three` 与 `three/addons/controls/OrbitControls.js` 使用。

- [ ] **Step 1: 初始化仓库**

```bash
cd ~/tools/physics-3d
git init 2>/dev/null || true
printf '*.png\n__pycache__/\n' > .gitignore
```

- [ ] **Step 2: 写冒烟测试页 `tests/smoke.html`**

```html
<!doctype html><meta charset="utf-8">
<title>LOADING</title>
<script type="importmap">
{"imports":{
  "three":"./lib/three.module.js",
  "three/addons/controls/OrbitControls.js":"./lib/OrbitControls.js"
}}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const r = new THREE.WebGLRenderer();
r.setSize(64,64);
const s = new THREE.Scene(), c = new THREE.PerspectiveCamera(50,1,.1,10);
c.position.z = 2;
s.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0x00ff88})));
const ctl = new OrbitControls(c, r.domElement);
r.render(s,c);
document.title = 'RENDER_OK';
</script>
```

- [ ] **Step 3: 运行，确认失败**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=2000 --dump-dom "file://$HOME/tools/physics-3d/tests/smoke.html" | grep -c RENDER_OK
```
Expected: `0`（lib 不存在，模块加载失败）

- [ ] **Step 4: 下载并锁定版本**

```bash
cd ~/tools/physics-3d/lib
curl -sS -x http://127.0.0.1:7897 -o three.module.js \
  https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js
curl -sS -x http://127.0.0.1:7897 -o OrbitControls.js \
  https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js
ls -l three.module.js OrbitControls.js   # three ≈1.3MB，controls ≈30KB
```

- [ ] **Step 5: 再跑，确认通过**

Run: 同 Step 3。
Expected: `1`

- [ ] **Step 6: 提交**

```bash
cd ~/tools/physics-3d && git add -A && git commit -m "chore: vendor three.js r169 for offline use"
```

---

### Task 2: 共用底座 `templates/shell.html`

**Files:**
- Create: `templates/shell.html`

**Interfaces:**
- Produces: 一个可直接打开的空场景页面，包含视觉 token、HUD、控制面板（速度四档 / 暂停 / 重播 / 答案）、工具函数 `label3d(text,color,size)`、`makeArrow(color,len)`、`makeTrail(maxPoints)`。后续模板复制此文件并只替换 `/* === SCENE === */` 区块。

- [ ] **Step 1: 写测试脚本 `tests/shell.test.sh`**

```bash
#!/bin/bash
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=$("$CHROME" --headless=new --virtual-time-budget=3000 --dump-dom \
  "file://$HOME/tools/physics-3d/templates/shell.html")
echo "$OUT" | grep -q 'id="btn-speed-2"' || { echo "FAIL: 缺少速度按钮"; exit 1; }
echo "$OUT" | grep -q 'aria-pressed="true"'        || { echo "FAIL: 缺少默认选中态"; exit 1; }
echo "$OUT" | grep -q 'id="answer"'                || { echo "FAIL: 缺少答案面板"; exit 1; }
echo "$OUT" | grep -q '<title>SHELL_OK</title>'     || { echo "FAIL: 脚本未执行"; exit 1; }
echo "PASS"
```
（`chmod +x tests/shell.test.sh`）

- [ ] **Step 2: 运行，确认失败**

Run: `bash ~/tools/physics-3d/tests/shell.test.sh`
Expected: `FAIL: 缺少速度按钮`（文件不存在）

- [ ] **Step 3: 实现 `templates/shell.html`**

要点（照现有演示的视觉与控件）：
- `<style>` 内定义 `:root` token：`--bg:#080F12; --panel:rgba(12,26,32,.84); --line:rgba(126,214,220,.22); --ink:#E4F1F3; --muted:#88A3AA; --brand:#4ADE80; --cyan:#7DD3FC; --warn:#F2C14E`
- HUD 左上：`.eyebrow` + `h1`（带小字副标题）；`.readout` 区域放 `#ro-*` 读数
- 右下 `.panel`：`<div class="cap">播放速度</div>` + 四个按钮 `id="btn-speed-0.25|0.5|1|2"`（1× 默认 `aria-pressed="true"`）；`按钮 #btn-answer`；`#pause`、`#reset`
- `.answer#answer`（默认 `display:none`，`.on` 显示）；面板内顶部留 `#drift` 提示位（默认隐藏），提供 `markDrift(on)` 开关，文案「已偏离题目条件，读数仅供参考」
- 可折叠的题目原文卡片 `#problem`（默认收起，点击展开），每个演示把自己的题干放进去
- 页面末尾：`<script type="importmap">` 指向 `../lib/three.module.js` 与 `../lib/OrbitControls.js`
- 模块脚本内提供：
  - `const clock = new THREE.Clock(); let speed = 1;` 与 `setSpeed(v)`（更新按钮态）
  - `label3d(text, color = '#9FE6C4', size = .3)` → `THREE.Sprite`（canvas 贴图）
  - `makeArrow(color, len)` → `THREE.ArrowHelper`
  - `makeTrail(maxPoints)` → `{ line, push(p), clear() }`
  - `/* === SCENE === */` 区块，内含空的 `animate()`，标题写 `SHELL_OK`
- 键盘：空格暂停、R 重播

- [ ] **Step 4: 运行，确认通过**

Run: `bash ~/tools/physics-3d/tests/shell.test.sh`
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add templates/shell.html tests/shell.test.sh && git commit -m "feat: shared demo shell with unified controls"
```

---

### Task 3: `tools/build.py` 单文件打包

**Files:**
- Create: `tools/build.py`
- Test: `tests/build.test.py`

**Interfaces:**
- Produces: `build(src_html: str, out_html: str) -> None`。读取模板 HTML，把 importmap 里指向本地文件的 `three` 与 `three/addons/controls/OrbitControls.js` 替换为 `data:text/javascript;base64,...`，并内联所有 `<script src="...">`；输出单文件。

- [ ] **Step 1: 写测试 `tests/build.test.py`**

```python
import subprocess, sys, pathlib
ROOT = pathlib.Path.home() / "tools/physics-3d"
out = ROOT / "tests" / "out_shell.html"
subprocess.run([sys.executable, str(ROOT/"tools/build.py"),
                str(ROOT/"templates/shell.html"), str(out)], check=True)
html = out.read_text(encoding="utf-8")
assert "https://" not in html and "http://" not in html, "仍引用网络地址"
assert "data:text/javascript;base64," in html, "three 未内联"
assert out.stat().st_size > 1_200_000, "产物过小，疑似未内联"
print("PASS")
```

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/build.test.py`
Expected: `FileNotFoundError` / 非零退出（build.py 不存在）

- [ ] **Step 3: 实现 `tools/build.py`**

```python
#!/usr/bin/env python3
"""把模板打包成单文件 HTML：内联 three.js 与本地脚本，产物不联网。"""
import base64, pathlib, re, sys

def data_url(p: pathlib.Path) -> str:
    return "data:text/javascript;base64," + base64.b64encode(p.read_bytes()).decode()

def build(src: pathlib.Path, out: pathlib.Path) -> None:
    root = src.parent
    html = src.read_text(encoding="utf-8")
    # 1) importmap：本地路径 → data URL
    def repl(m):
        key, val = m.group(1), m.group(2)
        p = (root / val).resolve()
        return f'"{key}":"{data_url(p)}"' if p.suffix == ".js" else m.group(0)
    html = re.sub(r'"([^"]+)"\s*:\s*"([^"]+\.js)"', repl, html)
    # 2) <script src="...">：内联
    def inline(m):
        p = (root / m.group(1)).resolve()
        return "<script>\n" + p.read_text(encoding="utf-8") + "\n</script>"
    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    out.write_text(html, encoding="utf-8")

if __name__ == "__main__":
    build(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
```

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/build.test.py`
Expected: `PASS`

- [ ] **Step 5: 确认产物真的能打开（不是只过了字符串检查）**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=3000 --dump-dom "file://$HOME/tools/physics-3d/tests/out_shell.html" | grep -c SHELL_OK
```
Expected: `1`（若为 0，说明 data: 模块在 file:// 下未能解析，需改走「内联为经典脚本」方案）

- [ ] **Step 6: 提交**

```bash
cd ~/tools/physics-3d && git add tools/build.py tests/build.test.py && git commit -m "feat: single-file build with inlined three.js"
```

---

### Task 4: 纯物理函数 `src/physics.js` 与单元测试

**Files:**
- Create: `src/physics.js`
- Test: `tests/physics.test.js`

**Interfaces:**
- Produces：`globalThis.PHYS`，包含
  - `PHYS.t1.radius({v, m, q, B}) -> number`（`m·v/(|q|·B)`）
  - `PHYS.t1.period({m, q, B}) -> number`（`2πm/(|q|·B)`）
  - `PHYS.t1.omega({m, q, B}) -> number`（带符号 `-q·B/m`，负电荷反向）
  - `PHYS.t2.centralAngle(theta) -> number`（`2π − 2θ`，θ 为速度与边界线的夹角，弧度）
  - `PHYS.t2.chord(r, theta) -> number`（`2r·sinθ`）
  - `PHYS.t2.time({m, q, B, theta}) -> number`
  - `PHYS.t3.radius({v, theta, m, q, B}) -> number`（`m·v·sinθ/(|q|·B)`）
  - `PHYS.t3.pitch({v, theta, m, q, B}) -> number`（`v·cosθ · 2πm/(|q|·B)`）
  - `PHYS.t4.selectorSpeed(E, B) -> number`（`E/B`）
  - `PHYS.t4.willPass(v, E, B) -> boolean`（`|v − E/B| < 1e-9` 时直线通过）
  - `PHYS.safe(x) -> number`（非有限值返回 0，用于防止 NaN 上屏）

- [ ] **Step 1: 写测试 `tests/physics.test.js`**

```js
load("src/physics.js");
function near(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }
function fail(msg) { print("FAIL: " + msg); quit(1); }

const P = globalThis.PHYS;
if (!near(P.t1.radius({ v: 1, m: 1, q: 1, B: 1 }), 1)) fail("r=mv/qB");
if (!near(P.t1.radius({ v: 2, m: 1, q: 1, B: 1 }), 2)) fail("r ∝ v");
if (!near(P.t1.period({ m: 1, q: 1, B: 1 }), 2 * Math.PI)) fail("T=2πm/qB");
if (!near(P.t1.period({ m: 1, q: 1, B: 2 }), Math.PI)) fail("T ∝ 1/B");
if (!near(P.t1.radius({ v: 1, m: 1, q: -1, B: 1 }), 1)) fail("负电荷半径取绝对值");
if (P.t1.omega({ m: 1, q: 1, B: 1 }) * P.t1.omega({ m: 1, q: -1, B: 1 }) >= 0) fail("负电荷应反向");

const half = Math.PI / 2;
if (!near(P.t2.centralAngle(half), Math.PI)) fail("垂直入射为半圆");
if (!near(P.t2.chord(1, half), 2)) fail("垂直入射弦长为直径");
if (!near(P.t2.centralAngle(Math.PI / 6), 4 * Math.PI / 3)) fail("斜入射圆心角");
if (P.t2.centralAngle(0) > 2 * Math.PI + 1e-9) fail("圆心角不得超过 2π");

if (P.safe(NaN) !== 0 || P.safe(Infinity) !== 0 || P.safe(3) !== 3) fail("safe()");

// 退化与极端值：B→0、v→0 不得返回 NaN，也不得编造数字
if (P.t1.radius({ v: 1, m: 1, q: 1, B: 0 }) !== 0) fail("B=0 半径应为 0");
if (P.t1.radius({ v: 0, m: 1, q: 1, B: 1 }) !== 0) fail("v=0 半径应为 0");
if (!Number.isFinite(P.t1.period({ m: 1, q: 0, B: 1 }))) fail("q=0 周期不得为 NaN");

// T3 螺旋：θ=90° 退化为圆周，θ=0 退化为直线
if (!near(P.t3.pitch({ v: 1, theta: half, m: 1, q: 1, B: 1 }), 0)) fail("θ=90° 螺距应为 0");
if (!near(P.t3.radius({ v: 1, theta: half, m: 1, q: 1, B: 1 }), 1)) fail("θ=90° 半径应为 mv/qB");
if (P.t3.radius({ v: 1, theta: 0, m: 1, q: 1, B: 1 }) !== 0) fail("θ=0 半径应为 0（直线）");

// T4 速度选择器
if (!near(P.t4.selectorSpeed(2, 1), 2)) fail("v=E/B");
if (!P.t4.willPass(2, 2, 1)) fail("v=E/B 应直线通过");
if (P.t4.willPass(1, 2, 1)) fail("v≠E/B 应偏转");
print("PASS");
```

- [ ] **Step 2: 运行，确认失败**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc ~/tools/physics-3d/tests/physics.test.js`
Expected: 报错退出（`src/physics.js` 不存在）

- [ ] **Step 3: 实现 `src/physics.js`**

```js
(function (g) {
  const TAU = Math.PI * 2;
  const safe = x => (Number.isFinite(x) ? x : 0);
  const t1 = {
    radius: ({ v, m, q, B }) => safe(Math.abs(q) > 0 && B > 0 ? (m * v) / (Math.abs(q) * B) : 0),
    period: ({ m, q, B }) => safe(Math.abs(q) > 0 && B > 0 ? (TAU * m) / (Math.abs(q) * B) : 0),
    omega:  ({ m, q, B }) => safe(Math.abs(m) > 0 ? (-q * B) / m : 0),
  };
  const t2 = {
    centralAngle: theta => safe(Math.min(TAU, Math.max(0, TAU - 2 * theta))),
    chord: (r, theta) => safe(2 * r * Math.sin(Math.min(theta, Math.PI - theta) || 0)),
    time: ({ m, q, B, theta }) => {
      const w = Math.abs(t1.omega({ m, q, B }));
      return safe(w > 0 ? t2.centralAngle(theta) / w : 0);
    },
  };
  const t3 = {
    radius: ({ v, theta, m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (m * v * Math.sin(theta)) / (Math.abs(q) * B) : 0),
    pitch: ({ v, theta, m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? v * Math.cos(theta) * (TAU * m) / (Math.abs(q) * B) : 0),
  };
  const t4 = {
    selectorSpeed: (E, B) => safe(B > 0 ? E / B : 0),
    willPass: (v, E, B) => Math.abs(v - t4.selectorSpeed(E, B)) < 1e-9,
  };
  g.PHYS = { t1, t2, t3, t4, safe };
})(globalThis);
```

- [ ] **Step 4: 运行，确认通过**

Run: 同 Step 2。
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add src/physics.js tests/physics.test.js && git commit -m "feat: pure physics functions with unit tests"
```

---

### Task 5: T1 模板（无边界磁场·圆周运动）

**Files:**
- Create: `templates/t1-circular.html`（复制 shell，替换 `/* === SCENE === */`）
- Create: `tests/t1.render.test.py`

**Interfaces:**
- Consumes: `PHYS.t1.*`（Task 4）、shell 的 `label3d/makeArrow/makeTrail/setSpeed`
- Produces: 可打包的 T1 模板；页面暴露 `#ro-r`、`#ro-T`，并嵌入 `<script id="expect" type="application/json">{"r":1,"T":6.283}</script>` 供自检比对。

- [ ] **Step 1: 写渲染测试 `tests/t1.render.test.py`**

```python
import json, re, subprocess, sys, pathlib
ROOT = pathlib.Path.home() / "tools/physics-3d"
built = ROOT / "tests" / "out_t1.html"
subprocess.run([sys.executable, str(ROOT/"tools/build.py"),
                str(ROOT/"templates/t1-circular.html"), str(built)], check=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
dom = subprocess.run([CHROME, "--headless=new", "--virtual-time-budget=3000",
                      "--dump-dom", f"file://{built}"], capture_output=True, text=True).stdout
assert "<title>T1_OK</title>" in dom, "页面未完成初始化"
r = float(re.search(r'id="ro-r"[^>]*>([-0-9.]+)<', dom).group(1))
expect = json.loads(re.search(r'<script id="expect"[^>]*>(.*?)</script>', dom, re.S).group(1))
assert abs(r - expect["r"]) < 1e-2, f"半径读数 {r} 与期望 {expect['r']} 不符"
print("PASS")
```

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/t1.render.test.py`
Expected: 非零退出（模板不存在）

- [ ] **Step 3: 实现 T1 模板**

场景要求：
- 坐标：粒子在 xy 平面，B 沿 +z；画面用深色网格做参照
- 参数（滑块 + `#ro-*` 读数）：速率 v（0.3–2.0）、磁感应 B（0.5–2.5）、电荷正负（按钮）
- 视觉：粒子（小球 + 光晕）、轨迹线（实时）、速度矢量（黄）、洛伦兹力矢量（红）、圆心与半径虚线、标签 A（入射点）
- 读数：`#ro-r`（半径）、`#ro-T`（周期）、`#ro-th`（偏转角/已转过角度）
- 数值统一：`const m = 1, q = ±1, v, B`，半径与周期调用 `PHYS.t1.*`，不手算
- 电荷为负时 `PHYS.t1.omega` 自动反号，轨迹反向
- 当 `B <= 0` 或 `v <= 0`：不画圆，粒子走直线，读数显示 `—`
- `document.title = 'T1_OK'` 在首帧渲染后设置
- 拖动任意滑块时调用 `markDrift(true)`，点「重播」恢复 `markDrift(false)`
- 嵌入 expect：`{"r": <默认 v/B>, "T": <2π/B>}`（默认 v=1, B=1）

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/t1.render.test.py`
Expected: `PASS`

- [ ] **Step 5: 人工看一眼截图**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --window-size=1280,800 --virtual-time-budget=4000 --screenshot=/tmp/t1.png \
  "file://$HOME/tools/physics-3d/tests/out_t1.html" && open /tmp/t1.png
```
Expected: 画面上有圆轨迹、三个矢量、控制面板；无穿模

- [ ] **Step 6: 提交**

```bash
cd ~/tools/physics-3d && git add templates/t1-circular.html tests/t1.render.test.py && git commit -m "feat: T1 uniform-field circular motion template"
```

---

### Task 6: `tools/check.py` 自检

**Files:**
- Create: `tools/check.py`
- Test: `tests/check.test.py`

**Interfaces:**
- Produces: `check(html_path) -> list[str]`（问题列表，空表示通过），以及命令行入口（退出码 0/1）。检查项：console 无错、`<title>` 含 `_OK`、`#ro-*` 与 `#expect` 一致（容差 1e-2）、截图非纯黑（平均亮度 > 8）。

- [ ] **Step 1: 写测试 `tests/check.test.py`**

```python
import pathlib, subprocess, sys, shutil
ROOT = pathlib.Path.home() / "tools/physics-3d"
good = ROOT / "tests" / "out_t1.html"
bad = ROOT / "tests" / "out_t1_bad.html"
assert good.exists(), "先跑 Task 5 生成 out_t1.html"
# 正例
r = subprocess.run([sys.executable, str(ROOT/"tools/check.py"), str(good)])
assert r.returncode == 0, "正常页面应通过"
# 反例：把期望值改坏
html = good.read_text(encoding="utf-8").replace('"r":1', '"r":9')
bad.write_text(html, encoding="utf-8")
r = subprocess.run([sys.executable, str(ROOT/"tools/check.py"), str(bad)])
assert r.returncode == 1, "读数不符时必须以非零退出"
print("PASS")
```

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/check.test.py`
Expected: 非零（check.py 不存在）

- [ ] **Step 3: 实现 `tools/check.py`**

要点：
- 用 `--dump-dom` 抓 HTML，用 `--screenshot=/tmp/check.png` 抓图
- 解析 `id="ro-xxx"` 的文本，与 `<script id="expect">` 的 JSON 逐项比对，容差 `1e-2`
- 截图用 Pillow 读平均亮度（venv：`~/tools/physics-3d/.venv`），低于 8 判为黑屏
- 检查 DOM 中不含 `https://`（防止误引用网络资源）
- 任一失败 → 打印问题并以 1 退出

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/check.test.py`
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add tools/check.py tests/check.test.py && git commit -m "feat: automated demo self-check"
```

---

### Task 7: T2 模板（直线边界磁场）

**Files:**
- Create: `templates/t2-boundary.html`
- Create: `tests/t2.render.test.py`（照 Task 5 的测试改 `T2_OK` 与 `#ro-ang`）

**Interfaces:**
- Consumes: `PHYS.t2.*`
- Produces: 可打包的 T2 模板，读数 `#ro-r`、`#ro-ang`（圆心角）、`#ro-t`（磁场中时间）

- [ ] **Step 1: 写测试**（复制 `tests/t1.render.test.py`，改模板名、标题、读数 id 与 expect 字段）

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/t2.render.test.py`
Expected: 非零退出

- [ ] **Step 3: 实现模板**

场景要求：
- 一条竖直边界线把空间分成「无场区 / 磁场区」；粒子从左方以与边界线夹角 θ 射入
- 参数：θ（15°–85°）、v、B、电荷正负
- 视觉：轨迹圆弧、入射点与出射点、弦（虚线）、圆心、圆心角标注
- 读数：半径、圆心角（度）、在磁场中的时间；调用 `PHYS.t2.*`，不手算
- 边界情况：θ→0 时轨迹几乎与边界相切，不能出现负圆心角或 NaN（`PHYS.t2.centralAngle` 已夹取）
- `document.title = 'T2_OK'`

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/t2.render.test.py`
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add templates/t2-boundary.html tests/t2.render.test.py && git commit -m "feat: T2 straight-boundary template"
```

---

### Task 8: T3 模板（磁场中的螺旋运动）

**Files:**
- Create: `templates/t3-helix.html`
- Create: `tests/t3.render.test.py`

**Interfaces:**
- Consumes: `PHYS.t3.radius`、`PHYS.t3.pitch`
- Produces: 可打包的 T3 模板，读数 `#ro-r`（半径）、`#ro-p`（螺距）

- [ ] **Step 1: 写测试**（复制 `tests/t2.render.test.py`，模板改为 `t3-helix.html`、标题 `T3_OK`、比对 `#ro-p`）

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/t3.render.test.py`
Expected: 非零退出

- [ ] **Step 3: 实现模板**

场景要求：
- B 沿 +z；粒子以与 B 成 θ 的速度入射，做螺旋线
- 参数：θ（15°–85°）、v、B、电荷正负
- 读数：回旋半径、螺距（调用 `PHYS.t3.*`）
- θ→0 时不画螺旋、粒子走直线，读数显示 `—`
- `document.title = 'T3_OK'`

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/t3.render.test.py`
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add templates/t3-helix.html tests/t3.render.test.py && git commit -m "feat: T3 helical motion template"
```

---

### Task 9: T4 模板（复合场·速度选择器）

**Files:**
- Create: `templates/t4-selector.html`
- Create: `tests/t4.render.test.py`

**Interfaces:**
- Consumes: `PHYS.t4.selectorSpeed`、`PHYS.t4.willPass`
- Produces: 可打包的 T4 模板，读数 `#ro-sel`（E/B）

- [ ] **Step 1: 写测试**（照 Task 8，标题 `T4_OK`，比对 `#ro-sel`）

- [ ] **Step 2: 运行，确认失败**

Run: `python3 ~/tools/physics-3d/tests/t4.render.test.py`
Expected: 非零退出

- [ ] **Step 3: 实现模板**

场景要求：
- E 竖直向下、B 垂直纸面向外，粒子水平射入极板之间
- 参数：v、E、B；读数显示 `E/B`
- `willPass` 为真时轨迹是直线，为假时朝一侧偏转，并在角落标注"未通过"
- `document.title = 'T4_OK'`

- [ ] **Step 4: 运行，确认通过**

Run: `python3 ~/tools/physics-3d/tests/t4.render.test.py`
Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add templates/t4-selector.html tests/t4.render.test.py && git commit -m "feat: T4 velocity selector template"
```

---

### Task 10: 安装技能与真题验证

**Files:**
- Create: `~/.claude/skills/physics-3d-demo/SKILL.md`
- Create: `docs/superpowers/records/2026-11-10-first-run.md`

**Interfaces:**
- Consumes: 前面全部产物
- Produces: 用户日常入口——发题 + "做个演示" 即可触发。

- [ ] **Step 1: 写技能文档**

```markdown
---
name: physics-3d-demo
description: 把一道高中物理题（尤为磁场、电场中的运动）做成单文件三维演示 HTML。用户发来物理题并说"做个演示 / 做成三维 / 出个动画"时使用。
---

# 物理三维演示生成流程

工具目录：~/tools/physics-3d（模板、脚本，勿由用户操作）
输出目录：~/磁场三维演示/，命名 `<YYYYMMDD>-<题号或主题>-<slug>.html`

## 六步，不可跳过

1. **复述**（必须先说）：用两三句话说出场、粒子、几何、要求，等用户确认或指出错误。
2. **判模型**：对照判定表；判不了就明说"现有模板做不了"，给出最接近的模板与需要的增量。
3. **定几何**：坐标、正方向、比例、显示值与题目真实值的关系。
4. **生成**：复制 templates/shell.html 或最接近的模板，替换 SCENE 区块；物理量一律调用 src/physics.js，不手写公式。
5. **自检**：`python3 tools/build.py <模板> <输出>` → `python3 tools/check.py <输出>`；失败必须修到通过。
6. **交付**：路径 + 三句话操作说明 + 本题题眼。

## 判定表

| 题目特征 | 模板 |
|---|---|
| 只有磁场、垂直射入、无边界 | t1-circular |
| 直线边界、"恰好射出"、求弦长/时间 | t2-boundary |
| 速度与 B 斜交、问螺距 | T3（未建，先做增量） |
| E 与 B 同时存在、直线通过 | T4（未建，先做增量） |

## 硬性要求

- 单文件产物，不得引用任何网络地址
- 控件统一：四档速度、暂停、重播、空格暂停、R 重置、答案面板默认收起
- 读数用题目真实数值；无数值显示公式，禁止编数字
- 答案锁定题目条件，拖参数后顶部提示"已偏离题目条件"
```

- [ ] **Step 2: 验证技能被识别**

Run: 在 Claude Code 中 `/skills` 或直接问"物理三维演示流程是什么"，确认技能可被载入。

- [ ] **Step 3: 用一道真题端到端跑一遍**

以一份真实磁场题（文字或截图）为输入，严格按六步执行，产出到 `~/磁场三维演示/`。
记录：耗时、卡住的步骤、需要人工修正的次数 → 写入 `docs/superpowers/records/2026-11-10-first-run.md`。

- [ ] **Step 4: 根据记录修正流程**

如果第一次跑通的耗时 > 30 分钟，把卡点写回 SKILL.md 的对应步骤（例如"判模型前先确认磁场方向"）。

- [ ] **Step 5: 提交**

```bash
cd ~/tools/physics-3d && git add -A && git commit -m "feat: install physics demo skill and first end-to-end run"
```
