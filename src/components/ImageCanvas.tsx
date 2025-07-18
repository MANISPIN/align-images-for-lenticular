import React, { useRef, useEffect, useState, useCallback } from 'react'

interface ImageData {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
}

interface ImageCanvasProps {
  images: ImageData[]
  selectedImageId: string | null
  onAreaSelect: (imageId: string, area: { x: number; y: number; width: number; height: number }) => void
  onImageSelect: (imageId: string) => void
  alignmentMode: 'area' | 'transform'
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  images,
  selectedImageId,
  onAreaSelect,
  onImageSelect,
  alignmentMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentSelection, setCurrentSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const selectedImage = images.find(img => img.id === selectedImageId)

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const getCanvasRect = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getBoundingClientRect()
  }, [])

  const clearCanvas = useCallback(() => {
    const ctx = getCanvasContext()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [getCanvasContext])

  // 画像と変換パラメータのみで表示
  const drawSelectedImage = useCallback(() => {
    const ctx = getCanvasContext()
    const canvas = canvasRef.current
    if (!ctx || !canvas || !selectedImage) return

    clearCanvas()

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // 表示スケール計算
      const displayScaleX = (canvas.width * 0.9) / img.width
      const displayScaleY = (canvas.height * 0.9) / img.height
      const displayScale = Math.min(displayScaleX, displayScaleY, 1.0)
      const { scale, rotation, translateX, translateY } = selectedImage.transform
      const canvasCenterX = canvas.width / 2
      const canvasCenterY = canvas.height / 2

      ctx.save()
      ctx.translate(canvasCenterX + translateX * displayScale, canvasCenterY + translateY * displayScale)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.scale(scale * displayScale, scale * displayScale)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()

      // 領域選択があれば描画
      if (selectedImage.selectedArea) {
        drawSelectedArea(ctx, img.width, img.height, displayScale)
      }
    }
    img.src = selectedImage.url
  }, [selectedImage, getCanvasContext, clearCanvas])

  // 領域選択の描画（画像変換と同じ座標変換を適用）
  const drawSelectedArea = useCallback((ctx: CanvasRenderingContext2D, imgWidth: number, imgHeight: number, displayScale: number) => {
    if (!selectedImage || !selectedImage.selectedArea) return
    const { scale, rotation, translateX, translateY } = selectedImage.transform
    const area = selectedImage.selectedArea
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasCenterX = canvas.width / 2
    const canvasCenterY = canvas.height / 2

    ctx.save()
    ctx.translate(canvasCenterX + translateX * displayScale, canvasCenterY + translateY * displayScale)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.scale(scale * displayScale, scale * displayScale)
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 2 / (scale * displayScale)
    ctx.setLineDash([5 / (scale * displayScale), 5 / (scale * displayScale)])
    ctx.strokeRect(area.x - imgWidth / 2, area.y - imgHeight / 2, area.width, area.height)
    ctx.setLineDash([])
    // 領域の中心にマーカー
    const centerX = area.x + area.width / 2 - imgWidth / 2
    const centerY = area.y + area.height / 2 - imgHeight / 2
    ctx.fillStyle = '#00ff00'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 3 / (scale * displayScale), 0, 2 * Math.PI)
    ctx.fill()
    ctx.restore()
  }, [selectedImage])

  // 現在の選択範囲を描画（キャンバス座標系でそのまま）
  const drawCurrentSelection = useCallback(() => {
    const ctx = getCanvasContext()
    if (!ctx || !currentSelection) return
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height)
    ctx.setLineDash([])
  }, [currentSelection, getCanvasContext])

  // 領域選択のためのマウス操作
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (alignmentMode !== 'area' || !selectedImageId) return
    const rect = getCanvasRect()
    if (!rect) return
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    setIsDrawing(true)
    setDrawStart({ x, y })
    setCurrentSelection({ x, y, width: 0, height: 0 })
  }, [alignmentMode, selectedImageId, getCanvasRect])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return
    const rect = getCanvasRect()
    if (!rect) return
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const width = x - drawStart.x
    const height = y - drawStart.y
    setCurrentSelection({
      x: width < 0 ? x : drawStart.x,
      y: height < 0 ? y : drawStart.y,
      width: Math.abs(width),
      height: Math.abs(height)
    })
  }, [isDrawing, drawStart, getCanvasRect])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentSelection || !selectedImageId || !selectedImage) return
    // キャンバス座標を画像座標に逆変換
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasCenterX = canvas.width / 2
    const canvasCenterY = canvas.height / 2
    const { scale, rotation, translateX, translateY } = selectedImage.transform
    const displayScaleX = (canvas.width * 0.9) / selectedImage.width
    const displayScaleY = (canvas.height * 0.9) / selectedImage.height
    const displayScale = Math.min(displayScaleX, displayScaleY, 1.0)
    // 逆変換
    const cos = Math.cos(-rotation * Math.PI / 180)
    const sin = Math.sin(-rotation * Math.PI / 180)
    const relativeX = (currentSelection.x - canvasCenterX - translateX * displayScale) / (scale * displayScale)
    const relativeY = (currentSelection.y - canvasCenterY - translateY * displayScale) / (scale * displayScale)
    const rotatedX = relativeX * cos - relativeY * sin
    const rotatedY = relativeX * sin + relativeY * cos
    const imageArea = {
      x: rotatedX + selectedImage.width / 2,
      y: rotatedY + selectedImage.height / 2,
      width: currentSelection.width / (scale * displayScale),
      height: currentSelection.height / (scale * displayScale)
    }
    onAreaSelect(selectedImageId, imageArea)
    setIsDrawing(false)
    setDrawStart(null)
    setCurrentSelection(null)
  }, [isDrawing, currentSelection, selectedImageId, selectedImage, onAreaSelect])

  // 画像と領域を描画
  useEffect(() => {
    if (selectedImage) {
      drawSelectedImage()
    }
  }, [selectedImage, drawSelectedImage])

  // 現在の選択範囲を描画
  useEffect(() => {
    if (currentSelection) {
      drawCurrentSelection()
    }
  }, [currentSelection, drawCurrentSelection])

  // 選択された画像の領域が変更されたときに再描画
  useEffect(() => {
    if (selectedImage && selectedImage.selectedArea) {
      const timer = setTimeout(() => {
        drawSelectedImage()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [selectedImage?.selectedArea, drawSelectedImage])

  if (!selectedImage) {
    return (
      <div className="image-canvas">
        <div className="no-image-selected">
          <div className="no-image-icon">🖼️</div>
          <p>左側の画像をクリックして選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="image-canvas">
      <div className="canvas-header">
        <h3>選択中の画像: {selectedImage.file.name}</h3>
        {selectedImage.selectedArea && (
          <p className="area-info">
            選択領域: ({selectedImage.selectedArea.x.toFixed(0)}, {selectedImage.selectedArea.y.toFixed(0)})
            {selectedImage.selectedArea.width.toFixed(0)}×{selectedImage.selectedArea.height.toFixed(0)}
          </p>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ border: '1px solid #ccc', cursor: alignmentMode === 'area' ? 'crosshair' : 'default' }}
      />
      {alignmentMode === 'area' && selectedImageId && (
        <div className="canvas-info">
          <p>画像上でドラッグして領域を選択してください</p>
        </div>
      )}
    </div>
  )
}

export default ImageCanvas 