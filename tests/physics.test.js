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
if (!near(P.t2.centralAngle(Math.PI / 6), 5 * Math.PI / 3)) fail("θ=30° 圆心角应为 300°");
if (!near(P.t2.centralAngle(Math.PI / 3), 4 * Math.PI / 3)) fail("θ=60° 圆心角应为 240°");
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
// 直线边界：负电荷只转 2θ
if (!near(P.t2.centralAngle(Math.PI / 6, -1), Math.PI / 3)) fail("负电荷圆心角应为 2θ");
if (!near(P.t2.time({ m: 1, q: -1, B: 1, theta: Math.PI / 6 }), Math.PI / 3)) fail("负电荷在磁场中时间");

// 数值格式：指数符号不能丢
if (P.fmt(5.027e-7) !== "5.03×10⁻⁷") fail("负指数格式: " + P.fmt(5.027e-7));
if (P.fmt(1e-4) !== "1.00×10⁻⁴") fail("1e-4 格式");
if (P.fmt(0.16) !== "0.16") fail("普通数值格式");
if (P.fmt(-3.5e-12) !== "-3.50×10⁻¹²") fail("负数格式: " + P.fmt(-3.5e-12));
print("PASS");
