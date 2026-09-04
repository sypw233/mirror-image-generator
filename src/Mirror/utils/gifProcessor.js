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
function clearRect (buffer, rect) {
  const { left, top, width, height } = rect
  for (let y = 0; y < height; y++) {
    const row = (top + y) * buffer.width
    for (let x = 0; x < width; x++) {
      buffer.data[((row + left + x) * 4) + 3] = 0
    }
  }
}
function drawPatch (buffer, frame) {
  const { left, top, width, height } = frame.dims
  const patch = frame.patch
  for (let y = 0; y < height; y++) {
    const patchRow = y * width
    const bufRow = (top + y) * buffer.width + left
    for (let x = 0; x < width; x++) {
      const pi = (patchRow + x) * 4
      if (patch[pi + 3] === 0) continue // 透明像素跳过
      const di = (bufRow + x) * 4
      buffer.data[di] = patch[pi]
      buffer.data[di + 1] = patch[pi + 1]
      buffer.data[di + 2] = patch[pi + 2]
      buffer.data[di + 3] = 255
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
/**
 * GIF 镜像处理：
 * 解码 → 全画幅合成 → 逐帧镜像 → 透明处理 → gif.js 编码
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} direction left|right|top|bottom
 * @param {number} ratio 镜像比例 1-100
 * @param {boolean} keepOriginalSize
 * @param {(p:number)=>void} onProgress 0-100
 * @param {{workerScript?:string, workers?:number}} [options]
 */
export async function processGif (arrayBuffer, direction, ratio, keepOriginalSize, onProgress, options = {}) {
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)
  const total = frames.length
  if (total === 0) {
    throw new Error('GIF 不包含有效帧')
  }
  // 1. 全画幅合成（处理局部帧与 disposal）
  const composed = composeFrames(gif, frames)
  if (onProgress) onProgress(10)
  // 2. 逐帧镜像
  const canvases = []
  for (let i = 0; i < total; i++) {
    const fullCanvas = imageDataToCanvas(composed[i])
    const mirrored = mirrorFrame(fullCanvas, direction, ratio, keepOriginalSize)
    // gifuct 已将 gce.delay(厘秒) 转为毫秒，最小 100ms
    const delay = Math.max(10, frames[i].delay || 100)
    canvases.push({ canvas: mirrored, delay })
    if (onProgress) onProgress(10 + Math.round(((i + 1) / total) * 45))
    if (i % 3 === 2) await yieldToUI()
  }
  // 3. 颜色扫描 + 透明键
  const { map: colorMap, overflow } = scanColors(canvases, 255)
  const key = pickTransparentKey(colorMap)
  const useGlobalPalette = !overflow
  // 4. 透明像素替换为透明键色
  for (let i = 0; i < canvases.length; i++) {
    replaceTransparent(canvases[i].canvas, key)
    if (i % 3 === 2) await yieldToUI()
  }
  // 5. 编码
  const first = canvases[0].canvas
  const encoderOptions = {
    workers: options.workers ?? 4,
    quality: 10,
    width: first.width,
    height: first.height,
    workerScript: options.workerScript ?? workerUrl,
    transparent: key.num
  }
  if (useGlobalPalette) {
    // 全局调色板：实际颜色 + 透明键，补齐到 256
    const palette = []
    for (const rgb of colorMap.values()) palette.push(rgb[0], rgb[1], rgb[2])
    palette.push(key.r, key.g, key.b)
    while (palette.length < 256 * 3) palette.push(0)
    encoderOptions.globalPalette = palette.slice(0, 256 * 3)
  }
  const encoder = new GIF(encoderOptions)
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
