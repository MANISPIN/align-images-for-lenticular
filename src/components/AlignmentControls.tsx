import React, { useCallback } from 'react'

interface ImageData {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
}

interface AlignmentControlsProps {
  image: ImageData
  onTransformChange: (transform: { scale: number; rotation: number; translateX: number; translateY: number }) => void
  alignmentMode: 'area' | 'transform'
  onAlignmentModeChange: (mode: 'area' | 'transform') => void
  onAutoAlign?: () => void
  onAlignByArea?: () => void
  onAlignByRotation?: () => void
  onResetImages?: () => void
  onExportImages?: () => void
  onDownloadCurrentImage?: () => void
  onTextureAtlasExport?: () => void
  isAligning?: boolean
  isExporting?: boolean
}

const AlignmentControls: React.FC<AlignmentControlsProps> = ({
  image,
  onTransformChange,
  alignmentMode,
  onAlignmentModeChange,
  onAutoAlign,
  onAlignByArea,
  onAlignByRotation,
  onResetImages,
  onExportImages,
  onDownloadCurrentImage,
  onTextureAtlasExport,
  isAligning = false,
  isExporting = false
}) => {
  const handleScaleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const scale = parseFloat(event.target.value)
    onTransformChange({
      ...image.transform,
      scale
    })
  }, [image.transform, onTransformChange])

  // 回転値の入力用stateを追加
  const [rotationInput, setRotationInput] = React.useState<string | number>(image.transform.rotation)

  React.useEffect(() => {
    setRotationInput(image.transform.rotation)
  }, [image.transform.rotation])

  const handleRotationChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rotation = parseFloat(event.target.value)
    setRotationInput(event.target.value)
    onTransformChange({
      ...image.transform,
      rotation
    })
  }, [image.transform, onTransformChange])

  const handleRotationInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setRotationInput(value)
    if (value === "") {
      // 空文字は一時的に許容
      return
    }
    if (isNaN(parseFloat(value))) return
    const rotation = parseFloat(value)
    const clampedRotation = Math.max(-180, Math.min(180, rotation))
    onTransformChange({
      ...image.transform,
      rotation: clampedRotation
    })
  }, [image.transform, onTransformChange])

  const handleTranslateXChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const translateX = parseFloat(event.target.value)
    onTransformChange({
      ...image.transform,
      translateX
    })
  }, [image.transform, onTransformChange])

  const handleTranslateYChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const translateY = parseFloat(event.target.value)
    onTransformChange({
      ...image.transform,
      translateY
    })
  }, [image.transform, onTransformChange])

  const handleReset = useCallback(() => {
    onTransformChange({
      scale: 1,
      rotation: 0,
      translateX: 0,
      translateY: 0
    })
  }, [onTransformChange])

  return (
    <div className="alignment-controls">
      <h3>画像変形制御</h3>
      
      <div className="controls-layout">
        <div className="left-panel">
          <div className="mode-selector">
            <label>
              <input
                type="radio"
                name="alignmentMode"
                value="area"
                checked={alignmentMode === 'area'}
                onChange={() => onAlignmentModeChange('area')}
              />
              領域選択モード
            </label>
            <label>
              <input
                type="radio"
                name="alignmentMode"
                value="transform"
                checked={alignmentMode === 'transform'}
                onChange={() => onAlignmentModeChange('transform')}
              />
              変形モード
            </label>
          </div>

          <div className="control-buttons">
            <button onClick={handleReset} className="reset-btn">
              変形リセット
            </button>
            {onResetImages && (
              <button 
                onClick={() => {
                  console.log('処理リセットボタンがクリックされました')
                  onResetImages()
                }} 
                className="reset-all-btn"
              >
                処理リセット
              </button>
            )}
            {onAutoAlign && (
              <button 
                onClick={() => {
                  console.log('自動整列ボタンがクリックされました')
                  onAutoAlign()
                }} 
                className="align-btn"
                disabled={isAligning}
              >
                {isAligning ? '整列中...' : '自動整列'}
              </button>
            )}
            {onAlignByArea && (
              <button 
                onClick={() => {
                  console.log('上下合わせボタンがクリックされました')
                  onAlignByArea()
                }} 
                className="align-btn"
                disabled={isAligning}
              >
                {isAligning ? '処理中...' : '上下合わせ'}
              </button>
            )}
            {onAlignByRotation && (
              <button 
                onClick={() => {
                  console.log('回転調整ボタンがクリックされました')
                  onAlignByRotation()
                }} 
                className="align-btn"
                disabled={isAligning}
              >
                {isAligning ? '処理中...' : '回転調整'}
              </button>
            )}
            {onExportImages && (
              <button 
                onClick={() => {
                  console.log('画像出力ボタンがクリックされました')
                  onExportImages()
                }} 
                className="export-btn"
                disabled={isExporting}
              >
                {isExporting ? '出力中...' : '画像出力'}
              </button>
            )}
            {onDownloadCurrentImage && (
              <button 
                onClick={() => {
                  console.log('現在画像ダウンロードボタンがクリックされました')
                  onDownloadCurrentImage()
                }} 
                className="download-btn"
                disabled={isExporting}
              >
                {isExporting ? 'ダウンロード中...' : '現在画像ダウンロード'}
              </button>
            )}
            {onTextureAtlasExport && (
              <button 
                onClick={() => {
                  console.log('TextureAtlas出力ボタンがクリックされました')
                  onTextureAtlasExport()
                }} 
                className="texture-atlas-btn"
                disabled={isExporting}
              >
                {isExporting ? '出力中...' : 'TextureAtlas出力'}
              </button>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div className="transform-controls">
            <div className="control-group rotation-group">
              <label>回転: {image.transform.rotation.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={image.transform.rotation}
                onChange={handleRotationChange}
              />
              <input
                type="number"
                min="-180"
                max="180"
                step="0.1"
                value={rotationInput}
                onChange={handleRotationInputChange}
              />
            </div>

            <div className="control-group">
              <label>X位置: {image.transform.translateX.toFixed(0)}px</label>
              <input
                type="range"
                min="-400"
                max="400"
                step="1"
                value={image.transform.translateX}
                onChange={handleTranslateXChange}
              />
            </div>

            <div className="control-group">
              <label>Y位置: {image.transform.translateY.toFixed(0)}px</label>
              <input
                type="range"
                min="-300"
                max="300"
                step="1"
                value={image.transform.translateY}
                onChange={handleTranslateYChange}
              />
            </div>

            <div className="control-group">
              <label>スケール: {image.transform.scale.toFixed(2)}</label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={image.transform.scale}
                onChange={handleScaleChange}
              />
            </div>
          </div>
        </div>
      </div>

      {image.selectedArea && (
        <div className="selected-area-info">
          <h4>選択された領域</h4>
          <p>X: {image.selectedArea.x.toFixed(0)}</p>
          <p>Y: {image.selectedArea.y.toFixed(0)}</p>
          <p>幅: {image.selectedArea.width.toFixed(0)}</p>
          <p>高さ: {image.selectedArea.height.toFixed(0)}</p>
        </div>
      )}
    </div>
  )
}

export default AlignmentControls 