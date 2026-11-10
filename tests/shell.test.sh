#!/bin/bash
# 底座验收：控件齐全、默认态正确、脚本能跑起来（须走 HTTP，file:// 会拦模块）。
set -e
cd "$(dirname "$0")/.."
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=$("$CHROME" --headless=new --virtual-time-budget=3000 --dump-dom "http://127.0.0.1:8765/templates/shell.html" 2>/dev/null)
echo "$OUT" | grep -q 'id="btn-speed-2"'      || { echo "FAIL: 缺少速度按钮"; exit 1; }
echo "$OUT" | grep -q 'aria-pressed="true"'    || { echo "FAIL: 缺少默认选中态"; exit 1; }
echo "$OUT" | grep -q 'id="answer"'            || { echo "FAIL: 缺少答案面板"; exit 1; }
echo "$OUT" | grep -q '<title>SHELL_OK</title>' || { echo "FAIL: 脚本未执行"; exit 1; }
echo "PASS"
