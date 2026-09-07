/**
 * 镜像核心算法
 *
 * 逻辑：按方向从原图取 `ratio%` 的裁剪块，用 canvas 翻转拼接成对称图。
 * - left/right  ：水平镜像（原块 + 水平翻转块），输出宽度 = 2 × 裁剪宽
 * - top/bottom  ：垂直镜像（原块 + 垂直翻转块），输出高度 = 2 × 裁剪高
 * - tl/br       ：对角线镜像（原块 + 转置块），取方形裁剪区，输出为 2c × 2c 正方形，
 *                 br 沿主对角线（\）对称展开，tl 沿副对角线（/）对称展开
 * - keepOriginalSize：输出保持原图尺寸，组合结果等比缩放（仅当超出时缩小）并居中，避免裁切
 */
export function mirrorImage (imageData, direction, ratio, keepOriginalSize, maxEdge) {
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
  } else if (direction === 'tl' || direction === 'br') {
    // 对角线镜像取方形裁剪区（边长 = min(srcW, srcH) × r），br 取左上、tl 取右下
    const c = Math.max(1, Math.round(Math.min(srcW, srcH) * r))
    clipW = c
    clipH = c
    clipX = direction === 'tl' ? srcW - c : 0
    clipY = direction === 'tl' ? srcH - c : 0
  }

  const isHorizontal = direction === 'left' || direction === 'right'
  const isVertical = direction === 'top' || direction === 'bottom'
  const isDiagonal = direction === 'tl' || direction === 'br'
  // 源块取自 right/bottom 时，镜像块放在左侧/上侧
  const mirrorOnLeft = direction === 'right'
  const mirrorOnTop = direction === 'bottom'

  const compW = isHorizontal ? clipW * 2 : isDiagonal ? clipW * 2 : srcW
  const compH = isVertical ? clipH * 2 : isDiagonal ? clipH * 2 : srcH

  // 组合画布：原块 + 翻转块
  const comp = document.createElement('canvas')
  comp.width = compW
  comp.height = compH
  const ctx = comp.getContext('2d')

  if (isDiagonal) {
    const c = clipW
    if (direction === 'br') {
      // 原块左上 + 转置块右下（沿主对角线 \ 对称）
      ctx.drawImage(imageData, clipX, clipY, c, c, 0, 0, c, c)
      drawTransposed(ctx, imageData, clipX, clipY, c, c, c, c, false)
    } else {
      // 原块右下 + 转置(180°旋转)块左上（沿副对角线 / 对称）
      drawTransposed(ctx, imageData, clipX, clipY, c, c, 0, 0, true)
      ctx.drawImage(imageData, clipX, clipY, c, c, c, c, c, c)
    }
  } else if (isHorizontal) {
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
  let result = comp
  if (keepOriginalSize) {
    const out = document.createElement('canvas')
    out.width = srcW
    out.height = srcH
    const octx = out.getContext('2d')
    const scale = Math.min(1, srcW / compW, srcH / compH)
    const dw = compW * scale
    const dh = compH * scale
    octx.drawImage(comp, (srcW - dw) / 2, (srcH - dh) / 2, dw, dh)
    result = out
  }
  // 导出长边上限：超出时等比缩小（maxEdge>0 生效）
  if (maxEdge && maxEdge > 0) {
    const long = Math.max(result.width, result.height)
    if (long > maxEdge) {
      const scale = maxEdge / long
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(result.width * scale))
      out.height = Math.max(1, Math.round(result.height * scale))
      out.getContext('2d').drawImage(result, 0, 0, out.width, out.height)
      result = out
    }
  }
  return result
}

/**
 * 转置（对角线镜像）绘制：把源图 (sx,sy,sw,sh) 区域转置（像素 (x,y)→(y,x)）画到目标画布 (dx,dy)。
 * @param {CanvasRenderingContext2D} ctx 目标画布上下文
 * @param {*} source 源图（canvas 或 Image）
 * @param {number} sx 源 x
 * @param {number} sy 源 y
 * @param {number} sw 源宽（= 源高，方形）
 * @param {number} sh 源高
 * @param {number} dx 目标 x
 * @param {number} dy 目标 y
 * @param {boolean} flip180 先 180° 旋转再转置（用于副对角线 / 方向）
 */
function drawTransposed (ctx, source, sx, sy, sw, sh, dx, dy, flip180) {
  const size = sw
  const tmp = document.createElement('canvas')
  tmp.width = size
  tmp.height = size
  const tctx = tmp.getContext('2d')
  tctx.drawImage(source, sx, sy, size, size, 0, 0, size, size)
  if (flip180) {
    tctx.save()
    tctx.translate(size, size)
    tctx.scale(-1, -1)
    tctx.drawImage(tmp, 0, 0)
    tctx.restore()
  }
  const data = tctx.getImageData(0, 0, size, size).data
  const compW = ctx.canvas.width
  const compData = ctx.getImageData(0, 0, compW, ctx.canvas.height)
  const dst = compData.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4
      const di = ((dy + x) * compW + (dx + y)) * 4
      dst[di] = data[si]
      dst[di + 1] = data[si + 1]
      dst[di + 2] = data[si + 2]
      dst[di + 3] = data[si + 3]
    }
  }
  ctx.putImageData(compData, 0, 0)
}

export function mirrorFrame (sourceCanvas, direction, ratio, keepOriginalSize, maxEdge) {
  return mirrorImage(sourceCanvas, direction, ratio, keepOriginalSize, maxEdge)
}
