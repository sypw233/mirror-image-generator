import { useState, useEffect, useCallback, useRef } from 'react'
import ImageUploader from './components/ImageUploader'
import MirrorControls from './components/MirrorControls'
import ImagePreview from './components/ImagePreview'
import { isGifFile, isImageFile, saveFile, copyImageToClipboard, readFileAsArrayBuffer } from './utils/fileHelper'
import { mirrorImage } from './utils/mirror'
import { processGif, isGifBuffer } from './utils/gifProcessor'
import './index.css'

export default function Mirror ({ enterAction }) {
  const [arrayBuffer, setArrayBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isGif, setIsGif] = useState(false)
  const [controls, setControls] = useState({
    direction: 'left',
    ratio: 50,
    keepOriginalSize: false
  })
  const [resultBlob, setResultBlob] = useState(null)
  const [progress, setProgress] = useState(0)
  const [processing, setProcessing] = useState(false)

  const imgRef = useRef(null)
  const originalUrlRef = useRef(null)

  const getOriginalUrl = useCallback(() => {
    if (!arrayBuffer) return null
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current)
    }
    const mime = isGif ? 'image/gif' : 'image/png'
    const blob = new Blob([arrayBuffer], { type: mime })
    const url = URL.createObjectURL(blob)
    originalUrlRef.current = url
    return url
  }, [arrayBuffer, isGif])

  const processImage = useCallback(async () => {
    if (!arrayBuffer) return
    setProcessing(true)
    setProgress(0)

    try {
      if (isGif) {
        const blob = await processGif(
          arrayBuffer,
          controls.direction,
          controls.ratio,
          controls.keepOriginalSize,
          setProgress
        )
        setResultBlob(blob)
      } else {
        const img = await loadImage(arrayBuffer)
        const canvas = mirrorImage(
          img,
          controls.direction,
          controls.ratio,
          controls.keepOriginalSize
        )
        canvas.toBlob((blob) => {
          setResultBlob(blob)
        }, 'image/png')
      }
    } catch (err) {
      console.error('处理失败:', err)
      window.utools?.showNotification('图片处理失败: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }, [arrayBuffer, isGif, controls])

  useEffect(() => {
    processImage()
  }, [processImage])

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
      if (!isImageFile(file.name)) return

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
    setArrayBuffer(buffer)
    setFileName(name)
    setIsGif(isGifFile(name) || isGifBuffer(buffer))
    setResultBlob(null)
    setProgress(0)
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

  const originalUrl = getOriginalUrl()

  return (
    <div className="mirror-app">
      {!arrayBuffer && (
        <ImageUploader onImageLoad={handleImageLoad} />
      )}

      {arrayBuffer && (
        <>
          <div className="mirror-toolbar">
            <button
              className="mirror-btn-back"
              onClick={() => {
                setArrayBuffer(null)
                setFileName('')
                setIsGif(false)
                setResultBlob(null)
              }}
            >
              ← 重新选择
            </button>
            <span className="mirror-file-name">{fileName}</span>
            {isGif && <span className="mirror-gif-badge">GIF</span>}
          </div>

          <MirrorControls onChange={handleControlsChange} />

          {processing && isGif && (
            <div className="mirror-progress">
              <div className="mirror-progress-bar">
                <div
                  className="mirror-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="mirror-progress-text">{progress}%</span>
            </div>
          )}

          <ImagePreview
            originalUrl={originalUrl}
            resultBlob={resultBlob}
            isGif={isGif}
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
