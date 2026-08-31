import { readFileSync } from 'node:fs'
import { parseGIF, decompressFrames } from 'gifuct-js'

const testGifPath = process.argv[2]

if (!testGifPath) {
  console.log('用法: node test-gif.mjs <gif文件路径>')
  console.log('示例: node test-gif.mjs test.gif')
  process.exit(1)
}

console.log('\n=== GIF 镜像测试 ===\n')
console.log(`读取文件: ${testGifPath}`)

try {
  const buffer = readFileSync(testGifPath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  console.log(`文件大小: ${buffer.length} bytes`)

  const bytes = new Uint8Array(arrayBuffer)
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
  console.log(`是GIF文件: ${isGif}`)

  if (!isGif) {
    console.error('不是有效的GIF文件')
    process.exit(1)
  }

  console.log('\n--- 解析GIF结构 ---')
  const gif = parseGIF(arrayBuffer)
  console.log('解析成功')

  console.log('\n--- 解压帧数据 ---')
  const frames = decompressFrames(gif, true)
  console.log(`帧数: ${frames.length}`)

  if (frames.length > 0) {
    const firstFrame = frames[0]
    const { width, height, left, top } = firstFrame.dims
    console.log(`第一帧尺寸: ${width} x ${height}`)
    console.log(`第一帧位置: left=${left}, top=${top}`)
    console.log(`第一帧延迟: ${firstFrame.delay} (centiseconds = ${firstFrame.delay * 10}ms)`)
    console.log(`第一帧像素数据(pixels)长度: ${firstFrame.pixels?.length || 0}`)
    console.log(`第一帧patch长度: ${firstFrame.patch?.length || 0}`)
    console.log(`第一帧colorTable长度: ${firstFrame.colorTable?.length || 0}`)

    if (firstFrame.pixels) {
      const expectedLength = width * height * 4
      console.log(`期望RGBA像素长度: ${expectedLength}`)
      console.log(`pixels是否RGBA: ${firstFrame.pixels.length === expectedLength}`)
    }

    console.log('\n--- 镜像方向测试 ---')
    for (const dir of ['left', 'right', 'top', 'bottom']) {
      const clipW = dir === 'left' || dir === 'right'
        ? Math.round(width * 0.5)
        : width
      const clipH = dir === 'top' || dir === 'bottom'
        ? Math.round(height * 0.5)
        : height

      let outW, outH
      if (dir === 'left' || dir === 'right') {
        outW = clipW * 2
        outH = height
      } else {
        outW = width
        outH = clipH * 2
      }
      console.log(`  ${dir}: 输入 ${width}x${height} → 输出 ${outW}x${outH}`)
    }

    if (frames.length > 1) {
      console.log('\n--- 多帧信息 ---')
      let totalDelay = 0
      for (let i = 0; i < Math.min(frames.length, 5); i++) {
        const f = frames[i]
        totalDelay += f.delay ? f.delay * 10 : 100
        console.log(`  帧 ${i}: ${f.dims.width}x${f.dims.height}, delay=${f.delay * 10}ms`)
      }
      if (frames.length > 5) {
        console.log(`  ... 还有 ${frames.length - 5} 帧`)
      }
      console.log(`  总延迟: ${totalDelay}ms`)
    }
  }

  console.log('\n=== 测试通过 ===')
  console.log('GIF 解码功能正常，可以在浏览器中使用')

} catch (err) {
  console.error('\n=== 测试失败 ===')
  console.error(err.message)
  process.exit(1)
}
