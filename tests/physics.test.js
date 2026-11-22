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
// T5：沿半径射入圆形磁场
if (!near(P.t5.deflectionDeg({ r: 1, R: 1 }), 90)) fail("r=R 应偏转 90°");
if (!near(P.t5.deflectionDeg({ r: 1 / Math.sqrt(3), R: 1 }), 120)) fail("r=R/√3 应偏转 120°");
const e1 = P.t5.exitPoint({ r: 1, R: 1 });
if (!near(e1.x, 1) || !near(e1.y, -1)) fail("r=R 出射点应为 (R,-R)");
print("PASS");

// T7 竖直运动：本题数据 g=10、v0=5、t=4 s、松脱点 60 m
if (!near(P.t7.height({ y0: 60, v0: 5, g: 10, t: 4 }), 0)) fail("4 s 后螺钉应落到井底");
if (!near(P.t7.velocity({ v0: 5, g: 10, t: 4 }), -35)) fail("落地速度应为 -35 m/s");
if (!near(P.t7.peakHeight({ y0: 60, v0: 5, g: 10 }), 61.25)) fail("最高点应为 61.25 m");
if (!near(P.t7.peakTime({ v0: 5, g: 10 }), 0.5)) fail("最高点时刻应为 0.5 s");
if (!near(P.t7.relDrop({ g: 10, t: 4 }), 80)) fail("相对底板应下落 80 m");
if (!near(P.t7.liftY({ y0: 60, v: 5, t: 4 }), 80)) fail("底板 4 s 后应在井口 80 m");
if (!near(P.t7.pathLength({ y0: 60, v0: 5, yEnd: 0, g: 10 }), 62.5)) fail("路程应为 62.5 m");
if (!near(P.t7.avgSpeed(62.5, 4), 15.625)) fail("平均速率应为 15.625 m/s");
if (P.t7.avgSpeed(62.5, 0) !== 0) fail("t=0 平均速率应为 0");
if (!near(P.t7.height({ y0: 0, v0: 0, g: 10, t: 0 }), 0)) fail("t=0 高度应为 0");

// T8 追及相遇：本题 v=2.5、d=50、a1=0.5、a2=2
if (!near(P.t8.catchTime({ v: 2.5, d: 50, a: 0.5 }), 20)) fail("第一次相遇应为 20 s");
if (!near(P.t8.maxGap({ v: 2.5, d: 50, a: 0.5 }), 56.25)) fail("最远距离应为 56.25 m");
if (!near(P.t8.maxGapTime({ v: 2.5, a: 0.5 }), 5)) fail("最远时刻应为 5 s");
if (!near(P.t8.brakeStopTime({ v: 10, a: 2 }), 5)) fail("刹车停下应为 5 s");
if (!near(P.t8.brakeDistance({ v: 10, a: 2 }), 25)) fail("刹车距离应为 25 m");
if (!near(P.t8.secondMeet({ vA: 2.5, vB: 10, a: 2 }), 10)) fail("第二次相遇 Δt 应为 10 s");
if (P.t8.catchTime({ v: 2.5, d: 50, a: 0 }) !== 0) fail("a=0 不得返回 NaN");

// T9 质谱仪：m=1、q=1、v=2、B=1 → r=2、落点 4
if (!near(P.t9.selectorSpeed(2, 1), 2)) fail("T9 v=E/B");
if (!near(P.t9.radius({ m: 1, q: 1, v: 2, B: 1 }), 2)) fail("T9 r=mv/qB");
if (!near(P.t9.landing(2), 4)) fail("T9 落点 2r");
if (!near(P.t9.spacing(2, 3), 2)) fail("T9 间距 2Δr");
if (P.t9.radius({ m: 1, q: 1, v: 2, B: 0 }) !== 0) fail("T9 B=0 半径应为 0");
if (P.t9.selectorSpeed(2, 0) !== 0) fail("T9 B=0 速度应为 0");

// T10 回旋加速器：m=1、q=1、B=1 → T=2π；B=2 → T=π
if (!near(P.t10.period({ m: 1, q: 1, B: 1 }), 2 * Math.PI)) fail("T10 T=2πm/qB");
if (!near(P.t10.period({ m: 1, q: 1, B: 2 }), Math.PI)) fail("T10 T∝1/B");
if (!near(P.t10.frequency({ m: 1, q: 1, B: 1 }), 1 / (2 * Math.PI))) fail("T10 f=1/T");
if (!near(P.t10.vMax({ m: 1, q: 1, B: 1, R: 3 }), 3)) fail("T10 vmax=qBR/m");
if (!near(P.t10.energyMax({ m: 1, q: 1, B: 1, R: 3 }), 4.5)) fail("T10 Ek=½mvmax²");
if (P.t10.crossings({ m: 1, q: 1, B: 1, R: 3, U: 1 }) !== 5) fail("T10 加速次数向上取整");
if (!near(P.t10.radiusN({ n: 1, m: 1, q: 1, B: 1, U: 2 }), 2)) fail("T10 r1=√(2mU)/qB");
if (P.t10.radiusN({ n: 1, m: 1, q: 1, B: 0, U: 2 }) !== 0) fail("T10 B=0 不得 NaN");
if (P.t10.crossings({ m: 1, q: 1, B: 1, R: 3, U: 0 }) !== 0) fail("T10 U=0 加速次数应为 0");
