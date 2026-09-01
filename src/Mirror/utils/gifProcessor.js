import { parseGIF, decompressFrames } from 'gifuct-js'
import GIF from 'gif.js'
import { mirrorFrame } from './mirror'

const TRANSPARENT_RGB = [255, 0, 255]
const TRANSPARENT_NUM = (255 << 16) | (0 << 8) | 255

export function isGifBuffer (buffer) {
  const bytes = new Uint8Array(buffer)
  return bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
}

function buildGlobalPalette (frames) {
  const colorMap = new Map()

  for (const frame of frames) {
    const ct = frame.colorTable
    if (!ct) continue
    for (let i = 0; i < ct.length; i++) {
      const entry = ct[i]
      const r = entry[0], g = entry[1], b = entry[2]
      const key = (r << 16) | (g << 8) | b
      if (!colorMap.has(key)) {
        colorMap.set(key, [r, g, b])
      }
    }
  }

  const palette = []
  for (const rgb of colorMap.values()) {
    palette.push(rgb[0], rgb[1], rgb[2])
  }

  let hasTransparent = false
  for (let i = 0; i < palette.length; i += 3) {
    if (palette[i] === TRANSPARENT_RGB[0] &&
        palette[i + 1] === TRANSPARENT_RGB[1] &&
        palette[i + 2] === TRANSPARENT_RGB[2]) {
      hasTransparent = true
      break
    }
  }
  if (!hasTransparent) {
    palette.push(...TRANSPARENT_RGB)
  }

  while (palette.length < 256 * 3) {
    palette.push(0)
  }

  return palette.slice(0, 256 * 3)
}

function prepareFrameForGif (canvas) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = TRANSPARENT_RGB[0]
      data[i + 1] = TRANSPARENT_RGB[1]
      data[i + 2] = TRANSPARENT_RGB[2]
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export async function processGif (arrayBuffer, direction, ratio, keepOriginalSize, onProgress) {
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)

  const totalFrames = frames.length
  const canvases = []

  for (let i = 0; i < totalFrames; i++) {
    const frame = frames[i]
    const { width: fw, height: fh } = frame.dims

    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = fw
    frameCanvas.height = fh
    const frameCtx = frameCanvas.getContext('2d')

    const imageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      fw,
      fh
    )
    frameCtx.putImageData(imageData, 0, 0)

    const mirrored = mirrorFrame(frameCanvas, direction, ratio, keepOriginalSize)
    prepareFrameForGif(mirrored)

    let delay = frame.delay || 10
    if (delay > 0 && delay < 10) {
      delay = 10
    }

    canvases.push({
      canvas: mirrored,
      delay
    })

    if (onProgress && i % 5 === 0) {
      onProgress(Math.round(((i + 1) / totalFrames) * 50))
    }
  }

  const firstCanvas = canvases[0].canvas
  const palette = buildGlobalPalette(frames)

  const encoder = new GIF({
    workers: 4,
    quality: 10,
    width: firstCanvas.width,
    height: firstCanvas.height,
    workerScript: 'gif.worker.js',
    transparent: TRANSPARENT_NUM,
    globalPalette: palette
  })

  return new Promise((resolve, reject) => {
    encoder.on('finished', (blob) => {
      if (onProgress) onProgress(100)
      resolve(blob)
    })

    encoder.on('abort', () => {
      reject(new Error('GIF 编码被中断'))
    })

    for (let i = 0; i < canvases.length; i++) {
      encoder.addFrame(canvases[i].canvas, {
        delay: canvases[i].delay,
        copy: true
      })
    }

    encoder.render()
  })
}

export function getGifMetadata (arrayBuffer) {
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)
  let totalDelay = 0
  for (const frame of frames) {
    totalDelay += frame.delay || 10
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
