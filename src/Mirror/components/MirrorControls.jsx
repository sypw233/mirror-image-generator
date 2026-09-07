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
/** 背景色：null=透明，其余为 #rrggbb；含常用色板 + 自定义取色器 */
const BG_PRESETS = [
  { value: null, label: '透明', cls: 'checker' },
  { value: '#ffffff', label: '白' },
  { value: '#000000', label: '黑' },
  { value: '#f44336', label: '红' },
  { value: '#2196f3', label: '蓝' },
  { value: '#4caf50', label: '绿' },
  { value: '#ffeb3b', label: '黄' }
]
const OUTPUT_FORMATS = [
  { key: 'png', label: 'PNG' },
  { key: 'webp', label: 'WebP' }
]
const GIF_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' }
]
const GIF_REPEATS = [
  { value: 0, label: '无限' },
  { value: 1, label: '1 次' },
  { value: 3, label: '3 次' },
  { value: 5, label: '5 次' }
]
const STORAGE_KEY = 'mirror.settings'
/** 从 localStorage 恢复上次设置；解析失败或字段非法时回退默认值 */
function loadSettings () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    const bg = s.backgroundColor
    const bgOk = bg === null || (typeof bg === 'string' && /^#[0-9a-f]{6}$/i.test(bg))
    return {
      direction: DIRECTIONS.some((d) => d.key === s.direction) ? s.direction : 'left',
      ratio: Math.min(100, Math.max(1, Number(s.ratio) || 50)),
      keepOriginalSize: !!s.keepOriginalSize,
      quality: QUALITY_OPTIONS.some((q) => q.key === s.quality) ? s.quality : 'high',
      maxEdge: MAX_EDGE_OPTIONS.some((m) => m.value === Number(s.maxEdge)) ? Number(s.maxEdge) : 0,
      backgroundColor: bgOk ? bg : null,
      outputFormat: OUTPUT_FORMATS.some((f) => f.key === s.outputFormat) ? s.outputFormat : 'png',
      gifSpeed: [0.5, 1, 2].includes(Number(s.gifSpeed)) ? Number(s.gifSpeed) : 1,
      gifRepeat: [0, 1, 3, 5].includes(Number(s.gifRepeat)) ? Number(s.gifRepeat) : 0
    }
  } catch (err) {
    return null
  }
}
function saveSettings (settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    // 隐私模式等环境下 localStorage 不可用，忽略即可
  }
}
export default function MirrorControls ({ onChange, disabled = false, showQuality = false, showOutputFormat = false, showGifOptions = false }) {
  const saved = loadSettings()
  const [direction, setDirection] = useState(saved?.direction || 'left')
  const [ratio, setRatio] = useState(saved?.ratio || 50)
  const [keepOriginalSize, setKeepOriginalSize] = useState(saved?.keepOriginalSize || false)
  const [quality, setQuality] = useState(saved?.quality || 'high')
  const [maxEdge, setMaxEdge] = useState(saved?.maxEdge || 0)
  const [backgroundColor, setBackgroundColor] = useState(saved?.backgroundColor ?? null)
  const [outputFormat, setOutputFormat] = useState(saved?.outputFormat || 'png')
  const [gifSpeed, setGifSpeed] = useState(saved?.gifSpeed || 1)
  const [gifRepeat, setGifRepeat] = useState(saved?.gifRepeat || 0)
  const collect = (dir, r, keep, q, m, bg, of, gs, gr) => ({
    direction: dir, ratio: r, keepOriginalSize: keep, quality: q, maxEdge: m,
    backgroundColor: bg, outputFormat: of, gifSpeed: gs, gifRepeat: gr
  })
  const emitChange = (next) => {
    saveSettings(next)
    onChange(next)
  }
  const handleDirection = (dir) => {
    setDirection(dir)
    emitChange(collect(dir, ratio, keepOriginalSize, quality, maxEdge, backgroundColor, outputFormat, gifSpeed, gifRepeat))
  }
  const handleRatio = (r) => {
    const value = Math.min(100, Math.max(1, r))
    setRatio(value)
    emitChange(collect(direction, value, keepOriginalSize, quality, maxEdge, backgroundColor, outputFormat, gifSpeed, gifRepeat))
  }
  const handleKeepSize = (e) => {
    const keep = e.target.checked
    setKeepOriginalSize(keep)
    emitChange(collect(direction, ratio, keep, quality, maxEdge, backgroundColor, outputFormat, gifSpeed, gifRepeat))
  }
  const handleQuality = (q) => {
    setQuality(q)
    emitChange(collect(direction, ratio, keepOriginalSize, q, maxEdge, backgroundColor, outputFormat, gifSpeed, gifRepeat))
  }
  const handleMaxEdge = (m) => {
    setMaxEdge(m)
    emitChange(collect(direction, ratio, keepOriginalSize, quality, m, backgroundColor, outputFormat, gifSpeed, gifRepeat))
  }
  const handleBackground = (bg) => {
    setBackgroundColor(bg)
    emitChange(collect(direction, ratio, keepOriginalSize, quality, maxEdge, bg, outputFormat, gifSpeed, gifRepeat))
  }
  const handleOutputFormat = (f) => {
    setOutputFormat(f)
    emitChange(collect(direction, ratio, keepOriginalSize, quality, maxEdge, backgroundColor, f, gifSpeed, gifRepeat))
  }
  const handleGifSpeed = (s) => {
    setGifSpeed(s)
    emitChange(collect(direction, ratio, keepOriginalSize, quality, maxEdge, backgroundColor, outputFormat, s, gifRepeat))
  }
  const handleGifRepeat = (n) => {
    setGifRepeat(n)
    emitChange(collect(direction, ratio, keepOriginalSize, quality, maxEdge, backgroundColor, outputFormat, gifSpeed, n))
  }
  const isCustomBg = backgroundColor !== null && !BG_PRESETS.some((p) => p.value === backgroundColor)
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
      {showGifOptions && (
        <>
          <div className='mirror-control-group mirror-control-row mirror-quality-group'>
            <label className='mirror-control-label'>GIF 速度</label>
            <div className='mirror-presets'>
              {GIF_SPEEDS.map((s) => (
                <button
                  key={s.value}
                  className={`mirror-preset-btn ${gifSpeed === s.value ? 'active' : ''}`}
                  onClick={() => handleGifSpeed(s.value)}
                  disabled={disabled}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className='mirror-control-group mirror-control-row mirror-quality-group'>
            <label className='mirror-control-label'>循环次数</label>
            <div className='mirror-presets'>
              {GIF_REPEATS.map((n) => (
                <button
                  key={n.value}
                  className={`mirror-preset-btn ${gifRepeat === n.value ? 'active' : ''}`}
                  onClick={() => handleGifRepeat(n.value)}
                  disabled={disabled}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {showOutputFormat && (
        <div className='mirror-control-group mirror-control-row mirror-quality-group'>
          <label className='mirror-control-label'>输出格式</label>
          <div className='mirror-presets'>
            {OUTPUT_FORMATS.map((f) => (
              <button
                key={f.key}
                className={`mirror-preset-btn ${outputFormat === f.key ? 'active' : ''}`}
                onClick={() => handleOutputFormat(f.key)}
                disabled={disabled}
              >
                {f.label}
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
      <div className='mirror-control-group mirror-control-row mirror-quality-group'>
        <label className='mirror-control-label'>背景色</label>
        <div className='mirror-bg-options'>
          {BG_PRESETS.map((p) => (
            <button
              key={p.value === null ? 'transparent' : p.value}
              className={`mirror-bg-swatch ${backgroundColor === p.value ? 'active' : ''} ${p.cls || ''}`}
              onClick={() => handleBackground(p.value)}
              disabled={disabled}
              title={p.label}
              aria-label={p.label}
            >
              {p.value === null
                ? <span className='mirror-bg-checker' />
                : <span className='mirror-bg-fill' style={{ background: p.value }} />}
            </button>
          ))}
          <label
            className={`mirror-bg-swatch mirror-bg-custom ${isCustomBg ? 'active' : ''}`}
            title='自定义颜色'
            aria-label='自定义颜色'
          >
            <input
              type='color'
              value={backgroundColor && /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : '#ffffff'}
              onChange={(e) => handleBackground(e.target.value)}
              disabled={disabled}
            />
            <span className='mirror-bg-fill' style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
          </label>
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
