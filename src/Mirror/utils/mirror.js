/**
 * 镜像核心算法
 *
 * 逻辑：按方向从原图取 `ratio%` 的裁剪块，用 canvas 翻转拼接成对称图。
 * - left/right  ：水平镜像（原块 + 水平翻转块），输出宽度 = 2 × 裁剪宽
 * - top/bottom  ：垂直镜像（原块 + 垂直翻转块），输出高度 = 2 × 裁剪高
 * - tl/br       ：对角线镜像（斜切），取方形裁剪区（边长 c = min(宽,高) × ratio），输出 c × c 方形，
 *                 tl 取源图左上角、沿主对角线（\）斜切（右下三角保留原内容），
 *                 br 取源图右下角、沿副对角线（/）斜切（右上三角保留原内容），
 *                 另一侧填充对角镜像，两侧沿对角线严格对称、无透明区域
 * - keepOriginalSize：输出保持原图尺寸，组合结果等比缩放（仅当超出时缩小）并居中，避免裁切
 * - backgroundColor：非空时输出不透明，所有透明区域（源图透明 / 缩放留白）填充该颜色
 * @param {CanvasImageSource} imageData canvas 或 Image
 * @param {string} direction left|right|top|bottom|tl|br
 * @param {number} ratio 镜像比例 1-100
 * @param {boolean} keepOriginalSize 保持原图尺寸
 * @param {number} [maxEdge] 导出长边上限，超出等比缩小
 * @param {string|null} [backgroundColor] 背景色（#rrggbb 或 null=透明）
 */
export function mirrorImage (imageData, direction, ratio, keepOriginalSize, maxEdge, backgroundColor) {
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
    // 对角线镜像取方形裁剪区（边长 = min(srcW, srcH) × r）；方向名 = 原内容保留的角：
    // 左上对称取源图左上角，右下对称取源图右下角
    const c = Math.max(1, Math.round(Math.min(srcW, srcH) * r))
    clipW = c
    clipH = c
    clipX = direction === 'br' ? srcW - c : 0
    clipY = direction === 'br' ? srcH - c : 0
  }

  const isHorizontal = direction === 'left' || direction === 'right'
  const isVertical = direction === 'top' || direction === 'bottom'
  const isDiagonal = direction === 'tl' || direction === 'br'
  // 源块取自 right/bottom 时，镜像块放在左侧/上侧
  const mirrorOnLeft = direction === 'right'
  const mirrorOnTop = direction === 'bottom'

  const compW = isHorizontal ? clipW * 2 : isDiagonal ? clipW : srcW
  const compH = isVertical ? clipH * 2 : isDiagonal ? clipH : srcH

  // 组合画布：原块 + 翻转块（背景色时先铺底，透明区域显示背景色）
  const comp = document.createElement('canvas')
  comp.width = compW
  comp.height = compH
  const ctx = comp.getContext('2d')
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, compW, compH)
  }

  if (isDiagonal) {
    // 对角线斜切：画面被对角线一分为二，一侧保留原内容、另一侧填充对角镜像
    drawDiagonalMirror(ctx, imageData, clipX, clipY, clipW, direction)
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
    if (backgroundColor) {
      octx.fillStyle = backgroundColor
      octx.fillRect(0, 0, srcW, srcH)
    }
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
 * 对角线"斜切"镜像：取方形区（c × c），画面被对角线一分为二，两侧内容沿对角线严格对称。
 * - tl（左上对称）：沿主对角线（\）斜切，右下三角（x>y）保留原内容，左上三角（x<y）填充转置镜像 source(y,x)
 * - br（右下对称）：沿副对角线（/）斜切，右上三角（x+y>c-1）保留原内容，左上三角（x+y<c-1）填充转置镜像 source(c-1-y, c-1-x)
 * 输出为完整方形画面，无透明区域。
 * 实现：先整块复制（保留角一侧为原内容），再逐像素覆盖另一侧三角，Uint32 视角批量读写提速。
 * @param {CanvasRenderingContext2D} ctx 目标画布上下文
 * @param {*} source 源图（canvas 或 Image）
 * @param {number} sx 源 x
 * @param {number} sy 源 y
 * @param {number} c 方形区边长
 * @param {'tl'|'br'} direction 左上对称 / 右下对称
 */
function drawDiagonalMirror (ctx, source, sx, sy, c, direction) {
  const tmp = document.createElement('canvas')
  tmp.width = c
  tmp.height = c
  const tctx = tmp.getContext('2d')
  tctx.drawImage(source, sx, sy, c, c, 0, 0, c, c)
  const src = tctx.getImageData(0, 0, c, c).data
  // 先整块复制：保留角一侧为原内容，另一侧待覆盖
  const dst = new Uint8ClampedArray(src)
  const src32 = new Uint32Array(src.buffer)
  const dst32 = new Uint32Array(dst.buffer)
  if (direction === 'tl') {
    // 左上对称：沿主对角线（\），覆盖左上三角（x<y）为 source(y,x)，右下三角保留原内容
    for (let y = 0; y < c; y++) {
      for (let x = 0; x < y; x++) {
        dst32[y * c + x] = src32[x * c + y]
      }
    }
  } else {
    // 右下对称：沿副对角线（/），覆盖左上三角（x+y<c-1）为 source(c-1-y, c-1-x)，右上三角保留原内容
    for (let y = 0; y < c; y++) {
      const limit = c - 1 - y
      for (let x = 0; x < limit; x++) {
        dst32[y * c + x] = src32[(c - 1 - x) * c + (c - 1 - y)]
      }
    }
  }
  tctx.putImageData(new ImageData(dst, c, c), 0, 0)
  ctx.drawImage(tmp, 0, 0)
}

export function mirrorFrame (sourceCanvas, direction, ratio, keepOriginalSize, maxEdge, backgroundColor) {
  return mirrorImage(sourceCanvas, direction, ratio, keepOriginalSize, maxEdge, backgroundColor)
}
