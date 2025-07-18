import React, { useState, useRef, useCallback } from 'react'
import ImageUploader from './components/ImageUploader'
import ImageCanvas from './components/ImageCanvas'
import AlignmentControls from './components/AlignmentControls'
import { 
  alignAllImages, 
  alignImagesByAreaOnly, 
  alignImagesByRotationOnly,
  calculateMaxScale, 
  type ImageData as AlignmentImageData, 
  checkOpenCVConstants, 
  checkORBConstructor 
} from './utils/imageAlignment'
import { exportImagesAsZip, downloadSingleImage } from './utils/imageExport'
import { downloadTextureAtlas } from './utils/textureAtlas'
import TextureAtlasDialog from './components/TextureAtlasDialog'
import './App.css'

interface ImageData {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
}

function App() {
  const [images, setImages] = useState<ImageData[]>([])
  const [originalImages, setOriginalImages] = useState<ImageData[]>([]) // オリジナル画像のバックアップ
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [alignmentMode, setAlignmentMode] = useState<'area' | 'transform'>('area')
  const [forceUpdate, setForceUpdate] = useState(0) // 強制更新用
  const [isAligning, setIsAligning] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isTextureAtlasDialogOpen, setIsTextureAtlasDialogOpen] = useState(false)

  const getImageDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.src = URL.createObjectURL(file)
    })
  }, [])

  const handleImageUpload = useCallback(async (files: FileList) => {
    console.log('画像アップロード開始:', {
      fileCount: files.length,
      fileNames: Array.from(files).map(f => f.name)
    })
    
    // ファイルを配列に変換して番号でソート
    const fileArray = Array.from(files)
    
    // ファイル名から番号を抽出する関数
    const extractNumberFromFileName = (fileName: string): number => {
      // ファイル名から数字を抽出（拡張子を除く）
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
      
      // 様々なパターンで数字を探す
      // 1. 連続する数字（例: image1.jpg → 1）
      // 2. アンダースコア区切り（例: image_001.jpg → 1）
      // 3. ハイフン区切り（例: image-01.jpg → 1）
      // 4. スペース区切り（例: image 1.jpg → 1）
      
      // パターン1: 連続する数字
      let numberMatch = nameWithoutExt.match(/(\d+)/)
      if (numberMatch) {
        return parseInt(numberMatch[1], 10)
      }
      
      // パターン2: アンダースコア区切り
      numberMatch = nameWithoutExt.match(/[_-](\d+)/)
      if (numberMatch) {
        return parseInt(numberMatch[1], 10)
      }
      
      // パターン3: スペース区切り
      numberMatch = nameWithoutExt.match(/\s+(\d+)/)
      if (numberMatch) {
        return parseInt(numberMatch[1], 10)
      }
      
      // パターン4: ファイル名の最後の数字
      numberMatch = nameWithoutExt.match(/(\d+)$/)
      if (numberMatch) {
        return parseInt(numberMatch[1], 10)
      }
      
      // 数字が見つからない場合は0を返す
      return 0
    }
    
    // ファイル名の番号でソート
    fileArray.sort((a, b) => {
      const numA = extractNumberFromFileName(a.name)
      const numB = extractNumberFromFileName(b.name)
      return numA - numB
    })
    
    console.log('ソート後のファイル:', {
      sortedFileNames: fileArray.map(f => f.name),
      extractedNumbers: fileArray.map(f => extractNumberFromFileName(f.name))
    })
    
    const newImages: ImageData[] = []
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const dimensions = await getImageDimensions(file)
      
      // 画像全体が見える最大スケールを計算
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
    
    console.log('処理後の画像順序:', {
      imageNames: newImages.map(img => img.file.name),
      imageIds: newImages.map(img => img.id)
    })
    
    setImages(prev => [...prev, ...newImages])
    setOriginalImages(prev => [...prev, ...newImages]) // オリジナル画像のバックアップも保存
    
    // 最初の画像を自動選択
    if (newImages.length > 0 && selectedImageId === null) {
      setSelectedImageId(newImages[0].id)
    }
  }, [selectedImageId, getImageDimensions])

  const handleAreaSelect = useCallback((imageId: string, area: { x: number; y: number; width: number; height: number }) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, selectedArea: area } : img
    ))
    // 領域選択後にも強制更新
    setForceUpdate(prev => prev + 1)
  }, [])

  const handleTransformChange = useCallback((imageId: string, transform: { scale: number; rotation: number; translateX: number; translateY: number }) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, transform } : img
    ))
    // 変形パラメータが変更されたときに強制更新
    setForceUpdate(prev => prev + 1)
  }, [])

  const handleImageSelect = useCallback((imageId: string) => {
    setSelectedImageId(imageId)
  }, [])

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId))
    setOriginalImages(prev => prev.filter(img => img.id !== imageId)) // オリジナル画像からも削除
    if (selectedImageId === imageId) {
      // 削除された画像が選択されていた場合、次の画像を選択
      const remainingImages = images.filter(img => img.id !== imageId)
      if (remainingImages.length > 0) {
        setSelectedImageId(remainingImages[0].id)
      } else {
        setSelectedImageId(null)
      }
    }
  }, [selectedImageId, images])

  const handleResetImages = useCallback(() => {
    console.log('処理リセットボタンが押されました')
    
    if (originalImages.length === 0) {
      console.log('リセットするオリジナル画像がありません')
      alert('リセットする画像がありません')
      return
    }
    
    // オリジナル画像を現在の画像にコピー
    setImages([...originalImages])
    setForceUpdate(prev => prev + 1)
    
    console.log('画像をオリジナル状態にリセットしました:', {
      originalImageCount: originalImages.length,
      resetImageCount: originalImages.length
    })
    
    alert('画像をオリジナル状態にリセットしました')
  }, [originalImages])

  const handleAutoAlign = useCallback(async () => {
    console.log('自動整列ボタンが押されました')
    
    if (images.length < 2) {
      console.log('画像が2枚未満のため処理を中止')
      alert('整列には少なくとも2つの画像が必要です')
      return
    }

    // すべての画像に選択領域があるかチェック
    const imagesWithoutArea = images.filter(img => !img.selectedArea)
    if (imagesWithoutArea.length > 0) {
      console.log('選択領域が設定されていない画像があります:', imagesWithoutArea.map(img => img.id))
      alert('すべての画像に選択領域を設定してください')
      return
    }

    console.log('OpenCVの読み込み状態を確認中...')
    console.log('window.cv:', typeof window !== 'undefined' ? !!window.cv : 'window is undefined')
    
    // OpenCV定数を確認
    if (typeof window !== 'undefined' && window.cv) {
      checkOpenCVConstants()
      checkORBConstructor()
    }

    setIsAligning(true)
    try {
      // OpenCVが読み込まれているかチェック
      if (typeof window !== 'undefined' && !window.cv) {
        console.error('OpenCVが読み込まれていません')
        alert('OpenCVが読み込まれていません。ページを再読み込みしてください。')
        return
      }

      console.log('=== 自動整列処理開始 ===')
      console.log('処理前の画像:', images.map(img => ({
        id: img.id,
        transform: img.transform
      })))

      const alignedImages = await alignAllImages(images as AlignmentImageData[])
      
      console.log('=== 整列処理完了 ===')
      console.log('整列後の画像:', alignedImages.map(img => ({
        id: img.id,
        transform: img.transform
      })))
      
      setImages(alignedImages as ImageData[])
      setForceUpdate(prev => prev + 1)
      
      console.log('=== 状態更新完了 ===')
      console.log('強制更新カウンター:', forceUpdate + 1)
      
      alert('画像の整列が完了しました')
    } catch (error) {
      console.error('整列処理でエラーが発生しました:', error)
      alert('整列処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsAligning(false)
    }
  }, [images, forceUpdate])

  const handleAlignByArea = useCallback(async () => {
    console.log('上下合わせボタンが押されました')
    
    if (images.length < 2) {
      console.log('画像が2枚未満のため処理を中止')
      alert('整列には少なくとも2つの画像が必要です')
      return
    }

    // すべての画像に選択領域があるかチェック
    const imagesWithoutArea = images.filter(img => !img.selectedArea)
    if (imagesWithoutArea.length > 0) {
      console.log('選択領域が設定されていない画像があります:', imagesWithoutArea.map(img => img.id))
      alert('すべての画像に選択領域を設定してください')
      return
    }

    setIsAligning(true)
    try {
      console.log('=== 上下合わせ処理開始 ===')
      console.log('処理前の画像:', images.map(img => ({
        id: img.id,
        transform: img.transform
      })))

      const alignedImages = await alignImagesByAreaOnly(images as AlignmentImageData[])
      
      console.log('=== 上下合わせ処理完了 ===')
      console.log('処理後の画像:', alignedImages.map(img => ({
        id: img.id,
        transform: img.transform
      })))
      
      setImages(alignedImages as ImageData[])
      setForceUpdate(prev => prev + 1)
      
      alert('上下合わせが完了しました')
    } catch (error) {
      console.error('上下合わせ処理でエラーが発生しました:', error)
      alert('上下合わせ処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsAligning(false)
    }
  }, [images, forceUpdate])

  const handleAlignByRotation = useCallback(async () => {
    console.log('回転調整ボタンが押されました')
    
    if (images.length < 2) {
      console.log('画像が2枚未満のため処理を中止')
      alert('整列には少なくとも2つの画像が必要です')
      return
    }

    // すべての画像に選択領域があるかチェック
    const imagesWithoutArea = images.filter(img => !img.selectedArea)
    if (imagesWithoutArea.length > 0) {
      console.log('選択領域が設定されていない画像があります:', imagesWithoutArea.map(img => img.id))
      alert('すべての画像に選択領域を設定してください')
      return
    }

    console.log('OpenCVの読み込み状態を確認中...')
    console.log('window.cv:', typeof window !== 'undefined' ? !!window.cv : 'window is undefined')
    
    // OpenCV定数を確認
    if (typeof window !== 'undefined' && window.cv) {
      checkOpenCVConstants()
      checkORBConstructor()
    }

    setIsAligning(true)
    try {
      // OpenCVが読み込まれているかチェック
      if (typeof window !== 'undefined' && !window.cv) {
        console.error('OpenCVが読み込まれていません')
        alert('OpenCVが読み込まれていません。ページを再読み込みしてください。')
        return
      }

      console.log('=== 回転調整処理開始 ===')
      console.log('処理前の画像:', images.map(img => ({
        id: img.id,
        transform: img.transform
      })))

      const alignedImages = await alignImagesByRotationOnly(images as AlignmentImageData[])
      
      console.log('=== 回転調整処理完了 ===')
      console.log('処理後の画像:', alignedImages.map(img => ({
        id: img.id,
        transform: img.transform
      })))
      
      setImages(alignedImages as ImageData[])
      setForceUpdate(prev => prev + 1)
      
      alert('回転調整が完了しました')
    } catch (error) {
      console.error('回転調整処理でエラーが発生しました:', error)
      alert('回転調整処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsAligning(false)
    }
  }, [images, forceUpdate])

  const handleExportImages = useCallback(async () => {
    console.log('画像出力ボタンが押されました')
    
    if (images.length === 0) {
      console.log('出力する画像がありません')
      alert('出力する画像がありません')
      return
    }

    setIsExporting(true)
    try {
      console.log('=== 画像出力処理開始 ===')
      console.log('出力対象画像数:', images.length)

      await exportImagesAsZip(images)
      
      console.log('=== 画像出力処理完了 ===')
      alert('画像の出力が完了しました')
    } catch (error) {
      console.error('画像出力処理でエラーが発生しました:', error)
      alert('画像出力処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }, [images])

  const selectedImage = images.find(img => img.id === selectedImageId)

  const handleDownloadCurrentImage = useCallback(async () => {
    if (!selectedImage) {
      alert('選択された画像がありません')
      return
    }

    setIsExporting(true)
    try {
      console.log('=== 単一画像ダウンロード開始 ===')
      console.log('ダウンロード対象:', selectedImage.file.name)

      await downloadSingleImage(selectedImage)
      
      console.log('=== 単一画像ダウンロード完了 ===')
      alert('画像のダウンロードが完了しました')
    } catch (error) {
      console.error('画像ダウンロード処理でエラーが発生しました:', error)
      alert('画像ダウンロード処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }, [selectedImage])

  const handleTextureAtlasExport = useCallback(async (outputSize: number, gridSize: string) => {
    console.log('TextureAtlas出力開始:', { outputSize, gridSize })
    
    if (images.length === 0) {
      console.log('出力する画像がありません')
      alert('出力する画像がありません')
      return
    }

    setIsExporting(true)
    try {
      console.log('=== TextureAtlas出力処理開始 ===')
      console.log('出力対象画像数:', images.length)

      await downloadTextureAtlas(images, outputSize, gridSize)
      
      console.log('=== TextureAtlas出力処理完了 ===')
      alert('TextureAtlasの出力が完了しました')
    } catch (error) {
      console.error('TextureAtlas出力処理でエラーが発生しました:', error)
      alert('TextureAtlas出力処理でエラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }, [images])

  return (
    <div className="app">
      <header className="app-header">
        <h1>画像整列アプリ</h1>
        <p>複数画像を指定領域に合わせて整列します</p>
      </header>
      
      <main className="app-main">
        <div className="sidebar">
          <ImageUploader onImageUpload={handleImageUpload} />
          
          <div className="image-list">
            <h3>アップロード済み画像 ({images.length})</h3>
            {images.length === 0 ? (
              <div className="no-images">
                <p>画像をアップロードしてください</p>
              </div>
            ) : (
              images.map((image, index) => (
                <div 
                  key={image.id} 
                  className={`image-item ${selectedImageId === image.id ? 'selected' : ''}`}
                  onClick={() => handleImageSelect(image.id)}
                >
                  <div className="image-index">#{index + 1}</div>
                  <img src={image.url} alt={image.file.name} />
                  <div className="image-info">
                    <span className="image-name">{image.file.name}</span>
                    <span className="image-size">{image.width}×{image.height}</span>
                    {image.selectedArea && (
                      <span className="area-indicator">✓ 領域選択済み</span>
                    )}
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage(image.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="main-content">
          <div className="canvas-container">
            <ImageCanvas
              key={`${selectedImageId}-${forceUpdate}`} // 強制更新用のキー
              images={images}
              selectedImageId={selectedImageId}
              onAreaSelect={handleAreaSelect}
              onImageSelect={handleImageSelect}
              alignmentMode={alignmentMode}
            />
          </div>

          {selectedImage && (
            <div className="controls-panel">
              <AlignmentControls
                image={selectedImage}
                onTransformChange={(transform: { scale: number; rotation: number; translateX: number; translateY: number }) => handleTransformChange(selectedImage.id, transform)}
                alignmentMode={alignmentMode}
                onAlignmentModeChange={setAlignmentMode}
                onAutoAlign={handleAutoAlign}
                onAlignByArea={handleAlignByArea}
                onAlignByRotation={handleAlignByRotation}
                onResetImages={handleResetImages}
                onExportImages={handleExportImages}
                onDownloadCurrentImage={handleDownloadCurrentImage}
                onTextureAtlasExport={() => setIsTextureAtlasDialogOpen(true)}
                isAligning={isAligning}
                isExporting={isExporting}
              />
            </div>
          )}
        </div>
      </main>

      <TextureAtlasDialog
        isOpen={isTextureAtlasDialogOpen}
        onClose={() => setIsTextureAtlasDialogOpen(false)}
        onConfirm={handleTextureAtlasExport}
        imageCount={images.length}
      />
    </div>
  )
}

export default App
