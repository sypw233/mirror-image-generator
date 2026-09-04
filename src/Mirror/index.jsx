import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
/* global Image */
import ImageUploader from './components/ImageUploader'
import MirrorControls from './components/MirrorControls'
import ImagePreview from './components/ImagePreview'
import { isGifFile, isImageFile, saveFile, copyImageToClipboard, readFileAsArrayBuffer } from './utils/fileHelper'
import { mirrorImage } from './utils/mirror'
import { processGif, isGifBuffer, getGifMetadata } from './utils/gifProcessor'
import './index.css'
export default function Mirror ({ enterAction }) {
  const [arrayBuffer, setArrayBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isGif, setIsGif] = useState(false)
  const [gifMeta, setGifMeta] = useState(null)
  const [controls, setControls] = useState({
    direction: 'left',
    ratio: 50,
    keepOriginalSize: false
  })
  const [resultBlob, setResultBlob] = useState(null)
  const [progress, setProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [resultInfo, setResultInfo] = useState(null)
  const runIdRef = useRef(0)
  // 原图 URL：仅在输入变化时重建，避免每次渲染都重建导致图片闪烁
  const originalUrl = useMemo(() => {
    if (!arrayBuffer) return null
    const mime = isGif ? 'image/gif' : 'image/png'
    const blob = new Blob([arrayBuffer], { type: mime })
    return URL.createObjectURL(blob)
  }, [arrayBuffer, isGif])
  // 原图 URL 变化时释放旧 URL，避免内存泄漏
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl)
    }
  }, [originalUrl])
  const processImage = useCallback(async () => {
    if (!arrayBuffer) return
    const runId = ++runIdRef.current
    setError('')
    setProcessing(true)
    setProgress(0)
    setResultInfo(null)
    try {
      let blob
      if (isGif) {
        blob = await processGif(
          arrayBuffer,
          controls.direction,
          controls.ratio,
          controls.keepOriginalSize,
          setProgress
        )
      } else {
        // 让出主线程，先让“处理中”状态绘制出来
        await new Promise((resolve) => setTimeout(resolve, 0))
        const img = await loadImage(arrayBuffer)
        const canvas = mirrorImage(
          img,
          controls.direction,
          controls.ratio,
          controls.keepOriginalSize
        )
        blob = await canvasToBlob(canvas)
      }
      if (runId !== runIdRef.current) return // 丢弃过期结果
      setResultBlob(blob)
      const info = await readImageInfo(blob, isGif, gifMeta)
      if (runId !== runIdRef.current) return
      setResultInfo(info)
    } catch (err) {
      console.error('处理失败:', err)
      if (runId !== runIdRef.current) return
      const msg = err?.message || '图片处理失败'
      setError(msg)
      window.utools?.showNotification('图片处理失败: ' + msg)
    } finally {
      if (runId === runIdRef.current) {
        setProcessing(false)
      }
    }
  }, [arrayBuffer, isGif, controls, gifMeta])
  // 防抖：滑块连续拖动时不频繁触发重处理
  useEffect(() => {
    if (!arrayBuffer) return
    const timer = setTimeout(() => {
      processImage()
    }, 150)
    return () => clearTimeout(timer)
  }, [processImage, arrayBuffer])
  useEffect(() => {
    if (enterAction?.type === 'img' && enterAction.payload) {
      const payload = enterAction.payload
      if (typeof payload === 'string') {
        const binary = atob(payload.split(',')[1] || payload)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        handleImageLoad(bytes.buffer, 'image.png')
      }
    }
  }, [enterAction])
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const file = files[0]
      if (!isImageFile(file.name)) {
        setError('不支持的文件类型，请拖入 PNG / JPG / GIF / BMP / WebP 图片')
        return
      }
      const buffer = await readFileAsArrayBuffer(file)
      handleImageLoad(buffer, file.name)
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])
  const handleImageLoad = (buffer, name) => {
    runIdRef.current++ // 使进行中的旧处理失效
    setArrayBuffer(buffer)
    setFileName(name)
    const gif = isGifFile(name) || isGifBuffer(buffer)
    setIsGif(gif)
    setGifMeta(gif ? safeGifMeta(buffer) : null)
    setResultBlob(null)
    setProgress(0)
    setError('')
    setResultInfo(null)
  }
  const handleControlsChange = (newControls) => {
    setControls(newControls)
  }
  const handleDownload = async () => {
    if (!resultBlob) return
    const ext = isGif ? 'gif' : 'png'
    const baseName = fileName.replace(/\.[^.]+$/, '')
    const downloadName = `${baseName}_mirror.${ext}`
    await saveFile(resultBlob, downloadName)
  }
  const handleCopy = async () => {
    if (!resultBlob) return false
    return await copyImageToClipboard(resultBlob)
  }
  const handleReset = () => {
    runIdRef.current++
    setArrayBuffer(null)
    setFileName('')
    setIsGif(false)
    setGifMeta(null)
    setResultBlob(null)
    setProgress(0)
    setError('')
    setResultInfo(null)
  }
  return (
    <div className='mirror-app'>
      {!arrayBuffer && (
        <>
          {error && <div className='mirror-error'>{error}</div>}
          <ImageUploader onImageLoad={handleImageLoad} />
        </>
      )}
      {arrayBuffer && (
        <>
          <div className='mirror-toolbar'>
            <button className='mirror-btn-back' onClick={handleReset} disabled={processing}>
              ← 重新选择
            </button>
            <span className='mirror-file-name' title={fileName}>{fileName}</span>
            {isGif && <span className='mirror-gif-badge'>GIF</span>}
            {processing && (
              <span className='mirror-processing-tag'>
                <span className='mirror-spinner' />
                处理中
              </span>
            )}
          </div>
          {error && <div className='mirror-error'>{error}</div>}
          <MirrorControls onChange={handleControlsChange} disabled={processing} />
          {processing && (
            <div className='mirror-progress'>
              <div className='mirror-progress-bar'>
                <div className='mirror-progress-fill' style={{ width: `${progress}%` }} />
              </div>
              <span className='mirror-progress-text'>{progress}%</span>
            </div>
          )}
          <ImagePreview
            originalUrl={originalUrl}
            resultBlob={resultBlob}
            isGif={isGif}
            info={resultInfo}
            processing={processing}
            onDownload={handleDownload}
            onCopy={handleCopy}
          />
        </>
      )}
    </div>
  )
}
function loadImage (buffer) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer])
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}
function canvasToBlob (canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片编码失败'))
    }, 'image/png')
  })
}
function safeGifMeta (buffer) {
  try {
    return getGifMetadata(buffer)
  } catch (err) {
    console.warn('GIF 元信息解析失败:', err)
    return null
  }
}
async function readImageInfo (blob, gif, gifMeta) {
  const info = { width: 0, height: 0, size: blob.size }
  try {
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => reject(new Error('读取尺寸失败'))
        im.src = url
      })
      info.width = img.naturalWidth
      info.height = img.naturalHeight
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.warn(err)
  }
  if (gif && gifMeta) {
    info.frameCount = gifMeta.frameCount
    info.duration = gifMeta.totalDelay
  }
  return info
}
