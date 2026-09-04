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
export default function ImagePreview ({ originalUrl, resultBlob, isGif, info, processing, onDownload, onCopy }) {
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
      (isGif && info.duration ? ` · ${formatDuration(info.duration)}` : '')
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
                <img src={resultUrl} alt='镜像结果' className='mirror-preview-img' />
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
