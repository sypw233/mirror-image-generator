/* global localStorage */
import { useState } from 'react'
const DIRECTIONS = [
  { key: 'left', label: '左对称', icon: '◀' },
  { key: 'right', label: '右对称', icon: '▶' },
  { key: 'top', label: '上对称', icon: '▲' },
  { key: 'bottom', label: '下对称', icon: '▼' },
  { key: 'tl', label: '左上对称', icon: '↖' },
  { key: 'br', label: '右下对称', icon: '↘' }
]
const RATIO_PRESETS = [25, 50, 75, 100]
const QUALITY_OPTIONS = [
  { key: 'high', label: '高质量', hint: '256 色' },
  { key: 'standard', label: '标准', hint: '128 色' },
  { key: 'low', label: '小体积', hint: '64 色' }
]
const MAX_EDGE_OPTIONS = [
  { value: 0, label: '不限' },
  { value: 4096, label: '4096' },
  { value: 2048, label: '2048' },
  { value: 1024, label: '1024' }
]
const STORAGE_KEY = 'mirror.settings'
/** 从 localStorage 恢复上次设置；解析失败或字段非法时回退默认值 */
function loadSettings () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return {
      direction: DIRECTIONS.some((d) => d.key === s.direction) ? s.direction : 'left',
      ratio: Math.min(100, Math.max(1, Number(s.ratio) || 50)),
      keepOriginalSize: !!s.keepOriginalSize,
      quality: QUALITY_OPTIONS.some((q) => q.key === s.quality) ? s.quality : 'high',
      maxEdge: MAX_EDGE_OPTIONS.some((m) => m.value === Number(s.maxEdge)) ? Number(s.maxEdge) : 0
    }
  } catch (err) {
    return null
  }
}
function saveSettings (direction, ratio, keepOriginalSize, quality, maxEdge) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ direction, ratio, keepOriginalSize, quality, maxEdge }))
  } catch (err) {
    // 隐私模式等环境下 localStorage 不可用，忽略即可
  }
}
export default function MirrorControls ({ onChange, disabled = false, showQuality = false }) {
  const saved = loadSettings()
  const [direction, setDirection] = useState(saved?.direction || 'left')
  const [ratio, setRatio] = useState(saved?.ratio || 50)
  const [keepOriginalSize, setKeepOriginalSize] = useState(saved?.keepOriginalSize || false)
  const [quality, setQuality] = useState(saved?.quality || 'high')
  const [maxEdge, setMaxEdge] = useState(saved?.maxEdge || 0)
  const emitChange = (dir, r, keep, q, m) => {
    saveSettings(dir, r, keep, q, m)
    onChange({ direction: dir, ratio: r, keepOriginalSize: keep, quality: q, maxEdge: m })
  }
  const handleDirection = (dir) => {
    setDirection(dir)
    emitChange(dir, ratio, keepOriginalSize, quality, maxEdge)
  }
  const handleRatio = (r) => {
    const value = Math.min(100, Math.max(1, r))
    setRatio(value)
    emitChange(direction, value, keepOriginalSize, quality, maxEdge)
  }
  const handleKeepSize = (e) => {
    const keep = e.target.checked
    setKeepOriginalSize(keep)
    emitChange(direction, ratio, keep, quality, maxEdge)
  }
  const handleQuality = (q) => {
    setQuality(q)
    emitChange(direction, ratio, keepOriginalSize, q, maxEdge)
  }
  const handleMaxEdge = (m) => {
    setMaxEdge(m)
    emitChange(direction, ratio, keepOriginalSize, quality, m)
  }
  return (
    <div className='mirror-controls'>
      <div className='mirror-control-group'>
        <label className='mirror-control-label'>镜像方向</label>
        <div className='mirror-direction-btns'>
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              className={`mirror-dir-btn ${direction === d.key ? 'active' : ''}`}
              onClick={() => handleDirection(d.key)}
              title={d.label}
              disabled={disabled}
            >
              <span className='mirror-dir-icon'>{d.icon}</span>
              <span className='mirror-dir-label'>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className='mirror-control-group'>
        <label className='mirror-control-label'>
          镜像比例
          <span className='mirror-ratio-value'>{ratio}%</span>
        </label>
        <div className='mirror-slider-wrap'>
          <span className='mirror-slider-min'>1%</span>
          <input
            type='range'
            className='mirror-slider'
            min='1'
            max='100'
            value={ratio}
            onChange={(e) => handleRatio(Number(e.target.value))}
            disabled={disabled}
          />
          <span className='mirror-slider-max'>100%</span>
        </div>
        <div className='mirror-presets'>
          {RATIO_PRESETS.map((v) => (
            <button
              key={v}
              className={`mirror-preset-btn ${ratio === v ? 'active' : ''}`}
              onClick={() => handleRatio(v)}
              disabled={disabled}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>
      {showQuality && (
        <div className='mirror-control-group mirror-quality-group'>
          <label className='mirror-control-label'>GIF 输出质量</label>
          <div className='mirror-presets'>
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.key}
                className={`mirror-preset-btn ${quality === q.key ? 'active' : ''}`}
                onClick={() => handleQuality(q.key)}
                disabled={disabled}
                title={q.hint}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className='mirror-control-group mirror-control-row mirror-quality-group'>
        <label className='mirror-control-label'>导出长边上限</label>
        <div className='mirror-presets'>
          {MAX_EDGE_OPTIONS.map((m) => (
            <button
              key={m.value}
              className={`mirror-preset-btn ${maxEdge === m.value ? 'active' : ''}`}
              onClick={() => handleMaxEdge(m.value)}
              disabled={disabled}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className='mirror-control-group mirror-control-row'>
        <label className='mirror-checkbox'>
          <input
            type='checkbox'
            checked={keepOriginalSize}
            onChange={handleKeepSize}
            disabled={disabled}
          />
          <span>保持原图尺寸</span>
        </label>
      </div>
    </div>
  )
}
