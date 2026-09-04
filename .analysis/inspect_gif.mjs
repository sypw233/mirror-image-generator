import { parseGIF, decompressFrames } from 'gifuct-js'
import fs from 'node:fs'
const files = ['full.gif', 'transparent.gif', 'delay.gif', 'partial_pil.gif']
for (const f of files) {
  const buf = fs.readFileSync(`public/test/${f}`)
  const gif = parseGIF(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const frames = decompressFrames(gif, true)
  console.log(`\n=== ${f} === canvas ${gif.lsd.width}x${gif.lsd.height} frames=${frames.length}`)
  frames.forEach((fr, i) => {
    console.log(`  #${i} dims(${fr.dims.left},${fr.dims.top},${fr.dims.width}x${fr.dims.height}) delay=${fr.delay}ms disposal=${fr.disposalType} transparentIdx=${fr.transparentIndex} patchLen=${fr.patch.length} expected=${fr.dims.width*fr.dims.height*4}`)
  })
}
