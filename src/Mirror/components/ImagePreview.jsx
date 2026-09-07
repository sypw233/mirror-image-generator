import { useEffect, useMemo, useState } from 'react'

function formatSize (bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDuration (ms) {
  if (!ms && ms !== 0) return ''
  return `${(ms / 1000).toFixed(1)}s`
}
function formatElapsed (ms) {
  if (!ms && ms !== 0) return ''
  return `${ms}ms`
}

/** 计算 contain 布局下图片内容在容器中的实际矩形（供镜像轴定位） */
function computeContainBox (imgW, imgH, cw, ch) {
  if (!imgW || !imgH || !cw || !ch) return null
  const scale = Math.min(cw / imgW, ch / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return { left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h }
}

export default function ImagePreview ({ originalUrl, resultBlob, isGif, info, processing, onDownload, onCopy, direction, history = null }) {
  // 仅在结果变化时创建 URL，避免每次渲染重建导致图片闪烁
  const resultUrl = useMemo(() => {
    if (!resultBlob) return null
    return URL.createObjectURL(resultBlob)
  }, [resultBlob])
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])
  // 历史缩略图 URL：批量创建、卸载时统一回收
  const historyItems = useMemo(() => {
    if (!history || !history.items || history.items.length === 0) return []
    return history.items.map((item) => ({
      ...item,
      url: URL.createObjectURL(item.blob)
    }))
  }, [history])
  useEffect(() => {
    const urls = historyItems.map((i) => i.url)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [historyItems])
  // 结果图内容矩形（相对预览容器），用于绘制镜像轴
  const [axisBox, setAxisBox] = useState(null)
  const handleResultLoad = (e) => {
    const wrap = e.target.parentElement
    if (!wrap) return
    setAxisBox(computeContainBox(e.target.naturalWidth, e.target.naturalHeight, wrap.clientWidth, wrap.clientHeight))
  }
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    setCopied(false)
  }, [resultBlob])
  const handleCopy = async () => {
    if (!onCopy) return
    const ok = await onCopy()
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  if (!originalUrl) return null
  const infoText = info
    ? `${info.width}×${info.height} · ${formatSize(info.size)}` +
      (isGif && info.frameCount ? ` · ${info.frameCount} 帧` : '') +
      (isGif && info.duration ? ` · ${formatDuration(info.duration)}` : '') +
      (info.elapsedMs ? ` · 耗时 ${formatElapsed(info.elapsedMs)}` : '')
    : ''
  return (
    <div className='mirror-preview'>
      <div className='mirror-preview-row'>
        <div className='mirror-preview-panel'>
          <div className='mirror-preview-title'>原图</div>
          <div className='mirror-preview-img-wrap'>
            <img src={originalUrl} alt='原图' className='mirror-preview-img' />
          </div>
        </div>
        <div className='mirror-preview-divider'>
          <span className='mirror-preview-arrow'>→</span>
        </div>
        <div className='mirror-preview-panel'>
          <div className='mirror-preview-title'>镜像结果</div>
          <div className='mirror-preview-img-wrap'>
            {resultUrl
              ? (
                <>
                  <img src={resultUrl} alt='镜像结果' className='mirror-preview-img' onLoad={handleResultLoad} />
                  {/* 镜像轴虚线：直观展示对称边界 */}
                  {axisBox && !processing && direction && (
                    <div
                      className='mirror-preview-axis'
                      style={{ left: axisBox.left, top: axisBox.top, width: axisBox.width, height: axisBox.height }}
                    >
                      {(direction === 'left' || direction === 'right') && <div className='mirror-axis-line mirror-axis-v' />}
                      {(direction === 'top' || direction === 'bottom') && <div className='mirror-axis-line mirror-axis-h' />}
                      {direction === 'br' && (
                        <svg className='mirror-axis-svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
                          <line x1='0' y1='0' x2='100' y2='100' />
                        </svg>
                      )}
                      {direction === 'tl' && (
                        <svg className='mirror-axis-svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
                          <line x1='100' y1='0' x2='0' y2='100' />
                        </svg>
                      )}
                    </div>
                  )}
                </>
                )
              : (
                <div className='mirror-preview-placeholder'>
                  {processing
                    ? (
                      <>
                        <span className='mirror-spinner mirror-spinner-lg' />
                        <span>处理中...</span>
                      </>
                      )
                    : '等待处理'}
                </div>
                )}
            {processing && resultUrl && <div className='mirror-preview-mask'><span className='mirror-spinner mirror-spinner-lg' /></div>}
          </div>
        </div>
      </div>
      {infoText && <div className='mirror-info'>{infoText}</div>}
      {historyItems.length > 0 && (
        <div className='mirror-history'>
          <div className='mirror-history-head'>
            <span className='mirror-history-title'>历史记录</span>
            <button className='mirror-history-clear' onClick={history.onClear}>清空</button>
          </div>
          <div className='mirror-history-list'>
            {historyItems.map((item) => (
              <button
                key={item.id}
                className={`mirror-history-item ${resultBlob === item.blob ? 'active' : ''}`}
                onClick={() => history.onRestore(item)}
                title={`${item.fileName} · ${item.direction}`}
                disabled={processing}
              >
                <img src={item.url} alt='历史' className='mirror-history-thumb' />
                <span className='mirror-history-meta'>{item.direction}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {resultBlob && (
        <div className='mirror-preview-actions'>
          <button className='mirror-download-btn' onClick={onDownload} disabled={processing}>
            下载{isGif ? ' GIF' : ' 图片'}
          </button>
          <button className='mirror-copy-btn' onClick={handleCopy} disabled={processing}>
            {copied ? '已复制' : '复制图片'}
          </button>
        </div>
      )}
    </div>
  )
}
