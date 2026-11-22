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

  const t7 = {
    // 竖直匀变速（取向上为正）：y = y0 + v0 t − ½ g t²
    height: ({ y0 = 0, v0 = 0, g = 10, t = 0 }) => safe(y0 + v0 * t - 0.5 * g * t * t),
    velocity: ({ v0 = 0, g = 10, t = 0 }) => safe(v0 - g * t),
    // 匀速上升的底板
    liftY: ({ y0 = 0, v = 0, t = 0 }) => safe(y0 + v * t),
    // 相对底板：松脱时相对速度为 0，故相对位移 ½gt²、相对速度 gt（方向向下取负）
    relDrop: ({ g = 10, t = 0 }) => safe(0.5 * g * t * t),
    relVelocity: ({ g = 10, t = 0 }) => safe(-g * t),
    peakTime: ({ v0 = 0, g = 10 }) => safe(g > 0 ? v0 / g : 0),
    peakHeight: ({ y0 = 0, v0 = 0, g = 10 }) => safe(g > 0 ? y0 + v0 * v0 / (2 * g) : y0),
    // 先升后降的总路程
    pathLength: ({ y0 = 0, v0 = 0, yEnd = 0, g = 10 }) => {
      const hp = t7.peakHeight({ y0, v0, g });
      return safe(Math.abs(hp - y0) + Math.abs(hp - yEnd));
    },
    avgSpeed: (dist, t) => safe(t > 0 ? dist / t : 0),
  };

  const t8 = {
    // 追及相遇：A 匀速 v 在前，B 从后方 d 处静止出发、加速度 a
    aPos: ({ v = 0, t = 0 }) => safe(v * t),
    bPos: ({ d = 0, a = 0, t = 0 }) => safe(-d + 0.5 * a * t * t),
    // 解 ½at² = vt + d，取正根
    catchTime: ({ v = 0, d = 0, a = 0 }) => {
      if (!(a > 0)) return 0;
      const A = 0.5 * a, B = -v, C = -d;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return 0;
      return safe((-B + Math.sqrt(disc)) / (2 * A));
    },
    // 速度相等时相距最远
    maxGapTime: ({ v = 0, a = 0 }) => safe(a > 0 ? v / a : 0),
    maxGap: ({ v = 0, d = 0, a = 0 }) => safe(a > 0 ? d + v * v / (2 * a) : d),
    // 刹车：停下所需时间与距离
    brakeStopTime: ({ v = 0, a = 0 }) => safe(a > 0 ? v / a : 0),
    brakeDistance: ({ v = 0, a = 0 }) => safe(a > 0 ? v * v / (2 * a) : 0),
    // 第一次相遇后 B 以 a 减速到停止，A 再追上所需时间（严格按“停下就不动了”）
    secondMeet: ({ vA = 0, vB = 0, a = 0 }) => {
      const ts = t8.brakeStopTime({ v: vB, a });
      const sb = t8.brakeDistance({ v: vB, a });
      const rest = sb - vA * ts;
      return safe(vA > 0 && rest > 0 ? ts + rest / vA : ts);
    },
  };

  // T9 质谱仪：速度选择器 → 偏转磁场 → 照相底片
  const t9 = {
    // 速度选择器：qE = qvB → v = E/B
    selectorSpeed: (E, B) => safe(B > 0 ? E / B : 0),
    // 偏转磁场中的半径：r = mv/(qB)
    radius: ({ m, q, v, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (m * Math.abs(v)) / (Math.abs(q) * B) : 0),
    // 180° 半圆后落点距入射口 2r
    landing: (r) => safe(2 * Math.abs(r)),
    // 相邻两束的落点间距
    spacing: (rA, rB) => safe(2 * Math.abs(rB - rA)),
  };

  // T10 回旋加速器
  const t10 = {
    // 回旋周期：T = 2πm/(qB)，与速度无关
    period: ({ m, q, B }) =>
      safe(Math.abs(q) > 0 && B > 0 ? (TAU * m) / (Math.abs(q) * B) : 0),
    frequency: ({ m, q, B }) => {
      const T = t10.period({ m, q, B });
      return safe(T > 0 ? 1 / T : 0);
    },
    // 最大速度：v_max = qBR/m（半径达到 D 形盒半径时）
    vMax: ({ m, q, B, R }) =>
      safe(m > 0 && B > 0 ? (Math.abs(q) * B * R) / m : 0),
    // 最大动能：Ek = q²B²R²/(2m)
    energyMax: ({ m, q, B, R }) => {
      const v = t10.vMax({ m, q, B, R });
      return safe(0.5 * m * v * v);
    },
    // 每过一次缝隙获得 qU；达到最大动能所需加速次数（向上取整）
    crossings: ({ m, q, B, R, U }) => {
      const du = Math.abs(q) * U;
      const ek = t10.energyMax({ m, q, B, R });
      return safe(du > 0 ? Math.ceil(ek / du) : 0);
    },
    // 第 n 次加速后的轨道半径：r_n = √(2nmU/qB²)
    radiusN: ({ n, m, q, B, U }) => {
      const qq = Math.abs(q);
      const den = qq * B;
      return safe(n > 0 && qq > 0 && B > 0 ? Math.sqrt(2 * n * m * qq * U) / den : 0);
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

  g.PHYS = { t1, t2, t3, t4, t5, t7, t8, t9, t10, safe, fmt };
})(globalThis);
