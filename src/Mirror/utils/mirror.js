export function mirrorImage (imageData, direction, ratio, keepOriginalSize) {
  const { width: srcW, height: srcH } = imageData

  const r = ratio / 100

  let clipX = 0
  let clipY = 0
  let clipW = srcW
  let clipH = srcH

  if (direction === 'left') {
    clipW = Math.round(srcW * r)
    clipX = 0
  } else if (direction === 'right') {
    clipW = Math.round(srcW * r)
    clipX = srcW - clipW
  } else if (direction === 'top') {
    clipH = Math.round(srcH * r)
    clipY = 0
  } else if (direction === 'bottom') {
    clipH = Math.round(srcH * r)
    clipY = srcH - clipH
  }

  const isHorizontal = direction === 'left' || direction === 'right'
  const isMirrorFirst = direction === 'right' || direction === 'bottom'

  let outW, outH
  if (keepOriginalSize) {
    outW = srcW
    outH = srcH
  } else if (isHorizontal) {
    outW = clipW * 2
    outH = srcH
  } else {
    outW = srcW
    outH = clipH * 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')

  if (isHorizontal) {
    if (keepOriginalSize) {
      const offsetX = (outW - clipW * 2) / 2
      if (isMirrorFirst) {
        ctx.save()
        ctx.translate(offsetX + clipW, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, offsetX + clipW, 0, clipW, clipH)
      } else {
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, offsetX, 0, clipW, clipH)
        ctx.save()
        ctx.translate(offsetX + clipW * 2, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
      }
    } else {
      if (isMirrorFirst) {
        ctx.save()
        ctx.translate(clipW, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, clipW, 0, clipW, clipH)
      } else {
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.save()
        ctx.translate(clipW * 2, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
      }
    }
  } else {
    if (keepOriginalSize) {
      const offsetY = (outH - clipH * 2) / 2
      if (isMirrorFirst) {
        ctx.save()
        ctx.translate(0, offsetY + clipH)
        ctx.scale(1, -1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, offsetY + clipH, clipW, clipH)
      } else {
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, offsetY, clipW, clipH)
        ctx.save()
        ctx.translate(0, offsetY + clipH * 2)
        ctx.scale(1, -1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
      }
    } else {
      if (isMirrorFirst) {
        ctx.save()
        ctx.translate(0, clipH)
        ctx.scale(1, -1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, clipH, clipW, clipH)
      } else {
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.save()
        ctx.translate(0, clipH * 2)
        ctx.scale(1, -1)
        ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
        ctx.restore()
      }
    }
  }

  return canvas
}

export function mirrorFrame (sourceCanvas, direction, ratio, keepOriginalSize) {
  return mirrorImage(sourceCanvas, direction, ratio, keepOriginalSize)
}
