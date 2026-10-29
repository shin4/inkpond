# inkpond — Agent Guide

墨池：一个 Canvas 2D 的水墨汉字背景库，外加一个演示用的「发起会话」页面。用法和选项写在 [README.md](README.md)（中文，主入口）和 [README.en.md](README.en.md)（英文），两份内容要保持一致，改一份就同步另一份；这里只记录改代码时必须守住的规则。

## 范围

- 这是一个独立项目，不引入任何其他产品的代码、命名、样式或接口约定。
- 库本身没有运行时依赖。React 是可选的 peer 依赖，只有 `src/react.tsx` 用到它。不要为了库功能新增依赖。
- 发布的包只包含 `dist/`。`demo/` 只是演示，库代码不能依赖它。
- 包发布在 npm（`npm i inkpond`），`prepublishOnly` 会先跑检查和打包冒烟测试；也可以从 GitHub 安装（`npm i github:shin4/inkpond`），这时由 `prepare` 运行 `scripts/build.mjs` 生成 `dist/`。这个脚本只能用 Node 自带模块，不能调用 shell 命令（`rm`、`cp`），否则在 Windows 上装不上。
- 项目代码使用 MIT 许可（`LICENSE`），字体单独按 OFL 授权。仓库是公开的 GitHub 仓库 `shin4/inkpond`（CI 见 `.github/workflows/ci.yml`，项目主页随 `pages.yml` 部署到 https://shin4.github.io/inkpond/）；没有用户明确要求，不要推送、改仓库可见性或发布到 npm；发布新版本时先改 `package.json` 的版本号，发布后打 `v<版本>` 标签。

## 分层

| 文件 | 职责 | 不能做的事 |
| --- | --- | --- |
| `src/engine.ts` | 所有场景共用的部分：水波、落墨、留白、字形图集、平移；没有 canvas 时也能运行 | 绑定 DOM 事件、调用定时器或 `requestAnimationFrame`、读写存储 |
| `src/scene.ts`、`src/scenes/` | 场景契约和各场景（山水、荷塘、清明上河、二十四节气、北冥、大肥鲸）：画面布局、慢变层、鱼船行人鲸 | 同 engine；也不能碰 canvas，只通过 `emit` 交出要画的字 |
| `src/scenes/jieqi/` | 二十四节气：`calendar.ts` 按太阳黄经算节气，`term.ts` 是单个节气的契约，四季各一个文件，`index.ts` 把 24 个节气装成一个场景（共用字表、预热、跨节气墨晕过渡） | 同上；节气的 `cell()` 每次合成都会被逐格调用，快的东西放进 `stamps()` |
| `src/controller.ts` | 帧循环、鼠标输入、留白区、字体加载、主题、可见性、性能档位 | 写死页面结构 |
| `src/tiers.ts` | 档位和降级判断，纯函数 | 访问 DOM |
| `src/react.tsx` | 薄封装，只负责挂载和传入 `active`；文件开头的 `"use client"` 不能删，Next.js 等服务端组件框架靠它识别 | 实现任何逻辑 |

新功能先放进 engine 或 controller，并通过选项暴露出来，不用 React 也必须能用。

## 性能约束

这些是设计前提，不能退化：

- 每帧只从字形图集贴图，绝不在每帧里调用 `fillText`。图集按 16 列排成网格向下增长（`ATLAS_COLUMNS`），不能排成一长行：字多的场景在 DPR 2 下排成一行很容易超过不少移动 GPU 的 4096px 纹理上限。
- 每帧的开销几乎全在贴图调用（约 1.5µs 一次），模拟本身可以忽略；要省就少画，不要在模拟上抠。移动场景的每帧回调不分配新对象（`envDrops` 复用），清明的固定字按 x 排序后二分取可见窗口。
- 场景的静止部分（远山、荷叶、房屋）和留白遮罩按尺寸预先算好；慢变层（云雾、水光、烟霭）用粗网格插值，每 4 帧重算一次；落墨只计算它包围盒内的格子；游动的东西（鲤鱼、船、行人）只是几十次贴图。
- 水在动时按档位帧率画；只有场景自己在动（鱼、船、长卷平移）时约 20–24 fps（`MOVING_INTERVAL_MS`）；只有云雾在飘时降到 10 fps（`CALM_INTERVAL_MS`）；30 秒没有输入就停帧（`SLEEP_AFTER_MS`），鱼和船停在原处，下一次输入再唤醒。
- 场景自己的移动不进入波动能量，也不参与降级判断：鱼尾的水纹是字，不是波纹模拟。节气里的雨点涟漪、蛙鸣声波、冲击波同样是字。
- 节气的每一幅画面都要守住清明上河的贴图量：1920×1080 下静水时每帧不超过约 2,600 个字。`index.ts` 的 `PAPER` 把淡于它的格子留白，画面整片铺满时要自己留出空白（用噪声分块），不要靠调低 `PAPER`。节气的粒子用 `term.ts` 的 `pool()` 预先分配，`step()` 里不分配新对象。
- 标签页隐藏时暂停；减少动画模式和静帧档只画一张静止画面，不响应鼠标；高对比度模式下 `inkpond.css` 隐藏画布。
- 降级判断（`createTierJudge`）：最近 10 帧的中位数超过 2 倍预算或帧间隔超过 60 ms，直接切到静帧；每 60 帧统计一次，p95 超标就降一档；**帧间隔超过 200 ms 视为被浏览器节流，不计入判断**。窗口被遮挡时 `document.hidden` 仍是 false，删掉这条会把快机器误降成静帧。
- 检测到软件渲染时从静帧开始；CPU 或内存偏弱的设备从轻量档开始。
- `cellSize` 由 `tiers.ts` 的 `cellFor` 换算：限制在 12–48，降档后不小于该档字格。不要让用户的字号绕过降档，否则慢设备降了档却省不下贴图。
- 降级结果会记住 30 天。修改判断规则时，要同时把 `DEFAULT_TIER_KEY` 换成新版本号，避免旧规则下记错的档位继续生效。

## 留白与交互

- 鲤鱼、船、行人等游动的字同样避开留白：在留白区里变淡，鲤鱼还会主动绕开。
- 宿主元素（画布的父元素）里带 `avoidAttribute`（默认 `data-inkpond-avoid`）的元素会留白。晚出现的元素靠 MutationObserver 发现；只有位置变化时才重算遮罩。
- 点击可交互元素或留白元素时绝不落墨；程序调用的 `drop()` 同样不能落在留白元素上。
- `ripple()` / `drop()` 在暂停、减少动画和静帧档下不生效，生效时要唤醒休眠的帧循环。
- 演示里的消息只在用户点击发送或按 Enter 时发出。
- `demo/index.html` 是项目主页，`demo/session/` 是发起会话演示；主页上的每个画布只在进入视口时 `active`，离开就暂停。
- 项目主页和 FAQ 各有中文（根路径）和英文（`demo/en/`）两版，文案在 `demo/copy.ts` 和 `demo/Faq.tsx` 里按语言并列，改一种语言就同步另一种；页面互相用 `hreflang` 标注。
- 项目主页和 `demo/faq/` 在构建时预渲染（`scripts/prerender.mjs` 加载 `demo/prerender.tsx`），让不执行 JavaScript 的爬虫和 AI 也能读到正文；浏览器端用 `hydrateRoot` 接管，所以首屏渲染不能读 `localStorage`、`window` 等只在浏览器里才有的东西，要放进 effect。
- 首页第一句、安装命令和网址集中在 `demo/site-meta.ts`；FAQ 问答在 `demo/Faq.tsx`，页面和 FAQPage 结构化数据都由它生成。`demo/public/llms.txt` 是给 AI 的简明说明，是手写的；`llms-full.txt` 由构建从英文 README 和两种语言的 FAQ 生成：改了场景、安装方式、许可或性能数字时同步更新它和 FAQ。
- macOS 文件系统不区分大小写：不要在同一目录里放只差大小写的文件名（例如 `landing.tsx` 和 `Landing.tsx`），会互相覆盖。

## 字表与字体

- 默认字表是 `src/glyphs.ts` 的 `DEFAULT_LEVELS`（山水场景的地面），按笔画从少到多分档。每个场景有自己的字表和字体子集 `src/assets/inkpond-<场景>.woff2`，按需加载；24 个节气共用一个 `inkpond-jieqi.woff2`，切换节气不重建图集也不等字体。
- 改了任何场景用到的字之后，要用原版 OTF（思源宋体 SC Medium 2.003）运行 `scripts/build-font.sh` 重新生成全部子集，脚本直接从各场景读字。
- 字体是思源宋体（SIL OFL 1.1）的改版：
  - 每个子集的字体内部名称都必须是 **Inkpond Glyphs**，不能出现保留名「Source」；
  - `src/assets/OFL.txt` 和其中的修改说明必须随字体一起保留；
  - `tests/glyphs.test.ts` 检查这两点。

## 验证

```bash
bun run lint && bun run typecheck && bun run test && bun run build && bun run build:demo
```

- 改了 `package.json` 的导出、`files`、构建脚本或依赖时，再跑一次 `bun run smoke:pack`（CI 的 `package` 任务也会跑）。

- 改了绘制或交互，要在浏览器里分别看亮色和暗色，每个场景都要看；改了节气的公共部分（`index.ts`、`term.ts`）要把 24 个节气都过一遍。
- 淡彩只用 `scene.ts` 的四种颜料（朱、胭脂、赭石、花青），颜色来自 `inkpond.css` 的 CSS 变量，暗色下有单独的取值。
- 后台的浏览器窗格会节流 `requestAnimationFrame`，动画和降级的检查要放在前台页面或无头 Chrome 里做，否则看到的不动或被降级都可能是假象。
- 修改降级规则时，在 `tests/engine.test.ts` 里补上对应的判断用例。
