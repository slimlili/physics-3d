/* 纯物理函数：无 DOM、无 three.js，可用 jsc / 浏览器直接测试。
   所有函数对非法输入返回 0，避免 NaN 上屏。 */
(function (g) {
  const TAU = Math.PI * 2;
  const safe = x => (Number.isFinite(x) ? x : 0);

  const t1 = {
    // 匀强磁场中的圆周运动
    radius: ({ v, m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (m * v) / (Math.abs(q) * B) : 0),
    period: ({ m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (TAU * m) / (Math.abs(q) * B) : 0),
    // 带符号角速度：负电荷反向
    omega: ({ m, q, B }) => safe(Math.abs(m) > 0 ? (-q * B) / m : 0),
  };

  const t2 = {
    // 直线边界：theta 为速度与边界线的夹角（弧度）
    // 正电荷（q>0）圆心落在磁场内，转 2π−2θ；负电荷受力朝外，穿出前只转 2θ
    centralAngle: (theta, q = 1) =>
      safe(Math.min(TAU, Math.max(0, q > 0 ? TAU - 2 * theta : 2 * theta))),
    chord: (r, theta) => safe(2 * r * Math.sin(Math.min(theta, Math.PI - theta) || 0)),
    time: ({ m, q, B, theta }) => {
      const w = Math.abs(t1.omega({ m, q, B }));
      return safe(w > 0 ? t2.centralAngle(theta, q) / w : 0);
    },
  };

  const t3 = {
    // 速度与 B 斜交：theta 为 v 与 B 的夹角
    radius: ({ v, theta, m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (m * v * Math.sin(theta)) / (Math.abs(q) * B) : 0),
    pitch: ({ v, theta, m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? v * Math.cos(theta) * (TAU * m) / (Math.abs(q) * B) : 0),
  };

  const t4 = {
    selectorSpeed: (E, B) => safe(B > 0 ? E / B : 0),
    willPass: (v, E, B) => Math.abs(v - t4.selectorSpeed(E, B)) < 1e-9,
  };

  const t5 = {
    // 组合场：粒子沿半径射入半径 R 的圆形磁场，轨迹半径 r，从边界穿出的交点
    exitPoint: ({ r, R }) => {
      const den = R * R + r * r;
      if (!(den > 0)) return { x: 0, y: 0 };
      return { x: safe(2 * r * R * R / den), y: safe(-2 * r * r * R / den) };
    },
    // 磁场中转过的圆心角（度）：r=R 时 90°，r=R/√3 时 120°
    deflectionDeg: ({ r, R }) => {
      const p = t5.exitPoint({ r, R });
      const ang = Math.atan2(p.y, p.x - r);          // 出射点相对轨迹圆心的方位角
      let d = ang - Math.PI;                          // 入射点方位角为 π
      while (d < 0) d += TAU;
      return safe(d * 180 / Math.PI);
    },
  };

  // 科学计数法：5.027e-7 → "5.03×10⁻⁷"；0.16 → "0.16"
  const SUP = { '-': '⁻', '+': '', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function fmt(x) {
    if (!Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 0.01 && a < 1e5) return x.toFixed(2);
    const [c, e] = x.toExponential(2).split('e');
    const exp = e.split('').map(ch => SUP[ch] ?? '').join('');
    return c + '×10' + exp;
  }

  g.PHYS = { t1, t2, t3, t4, t5, safe, fmt };
})(globalThis);
