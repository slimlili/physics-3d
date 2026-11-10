#!/bin/bash
# 冒烟测试：验证本地化的 three.js 与 OrbitControls 能加载并渲染首帧。
# 必须走 HTTP：file:// 下相对路径的 ES module 会被 CORS 拦截（已实测）。
set -e
cd "$(dirname "$0")/.."
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1
OUT=$("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=3000 --dump-dom "http://127.0.0.1:8765/tests/smoke.html" 2>/dev/null)
echo "$OUT" | grep -q '<title>RENDER_OK</title>' || { echo "FAIL: three.js 未能加载"; exit 1; }
echo "PASS"
