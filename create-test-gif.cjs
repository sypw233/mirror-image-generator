const { writeFileSync } = require('node:fs')

function createTestGif () {
  const width = 20
  const height = 20

  const frames = []
  for (let f = 0; f < 3; f++) {
    const pixels = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isLeft = x < width / 2
        if (f === 0) {
          pixels.push(isLeft ? 255 : 0, isLeft ? 0 : 0, 0)
        } else if (f === 1) {
          pixels.push(isLeft ? 0 : 0, 255, 0)
        } else {
          pixels.push(0, 0, isLeft ? 255 : 128)
        }
        pixels.push(255)
      }
    }
    frames.push({ pixels: Buffer.from(pixels), delay: 10 })
  }

  const buf = []

  function writeByte (b) { buf.push(b & 0xFF) }
  function writeShort (s) { writeByte(s); writeByte(s >> 8) }
  function writeBytes (arr) { for (const b of arr) writeByte(b) }
  function writeStr (s) { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)) }

  writeStr('GIF89a')

  writeShort(width)
  writeShort(height)
  writeByte(0xF7)
  writeByte(0)
  writeByte(0)

  const colorTable = []
  for (let i = 0; i < 256; i++) {
    colorTable.push(i, i, i)
  }
  for (let i = 0; i < 256 * 3; i++) {
    writeByte(colorTable[i])
  }

  for (let f = 0; f < frames.length; f++) {
    writeByte(0x21)
    writeByte(0xFF)
    writeByte(11)
    writeStr('NETSCAPE2.0')
    writeByte(3)
    writeByte(1)
    writeShort(0)
    writeByte(0)

    writeByte(0x21)
    writeByte(0xF9)
    writeByte(4)
    writeByte(0x04)
    writeShort(frames[f].delay)
    writeByte(0)
    writeByte(0)

    writeByte(0x2C)
    writeShort(0)
    writeShort(0)
    writeShort(width)
    writeShort(height)
    writeByte(0)

    const minCodeSize = 8
    writeByte(minCodeSize)

    const data = lzwEncode(frames[f].pixels, minCodeSize)
    const blocks = []
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255)
      blocks.push(chunk.length)
      blocks.push(...chunk)
    }
    for (const b of blocks) {
      writeByte(b)
    }
    writeByte(0)
  }

  writeByte(0x3B)

  return Buffer.from(buf)
}

function lzwEncode (pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1

  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  const codeLimit = 1 << 12

  const dictionary = new Map()
  for (let i = 0; i < clearCode; i++) {
    dictionary.set(String.fromCharCode(i), i)
  }

  const output = []
  let bitBuffer = 0
  let bitsUsed = 0

  function writeBits (code, size) {
    bitBuffer |= (code << bitsUsed)
    bitsUsed += size
    while (bitsUsed >= 8) {
      output.push(bitBuffer & 0xFF)
      bitBuffer >>= 8
      bitsUsed -= 8
    }
  }

  writeBits(clearCode, codeSize)

  let current = String.fromCharCode(pixels[0])
  for (let i = 1; i < pixels.length; i++) {
    const next = current + String.fromCharCode(pixels[i])
    if (dictionary.has(next)) {
      current = next
    } else {
      writeBits(dictionary.get(current), codeSize)
      if (nextCode < codeLimit) {
        dictionary.set(next, nextCode++)
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++
        }
      } else {
        writeBits(clearCode, codeSize)
        dictionary.clear()
        for (let j = 0; j < clearCode; j++) {
          dictionary.set(String.fromCharCode(j), j)
        }
        nextCode = eoiCode + 1
        codeSize = minCodeSize + 1
      }
      current = String.fromCharCode(pixels[i])
    }
  }

  writeBits(dictionary.get(current), codeSize)
  writeBits(eoiCode, codeSize)

  if (bitsUsed > 0) {
    output.push(bitBuffer & 0xFF)
  }

  return output
}

const gif = createTestGif()
writeFileSync('test.gif', gif)
console.log(`测试GIF已创建: test.gif (${gif.length} bytes)`)
