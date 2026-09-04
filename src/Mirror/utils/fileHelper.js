/* global FileReader, ClipboardItem, Image */
const isUtools = typeof window !== 'undefined' && window.utools
export function isGifFile (fileName) {
  return /\.gif$/i.test(fileName)
}
export function isImageFile (fileName) {
  return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)
}
export function readFileAsArrayBuffer (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}
export function readFileFromPath (filePath) {
  if (!isUtools) {
    throw new Error('文件路径读取仅支持 uTools 环境')
  }
  const fs = window.services?.readFileBuffer
  if (!fs) {
    throw new Error('未找到文件读取服务')
  }
  return fs(filePath)
}
export function openFilePicker (accept = 'image/*') {
  return new Promise((resolve) => {
    if (isUtools) {
      const files = window.utools.showOpenDialog({
        title: '选择图片',
        filters: [
          { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
        ],
        properties: ['openFile']
      })
      if (files && files.length > 0) {
        const filePath = files[0]
        const buffer = readFileFromPath(filePath)
        const name = filePath.split(/[\\/]/).pop()
        resolve({ buffer, name, filePath })
      } else {
        resolve(null)
      }
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = async () => {
        const file = input.files?.[0]
        if (file) {
          const buffer = await readFileAsArrayBuffer(file)
          resolve({ buffer, name: file.name, filePath: null })
        } else {
          resolve(null)
        }
      }
      input.click()
    }
  })
}
async function blobToBase64 (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Blob 转 Base64 失败'))
    reader.readAsDataURL(blob)
  })
}
export async function saveFile (blob, fileName) {
  if (!(blob instanceof Blob)) {
    blob = new Blob([blob])
  }
  if (isUtools && window.services?.writeImageFile) {
    try {
      const base64Url = await blobToBase64(blob)
      const savedPath = window.services.writeImageFile(base64Url)
      if (savedPath) {
        window.utools.shellShowItemInFolder(savedPath)
      }
      return savedPath
    } catch (err) {
      console.error('uTools 保存失败:', err)
      return downloadBlob(blob, fileName)
    }
  } else {
    return downloadBlob(blob, fileName)
  }
}
function downloadBlob (blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return null
}
export async function copyImageToClipboard (blob) {
  if (!(blob instanceof Blob)) {
    blob = new Blob([blob])
  }
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const mimeType = blob.type || 'image/png'
      const clipboardItem = new ClipboardItem({
        [mimeType]: blob
      })
      await navigator.clipboard.write([clipboardItem])
      return true
    }
    return await fallbackCopyImage(blob)
  } catch (err) {
    console.error('复制失败:', err)
    return await fallbackCopyImage(blob)
  }
}
async function fallbackCopyImage (blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(async (canvasBlob) => {
        try {
          if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            const item = new ClipboardItem({ 'image/png': canvasBlob })
            await navigator.clipboard.write([item])
            resolve(true)
          } else {
            resolve(false)
          }
        } catch {
          resolve(false)
        } finally {
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}
