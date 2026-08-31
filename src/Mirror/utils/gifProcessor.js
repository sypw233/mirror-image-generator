import { parseGIF, decompressFrames } from 'gifuct-js'
import GIF from 'gif.js'
import { mirrorFrame } from './mirror'

export function isGifBuffer (buffer) {
  const bytes = new Uint8Array(buffer)
  return bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
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
  const encoder = new GIF({
    workers: 4,
    quality: 30,
    width: firstCanvas.width,
    height: firstCanvas.height,
    workerScript: 'gif.worker.js'
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
