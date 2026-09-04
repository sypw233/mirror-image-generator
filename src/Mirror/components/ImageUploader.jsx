/* global FileReader */
import { useState } from 'react'
import { isImageFile, openFilePicker } from '../utils/fileHelper'
export default function ImageUploader ({ onImageLoad }) {
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')
  const handleFile = async (file) => {
    if (!file) return
    if (!isImageFile(file.name)) {
      setLocalError('不支持的文件类型，请选择 PNG / JPG / GIF / BMP / WebP 图片')
      return
    }
    setLocalError('')
    const reader = new FileReader()
    reader.onload = () => {
      onImageLoad(reader.result, file.name)
    }
    reader.onerror = () => setLocalError('文件读取失败，请重试')
    reader.readAsArrayBuffer(file)
  }
  const handlePicker = async () => {
    setLocalError('')
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
    <div>
      <div
        className={`mirror-uploader ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handlePicker}
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handlePicker()
          }
        }}
      >
        <div className='mirror-uploader-icon'>📁</div>
        <div className='mirror-uploader-text'>
          拖拽图片到此处，或点击选择文件
        </div>
        <div className='mirror-uploader-hint'>
          支持 PNG、JPG、GIF、BMP、WebP 格式
        </div>
      </div>
      {localError && <div className='mirror-error'>{localError}</div>}
    </div>
  )
}
