# Mirror Image Generator（uTools 图片镜像插件）

一个基于 [uTools](https://www.uTools.cn/) 的图片镜像处理插件。上传或拖入一张图片（PNG / GIF），即可生成四种方向的镜像（左 / 右 / 上 / 下对称），并支持自定义镜像比例、保持原图尺寸导出。

## 功能特性

- **PNG / GIF 双格式支持**：静态图与动图（含局部帧、透明背景、自定义帧延迟）均可处理
- **四种镜像方向**：左对称、右对称、上对称、下对称
- **镜像比例可调**：滑块拖拽 + 25% / 50% / 75% / 100% 预设
- **保持原图尺寸**：等比缩放居中（contain），内容不会被裁切
- **GIF 帧合成**：正确处理局部帧（left/top 偏移）与 disposal 1/2/3，逐帧保持延迟与透明度
- **结果导出**：下载图片 / 复制图片，GIF 同样支持
- **处理反馈**：处理中状态提示、进度更新、错误提示、结果信息（尺寸 · 大小 · 帧数 · 时长）

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 启动 vite 开发服务器（端口 5173）
npm run build      # 构建产物到 dist/
npm run lint       # 运行 JavaScript Standard Style 检查
```

## 测试

项目内置两套浏览器测试台（基于真实处理管线，需先启动 `npm run dev`）：

| 入口 | 说明 |
| --- | --- |
| `tests/browser-harness.html` | GIF 处理管线断言：帧数 / 画布尺寸 / 全画幅合成 / 帧延迟保持 / 镜像对称抽样 / 保持原尺寸等比缩放等 17 项 |
| `tests/mirror-harness.html` | 静态图镜像算法断言：四方向尺寸 / 水平垂直对称性 / 镜像块位置 / keepOriginalSize 等比缩放 / 方向区分等 25 项 |
| `tests/ui-test.html?type=png` | UI 集成测试（静态图场景，自动注入 base64 图片） |
| `tests/ui-test.html?type=gif` | UI 集成测试（GIF 场景，验证局部帧合成与透明背景） |

测试素材位于 `public/test/*.gif`（由 Python PIL 生成：全画幅、局部帧+透明、自定义延迟、局部帧等用例）。

辅助脚本：
- `.analysis/inspect_gif.mjs`：用 gifuct-js 检查 GIF 帧结构（需在项目目录内运行）

## 技术栈

- [uTools](https://www.uTools.cn/) 插件 API
- React 19 + Vite 6
- [gifuct-js](https://github.com/matt-way/gifuct-js)：GIF 解码
- [gif.js](https://github.com/jnordberg/gif.js)：GIF 编码（Worker 模式）
- JavaScript Standard Style

## 主要改动记录（GIF 修复）

- **局部帧合成**：gifuct-js `decompressFrames` 不做帧合成，旧代码把局部帧画到 (0,0) 导致动画错位；新增 `composeFrames()` 按 left/top 偏移 + disposal 逐帧合成全画幅
- **延迟保持**：`frame.delay` 单位已是毫秒，旧代码 `delay<10→10` 会把 100ms 钳成 10ms 导致加速；改为直接取 `frame.delay || 100` 并 clamp ≥10
- **透明保留**：旧代码硬编码品红作为透明键，会把真实品红像素误判为透明；新增 `pickTransparentKey()` 从候选色中选未出现在图像中的颜色作透明键
- **Worker 路径**：GIF 编码 Worker 从 `public/` 迁移为 `src/Mirror/utils/gif.worker.js` + `import ... ?url`，由 Vite 打包，避免子路径页面下解析到 SPA 兜底 HTML 导致进度卡死
- **保持原尺寸**：修复为等比缩放居中，比例 > 50% 时不再裁切
- **进度平滑**：处理进度从"卡 50% 后跳 100%"改为平滑 10% → 55% → 100%

## 主要改动记录（第二轮：性能与体验）
- **GIF 帧合成性能**：`clearRect` / `drawPatch` 从逐字节读写改为 Uint32 视角批量读写（`fill` 清零 + 单次打包写入像素），合成大图多帧时明显提速
- **静态图镜像测试台**：新增 `tests/mirror-harness.html`，直接对 `mirrorImage` 做 25 项断言（四方向尺寸 / 对称性 / 镜像块位置 / keepOriginalSize 等比缩放 / 方向区分）
- **设置持久化**：镜像方向 / 比例 / 保持原尺寸记忆到 localStorage，再次打开自动沿用上次设置
- **处理中拖入保护**：处理进行中拖入新图不再静默取消，改为明确提示"正在处理中，请稍候"
- **复制失败提示**：复制图片失败时显示错误提示，不再无反馈
- **处理耗时显示**：结果信息栏追加处理耗时（如 `耗时 412ms`）
- **lint 配置修正**：移除与代码风格冲突的 `jsx-quotes: prefer-double` 规则（standard 默认不启用该规则，且代码使用单引号）
