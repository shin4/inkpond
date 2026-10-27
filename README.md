<div align="center">

# 墨池 Inkpond

**简体中文** · [English](README.en.md)

以字为墨，以页为池：一层铺在网页背后的水墨汉字底。

[![CI](https://github.com/shin4/inkpond/actions/workflows/ci.yml/badge.svg)](https://github.com/shin4/inkpond/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/inkpond.svg?color=b4372b)](https://www.npmjs.com/package/inkpond)
[![License: MIT](https://img.shields.io/badge/license-MIT-b4372b.svg)](LICENSE)

[**在线演示**](https://shin4.github.io/inkpond/) · [发起会话 Demo](https://shin4.github.io/inkpond/session/)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/qingming-dark.webp" />
  <img alt="清明上河长卷缓缓向左展开：木拱虹桥从近岸拱起越过河面，船只往来，鼠标划过河面泛起水波，点击处墨迹晕开" src="docs/images/qingming-light.webp" />
</picture>

汉字按笔画疏密排成画面：远山云雾、鲤鱼游动的荷塘、缓缓展开的清明上河长卷、随日期轮换的二十四节气，或鲸影游过的深海。鼠标划过泛起水波，点击空白处落墨，墨迹晕开后慢慢淡去；页面上的内容周围自动留白。

- **五个场景**：山水、荷塘、清明上河、按日期自动切换的二十四节气，以及鲸游深海的北冥，可选淡彩
- **会回应**：鼠标起波、点击落墨，鲤鱼躲人、抢食，行人被墨惊散，鲸被触到会下潜
- **不碍事**：内容周围自动留白，鱼、船、行人也会绕开
- **够轻**：Canvas 2D，零运行时依赖，每帧脚本开销不到 2 ms，弱设备自动降级
- **React 可选**：提供 `<InkPond />` 组件，不用 React 也能直接用

## 场景

| `scene` | 画面 | 会动的东西 |
| --- | --- | --- |
| `shanshui`（默认） | 两重远山，云雾飘过 | 云雾 |
| `lotus` | 俯看荷塘：荷叶、荷花、浮萍 | 鲤鱼绕开内容游动，鼠标靠近会散开，落墨处会游过来 |
| `qingming` | 清明上河长卷：群山城郭、宝塔城楼、两岸酒旗飞檐、横跨两岸的木拱虹桥 | 长卷向左展开，船夫撑船，行人过桥，落墨惊散行人 |
| `jieqi` | 二十四节气，每个节气一幅画面，默认显示今天所在的节气 | 见下表；页面开着时跨入下一个节气，会以墨晕的方式过渡过去 |
| `beiming` | 北冥：俯看深海，浪下一头鲸的影子 | 鲸缓缓游动，约一分钟浮起又沉没一次，浮浅时在海面留下平静的鲸迹；鼠标触到它会下潜，落墨引它游近 |

荷塘、清明上河、节气和北冥带一点淡彩（朱、胭脂、赭石、花青），设 `tint={false}` 只用墨色。

### 二十四节气

`scene="jieqi"` 按太阳黄经判断今天所在的节气（误差约一刻钟）。用 `term` 固定显示某个节气，或用 `date` 显示某一天的节气：

```tsx
<InkPond scene="jieqi" />                          // 今天的节气，跟着时间走
<InkPond scene="jieqi" term="shuangjiang" />       // 只显示霜降
<InkPond scene="jieqi" date={new Date(2027, 0, 20)} /> // 那一天的节气（大寒）
```

`jieqiAt(date)` 返回某一时刻所在节气的 `term`，`JIEQI` 列出全部 24 个（`id`、名称、黄经）。

| 节气 | `term` | 画面 | 点击落墨时 / 鼠标 |
| --- | --- | --- | --- |
| 立春 | `lichun` | 冰面从一点裂开，裂缝旁冒出「芽」 | 落墨处成为新的破冰点 |
| 雨水 | `yushui` | 「雨」斜落，水面一圈圈涟漪 | 鼠标左右决定风向 |
| 惊蛰 | `jingzhe` | 闪电劈下、全屏一闪，「虫」从地里被震起 | 落墨处落雷 |
| 春分 | `chunfen` | 画面一半昼一半夜，朱色分界线起伏，燕子穿线 | 分界线跟随鼠标 |
| 清明 | `qingming` | 垂下的柳丝摆动，朱色纸鸢，细雨 | 鼠标拨开柳丝 |
| 谷雨 | `guyu` | 牡丹层层绽开，花瓣随雨飘落 | 落墨处开出新花 |
| 立夏 | `lixia` | 蛙鸣化作声波，层层叠加 | 鼠标靠近蛙叫得更急；落墨处一圈声波 |
| 小满 | `xiaoman` | 麦浪一道道滚过 | 鼠标处麦子被压低 |
| 芒种 | `mangzhong` | 朱色插秧线横扫水田，留下成行秧苗 | 落墨处插秧线移过去 |
| 夏至 | `xiazhi` | 朱色烈日、旋转的光芒，地面热浪扭曲 | 太阳缓缓跟随鼠标 |
| 小暑 | `xiaoshu` | 热气羽流上升扭动，蝉鸣 | 鼠标处吹来凉风 |
| 大暑 | `dashu` | 夜草丛上萤火游走，拖出光点 | 萤火被鼠标吸引 |
| 立秋 | `liqiu` | 大片留白，一片「叶」飘落入水 | 鼠标吹偏落叶 |
| 处暑 | `chushu` | 朱色热区被湍动的锋面推出画面，露出花青，鹰盘旋 | 鼠标处就地降温 |
| 白露 | `bailu` | 草叶上露珠凝结，饱满后滑落 | 碰到露珠它就滑落 |
| 秋分 | `qiufen` | 满月被朱色直径平分，直径缓慢自转 | 直径指向鼠标 |
| 寒露 | `hanlu` | 雁阵在「人」字和「一」字之间变换，地面菊丛 | 雁阵避开鼠标 |
| 霜降 | `shuangjiang` | 六角霜花从边缘生长，朱色枫叶飘落 | 鼠标的暖意融霜 |
| 立冬 | `lidong` | 水波由快到慢冻成冰纹，开裂后解冻 | 落墨处加一个波源 |
| 小雪 | `xiaoxue` | 三层景深的疏雪 | 鼠标吹开雪花 |
| 大雪 | `daxue` | 风雪斜扫，地面积起雪丘 | 鼠标左右决定风向 |
| 冬至 | `dongzhi` | 长夜中一点朱色「阳」推开墨色，外圈八十一点逐个成梅（数九） | 「阳」跟随鼠标 |
| 小寒 | `xiaohan` | 梅枝一笔笔生长，枝梢开花 | 落墨处绽开几朵梅 |
| 大寒 | `dahan` | 冰封的字格上烟花接连炸开 | 落墨处放一枚烟花 |

| 荷塘 | 山水 |
| --- | --- |
| <img alt="荷塘：落墨后鲤鱼游过来，鼠标划过时散开" src="docs/images/lotus.webp" /> | <img alt="山水：两重远山与云雾，鼠标划过起波，点击落墨" src="docs/images/shanshui.webp" /> |

## 安装

```bash
npm i inkpond
```

用 React 时还需要 `react`（18 及以上，可选的 peer 依赖）。

<details>
<summary>安装 GitHub 上的最新提交</summary>

```bash
npm i github:shin4/inkpond
```

从 GitHub 安装时会现场构建 `dist/`：

- npm 11 会对带构建脚本的依赖给出 `allow-scripts` 提示，安装照常完成；如果你的配置禁止依赖运行脚本，执行 `npm approve-scripts inkpond`。
- bun 默认不运行依赖的脚本，也不安装依赖的开发依赖。需要项目里有 TypeScript，并信任 inkpond：

  ```bash
  bun add -d typescript
  bun add github:shin4/inkpond
  bun pm trust inkpond
  ```

</details>

## 用法

### React

```tsx
import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

<main style={{ position: "relative" }}>
  <InkPond scene="lotus" active={isEmpty} />
  <section data-inkpond-avoid="">…问候语…</section>
  <form data-inkpond-avoid="">…输入框…</form>
</main>
```

- 画布铺满**最近的定位父元素**，并从它接收鼠标事件。
- 带 `data-inkpond-avoid` 的元素周围自动留白，后来才出现的元素也会被识别。
- `active` 表示这一块是否在屏幕上；标签页切到后台会自动暂停。
- 其他选项只在挂载时读一次，想改就换一个 `key` 重新挂载。
- 组件已标记 `"use client"`，可以直接放进 Next.js App Router 的服务端组件里。Vue、Svelte 的接入示例见 [常见问题](https://shin4.github.io/inkpond/faq/)。

### 不用 React

```ts
import { createInkPond } from "inkpond";
import "inkpond/inkpond.css";

const pond = createInkPond(document.querySelector("canvas.inkpond")!, {
  scene: "qingming",
});
pond.setActive(false); // 这一块被隐藏时
pond.destroy();        // 卸载时
```

### 主动拨动水面

页面自己也可以起波、落墨，比如打字时起涟漪、发送时落墨。坐标是视口坐标（`clientX` / `clientY`）：

```ts
pond.ripple(x, y, 0.4); // 一圈水波，强度 0–1，默认 1
pond.drop(x, y);        // 落墨；落在留白元素上会被拒绝，返回 false
```

React 里通过 `pondRef` 拿到同一个对象：

```tsx
const pondRef = useRef<InkPond | null>(null); // InkPond 类型来自 "inkpond"
<InkPond pondRef={pondRef} />
// 之后：pondRef.current?.ripple(x, y)
```

暂停、减少动画模式和静帧档下，这两个调用不生效。

## 选项

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `scene` | `"shanshui"` | `shanshui` / `lotus` / `qingming` / `jieqi` / `beiming` |
| `term` | 今天的节气 | 仅 `jieqi`：固定显示某个节气，如 `"qingming"` |
| `date` | 现在 | 仅 `jieqi`：显示这一天的节气，之后不再随时间切换 |
| `tint` | `true` | 是否画淡彩；`false` 只用墨色 |
| `active` | `true` | 是否在屏幕上；后台标签页总会暂停 |
| `strength` | `0.45` | 场景画面的墨色浓淡，不影响水波和墨迹 |
| `waveSpeed` | `1` | 水波速度倍数 |
| `cellSize` | 跟随档位（16） | 字格大小（CSS px，12–48），即字号；越小字越多、越费；降档后不会小于该档的字格（轻量档 22） |
| `levels` | 场景自带 | 替换主地面（山水的山、荷塘和清明的水面、北冥的海面）的字表，从淡到浓；换字需要自备字体；节气场景不使用 |
| `reducedMotion` | 跟随系统 | 开启后只画一张静止画面，不响应鼠标 |
| `avoidAttribute` | `data-inkpond-avoid` | 标记留白区域的属性名 |
| `avoidPadding` | `20` | 留白元素四周完全空出的宽度（CSS px） |
| `avoidFade` | `140` | 留白边缘墨色恢复的过渡宽度（CSS px） |
| `fontUrl` | 场景自带子集 | 设为 `null` 只用后备字体 |
| `fontFamily` / `fallbackFonts` | 场景自带 / 宋体系 | 字体名和后备字体 |
| `tierStorageKey` | `inkpond.tier` | 记住降级档位的 localStorage 键；`null` 不记 |

**颜色**：墨色取画布的 `color`，可用 CSS 变量 `--inkpond-ink` 设置，`--inkpond-alpha` 是最深处的不透明度。淡彩来自 `--inkpond-zhu`（朱）、`--inkpond-yanzhi`（胭脂）、`--inkpond-zhe`（赭石）、`--inkpond-huaqing`（花青）。`inkpond.css` 已处理 `prefers-color-scheme` 以及 `<html>` 上的 `.dark` / `data-theme="dark"`，主题切换后颜色自动更新。

## 性能

每个字只栅格化一次存进图集，之后每帧只贴图；静止的画面按窗口尺寸预先算好，云雾等慢变层每 4 帧重算一次。

- **按需降帧**：水在动时按档位帧率；只有鱼、船、长卷在动时约 20–24 fps；只有云雾时 10 fps；30 秒无操作停帧，鼠标一动就恢复。
- **三个档位**：标准（60 fps，字格 16px）、轻量（30 fps，字格 22px）、静帧。`cellSize` 可以改字格：调大更省，调小时贴图数按面积增长（12px 约为 16px 的 1.8 倍），降档后仍按该档的字格兜底。检测到软件渲染从静帧开始，弱设备从轻量开始；运行中卡顿会自动降档，结果记 30 天。
- **无障碍**：标签页隐藏即暂停；减少动画模式只画静止画面；高对比度模式下隐藏画布。

<details>
<summary>实测数据</summary>

无头 Chrome，1920×1080，DPR 1.5，每帧脚本耗时中位数 / p95，预算 8 ms：

| 场景 | 静水 | 鼠标持续搅动全屏 | 慢变层重算（每 4 帧） |
| --- | --- | --- | --- |
| 山水 | 0.2 / 0.3 ms | 0.9 / 1.8 ms | 0.1 ms |
| 荷塘 | 0.2 / 0.3 ms | 1.1 / 1.9 ms | < 0.1 ms |
| 清明上河 | 0.7 / 0.9 ms | 1.3 / 1.7 ms | 0.2 ms |
| 北冥 | 0.4 / 0.8 ms | 与荷塘相当，p95 约高 0.4 ms | 0.4 ms |

开销几乎全在贴图调用。节气的 24 幅画面都按这个预算画：同样尺寸下静水时每帧最多约 2,600 个字，和清明上河相当。关掉 GPU 用 CPU 光栅化时满屏搅动约 9 ms，这正是起始档位和自动降级要处理的情况。降级规则：最近 10 帧中位数超过 16 ms 或帧间隔超过 60 ms 直接切静帧；每 60 帧统计一次，p95 超过 8 ms 或帧间隔超过 40 ms 降一档。图集按 16 列排成网格（清明在 DPR 2 下 640×1400px），不会超出移动 GPU 的 4096px 纹理上限。

</details>

## 字体

每个场景带一个思源宋体 SC Medium（SIL OFL 1.1）的子集，只含这个场景用到的字，用到才加载：

| 文件 | 字数 | 大小 |
| --- | --- | --- |
| `inkpond-shanshui.woff2` | 39 | 约 10 KiB |
| `inkpond-lotus.woff2` | 66 | 约 16 KiB |
| `inkpond-qingming.woff2` | 101 | 约 21 KiB |
| `inkpond-jieqi.woff2` | 129 | 约 29 KiB（24 个节气共用一个） |
| `inkpond-beiming.woff2` | 21 | 约 6 KiB |

按 OFL 规定，修改版不能沿用保留名「Source」，这些子集都改名为 **Inkpond Glyphs**，许可全文和修改说明见 `src/assets/OFL.txt`。

<details>
<summary>山水字表</summary>

| 档位 | 字 |
| --- | --- |
| 1（最淡） | 一 |
| 2 | 二 人 八 乙 |
| 3 | 川 山 夕 么 |
| 4 | 水 云 风 月 石 木 |
| 5 | 雨 泉 波 松 苔 星 |
| 6 | 流 浪 深 涧 峰 |
| 7 | 渊 潮 雾 澜 溪 森 晶 |
| 8（最浓） | 墨 瀚 灏 澹 濛 麒 |

</details>

## 开发

```bash
bun install
bun run dev          # 项目主页 http://localhost:5173/ ，发起会话 /session/
bun run test         # 单元测试
bun run smoke:pack   # 打包冒烟测试：从打包产物和 git 两种方式安装到新项目，再导入、类型检查、打包
bun run build        # 输出库到 dist/
bun run build:demo   # 输出演示页到 dist-demo/
```

改了任何场景用到的字之后，用原版 OTF 重新生成全部子集（需要 `bun` 和 `uv`；原版字体在 Adobe 的 `adobe-fonts/source-han-serif` 仓库）：

```bash
scripts/build-font.sh path/to/SourceHanSerifSC-Medium.otf
```

<details>
<summary>目录</summary>

```
src/
  engine.ts      各场景共用的模拟与绘制：水波、落墨、留白、图集、平移
  scene.ts       场景契约、淡彩颜料、字表工具
  scenes/        山水、荷塘、清明上河、北冥；jieqi/ 是二十四节气和节气日期计算
  noise.ts       噪声与随机数
  controller.ts  帧循环、鼠标输入、留白区、字体、主题、性能档位
  tiers.ts       档位与降级判定
  glyphs.ts      山水字表与字体常量
  react.tsx      React 组件
  inkpond.css    画布定位、暗色和高对比度处理
demo/            项目主页与发起会话演示（session/）
tests/           Vitest 测试
scripts/         构建、打包冒烟测试、字体子集生成
```

</details>

项目主页源码在 `demo/index.html`，常见问题在 `demo/faq/`，英文版在 `demo/en/`；构建时会预渲染成静态 HTML 并附带结构化数据，另有给 AI 读的 [llms.txt](https://shin4.github.io/inkpond/llms.txt) 和完整版 [llms-full.txt](https://shin4.github.io/inkpond/llms-full.txt)。每次推送到 `main` 由 `.github/workflows/pages.yml` 重新部署。

## 致谢

墨池的想法来自 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)：用字符在页面背后养一片会游动、会躲开内容、会回应鼠标的海。墨池把它换成了水墨和汉字，代码从头写起，没有使用原仓库的代码。感谢原作者 [@stackedlol](https://github.com/stackedlol) 的创意。

## 许可

代码以 [MIT](LICENSE) 许可发布；字体子集按 SIL OFL 1.1 授权，两者分开适用。
