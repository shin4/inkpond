<div align="center">

# 墨池 Inkpond

**简体中文** · [English](README.en.md)

以字为墨，以页为池：一层铺在网页背后的水墨汉字底。

[![CI](https://github.com/shin4/inkpond/actions/workflows/ci.yml/badge.svg)](https://github.com/shin4/inkpond/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-b4372b.svg)](LICENSE)

[**在线演示**](https://shin4.github.io/inkpond/) · [发起会话 Demo](https://shin4.github.io/inkpond/session/)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/qingming-dark.webp" />
  <img alt="清明上河长卷缓缓向左展开：木拱虹桥从近岸拱起越过河面，船只往来，鼠标划过河面泛起水波，点击处墨迹晕开" src="docs/images/qingming-light.webp" />
</picture>

汉字按笔画疏密排成画面：远山云雾、鲤鱼游动的荷塘，或缓缓展开的清明上河长卷。鼠标划过泛起水波，点击空白处落墨，墨迹晕开后慢慢淡去；页面上的内容周围自动留白。

- **三个场景**：山水、荷塘、清明上河，可选淡彩
- **会回应**：鼠标起波、点击落墨，鲤鱼躲人、抢食，行人被墨惊散
- **不碍事**：内容周围自动留白，鱼、船、行人也会绕开
- **够轻**：Canvas 2D，零运行时依赖，每帧脚本开销不到 2 ms，弱设备自动降级
- **React 可选**：提供 `<InkPond />` 组件，不用 React 也能直接用

## 场景

| `scene` | 画面 | 会动的东西 |
| --- | --- | --- |
| `shanshui`（默认） | 两重远山，云雾飘过 | 云雾 |
| `lotus` | 俯看荷塘：荷叶、荷花、浮萍 | 鲤鱼绕开内容游动，鼠标靠近会散开，落墨处会游过来 |
| `qingming` | 清明上河长卷：群山城郭、宝塔城楼、两岸酒旗飞檐、横跨两岸的木拱虹桥 | 长卷向左展开，船夫撑船，行人过桥，落墨惊散行人 |

荷塘和清明上河带一点淡彩（朱、胭脂、赭石、花青），设 `tint={false}` 只用墨色。

| 荷塘 | 山水 |
| --- | --- |
| <img alt="荷塘：落墨后鲤鱼游过来，鼠标划过时散开" src="docs/images/lotus.webp" /> | <img alt="山水：两重远山与云雾，鼠标划过起波，点击落墨" src="docs/images/shanshui.webp" /> |

## 安装

还没有发布到 npm，目前从 GitHub 安装，安装时自动构建：

```bash
npm i github:shin4/inkpond
```

<details>
<summary>用 bun、或 npm 提示 allow-scripts 时</summary>

- npm 11 会对带构建脚本的依赖给出 `allow-scripts` 提示，安装照常完成；如果你的配置禁止依赖运行脚本，执行 `npm approve-scripts inkpond`。
- bun 默认不运行依赖的脚本，也不安装依赖的开发依赖。需要项目里有 TypeScript，并信任 inkpond：

  ```bash
  bun add -d typescript
  bun add github:shin4/inkpond
  bun pm trust inkpond
  ```
- 固定版本：在地址后加提交或标签，例如 `github:shin4/inkpond#<commit>`。

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
| `scene` | `"shanshui"` | `shanshui` / `lotus` / `qingming` |
| `tint` | `true` | 是否画淡彩；`false` 只用墨色 |
| `active` | `true` | 是否在屏幕上；后台标签页总会暂停 |
| `strength` | `0.45` | 场景画面的墨色浓淡，不影响水波和墨迹 |
| `waveSpeed` | `1` | 水波速度倍数 |
| `levels` | 场景自带 | 替换主地面（山水的山、荷塘和清明的水面）的字表，从淡到浓；换字需要自备字体 |
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
- **三个档位**：标准（60 fps，字格 16px）、轻量（30 fps，字格 22px）、静帧。检测到软件渲染从静帧开始，弱设备从轻量开始；运行中卡顿会自动降档，结果记 30 天。
- **无障碍**：标签页隐藏即暂停；减少动画模式只画静止画面；高对比度模式下隐藏画布。

<details>
<summary>实测数据</summary>

无头 Chrome，1920×1080，DPR 1.5，每帧脚本耗时中位数 / p95，预算 8 ms：

| 场景 | 静水 | 鼠标持续搅动全屏 | 慢变层重算（每 4 帧） |
| --- | --- | --- | --- |
| 山水 | 0.2 / 0.3 ms | 0.9 / 1.8 ms | 0.1 ms |
| 荷塘 | 0.2 / 0.3 ms | 1.1 / 1.9 ms | < 0.1 ms |
| 清明上河 | 0.7 / 0.9 ms | 1.3 / 1.7 ms | 0.2 ms |

开销几乎全在贴图调用。关掉 GPU 用 CPU 光栅化时满屏搅动约 9 ms，这正是起始档位和自动降级要处理的情况。降级规则：最近 10 帧中位数超过 16 ms 或帧间隔超过 60 ms 直接切静帧；每 60 帧统计一次，p95 超过 8 ms 或帧间隔超过 40 ms 降一档。图集按 16 列排成网格（清明在 DPR 2 下 640×1400px），不会超出移动 GPU 的 4096px 纹理上限。

</details>

## 字体

每个场景带一个思源宋体 SC Medium（SIL OFL 1.1）的子集，只含这个场景用到的字，用到才加载：

| 文件 | 字数 | 大小 |
| --- | --- | --- |
| `inkpond-shanshui.woff2` | 39 | 约 10 KiB |
| `inkpond-lotus.woff2` | 66 | 约 16 KiB |
| `inkpond-qingming.woff2` | 101 | 约 21 KiB |

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
  scenes/        山水、荷塘、清明上河
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

项目主页源码在 `demo/index.html`，常见问题在 `demo/faq/`；构建时会预渲染成静态 HTML 并附带结构化数据，另有给 AI 读的 [llms.txt](https://shin4.github.io/inkpond/llms.txt)。每次推送到 `main` 由 `.github/workflows/pages.yml` 重新部署。

## 致谢

墨池的想法来自 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)：用字符在页面背后养一片会游动、会躲开内容、会回应鼠标的海。墨池把它换成了水墨和汉字，代码从头写起，没有使用原仓库的代码。感谢原作者 [@stackedlol](https://github.com/stackedlol) 的创意。

## 许可

代码以 [MIT](LICENSE) 许可发布；字体子集按 SIL OFL 1.1 授权，两者分开适用。
