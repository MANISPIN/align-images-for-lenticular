# 実装仕様書

## 1. プロジェクト構成

### 1.1 ファイル構造
```
ImageAlign1/
├── public/
│   ├── opencv.js          # OpenCV.jsライブラリ
│   ├── opencv_js.js       # OpenCV.js WebAssembly
│   ├── loader.js          # OpenCV.jsローダー
│   └── vite.svg           # Viteアイコン
├── src/
│   ├── components/
│   │   ├── ImageUploader.tsx      # 画像アップロード機能
│   │   ├── ImageCanvas.tsx        # 画像表示と領域選択
│   │   ├── AlignmentControls.tsx  # 変形制御と整列ボタン
│   │   └── TextureAtlasDialog.tsx # TextureAtlas設定ダイアログ
│   ├── utils/
│   │   ├── imageAlignment.ts      # OpenCV.jsによる整列処理
│   │   ├── imageTransform.ts      # アフィン変換計算
│   │   ├── imageExport.ts         # 画像出力機能
│   │   └── textureAtlas.ts       # TextureAtlas生成
│   ├── App.tsx                    # メインアプリケーション
│   ├── App.css                    # スタイルシート
│   ├── main.tsx                   # エントリーポイント
│   └── index.css                  # グローバルスタイル
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

### 1.2 依存関係
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

## 2. コンポーネント実装

### 2.1 App.tsx (メインコンポーネント)

#### 状態管理
```typescript
interface ImageData {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
}

// 主要な状態
const [images, setImages] = useState<ImageData[]>([])
const [originalImages, setOriginalImages] = useState<ImageData[]>([])
const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
const [alignmentMode, setAlignmentMode] = useState<'area' | 'transform'>('area')
const [forceUpdate, setForceUpdate] = useState(0)
const [isAligning, setIsAligning] = useState(false)
const [isExporting, setIsExporting] = useState(false)
const [isTextureAtlasDialogOpen, setIsTextureAtlasDialogOpen] = useState(false)
```

#### 主要な関数
```typescript
// 画像アップロード処理
const handleImageUpload = useCallback(async (files: FileList) => {
  // ファイル名から番号を抽出してソート
  const fileArray = Array.from(files)
  fileArray.sort((a, b) => {
    const numA = extractNumberFromFileName(a.name)
    const numB = extractNumberFromFileName(b.name)
    return numA - numB
  })
  
  // 画像データを作成
  const newImages: ImageData[] = []
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i]
    const dimensions = await getImageDimensions(file)
    const maxScale = calculateMaxScale(dimensions.width, dimensions.height)
    
    newImages.push({
      id: `image-${Date.now()}-${i}`,
      file,
      url: URL.createObjectURL(file),
      width: dimensions.width,
      height: dimensions.height,
      selectedArea: null,
      transform: { scale: 1.0, rotation: 0, translateX: 0, translateY: 0 }
    })
  }
  
  setImages(prev => [...prev, ...newImages])
  setOriginalImages(prev => [...prev, ...newImages])
}, [getImageDimensions])

// 自動整列処理
const handleAutoAlign = useCallback(async () => {
  if (images.length < 2) {
    alert('整列には少なくとも2つの画像が必要です')
    return
  }
  
  const imagesWithoutArea = images.filter(img => !img.selectedArea)
  if (imagesWithoutArea.length > 0) {
    alert('すべての画像に選択領域を設定してください')
    return
  }
  
  setIsAligning(true)
  try {
    const alignedImages = await alignAllImages(images as AlignmentImageData[])
    setImages(alignedImages as ImageData[])
    setForceUpdate(prev => prev + 1)
    alert('画像の整列が完了しました')
  } catch (error) {
    alert('整列処理でエラーが発生しました: ' + error.message)
  } finally {
    setIsAligning(false)
  }
}, [images, forceUpdate])

// 画像出力処理
const handleExportImages = useCallback(async () => {
  if (images.length === 0) {
    alert('出力する画像がありません')
    return
  }
  
  setIsExporting(true)
  try {
    await exportImagesAsZip(images)
    alert('画像の出力が完了しました')
  } catch (error) {
    alert('画像出力処理でエラーが発生しました: ' + error.message)
  } finally {
    setIsExporting(false)
  }
}, [images])

// TextureAtlas出力処理
const handleTextureAtlasExport = useCallback(async (outputSize: number, gridSize: string) => {
  if (images.length === 0) {
    alert('出力する画像がありません')
    return
  }
  
  setIsExporting(true)
  try {
    await downloadTextureAtlas(images, outputSize, gridSize)
    alert('TextureAtlasの出力が完了しました')
  } catch (error) {
    alert('TextureAtlas出力処理でエラーが発生しました: ' + error.message)
  } finally {
    setIsExporting(false)
  }
}, [images])
```

### 2.2 ImageUploader.tsx

#### ドラッグ&ドロップ機能
```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  const files = e.dataTransfer.files
  if (files.length > 0) {
    onImageUpload(files)
  }
}, [onImageUpload])

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault()
}, [])

const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  if (files && files.length > 0) {
    onImageUpload(files)
  }
}, [onImageUpload])
```

### 2.3 ImageCanvas.tsx

#### 変換パラメータ方式での描画
```typescript
const drawSelectedImage = useCallback(() => {
  const ctx = getCanvasContext()
  const canvas = canvasRef.current
  if (!ctx || !canvas || !selectedImage) return
  
  // 元画像を読み込み
  const img = new Image()
  img.onload = () => {
    ctx.save()
    
    // 変換パラメータをCanvasの座標変換で適用
    ctx.translate(width / 2 + selectedImage.transform.translateX, 
                  height / 2 + selectedImage.transform.translateY)
    ctx.rotate(selectedImage.transform.rotation * Math.PI / 180)
    ctx.scale(selectedImage.transform.scale, selectedImage.transform.scale)
    
    // 元画像を描画
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }
  img.src = selectedImage.url // 元画像のみを使用
}, [selectedImage, width, height])
```

#### 領域選択機能
```typescript
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  if (alignmentMode !== 'area') return
  
  const rect = canvasRef.current?.getBoundingClientRect()
  if (!rect) return
  
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  setSelectionStart({ x, y })
  setIsSelecting(true)
}, [alignmentMode])

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (!isSelecting || !selectionStart) return
  
  const rect = canvasRef.current?.getBoundingClientRect()
  if (!rect) return
  
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  setSelectionEnd({ x, y })
}, [isSelecting, selectionStart])

const handleMouseUp = useCallback(() => {
  if (!isSelecting || !selectionStart || !selectionEnd) return
  
  const area = calculateSelectionArea(selectionStart, selectionEnd)
  if (area && selectedImage) {
    onAreaSelect(selectedImage.id, area)
  }
  
  setIsSelecting(false)
  setSelectionStart(null)
  setSelectionEnd(null)
}, [isSelecting, selectionStart, selectionEnd, selectedImage, onAreaSelect])
```

### 2.4 AlignmentControls.tsx

#### 2列レイアウト
```typescript
return (
  <div className="alignment-controls">
    <h3>画像変形制御</h3>
    
    <div className="controls-layout">
      <div className="left-panel">
        {/* モード選択とボタン群 */}
        <div className="mode-selector">
          <label>
            <input type="radio" name="alignmentMode" value="area" 
                   checked={alignmentMode === 'area'} 
                   onChange={() => onAlignmentModeChange('area')} />
            領域選択モード
          </label>
          <label>
            <input type="radio" name="alignmentMode" value="transform" 
                   checked={alignmentMode === 'transform'} 
                   onChange={() => onAlignmentModeChange('transform')} />
            変形モード
          </label>
        </div>
        
        <div className="control-buttons">
          <button onClick={handleReset} className="reset-btn">変形リセット</button>
          <button onClick={onResetImages} className="reset-all-btn">処理リセット</button>
          <button onClick={onAutoAlign} className="align-btn" disabled={isAligning}>
            {isAligning ? '整列中...' : '自動整列'}
          </button>
          <button onClick={onAlignByArea} className="align-btn" disabled={isAligning}>
            {isAligning ? '処理中...' : '上下合わせ'}
          </button>
          <button onClick={onAlignByRotation} className="align-btn" disabled={isAligning}>
            {isAligning ? '処理中...' : '回転調整'}
          </button>
          <button onClick={onExportImages} className="export-btn" disabled={isExporting}>
            {isExporting ? '出力中...' : '画像出力'}
          </button>
          <button onClick={onDownloadCurrentImage} className="download-btn" disabled={isExporting}>
            {isExporting ? 'ダウンロード中...' : '現在画像ダウンロード'}
          </button>
          <button onClick={onTextureAtlasExport} className="texture-atlas-btn" disabled={isExporting}>
            {isExporting ? '出力中...' : 'TextureAtlas出力'}
          </button>
        </div>
      </div>
      
      <div className="right-panel">
        {/* スライダー群 */}
        <div className="transform-controls">
          <div className="control-group rotation-group">
            <label>回転: {image.transform.rotation.toFixed(1)}°</label>
            <input type="range" min="-180" max="180" step="0.1" 
                   value={image.transform.rotation} onChange={handleRotationChange} />
            <input type="number" min="-180" max="180" step="0.1" 
                   value={rotationInput} onChange={handleRotationInputChange} />
          </div>
          
          <div className="control-group">
            <label>X位置: {image.transform.translateX.toFixed(0)}px</label>
            <input type="range" min="-400" max="400" step="1" 
                   value={image.transform.translateX} onChange={handleTranslateXChange} />
          </div>
          
          <div className="control-group">
            <label>Y位置: {image.transform.translateY.toFixed(0)}px</label>
            <input type="range" min="-300" max="300" step="1" 
                   value={image.transform.translateY} onChange={handleTranslateYChange} />
          </div>
          
          <div className="control-group">
            <label>スケール: {image.transform.scale.toFixed(2)}</label>
            <input type="range" min="0.1" max="3" step="0.1" 
                   value={image.transform.scale} onChange={handleScaleChange} />
          </div>
        </div>
      </div>
    </div>
  </div>
)
```

#### 回転テキスト入力
```typescript
const [rotationInput, setRotationInput] = useState<string | number>(image.transform.rotation)

React.useEffect(() => {
  setRotationInput(image.transform.rotation)
}, [image.transform.rotation])

const handleRotationInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
  const value = event.target.value
  setRotationInput(value)
  if (value === "") return // 空文字は一時的に許容
  if (isNaN(parseFloat(value))) return
  const rotation = parseFloat(value)
  const clampedRotation = Math.max(-180, Math.min(180, rotation))
  onTransformChange({ ...image.transform, rotation: clampedRotation })
}, [image.transform, onTransformChange])
```

### 2.5 TextureAtlasDialog.tsx

#### ダイアログ実装
```typescript
const TextureAtlasDialog: React.FC<TextureAtlasDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  imageCount
}) => {
  const [outputSize, setOutputSize] = useState<number>(2048)
  const [gridSize, setGridSize] = useState<string>('4x4')
  
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
            <select value={outputSize} onChange={(e) => setOutputSize(Number(e.target.value))}>
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
            <select value={gridSize} onChange={(e) => setGridSize(e.target.value)}>
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
          <button onClick={onClose} className="cancel-btn">キャンセル</button>
          <button onClick={() => onConfirm(outputSize, gridSize)} className="confirm-btn">出力開始</button>
        </div>
      </div>
    </div>
  )
}
```

## 3. ユーティリティ実装

### 3.1 imageAlignment.ts

#### ORB特徴点抽出
```typescript
export function extractORBFeatures(mat: any): { keypoints: any; descriptors: any } {
  try {
    // OpenCV.jsのバージョンに応じてORBを初期化
    let orb
    const initMethods = [
      () => new window.cv.ORB(1000, 1.2, 8, 31, 0, 2),
      () => new window.cv.ORB(1000, 1.2, 8, 31),
      () => new window.cv.ORB(),
      () => new window.cv.ORB(500, 1.2, 8, 31, 0, 2, 0, 31, 20)
    ]
    
    let lastError = null
    for (let i = 0; i < initMethods.length; i++) {
      try {
        orb = initMethods[i]()
        break
      } catch (error) {
        lastError = error
        if (i === initMethods.length - 1) {
          throw lastError
        }
      }
    }
    
    const keypoints = new window.cv.KeyPointVector()
    const descriptors = new window.cv.Mat()
    
    orb.detectAndCompute(mat, new window.cv.Mat(), keypoints, descriptors)
    
    return { keypoints, descriptors }
  } catch (error) {
    console.error('ORB特徴点抽出でエラーが発生:', error)
    throw error
  }
}
```

#### 特徴点マッチング
```typescript
export function matchFeatures(descriptors1: any, descriptors2: any): any[] {
  const matcher = new window.cv.BFMatcher(window.cv.NORM_HAMMING, true)
  const matches = new window.cv.DMatchVector()
  
  matcher.match(descriptors1, descriptors2, matches)
  
  // マッチング結果を配列に変換
  const matchesArray: any[] = []
  for (let i = 0; i < matches.size(); i++) {
    matchesArray.push(matches.get(i))
  }
  
  if (matchesArray.length === 0) {
    return []
  }
  
  // 距離の統計を計算
  const distances = matchesArray.map(m => m.distance).sort((a, b) => a - b)
  const minDistance = distances[0]
  const maxDistance = distances[distances.length - 1]
  const medianDistance = distances[Math.floor(distances.length / 2)]
  
  // 距離フィルタリング
  const distanceThreshold = Math.min(50, medianDistance * 0.8)
  let goodMatches = matchesArray.filter(match => match.distance < distanceThreshold)
  
  // 外れ値除去
  if (goodMatches.length > 0) {
    const matchDistances = goodMatches.map(m => m.distance)
    const meanDist = matchDistances.reduce((sum, d) => sum + d, 0) / matchDistances.length
    const stdDist = Math.sqrt(matchDistances.reduce((sum, d) => sum + Math.pow(d - meanDist, 2), 0) / matchDistances.length)
    const outlierThreshold = meanDist + 2 * stdDist
    goodMatches = goodMatches.filter(match => match.distance < outlierThreshold)
  }
  
  return goodMatches
}
```

#### 最適化計算
```typescript
export function calculateOptimalRotation(
  keypoints1: any,
  keypoints2: any,
  matches: any[],
  currentRotation: number,
  selectedAreaCenter?: { x: number; y: number }
): { rotation: number; translateY: number } {
  if (matches.length < 3) {
    console.log('マッチした特徴点が不足しています')
    return { rotation: currentRotation, translateY: 0 }
  }
  
  // マッチした特徴点の座標を取得
  const points1: { x: number; y: number }[] = []
  const points2: { x: number; y: number }[] = []
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const kp1 = keypoints1.get(match.queryIdx)
    const kp2 = keypoints2.get(match.trainIdx)
    points1.push({ x: kp1.pt.x, y: kp1.pt.y })
    points2.push({ x: kp2.pt.x, y: kp2.pt.y })
  }
  
  // 選択領域の中心を回転の中心として使用
  const rotationCenter = selectedAreaCenter || { x: 0, y: 0 }
  
  let bestRotation = currentRotation
  let minTotalDistance = Infinity
  
  // 回転角の範囲を限定して最適化
  for (let angle = -30; angle <= 30; angle += 0.5) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    
    let totalDistance = 0
    
    // 選択領域の中心を基準とした回転を適用
    for (let i = 0; i < points1.length; i++) {
      const p1 = points1[i]
      const p2 = points2[i]
      
      // 選択領域の中心を基準とした座標変換
      const relativeX = p2.x - rotationCenter.x
      const relativeY = p2.y - rotationCenter.y
      
      // 回転を適用
      const rotatedX = relativeX * cos - relativeY * sin
      const rotatedY = relativeX * sin + relativeY * cos
      
      // 回転後の絶対座標
      const finalX = rotatedX + rotationCenter.x
      const finalY = rotatedY + rotationCenter.y
      
      // 距離を計算
      const distance = Math.sqrt(Math.pow(p1.x - finalX, 2) + Math.pow(p1.y - finalY, 2))
      totalDistance += distance
    }
    
    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance
      bestRotation = angle
    }
  }
  
  return { rotation: bestRotation, translateY: 0 }
}
```

### 3.2 imageExport.ts

#### 画像変換適用
```typescript
export async function applyTransformToImage(
  imageUrl: string,
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        // 変換後の画像サイズを計算
        const { width, height } = calculateTransformedSize(img.width, img.height, transform)
        
        // Canvasを作成
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context could not be created'))
          return
        }
        
        // 背景を透明にする
        ctx.clearRect(0, 0, width, height)
        
        // 変換を適用
        ctx.save()
        ctx.translate(width / 2 + transform.translateX, height / 2 + transform.translateY)
        ctx.rotate(transform.rotation * Math.PI / 180)
        ctx.scale(transform.scale, transform.scale)
        
        // 画像を描画
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        ctx.restore()
        
        // Blobに変換
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        }, 'image/png')
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    img.src = imageUrl
  })
}
```

#### 一括画像出力
```typescript
export async function exportImagesAsZip(
  images: Array<{
    id: string
    file: File
    transform: { scale: number; rotation: number; translateX: number; translateY: number }
  }>
): Promise<void> {
  try {
    const zip = new JSZip()
    
    // 各画像を処理
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      try {
        // 変換パラメータを適用した画像を生成
        const blob = await applyTransformToImage(URL.createObjectURL(image.file), image.transform)
        
        // ファイル名を生成
        const originalName = image.file.name
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
        const ext = originalName.match(/\.[^/.]+$/)?.[0] || '.png'
        const fileName = `${nameWithoutExt}_transformed_${i + 1}${ext}`
        
        // Zipに追加
        zip.file(fileName, blob)
        
        console.log(`画像 ${i + 1}/${images.length} を処理しました: ${fileName}`)
      } catch (error) {
        console.error(`画像 ${i + 1} の処理でエラーが発生しました:`, error)
      }
    }
    
    // Zipファイルを生成
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    
    // ダウンロード
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transformed_images_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('Zipファイルのダウンロードが完了しました')
  } catch (error) {
    console.error('Zipファイル生成でエラーが発生しました:', error)
    throw error
  }
}
```

### 3.3 textureAtlas.ts

#### 画像処理パイプライン
```typescript
export async function generateTextureAtlas(
  images: Array<{ id: string; file: File; url: string; width: number; height: number }>,
  outputSize: number,
  gridSize: string
): Promise<Blob> {
  try {
    const [rows, cols] = gridSize.split('x').map(Number)
    const requiredCount = rows * cols
    const tileSize = outputSize / rows
    
    console.log('TextureAtlas生成開始:', {
      outputSize,
      gridSize,
      requiredCount,
      tileSize,
      originalImageCount: images.length
    })
    
    // 画像リストを調整
    const adjustedImages = adjustImageList(images, requiredCount)
    console.log('画像リスト調整完了:', {
      adjustedCount: adjustedImages.length
    })
    
    // 各画像を処理
    const processedImages: Blob[] = []
    for (let i = 0; i < adjustedImages.length; i++) {
      const image = adjustedImages[i]
      console.log(`画像 ${i + 1}/${adjustedImages.length} を処理中:`, image.file.name)
      
      // 1. 正方形に切り取り
      const croppedBlob = await cropToSquare(image.url, image.width, image.height)
      
      // 2. 指定サイズにリサイズ
      const resizedBlob = await resizeImage(URL.createObjectURL(croppedBlob), tileSize, tileSize)
      
      processedImages.push(resizedBlob)
    }
    
    // アトラス画像を生成
    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = outputSize
    atlasCanvas.height = outputSize
    
    const atlasCtx = atlasCanvas.getContext('2d')
    if (!atlasCtx) {
      throw new Error('Atlas canvas context could not be created')
    }
    
    // 各タイルを配置
    for (let i = 0; i < processedImages.length; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * tileSize
      const y = row * tileSize
      
      const img = new Image()
      img.src = URL.createObjectURL(processedImages[i])
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          atlasCtx.drawImage(img, x, y, tileSize, tileSize)
          resolve()
        }
        img.onerror = () => reject(new Error('Failed to load processed image'))
      })
    }
    
    // アトラス画像をBlobに変換
    return new Promise<Blob>((resolve, reject) => {
      atlasCanvas.toBlob((blob) => {
        if (blob) {
          console.log('TextureAtlas生成完了')
          resolve(blob)
        } else {
          reject(new Error('Failed to create atlas blob'))
        }
      }, 'image/png')
    })
    
  } catch (error) {
    console.error('TextureAtlas生成でエラーが発生:', error)
    throw error
  }
}
```

## 4. スタイル実装

### 4.1 App.css

#### 2列レイアウト
```css
.controls-layout {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.left-panel {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-buttons button {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f8f9fa;
  cursor: pointer;
  transition: background-color 0.2s;
}

.control-buttons button:hover {
  background: #e9ecef;
}

.control-buttons button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.transform-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.control-group label {
  font-size: 12px;
  font-weight: bold;
  color: #333;
}

.control-group input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
}

.control-group input[type="number"] {
  width: 60px;
  padding: 4px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

.rotation-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rotation-group > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rotation-group label {
  min-width: 80px;
  white-space: nowrap;
}
```

#### ダイアログスタイル
```css
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
}

.dialog-section {
  margin-bottom: 15px;
}

.dialog-section label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.dialog-section select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dialog-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.dialog-info p {
  margin: 5px 0;
  font-size: 14px;
}

.status-match { color: #28a745; }
.status-shortage { color: #dc3545; }
.status-excess { color: #ffc107; }

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.dialog-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.confirm-btn {
  background: #007bff;
  color: white;
}

.cancel-btn:hover { background: #5a6268; }
.confirm-btn:hover { background: #0056b3; }
```

## 5. エラーハンドリング

### 5.1 OpenCV読み込み確認
```typescript
export function checkOpenCVConstants() {
  console.log('=== OpenCV.js定数確認 ===')
  console.log('window.cv:', typeof window.cv)
  console.log('ORB_HARRIS_SCORE:', window.cv.ORB_HARRIS_SCORE)
  console.log('ORB_FAST_SCORE:', window.cv.ORB_FAST_SCORE)
  console.log('NORM_HAMMING:', window.cv.NORM_HAMMING)
  console.log('NORM_HAMMING2:', window.cv.NORM_HAMMING2)
}

export function checkORBConstructor() {
  console.log('=== ORBコンストラクタ確認 ===')
  console.log('window.cv.ORB:', typeof window.cv.ORB)
  
  try {
    const testORB = new window.cv.ORB()
    console.log('ORB() - 成功')
  } catch (error) {
    console.log('ORB() - 失敗:', error instanceof Error ? error.message : String(error))
  }
  
  try {
    const testORB = new window.cv.ORB(500)
    console.log('ORB(500) - 成功')
  } catch (error) {
    console.log('ORB(500) - 失敗:', error instanceof Error ? error.message : String(error))
  }
  
  try {
    const testORB = new window.cv.ORB(500, 1.2)
    console.log('ORB(500, 1.2) - 成功')
  } catch (error) {
    console.log('ORB(500, 1.2) - 失敗:', error instanceof Error ? error.message : String(error))
  }
}
```

### 5.2 入力検証
```typescript
// 画像数の確認
if (images.length < 2) {
  console.log('画像が2枚未満のため処理を中止')
  alert('整列には少なくとも2つの画像が必要です')
  return
}

// 選択領域の確認
const imagesWithoutArea = images.filter(img => !img.selectedArea)
if (imagesWithoutArea.length > 0) {
  console.log('選択領域が設定されていない画像があります:', imagesWithoutArea.map(img => img.id))
  alert('すべての画像に選択領域を設定してください')
  return
}

// OpenCV読み込み確認
if (typeof window !== 'undefined' && !window.cv) {
  console.error('OpenCVが読み込まれていません')
  alert('OpenCVが読み込まれていません。ページを再読み込みしてください。')
  return
}
```

## 6. パフォーマンス最適化

### 6.1 メモリ効率化
- **変換パラメータ方式**: 元画像1枚分のメモリのみ使用
- **動的描画**: Canvasの座標変換でリアルタイムに変換を適用
- **ガベージコレクション**: 不要な画像データの生成を回避

### 6.2 処理速度最適化
- **ORB特徴点**: 高速な特徴点抽出
- **BFMatcher**: 効率的な特徴点マッチング
- **最適化計算**: 回転角の範囲を限定（-30度～30度）
- **並列処理**: 画像処理の並列実行

### 6.3 推奨仕様
- **画像サイズ**: 最大2048x2048px
- **同時処理画像数**: 10枚程度まで
- **処理時間**: 画像サイズと枚数に依存（数秒～数十秒）
- **メモリ使用量**: 元画像1枚分 + 変換パラメータ

## 7. セキュリティ

### 7.1 ファイル処理
- **ローカル処理**: 画像データはブラウザ内でのみ処理
- **外部送信なし**: 画像データを外部サーバーに送信しない
- **一時ファイル**: 処理完了後に自動的にメモリから削除

### 7.2 入力検証
- **ファイル形式**: 画像ファイルのみ受け付け
- **ファイルサイズ**: ブラウザの制限内で処理
- **悪意のあるファイル**: ブラウザの標準的な保護機能を利用

## 8. ブラウザ対応

### 8.1 必須機能
- **Canvas API**: 画像描画と変換
- **File API**: ファイルアップロード
- **WebAssembly**: OpenCV.jsの実行
- **Blob API**: ファイルダウンロード

### 8.2 対応ブラウザ
- **Chrome**: 最新版
- **Firefox**: 最新版
- **Safari**: 最新版
- **Edge**: 最新版

## 9. 開発・デバッグ

### 9.1 ログ出力
```typescript
console.log('=== 自動整列処理開始 ===')
console.log('処理前の画像:', images.map(img => ({
  id: img.id,
  transform: img.transform
})))

console.log('=== 整列処理完了 ===')
console.log('整列後の画像:', alignedImages.map(img => ({
  id: img.id,
  transform: img.transform
})))

console.log('=== 状態更新完了 ===')
console.log('強制更新カウンター:', forceUpdate + 1)
```

### 9.2 エラー処理
```typescript
try {
  const alignedImages = await alignAllImages(images as AlignmentImageData[])
  setImages(alignedImages as ImageData[])
  setForceUpdate(prev => prev + 1)
  alert('画像の整列が完了しました')
} catch (error) {
  console.error('整列処理でエラーが発生しました:', error)
  alert('整列処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
}
```

### 9.3 開発ツール
- **Vite**: 高速な開発サーバー
- **TypeScript**: 型安全性の確保
- **ESLint**: コード品質の維持
- **Hot Reload**: リアルタイムでの変更反映 