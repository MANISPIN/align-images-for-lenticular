import JSZip from 'jszip'

// 画像に変換パラメータを適用してCanvasからBlobを生成
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

// 変換後の画像サイズを計算
function calculateTransformedSize(
  originalWidth: number,
  originalHeight: number,
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
): { width: number; height: number } {
  // 回転を考慮したサイズ計算
  const rad = Math.abs(transform.rotation * Math.PI / 180)
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  
  // スケールを適用したサイズ
  const scaledWidth = originalWidth * transform.scale
  const scaledHeight = originalHeight * transform.scale
  
  // 回転後のサイズ
  const rotatedWidth = scaledWidth * cos + scaledHeight * sin
  const rotatedHeight = scaledWidth * sin + scaledHeight * cos
  
  // 移動量を考慮したサイズ
  const padding = 100 // 余白
  const width = Math.ceil(rotatedWidth + Math.abs(transform.translateX) * 2 + padding)
  const height = Math.ceil(rotatedHeight + Math.abs(transform.translateY) * 2 + padding)
  
  return { width, height }
}

// 画像リストからZipファイルを生成してダウンロード
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
        
        // ファイル名を生成（元のファイル名を保持しつつ、番号を付ける）
        const originalName = image.file.name
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
        const ext = originalName.match(/\.[^/.]+$/)?.[0] || '.png'
        const fileName = `${nameWithoutExt}_transformed_${i + 1}${ext}`
        
        // Zipに追加
        zip.file(fileName, blob)
        
        console.log(`画像 ${i + 1}/${images.length} を処理しました: ${fileName}`)
      } catch (error) {
        console.error(`画像 ${i + 1} の処理でエラーが発生しました:`, error)
        // エラーが発生しても他の画像は処理を続行
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

// 単一画像をダウンロード
export async function downloadSingleImage(
  image: {
    file: File
    transform: { scale: number; rotation: number; translateX: number; translateY: number }
  }
): Promise<void> {
  try {
    const blob = await applyTransformToImage(URL.createObjectURL(image.file), image.transform)
    
    const originalName = image.file.name
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
    const ext = originalName.match(/\.[^/.]+$/)?.[0] || '.png'
    const fileName = `${nameWithoutExt}_transformed${ext}`
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('画像のダウンロードが完了しました')
  } catch (error) {
    console.error('画像ダウンロードでエラーが発生しました:', error)
    throw error
  }
} 