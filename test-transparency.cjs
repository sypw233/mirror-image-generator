const { parseGIF, decompressFrames } = require('gifuct-js')
const fs = require('fs')

const buffer = fs.readFileSync('F:\\vue_project\\镜像图片生成\\public\\test.gif')
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

const gif = parseGIF(arrayBuffer)
const frames = decompressFrames(gif, true)

console.log('Global color table:', gif.colorTable ? 'yes' : 'no')
console.log('Frames:', frames.length)

for (let i = 0; i < Math.min(frames.length, 2); i++) {
  const frame = frames[i]
  console.log(`\nFrame ${i}:`)
  console.log('  dims:', frame.dims)
  console.log('  transparentIndex:', frame.transparentIndex)
  console.log('  hasLocalColorTable:', !!frame.localColorTable)
  console.log('  colorTable:', frame.colorTable ? `length=${frame.colorTable.length}` : 'none')
  console.log('  patch length:', frame.patch?.length)

  if (frame.transparentIndex != null) {
    console.log('  transparentIndex:', frame.transparentIndex)
    const ct = frame.colorTable
    if (ct) {
      const r = ct[frame.transparentIndex * 3]
      const g = ct[frame.transparentIndex * 3 + 1]
      const b = ct[frame.transparentIndex * 3 + 2]
      console.log('  transparent RGB:', r, g, b)
    }
  }

  const pixels = frame.patch
  if (pixels) {
    let alphaZero = 0, alphaFF = 0, alphaOther = 0
    for (let j = 3; j < pixels.length; j += 4) {
      if (pixels[j] === 0) alphaZero++
      else if (pixels[j] === 255) alphaFF++
      else alphaOther++
    }
    console.log('  alpha=0:', alphaZero)
    console.log('  alpha=255:', alphaFF)
    console.log('  alpha=other:', alphaOther)
  }
}
