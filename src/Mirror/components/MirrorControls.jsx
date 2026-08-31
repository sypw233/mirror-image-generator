import { useState } from 'react'

const DIRECTIONS = [
  { key: 'left', label: '左对称', icon: '◀' },
  { key: 'right', label: '右对称', icon: '▶' },
  { key: 'top', label: '上对称', icon: '▲' },
  { key: 'bottom', label: '下对称', icon: '▼' }
]

export default function MirrorControls ({ onChange }) {
  const [direction, setDirection] = useState('left')
  const [ratio, setRatio] = useState(50)
  const [keepOriginalSize, setKeepOriginalSize] = useState(false)

  const emitChange = (dir, r, keep) => {
    onChange({ direction: dir, ratio: r, keepOriginalSize: keep })
  }

  const handleDirection = (dir) => {
    setDirection(dir)
    emitChange(dir, ratio, keepOriginalSize)
  }

  const handleRatio = (e) => {
    const r = Number(e.target.value)
    setRatio(r)
    emitChange(direction, r, keepOriginalSize)
  }

  const handleKeepSize = (e) => {
    const keep = e.target.checked
    setKeepOriginalSize(keep)
    emitChange(direction, ratio, keep)
  }

  return (
    <div className="mirror-controls">
      <div className="mirror-control-group">
        <label className="mirror-control-label">镜像方向</label>
        <div className="mirror-direction-btns">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              className={`mirror-dir-btn ${direction === d.key ? 'active' : ''}`}
              onClick={() => handleDirection(d.key)}
              title={d.label}
            >
              <span className="mirror-dir-icon">{d.icon}</span>
              <span className="mirror-dir-label">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mirror-control-group">
        <label className="mirror-control-label">
          镜像比例
          <span className="mirror-ratio-value">{ratio}%</span>
        </label>
        <div className="mirror-slider-wrap">
          <span className="mirror-slider-min">0%</span>
          <input
            type="range"
            className="mirror-slider"
            min="1"
            max="100"
            value={ratio}
            onChange={handleRatio}
          />
          <span className="mirror-slider-max">100%</span>
        </div>
      </div>

      <div className="mirror-control-group mirror-control-row">
        <label className="mirror-checkbox">
          <input
            type="checkbox"
            checked={keepOriginalSize}
            onChange={handleKeepSize}
          />
          <span>保持原图尺寸</span>
        </label>
      </div>
    </div>
  )
}
