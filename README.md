# 物理 3D 演示

面向高中物理课堂的单文件三维演示：带电粒子在磁场、组合场中的运动，以及追及相遇。
每个演示把 three.js 内联进一个 HTML，**不联网、不用装软件，手机打开就能转**。

- 在线画廊：<https://boyahighschool.cn/3d/>
- 每个成品约 1.8MB，可单独拷走、断网播放

## 模板

| 模板 | 内容 |
|---|---|
| `templates/t1-circular.html` | 匀强磁场中的圆周运动 |
| `templates/t2-boundary.html` | 直线边界磁场 |
| `templates/t3-helix.html` | 磁场中的螺旋运动 |
| `templates/t4-selector.html` | 速度选择器 |
| `templates/t5-combo*.html` | 组合场（装置化 / 全息 / 亮色） |
| `templates/t7-vertical.html` | 竖直运动 · 升降机与螺钉 |
| `templates/t8-pursuit.html` | 追及相遇 · 两车 |
| `templates/t9-instruments.html` | 质谱仪 · 回旋加速器 |

## 构建

```bash
python3 tools/build.py templates/t1-circular.html out.html
```

把 importmap 与本地脚本内联成单文件；产物不依赖网络。

## 画廊

`gallery/index.html` 是手机端入口，`gallery/demos/` 是已构建的 5 个成品。
本地预览：

```bash
cd gallery && python3 -m http.server 8080
```

## 说明

- 渲染基于 [three.js](https://threejs.org/)（MIT），已放在 `lib/`。
- 只做课堂演示，不替代真实实验与推导。
