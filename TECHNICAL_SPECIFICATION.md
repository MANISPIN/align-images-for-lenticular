# 技術仕様書

## 1. アーキテクチャ概要

### 1.1 システム構成
- **フロントエンド**: React 18 + TypeScript
- **ビルドツール**: Vite
- **画像処理**: OpenCV.js (WebAssembly)
- **UIフレームワーク**: カスタムCSS
- **ファイル処理**: JSZip

### 1.2 データフロー
```
画像アップロード → 画像データ管理 → 領域選択 → 整列処理 → 変換パラメータ適用 → 出力
```

## 2. 画像データ管理方式

### 2.1 変換パラメータ方式
- **元画像保持**: アップロードされた元画像データをそのまま保持
- **変換パラメータ**: 位置、回転、スケールの変換情報のみを管理
- **Canvas描画時適用**: 表示時に変換パラメータをCanvasの座標変換で適用

### 2.2 データ構造
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
```

### 2.3 メモリ効率化
- **変換済み画像データの廃止**: `transformedDataUrl`などの重複データを削除
- **動的描画**: Canvasの座標変換でリアルタイムに変換を適用
- **メモリ使用量削減**: 元画像1枚分のメモリのみ使用

## 3. 画像整列アルゴリズム

### 3.1 ORB特徴点抽出
```typescript
function extractORBFeatures(mat: any): { keypoints: any; descriptors: any } {
  // OpenCV.jsのバージョンに応じてORBを初期化
  const orb = new window.cv.ORB(1000, 1.2, 8, 31, 0, 2)
  const keypoints = new window.cv.KeyPointVector()
  const descriptors = new window.cv.Mat()
  
  orb.detectAndCompute(mat, new window.cv.Mat(), keypoints, descriptors)
  return { keypoints, descriptors }
}
```

### 3.2 特徴点マッチング
```typescript
function matchFeatures(descriptors1: any, descriptors2: any): any[] {
  const matcher = new window.cv.BFMatcher(window.cv.NORM_HAMMING, true)
  const matches = new window.cv.DMatchVector()
  
  matcher.match(descriptors1, descriptors2, matches)
  
  // 距離フィルタリング
  const distanceThreshold = Math.min(50, medianDistance * 0.8)
  const goodMatches = matchesArray.filter(match => match.distance < distanceThreshold)
  
  // 外れ値除去
  const outlierThreshold = meanDist + 2 * stdDist
  return goodMatches.filter(match => match.distance < outlierThreshold)
}
```

### 3.3 最適化計算
```typescript
function calculateOptimalRotation(
  keypoints1: any,
  keypoints2: any,
  matches: any[],
  currentRotation: number
): { rotation: number; translateY: number } {
  // 回転とX移動、Y移動を同時に最適化
  let bestRotation = currentRotation
  let minTotalDistance = Infinity
  
  for (let angle = -30; angle <= 30; angle += 0.5) {
    const totalDistance = calculateTotalDistance(keypoints1, keypoints2, matches, angle)
    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance
      bestRotation = angle
    }
  }
  
  return { rotation: bestRotation, translateY: 0 }
}
```

## 4. 画像変換処理

### 4.1 Canvas描画時の変換適用
```typescript
// ImageCanvas.tsxでの描画処理
ctx.save()
ctx.translate(width / 2 + transform.translateX, height / 2 + transform.translateY)
ctx.rotate(transform.rotation * Math.PI / 180)
ctx.scale(transform.scale, transform.scale)
ctx.drawImage(img, -img.width / 2, -img.height / 2)
ctx.restore()
```

### 4.2 画像出力時の変換適用
```typescript
// imageExport.tsでの変換適用
export async function applyTransformToImage(
  imageUrl: string,
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // 変換後のサイズを計算
  const { width, height } = calculateTransformedSize(img.width, img.height, transform)
  canvas.width = width
  canvas.height = height
  
  // 変換を適用
  ctx.save()
  ctx.translate(width / 2 + transform.translateX, height / 2 + transform.translateY)
  ctx.rotate(transform.rotation * Math.PI / 180)
  ctx.scale(transform.scale, transform.scale)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  ctx.restore()
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}
```

## 5. UI/UX設計

### 5.1 2列レイアウト
```css
.controls-layout {
  display: flex;
  gap: 20px;
}

.left-panel {
  flex: 0 0 200px;
}

.right-panel {
  flex: 1;
}
```

### 5.2 回転制御の改善
```typescript
// スライダーとテキスト入力の両方対応
const [rotationInput, setRotationInput] = useState<string | number>(image.transform.rotation)

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

## 6. 画像出力機能

### 6.1 一括画像出力
```typescript
export async function exportImagesAsZip(images: ImageData[]): Promise<void> {
  const zip = new JSZip()
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const blob = await applyTransformToImage(URL.createObjectURL(image.file), image.transform)
    
    const fileName = `${nameWithoutExt}_transformed_${i + 1}${ext}`
    zip.file(fileName, blob)
  }
  
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  // ダウンロード処理
}
```

### 6.2 単一画像ダウンロード
```typescript
export async function downloadSingleImage(image: ImageData): Promise<void> {
  const blob = await applyTransformToImage(URL.createObjectURL(image.file), image.transform)
  const fileName = `${nameWithoutExt}_transformed${ext}`
  // ダウンロード処理
}
```

## 7. TextureAtlas機能

### 7.1 画像処理パイプライン
```typescript
export async function generateTextureAtlas(
  images: ImageData[],
  outputSize: number,
  gridSize: string
): Promise<Blob> {
  const [rows, cols] = gridSize.split('x').map(Number)
  const requiredCount = rows * cols
  const tileSize = outputSize / rows
  
  // 1. 画像リスト調整
  const adjustedImages = adjustImageList(images, requiredCount)
  
  // 2. 各画像を処理
  for (let i = 0; i < adjustedImages.length; i++) {
    // 正方形に切り取り
    const croppedBlob = await cropToSquare(image.url, image.width, image.height)
    // 指定サイズにリサイズ
    const resizedBlob = await resizeImage(URL.createObjectURL(croppedBlob), tileSize, tileSize)
  }
  
  // 3. アトラス画像生成
  const atlasCanvas = document.createElement('canvas')
  atlasCanvas.width = outputSize
  atlasCanvas.height = outputSize
  
  // 各タイルを配置
  for (let i = 0; i < processedImages.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = col * tileSize
    const y = row * tileSize
    atlasCtx.drawImage(img, x, y, tileSize, tileSize)
  }
  
  return new Promise((resolve) => {
    atlasCanvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}
```

### 7.2 画像リスト調整
```typescript
export function adjustImageList(images: ImageData[], requiredCount: number): ImageData[] {
  if (images.length === requiredCount) return images
  
  if (images.length > requiredCount) {
    // 過多の場合：先頭と最後から削除
    const excess = images.length - requiredCount
    const removeFromStart = Math.ceil(excess / 2)
    const removeFromEnd = excess - removeFromStart
    return images.slice(removeFromStart, images.length - removeFromEnd)
  } else {
    // 不足の場合：先頭と最後の画像を追加
    const shortage = requiredCount - images.length
    const addToStart = Math.ceil(shortage / 2)
    const addToEnd = shortage - addToStart
    
    const result = [...images]
    for (let i = 0; i < addToStart; i++) result.unshift(images[0])
    for (let i = 0; i < addToEnd; i++) result.push(images[images.length - 1])
    return result
  }
}
```

## 8. エラーハンドリング

### 8.1 OpenCV読み込み確認
```typescript
export function checkOpenCVConstants() {
  console.log('=== OpenCV.js定数確認 ===')
  console.log('window.cv:', typeof window.cv)
  console.log('ORB_HARRIS_SCORE:', window.cv.ORB_HARRIS_SCORE)
  console.log('NORM_HAMMING:', window.cv.NORM_HAMMING)
}

export function checkORBConstructor() {
  console.log('=== ORBコンストラクタ確認 ===')
  try {
    const testORB = new window.cv.ORB(500, 1.2, 8, 31, 0, 2)
    console.log('ORB初期化成功')
  } catch (error) {
    console.log('ORB初期化失敗:', error)
  }
}
```

### 8.2 入力検証
```typescript
// 画像数の確認
if (images.length < 2) {
  alert('整列には少なくとも2つの画像が必要です')
  return
}

// 選択領域の確認
const imagesWithoutArea = images.filter(img => !img.selectedArea)
if (imagesWithoutArea.length > 0) {
  alert('すべての画像に選択領域を設定してください')
  return
}
```

## 9. パフォーマンス最適化

### 9.1 メモリ使用量
- **変換パラメータ方式**: 元画像1枚分のメモリのみ使用
- **動的描画**: 変換済み画像データを保存しない
- **Canvas描画**: リアルタイムに変換を適用

### 9.2 処理速度
- **ORB特徴点**: 高速な特徴点抽出
- **BFMatcher**: 効率的な特徴点マッチング
- **最適化計算**: 回転角の範囲を限定（-30度～30度）

### 9.3 推奨仕様
- **画像サイズ**: 最大2048x2048px
- **同時処理画像数**: 10枚程度まで
- **処理時間**: 画像サイズと枚数に依存（数秒～数十秒）

## 10. セキュリティ

### 10.1 ファイル処理
- **ローカル処理**: 画像データはブラウザ内でのみ処理
- **外部送信なし**: 画像データを外部サーバーに送信しない
- **一時ファイル**: 処理完了後に自動的にメモリから削除

### 10.2 入力検証
- **ファイル形式**: 画像ファイルのみ受け付け
- **ファイルサイズ**: ブラウザの制限内で処理
- **悪意のあるファイル**: ブラウザの標準的な保護機能を利用

## 11. ブラウザ対応

### 11.1 必須機能
- **Canvas API**: 画像描画と変換
- **File API**: ファイルアップロード
- **WebAssembly**: OpenCV.jsの実行
- **Blob API**: ファイルダウンロード

### 11.2 対応ブラウザ
- **Chrome**: 最新版
- **Firefox**: 最新版
- **Safari**: 最新版
- **Edge**: 最新版

## 12. 開発・デバッグ

### 12.1 ログ出力
```typescript
console.log('=== 自動整列処理開始 ===')
console.log('処理前の画像:', images.map(img => ({
  id: img.id,
  transform: img.transform
})))
console.log('整列後の画像:', alignedImages.map(img => ({
  id: img.id,
  transform: img.transform
})))
```

### 12.2 エラー処理
```typescript
try {
  const alignedImages = await alignAllImages(images)
  setImages(alignedImages)
  alert('画像の整列が完了しました')
} catch (error) {
  console.error('整列処理でエラーが発生しました:', error)
  alert('整列処理でエラーが発生しました: ' + error.message)
}
```

### 12.3 開発ツール
- **Vite**: 高速な開発サーバー
- **TypeScript**: 型安全性の確保
- **ESLint**: コード品質の維持
- **Hot Reload**: リアルタイムでの変更反映 