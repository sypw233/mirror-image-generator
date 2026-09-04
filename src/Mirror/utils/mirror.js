/**
 * 镜像核心算法
 *
 * 逻辑：按方向从原图取 `ratio%` 的裁剪块，用 canvas 翻转拼接成对称图。
 * - left/right  ：水平镜像（原块 + 水平翻转块），输出宽度 = 2 × 裁剪宽
 * - top/bottom  ：垂直镜像（原块 + 垂直翻转块），输出高度 = 2 × 裁剪高
 * - keepOriginalSize：输出保持原图尺寸，组合结果等比缩放（仅当超出时缩小）并居中，避免裁切
 */
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
  // 源块取自 right/bottom 时，镜像块放在左侧/上侧
  const mirrorOnLeft = direction === 'right'
  const mirrorOnTop = direction === 'bottom'
  const compW = isHorizontal ? clipW * 2 : srcW
  const compH = isHorizontal ? srcH : clipH * 2
  // 组合画布：原块 + 翻转块
  const comp = document.createElement('canvas')
  comp.width = compW
  comp.height = compH
  const ctx = comp.getContext('2d')
  if (isHorizontal) {
    const srcX = mirrorOnLeft ? clipW : 0
    const mirrorX = mirrorOnLeft ? 0 : clipW
    ctx.drawImage(imageData, clipX, clipY, clipW, clipH, srcX, 0, clipW, clipH)
    ctx.save()
    ctx.translate(mirrorX + clipW, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
    ctx.restore()
  } else {
    const srcY = mirrorOnTop ? clipH : 0
    const mirrorY = mirrorOnTop ? 0 : clipH
    ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, srcY, clipW, clipH)
    ctx.save()
    ctx.translate(0, mirrorY + clipH)
    ctx.scale(1, -1)
    ctx.drawImage(imageData, clipX, clipY, clipW, clipH, 0, 0, clipW, clipH)
    ctx.restore()
  }
  // 保持原尺寸：等比缩放（只缩不放大）并居中，保证不裁切
  if (keepOriginalSize) {
    const out = document.createElement('canvas')
    out.width = srcW
    out.height = srcH
    const octx = out.getContext('2d')
    const scale = Math.min(1, srcW / compW, srcH / compH)
    const dw = compW * scale
    const dh = compH * scale
    octx.drawImage(comp, (srcW - dw) / 2, (srcH - dh) / 2, dw, dh)
    return out
  }
  return comp
}
export function mirrorFrame (sourceCanvas, direction, ratio, keepOriginalSize) {
  return mirrorImage(sourceCanvas, direction, ratio, keepOriginalSize)
}
