import { useState, useRef } from 'react'
import { openFilePicker } from '../utils/fileHelper'

export default function ImageUploader ({ onImageLoad }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onImageLoad(reader.result, file.name)
    }
    reader.readAsArrayBuffer(file)
  }

  const handlePicker = async () => {
    const result = await openFilePicker()
    if (result) {
      onImageLoad(result.buffer, result.name)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  return (
    <div
      className={`mirror-uploader ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handlePicker}
    >
      <div className="mirror-uploader-icon">📁</div>
      <div className="mirror-uploader-text">
        拖拽图片到此处，或点击选择文件
      </div>
      <div className="mirror-uploader-hint">
        支持 PNG、JPG、GIF、BMP、WebP 格式
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
