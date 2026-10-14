import { useEffect, useRef, useState } from 'react'

// Ritaglio 4:5: l'immagine copre sempre la cornice; trascina per spostarla, slider per lo zoom.
const FRAME_W = 300
const FRAME_H = 375
const OUT_W = 1080
const OUT_H = 1350

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export default function ImageCropper({ file, onCancel, onDone }) {
  const [img, setImg] = useState(null)
  const [url, setUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const drag = useRef(null)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      const base = Math.max(FRAME_W / image.naturalWidth, FRAME_H / image.naturalHeight)
      const w = image.naturalWidth * base
      const h = image.naturalHeight * base
      setZoom(1)
      setPos({ x: (FRAME_W - w) / 2, y: (FRAME_H - h) / 2 })
    }
    image.onerror = () => setError('Immagine non leggibile.')
    image.src = next
    return () => URL.revokeObjectURL(next)
  }, [file])

  const base = img ? Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight) : 1
  const scale = base * zoom
  const width = img ? img.naturalWidth * scale : FRAME_W
  const height = img ? img.naturalHeight * scale : FRAME_H

  function fit(next, w = width, h = height) {
    return { x: clamp(next.x, FRAME_W - w, 0), y: clamp(next.y, FRAME_H - h, 0) }
  }

  function changeZoom(value) {
    if (!img) return
    const nextScale = base * value
    const w = img.naturalWidth * nextScale
    const h = img.naturalHeight * nextScale
    const cx = (FRAME_W / 2 - pos.x) / scale
    const cy = (FRAME_H / 2 - pos.y) / scale
    setZoom(value)
    setPos(fit({ x: FRAME_W / 2 - cx * nextScale, y: FRAME_H / 2 - cy * nextScale }, w, h))
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: pos }
  }

  function onPointerMove(event) {
    if (!drag.current) return
    const { x, y, start } = drag.current
    setPos(fit({ x: start.x + event.clientX - x, y: start.y + event.clientY - y }))
  }

  function onPointerUp() {
    drag.current = null
  }

  function onKeyDown(event) {
    const step = event.shiftKey ? 20 : 6
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setPos((prev) => fit({ x: prev.x + move[0], y: prev.y + move[1] }))
  }

  async function confirm() {
    if (!img) return
    setBusy(true)
    setError('')
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    const k = OUT_W / FRAME_W
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, pos.x * k, pos.y * k, width * k, height * k)
    let blob = await toBlob(canvas, 'image/webp', 0.86)
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.88)
    setBusy(false)
    if (!blob) {
      setError('Impossibile preparare l’immagine.')
      return
    }
    onDone(blob)
  }

  return (
    <div className="crop">
      <div
        className="crop-frame"
        style={{ width: FRAME_W, height: FRAME_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="application"
        aria-label="Trascina o usa le frecce per centrare la locandina"
      >
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            style={{ width, height, transform: `translate(${pos.x}px, ${pos.y}px)` }}
          />
        ) : null}
        <span className="crop-grid" aria-hidden="true" />
      </div>
      <label className="admin-field crop-zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value))}
          disabled={!img}
        />
      </label>
      <p className="admin-hint">Formato 4:5. Trascina l’immagine per scegliere l’inquadratura.</p>
      {error ? <p className="book-error">{error}</p> : null}
      <div className="edit-actions">
        <button type="button" className="btn-save" onClick={confirm} disabled={!img || busy}>
          {busy ? 'Preparazione…' : 'Usa questa inquadratura'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Annulla
        </button>
      </div>
    </div>
  )
}
