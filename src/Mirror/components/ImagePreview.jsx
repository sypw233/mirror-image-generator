import { useEffect, useRef, useState } from 'react'

export default function ImagePreview ({ originalUrl, resultBlob, isGif, onDownload, onCopy }) {
  const resultUrlRef = useRef(null)
  const resultUrl = resultBlob ? URL.createObjectURL(resultBlob) : null
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current)
      }
    }
  }, [resultBlob])

  useEffect(() => {
    if (resultUrl) {
      resultUrlRef.current = resultUrl
    }
  }, [resultUrl])

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

  return (
    <div className="mirror-preview">
      <div className="mirror-preview-row">
        <div className="mirror-preview-panel">
          <div className="mirror-preview-title">原图</div>
          <div className="mirror-preview-img-wrap">
            <img src={originalUrl} alt="原图" className="mirror-preview-img" />
          </div>
        </div>

        <div className="mirror-preview-divider">
          <span className="mirror-preview-arrow">→</span>
        </div>

        <div className="mirror-preview-panel">
          <div className="mirror-preview-title">镜像结果</div>
          <div className="mirror-preview-img-wrap">
            {resultUrl
              ? (
                <img src={resultUrl} alt="镜像结果" className="mirror-preview-img" />
                )
              : (
                <div className="mirror-preview-placeholder">处理中...</div>
                )}
          </div>
        </div>
      </div>

      {resultBlob && (
        <div className="mirror-preview-actions">
          <button className="mirror-download-btn" onClick={onDownload}>
            下载{isGif ? ' GIF' : ' 图片'}
          </button>
          {!isGif && (
            <button className="mirror-copy-btn" onClick={handleCopy}>
              {copied ? '已复制' : '复制图片'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
