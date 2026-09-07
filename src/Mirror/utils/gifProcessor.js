/* global ImageData */
import { parseGIF, decompressFrames } from 'gifuct-js'
import GIF from 'gif.js'
import { mirrorFrame } from './mirror'
import workerUrl from './gif.worker.js?url'

/** 透明键兜底色（品红，仅当图像恰好包含该色时可能误判，见 pickTransparentKey） */
const FALLBACK_KEY = { r: 255, g: 0, b: 255, num: 0xff00ff }

/** 让出主线程，使 UI 能绘制进度、保持响应 */
function yieldToUI () {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
/** 检查是否已取消；已取消时抛 AbortError，使处理链快速退出 */
function throwIfAborted (signal) {
  if (signal && signal.aborted) {
    const err = new Error('处理已取消')
    err.name = 'AbortError'
    throw err
  }
}

export function isGifBuffer (buffer) {
  const bytes = new Uint8Array(buffer)
  return bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
}

/**
 * 把 gifuct 解析出的局部帧按 GIF 渲染规则合成到全画幅。
 * gifuct-js 2.x 不会自动合成，部分帧（只存储变化区域）会丢失 top/left 与 disposal，
 * 因此必须在镜像前手动合成，否则动画会错位。
 */
function composeFrames (gif, frames) {
  const canvasW = gif.lsd.width
  const canvasH = gif.lsd.height
  const composed = []
  let buffer = new ImageData(canvasW, canvasH) // 初始全透明
  let prevRect = null
  let prevDisposal = 0
  let snapshotBeforePrev = null

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    // 先应用上一帧的 disposal
    if (i > 0) {
      if (prevDisposal === 2 && prevRect) {
        clearRect(buffer, prevRect)
      } else if (prevDisposal === 3 && snapshotBeforePrev) {
        buffer = new ImageData(new Uint8ClampedArray(snapshotBeforePrev.data), canvasW, canvasH)
      }
    }
    // 快照：当前帧 disposal=3（恢复至上一状态）时才需要
    let snapshotBeforeCurrent = null
    if (f.disposalType === 3) {
      snapshotBeforeCurrent = new ImageData(new Uint8ClampedArray(buffer.data), canvasW, canvasH)
    }
    // 绘制当前帧（跳过透明像素）
    if (f.patch) {
      drawPatch(buffer, f)
    }
    // 输出当前帧（拷贝，避免后续被修改）
    composed.push(new ImageData(new Uint8ClampedArray(buffer.data), canvasW, canvasH))
    prevRect = { left: f.dims.left, top: f.dims.top, width: f.dims.width, height: f.dims.height }
    prevDisposal = f.disposalType || 0
    snapshotBeforePrev = snapshotBeforeCurrent
  }
  return composed
}

/** 以 Uint32 视角读写 ImageData，单次读写整个像素（RGBA），比逐字节快数倍 */
function bufferView32 (buffer) {
  return new Uint32Array(buffer.data.buffer, buffer.data.byteOffset, buffer.data.length / 4)
}
function clearRect (buffer, rect) {
  const { left, top, width, height } = rect
  const buf32 = bufferView32(buffer)
  const canvasW = buffer.width
  for (let y = 0; y < height; y++) {
    const base = (top + y) * canvasW + left
    buf32.fill(0, base, base + width)
  }
}

function drawPatch (buffer, frame) {
  const { left, top, width, height } = frame.dims
  const patch = frame.patch
  const buf32 = bufferView32(buffer)
  const canvasW = buffer.width
  for (let y = 0; y < height; y++) {
    const patchRow = y * width
    const base = (top + y) * canvasW + left
    for (let x = 0; x < width; x++) {
      const pi = (patchRow + x) * 4
      if (patch[pi + 3] === 0) continue // 透明像素跳过
      // 小端打包：alpha<<24 | b<<16 | g<<8 | r（alpha 固定 255，同原逻辑）
      buf32[base + x] = (0xff000000) | (patch[pi + 2] << 16) | (patch[pi + 1] << 8) | patch[pi]
    }
  }
}

function imageDataToCanvas (imageData) {
  const c = document.createElement('canvas')
  c.width = imageData.width
  c.height = imageData.height
  c.getContext('2d').putImageData(imageData, 0, 0)
  return c
}

/**
 * 扫描所有帧的有效像素颜色。
 * 返回 { map: Map<num,[r,g,b]>, overflow }，颜色数超过 limit 时标记 overflow（用于决定是否用全局调色板）。
 */
function scanColors (canvases, limit) {
  const map = new Map()
  for (const { canvas } of canvases) {
    const ctx = canvas.getContext('2d')
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const num = (r << 16) | (g << 8) | b
      if (!map.has(num)) {
        if (map.size >= limit) return { map, overflow: true }
        map.set(num, [r, g, b])
      }
    }
  }
  return { map, overflow: false }
}

/** 从常用候选色中选一个未出现在图像里的颜色作为透明键，避免把图像真实颜色误判为透明 */
function pickTransparentKey (colorMap) {
  const candidates = [
    [255, 0, 255], [0, 255, 255], [255, 255, 0],
    [255, 0, 0], [0, 0, 255], [0, 255, 0],
    [0, 0, 0], [255, 255, 255], [128, 0, 128]
  ]
  for (const [r, g, b] of candidates) {
    const num = (r << 16) | (g << 8) | b
    if (!colorMap.has(num)) return { r, g, b, num }
  }
  return FALLBACK_KEY
}

/** 把画布中的透明像素替换为透明键色，供 gif.js 编码时映射为透明索引 */
function replaceTransparent (canvas, key) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  let changed = false
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = key.r
      data[i + 1] = key.g
      data[i + 2] = key.b
      data[i + 3] = 255
      changed = true
    }
  }
  if (changed) ctx.putImageData(imageData, 0, 0)
}

/** 把画布中的透明像素填充为背景色（"背景色"选项：输出不透明） */
function fillTransparentWithColor (canvas, color) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  let changed = false
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
      changed = true
    }
  }
  if (changed) ctx.putImageData(imageData, 0, 0)
}

/** 工作线程数：不超过 CPU 核数，最多 4（gif.js 按帧分片，多 worker 提速明显） */
function pickWorkerCount () {
  const hw = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  return Math.max(1, Math.min(4, hw))
}

/**
 * GIF 镜像处理：
 * 解码 → 全画幅合成 → 逐帧镜像 → 透明/背景处理 → gif.js 编码
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} direction left|right|top|bottom|tl|br
 * @param {number} ratio 镜像比例 1-100
 * @param {boolean} keepOriginalSize
 * @param {(p:number)=>void} onProgress 0-100
 * @param {{workerScript?:string, workers?:number, signal?:AbortSignal, quality?:number, colors?:number, maxEdge?:number, backgroundColor?:string, speed?:number, repeat?:number}} [options]
 *   quality: gif.js 采样质量 1-30（越小越精细），默认 10
 *   colors: 全局调色板颜色上限，默认 256
 *   maxEdge: 导出长边上限（像素），超出时等比缩小，默认不限
 *   backgroundColor: #rrggbb，非空时透明像素填充该色（输出不透明），默认 null=保留透明
 *   speed: 帧速率倍速（0.5=变慢一倍 / 1=原速 / 2=快一倍），默认 1
 *   repeat: 循环次数（0=无限 / N=循环 N 次），默认 0
 */
export async function processGif (arrayBuffer, direction, ratio, keepOriginalSize, onProgress, options = {}) {
  const signal = options.signal
  const quality = Math.min(30, Math.max(1, options.quality ?? 10))
  const colorLimit = Math.min(256, Math.max(16, options.colors ?? 256))
  const backgroundColor = options.backgroundColor || null
  const speed = Math.max(0.25, Math.min(4, Number(options.speed) || 1))
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)
  const total = frames.length
  if (total === 0) {
    throw new Error('GIF 不包含有效帧')
  }
  // 大图保护：防止超大 GIF（画布大 × 帧多）导致浏览器卡死
  const canvasPixels = gif.lsd.width * gif.lsd.height
  if (canvasPixels > 25_000_000 || canvasPixels * total > 200_000_000) {
    throw new Error(`GIF 尺寸过大（画布 ${gif.lsd.width}×${gif.lsd.height} × ${total} 帧），可能导致卡顿，请先压缩图片`)
  }
  throwIfAborted(signal)

  // 1. 全画幅合成（处理局部帧与 disposal）
  const composed = composeFrames(gif, frames)
  if (onProgress) onProgress(10)

  // 2. 逐帧镜像（背景色时由镜像层铺底 + 帧内透明像素填充）
  const canvases = []
  for (let i = 0; i < total; i++) {
    throwIfAborted(signal)
    const fullCanvas = imageDataToCanvas(composed[i])
    const mirrored = mirrorFrame(fullCanvas, direction, ratio, keepOriginalSize, options.maxEdge, backgroundColor)
    // gifuct 已将 gce.delay(厘秒) 转为毫秒；speed 为播放倍速（2x 更快 → 延迟减半），clamp ≥10ms
    const delay = Math.max(10, Math.round((frames[i].delay || 100) / speed))
    canvases.push({ canvas: mirrored, delay })
    if (onProgress) onProgress(10 + Math.round(((i + 1) / total) * 45))
    if (i % 3 === 2) await yieldToUI()
  }

  // 3. 颜色扫描 + 透明处理（背景色时先填充再扫描，无透明像素则不需要透明键）
  const useBackground = !!backgroundColor
  if (useBackground) {
    for (let i = 0; i < canvases.length; i++) {
      throwIfAborted(signal)
      fillTransparentWithColor(canvases[i].canvas, backgroundColor)
      if (i % 3 === 2) await yieldToUI()
    }
  }
  const { map: colorMap, overflow } = scanColors(canvases, colorLimit)
  const useGlobalPalette = !overflow
  let key = null
  if (!useBackground) {
    key = pickTransparentKey(colorMap)
    // 4. 透明像素替换为透明键色
    for (let i = 0; i < canvases.length; i++) {
      throwIfAborted(signal)
      replaceTransparent(canvases[i].canvas, key)
      if (i % 3 === 2) await yieldToUI()
    }
  }

  // 5. 编码
  throwIfAborted(signal)
  const first = canvases[0].canvas
  const encoderOptions = {
    workers: options.workers ?? pickWorkerCount(),
    quality,
    width: first.width,
    height: first.height,
    workerScript: options.workerScript ?? workerUrl,
    repeat: options.repeat === undefined ? 0 : Math.max(0, Math.floor(options.repeat))
  }
  if (!useBackground) {
    encoderOptions.transparent = key.num
  }
  if (useGlobalPalette) {
    // 全局调色板：实际颜色 + 透明键（透明背景时），按 colorLimit 截断后补齐到 256（LSD 固定 8 位表）
    const palette = []
    let count = 0
    for (const rgb of colorMap.values()) {
      if (count >= colorLimit) break
      palette.push(rgb[0], rgb[1], rgb[2])
      count++
    }
    if (key) palette.push(key.r, key.g, key.b)
    while (palette.length < 256 * 3) palette.push(0)
    encoderOptions.globalPalette = palette.slice(0, 256 * 3)
  }
  const encoder = new GIF(encoderOptions)
  if (signal) {
    signal.addEventListener('abort', () => encoder.abort(), { once: true })
  }

  return new Promise((resolve, reject) => {
    encoder.on('finished', (blob) => {
      if (onProgress) onProgress(100)
      resolve(blob)
    })
    encoder.on('abort', () => {
      reject(new Error('GIF 编码被中断'))
    })
    for (const c of canvases) {
      encoder.addFrame(c.canvas, { delay: c.delay, copy: true })
    }
    encoder.render()
  })
}

export function getGifMetadata (arrayBuffer) {
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)
  let totalDelay = 0
  for (const frame of frames) {
    totalDelay += frame.delay || 100
  }
  const firstFrame = frames[0]
  return {
    frameCount: frames.length,
    totalDelay,
    firstFrame: {
      width: firstFrame?.dims?.width || 0,
      height: firstFrame?.dims?.height || 0
    }
  }
}
