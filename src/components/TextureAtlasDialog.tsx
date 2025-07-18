import React, { useState } from 'react'

interface TextureAtlasDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (outputSize: number, gridSize: string) => void
  imageCount: number
}

const TextureAtlasDialog: React.FC<TextureAtlasDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  imageCount
}) => {
  const [outputSize, setOutputSize] = useState<number>(2048)
  const [gridSize, setGridSize] = useState<string>('4x4')

  const handleConfirm = () => {
    onConfirm(outputSize, gridSize)
    onClose()
  }

  const getRequiredImageCount = (grid: string) => {
    const [rows, cols] = grid.split('x').map(Number)
    return rows * cols
  }

  const requiredCount = getRequiredImageCount(gridSize)
  const status = 
    requiredCount === imageCount ? '完全一致' :
    requiredCount > imageCount ? `不足 (${requiredCount - imageCount}枚追加必要)` :
    `過多 (${imageCount - requiredCount}枚削除予定)`

  if (!isOpen) return null

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h3>TextureAtlas出力設定</h3>
        
        <div className="dialog-section">
          <label>
            テクスチャの出力サイズ:
            <select 
              value={outputSize} 
              onChange={(e) => setOutputSize(Number(e.target.value))}
            >
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </label>
        </div>

        <div className="dialog-section">
          <label>
            テクスチャの分割数:
            <select 
              value={gridSize} 
              onChange={(e) => setGridSize(e.target.value)}
            >
              <option value="4x4">4x4</option>
              <option value="8x8">8x8</option>
            </select>
          </label>
        </div>

        <div className="dialog-info">
          <p><strong>必要な画像数:</strong> {requiredCount}枚</p>
          <p><strong>現在の画像数:</strong> {imageCount}枚</p>
          <p><strong>状態:</strong> <span className={`status-${status.includes('一致') ? 'match' : status.includes('不足') ? 'shortage' : 'excess'}`}>{status}</span></p>
          <p><strong>各画像のサイズ:</strong> {outputSize / Number(gridSize.split('x')[0])}x{outputSize / Number(gridSize.split('x')[0])}px</p>
        </div>

        <div className="dialog-actions">
          <button onClick={onClose} className="cancel-btn">
            キャンセル
          </button>
          <button onClick={handleConfirm} className="confirm-btn">
            出力開始
          </button>
        </div>
      </div>
    </div>
  )
}

export default TextureAtlasDialog 