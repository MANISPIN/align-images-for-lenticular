// 画像を正方形に切り取る
export async function cropToSquare(
  imageUrl: string,
  width: number,
  height: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        // 正方形のサイズを決定（短い方に合わせる）
        const size = Math.min(width, height)
        
        // 切り取り位置を計算
        const offsetX = (width - size) / 2
        const offsetY = (height - size) / 2
        
        // Canvasを作成
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context could not be created'))
          return
        }
        
        // 画像を切り取って描画
        ctx.drawImage(
          img,
          offsetX, offsetY, size, size,  // ソース
          0, 0, size, size                // デスティネーション
        )
        
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

// 画像を指定サイズにリサイズ
export async function resizeImage(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        // Canvasを作成
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context could not be created'))
          return
        }
        
        // 画像をリサイズして描画
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
        
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

// 画像リストを調整（必要数に合わせる）
export function adjustImageList(
  images: Array<{ id: string; file: File; url: string; width: number; height: number }>,
  requiredCount: number
): Array<{ id: string; file: File; url: string; width: number; height: number }> {
  if (images.length === requiredCount) {
    return images
  }
  
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
    
    // 先頭に追加
    for (let i = 0; i < addToStart; i++) {
      result.unshift(images[0])
    }
    
    // 最後に追加
    for (let i = 0; i < addToEnd; i++) {
      result.push(images[images.length - 1])
    }
    
    return result
  }
}

// TextureAtlasを生成
export async function generateTextureAtlas(
  images: Array<{ id: string; file: File; url: string; width: number; height: number }>,
  outputSize: number,
  gridSize: string
): Promise<Blob> {
  try {
    const [rows, cols] = gridSize.split('x').map(Number)
    const requiredCount = rows * cols
    const tileSize = outputSize / rows // 各タイルのサイズ
    
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

// TextureAtlasをダウンロード
export async function downloadTextureAtlas(
  images: Array<{ id: string; file: File; url: string; width: number; height: number }>,
  outputSize: number,
  gridSize: string
): Promise<void> {
  try {
    console.log('TextureAtlasダウンロード開始')
    
    const atlasBlob = await generateTextureAtlas(images, outputSize, gridSize)
    
    // ダウンロード
    const url = URL.createObjectURL(atlasBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `texture_atlas_${outputSize}_${gridSize}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('TextureAtlasダウンロード完了')
  } catch (error) {
    console.error('TextureAtlasダウンロードでエラーが発生:', error)
    throw error
  }
} 