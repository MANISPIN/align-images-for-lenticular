// OpenCVを使用した画像整列処理のユーティリティ関数

import { calculateCenterImageTransform, calculateAlignImagesTransform, combineTransforms } from './imageTransform'

declare global {
  interface Window {
    cv: any
  }
}

export interface ImageData {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
}

export interface AlignmentResult {
  success: boolean
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
  error?: string
}

/**
 * 画像全体が見える最大スケールを計算
 */
export function calculateMaxScale(imageWidth: number, imageHeight: number, canvasWidth: number = 800, canvasHeight: number = 600): number {
  const scaleX = canvasWidth / imageWidth
  const scaleY = canvasHeight / imageHeight
  
  // 画像全体がキャンバスに収まる最大スケールを返す
  return Math.min(scaleX, scaleY, 1.0) // 最大でも1.0を超えないようにする
}

/**
 * 画像をCanvasに描画してOpenCV Matに変換
 */
export async function imageToMat(imageUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context could not be created'))
          return
        }
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const mat = window.cv.matFromImageData(imageData)
        resolve(mat)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageUrl
  })
}

/**
 * 画像の中心をX方向に移動させる
 */
export function centerImageX(imageData: ImageData, targetCenterX: number): { scale: number; rotation: number; translateX: number; translateY: number } {
  const currentCenterX = imageData.width / 2
  const translateX = targetCenterX - currentCenterX
  
  return {
    scale: imageData.transform.scale,
    rotation: imageData.transform.rotation,
    translateX: translateX,
    translateY: imageData.transform.translateY
  }
}

/**
 * OpenCV.jsの利用可能な定数を確認
 */
export function checkOpenCVConstants() {
  console.log('=== OpenCV.js定数確認 ===')
  console.log('window.cv:', typeof window.cv)
  console.log('ORB_HARRIS_SCORE:', window.cv.ORB_HARRIS_SCORE)
  console.log('ORB_FAST_SCORE:', window.cv.ORB_FAST_SCORE)
  console.log('NORM_HAMMING:', window.cv.NORM_HAMMING)
  console.log('NORM_HAMMING2:', window.cv.NORM_HAMMING2)
}

/**
 * OpenCV.jsのORBコンストラクタの利用可能なパラメータを確認
 */
export function checkORBConstructor() {
  console.log('=== ORBコンストラクタ確認 ===')
  console.log('window.cv.ORB:', typeof window.cv.ORB)
  
  // ORBコンストラクタの引数数を確認
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

/**
 * ORB特徴点を抽出
 */
export function extractORBFeatures(mat: any): { keypoints: any; descriptors: any } {
  try {
    // OpenCV.jsのバージョンに応じてORBを初期化
    let orb
    const initMethods = [
      // 方法1: 最小限のパラメータ（ScoreTypeを省略）
      () => new window.cv.ORB(1000, 1.2, 8, 31, 0, 2),
      // 方法2: さらに簡素化
      () => new window.cv.ORB(1000, 1.2, 8, 31),
      // 方法3: デフォルト値のみ
      () => new window.cv.ORB(),
      // 方法4: 基本的なパラメータのみ
      () => new window.cv.ORB(500, 1.2, 8, 31, 0, 2, 0, 31, 20)
    ]
    
    let lastError = null
    for (let i = 0; i < initMethods.length; i++) {
      try {
        console.log(`ORB初期化方法${i + 1}を試行中...`)
        orb = initMethods[i]()
        console.log(`ORB初期化成功（方法${i + 1}）`)
        break
      } catch (error) {
        console.log(`ORB初期化方法${i + 1}が失敗:`, error instanceof Error ? error.message : String(error))
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

/**
 * 特徴点マッチングを実行
 */
export function matchFeatures(descriptors1: any, descriptors2: any): any[] {
  const matcher = new window.cv.BFMatcher(window.cv.NORM_HAMMING, true)
  const matches = new window.cv.DMatchVector()
  
  matcher.match(descriptors1, descriptors2, matches)
  
  // マッチング結果を配列に変換
  const matchesArray: any[] = []
  for (let i = 0; i < matches.size(); i++) {
    matchesArray.push(matches.get(i))
  }
  
  console.log('生のマッチング結果:', {
    totalMatches: matchesArray.length,
    distances: matchesArray.map(m => m.distance).slice(0, 10) // 最初の10個の距離を表示
  })
  
  if (matchesArray.length === 0) {
    console.log('マッチング結果がありません')
    return []
  }
  
  // 距離の統計を計算
  const distances = matchesArray.map(m => m.distance).sort((a, b) => a - b)
  const minDistance = distances[0]
  const maxDistance = distances[distances.length - 1]
  const medianDistance = distances[Math.floor(distances.length / 2)]
  const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
  
  console.log('距離統計:', {
    minDistance,
    maxDistance,
    medianDistance,
    meanDistance,
    totalMatches: distances.length
  })
  
  // 厳しい距離閾値を設定（より厳しい条件）
  const distanceThreshold = Math.min(50, medianDistance * 0.8) // より厳しい閾値
  
  // 距離でフィルタリング（良いマッチのみを選択）
  let goodMatches = matchesArray.filter(match => match.distance < distanceThreshold)
  
  console.log('距離フィルタリング結果:', {
    distanceThreshold,
    goodMatches: goodMatches.length,
    minDistance: goodMatches.length > 0 ? Math.min(...goodMatches.map(m => m.distance)) : 0,
    maxDistance: goodMatches.length > 0 ? Math.max(...goodMatches.map(m => m.distance)) : 0
  })
  
  // 比率テストを無効化するフラグ（エラーが頻繁に発生する場合）
  const enableRatioTest = false // 一時的に無効化
  
  // 比率テストを追加（Lowe's ratio test）
  let ratioTestFailed = false
  if (enableRatioTest && goodMatches.length > 0) {
    try {
      console.log('比率テスト開始:', {
        goodMatchesLength: goodMatches.length,
        descriptors1Size: descriptors1.rows,
        descriptors2Size: descriptors2.rows
      })
      
      // 各特徴点について上位2つのマッチを取得
      const knnMatches = new window.cv.DMatchVectorVector()
      matcher.knnMatch(descriptors1, descriptors2, knnMatches, 2)
      
      console.log('knnMatch結果:', {
        knnMatchesSize: knnMatches.size(),
        firstGroupSize: knnMatches.size() > 0 ? knnMatches.get(0).size() : 0
      })
      
      const ratioTestMatches: any[] = []
      for (let i = 0; i < knnMatches.size(); i++) {
        try {
          const matchGroup = knnMatches.get(i)
          console.log(`マッチグループ${i}:`, {
            groupSize: matchGroup.size(),
            hasMatches: matchGroup.size() >= 2
          })
          
          if (matchGroup.size() >= 2) {
            const bestMatch = matchGroup.get(0)
            const secondBestMatch = matchGroup.get(1)
            
            console.log(`マッチ${i}詳細:`, {
              bestDistance: bestMatch.distance,
              secondBestDistance: secondBestMatch.distance,
              bestQueryIdx: bestMatch.queryIdx,
              bestTrainIdx: bestMatch.trainIdx,
              secondBestQueryIdx: secondBestMatch.queryIdx,
              secondBestTrainIdx: secondBestMatch.trainIdx
            })
            
            // 比率テスト: 最良マッチの距離が2番目に良いマッチの距離の0.7倍以下
            const ratio = bestMatch.distance / secondBestMatch.distance
            console.log(`比率${i}:`, ratio)
            
            if (ratio < 0.7) {
              ratioTestMatches.push(bestMatch)
              console.log(`比率テスト通過${i}:`, ratio)
            } else {
              console.log(`比率テスト失敗${i}:`, ratio)
            }
          } else {
            console.log(`マッチグループ${i}: マッチ数不足 (${matchGroup.size()})`)
          }
        } catch (groupError) {
          console.error(`マッチグループ${i}処理エラー:`, groupError)
        }
      }
      
      console.log('比率テスト結果:', {
        totalKnnMatches: knnMatches.size(),
        ratioTestMatches: ratioTestMatches.length
      })
      
      // 距離フィルタリングと比率テストの両方を満たすマッチを選択
      const distanceFilteredIds = new Set(goodMatches.map(m => `${m.queryIdx}-${m.trainIdx}`))
      goodMatches = ratioTestMatches.filter(match => 
        distanceFilteredIds.has(`${match.queryIdx}-${match.trainIdx}`)
      )
      
      console.log('比率テストフィルタリング結果:', {
        distanceFilteredCount: distanceFilteredIds.size,
        ratioTestCount: ratioTestMatches.length,
        finalCount: goodMatches.length
      })
      
    } catch (ratioTestError) {
      console.error('比率テスト全体エラー:', ratioTestError)
      console.log('比率テストをスキップして距離フィルタリングのみを使用')
      ratioTestFailed = true
      // エラーが発生した場合は比率テストをスキップ（goodMatchesは距離フィルタリング結果のまま）
    }
  }
  
  // 比率テストが失敗した場合のフォールバック処理
  if (ratioTestFailed) {
    console.log('比率テスト失敗のため、距離フィルタリングのみを使用')
    // goodMatchesは既に距離フィルタリング済みなのでそのまま使用
  }
  
  // 外れ値除去（RANSAC風のアプローチ）
  if (goodMatches.length >= 4) {
    const points1: { x: number; y: number }[] = []
    const points2: { x: number; y: number }[] = []
    
    // キーポイントを取得（仮想的に）
    // 実際のキーポイントは後で取得するため、ここではインデックスのみ使用
    for (const match of goodMatches) {
      points1.push({ x: match.queryIdx, y: 0 }) // 仮想的な座標
      points2.push({ x: match.trainIdx, y: 0 }) // 仮想的な座標
    }
    
    // 距離ベースの外れ値除去
    const distances = goodMatches.map(m => m.distance)
    const meanDist = distances.reduce((sum, d) => sum + d, 0) / distances.length
    const stdDist = Math.sqrt(distances.reduce((sum, d) => sum + Math.pow(d - meanDist, 2), 0) / distances.length)
    
    const outlierThreshold = meanDist + 2 * stdDist // 2標準偏差以上を外れ値とする
    
    goodMatches = goodMatches.filter(match => match.distance < outlierThreshold)
    
    console.log('外れ値除去結果:', {
      meanDistance: meanDist,
      stdDistance: stdDist,
      outlierThreshold,
      remainingMatches: goodMatches.length
    })
  }
  
  console.log('最終フィルタリング結果:', {
    goodMatches: goodMatches.length,
    minDistance: goodMatches.length > 0 ? Math.min(...goodMatches.map(m => m.distance)) : 0,
    maxDistance: goodMatches.length > 0 ? Math.max(...goodMatches.map(m => m.distance)) : 0,
    avgDistance: goodMatches.length > 0 ? goodMatches.reduce((sum, m) => sum + m.distance, 0) / goodMatches.length : 0
  })
  
  return goodMatches
}

/**
 * マッチング結果から回転のみを最適化し、選択領域の中心を回転の中心として回転のみを返す
 */
export function calculateOptimalRotation(
  keypoints1: any,
  keypoints2: any,
  matches: any[],
  currentRotation: number,
  selectedAreaCenter?: { x: number; y: number }
): { rotation: number; translateY: number } {
  if (matches.length < 3) {
    return { rotation: currentRotation, translateY: 0 }
  }
  
  // マッチング点の座標を取得
  const points1: { x: number; y: number }[] = []
  const points2: { x: number; y: number }[] = []
  
  for (const match of matches) {
    const kp1 = keypoints1.get(match.queryIdx)
    const kp2 = keypoints2.get(match.trainIdx)
    
    points1.push({ x: kp1.pt.x, y: kp1.pt.y })
    points2.push({ x: kp2.pt.x, y: kp2.pt.y })
  }
  
  console.log('特徴点マッチング詳細:', {
    totalPoints: points1.length,
    points1Sample: points1.slice(0, 3),
    points2Sample: points2.slice(0, 3),
    selectedAreaCenter
  })
  
  // 選択領域の中心を回転の中心として使用
  const rotationCenter = selectedAreaCenter || { x: 0, y: 0 }
  
  // 回転角のみを最適化
  let minTotalDistance = Infinity
  let optimalRotation = currentRotation
  
  // -30度から30度まで0.1度刻みで試行
  for (let angle = -30; angle <= 30; angle += 0.1) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    
    // 選択領域の中心を基準とした回転を適用
    let totalDistance = 0
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
      const dx = p1.x - finalX
      const dy = p1.y - finalY
      const distance = Math.sqrt(dx * dx + dy * dy)
      totalDistance += distance
    }
    
    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance
      optimalRotation = angle
    }
  }
  
  console.log('最適な回転角探索結果（選択領域中心基準）:', {
    optimalRotation,
    rotationCenter,
    minTotalDistance,
    avgDistance: minTotalDistance / points1.length
  })
  
  // 最終的な検証
  const rad = (optimalRotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  
  let finalTotalDistance = 0
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
    const dx = p1.x - finalX
    const dy = p1.y - finalY
    const distance = Math.sqrt(dx * dx + dy * dy)
    finalTotalDistance += distance
  }
  
  const finalAvgDistance = finalTotalDistance / points1.length
  
  console.log('最終検証結果（選択領域中心基準）:', {
    optimalRotation,
    rotationCenter,
    finalAvgDistance,
    improvement: (minTotalDistance / points1.length) - finalAvgDistance
  })
  
  // 回転のみを返す
  return { rotation: optimalRotation, translateY: 0 }
}

/**
 * 2つの画像を整列させる
 */
export async function alignImages(
  image1: ImageData,
  image2: ImageData
): Promise<AlignmentResult> {
  try {
    console.log('=== 画像整列処理開始 ===')
    console.log('画像1:', { id: image1.id, width: image1.width, height: image1.height })
    console.log('画像2:', { id: image2.id, width: image2.width, height: image2.height })
    
    if (!window.cv) {
      throw new Error('OpenCV is not loaded')
    }
    
    if (!image1.selectedArea || !image2.selectedArea) {
      throw new Error('Both images must have selected areas')
    }
    
    // 元画像を使用
    const image1Url = image1.url
    const image2Url = image2.url
    
    console.log('使用する画像URL:', {
      image1Url: image1Url.substring(0, 50) + '...',
      image2Url: image2Url.substring(0, 50) + '...',
    })
    
    // 画像をMatに変換
    console.log('画像1をMatに変換中...')
    const mat1 = await imageToMat(image1Url)
    console.log('画像2をMatに変換中...')
    const mat2 = await imageToMat(image2Url)
    
    // ORB特徴点を抽出
    console.log('画像1の特徴点を抽出中...')
    const features1 = extractORBFeatures(mat1)
    console.log('画像1の特徴点数:', features1.keypoints.size())
    
    console.log('画像2の特徴点を抽出中...')
    const features2 = extractORBFeatures(mat2)
    console.log('画像2の特徴点数:', features2.keypoints.size())
    
    // 特徴点マッチング
    console.log('特徴点マッチング実行中...')
    const matches = matchFeatures(features1.descriptors, features2.descriptors)
    console.log('マッチング結果:', {
      totalMatches: matches.length,
      minDistance: matches.length > 0 ? Math.min(...matches.map(m => m.distance)) : 0,
      maxDistance: matches.length > 0 ? Math.max(...matches.map(m => m.distance)) : 0,
      avgDistance: matches.length > 0 ? matches.reduce((sum, m) => sum + m.distance, 0) / matches.length : 0
    })
    
    if (matches.length < 3) {
      console.error('マッチング特徴点が不足:', matches.length)
      throw new Error('Not enough matching features found')
    }
    
    // 選択領域の中心を計算
    const selectedAreaCenter = image2.selectedArea ? {
      x: image2.selectedArea.x + image2.selectedArea.width / 2,
      y: image2.selectedArea.y + image2.selectedArea.height / 2
    } : undefined
    
    // 最適な回転角を計算（選択領域の中心を回転の中心として使用）
    console.log('最適な回転角を計算中（選択領域中心基準）...')
    const { rotation, translateY } = calculateOptimalRotation(
      features1.keypoints,
      features2.keypoints,
      matches,
      image2.transform.rotation,
      selectedAreaCenter
    )
    
    console.log('計算結果:', { rotation, translateY })
    
    // 結果をクリーンアップ
    mat1.delete()
    mat2.delete()
    features1.keypoints.delete()
    features1.descriptors.delete()
    features2.keypoints.delete()
    features2.descriptors.delete()
    
    console.log('=== 画像整列処理完了（成功） ===')
    
    return {
      success: true,
      transform: {
        scale: image2.transform.scale,
        rotation: rotation,
        translateX: image2.transform.translateX,
        translateY: translateY
      }
    }
  } catch (error) {
    console.error('=== 画像整列処理失敗 ===')
    console.error('エラー詳細:', error)
    return {
      success: false,
      transform: image2.transform,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 画像リスト全体を整列させる（変換パラメータのみを計算・適用）
 */
export async function alignAllImages(images: ImageData[]): Promise<ImageData[]> {
  console.log('整列処理開始:', { imageCount: images.length })
  
  if (images.length < 2) {
    console.log('画像が2枚未満のため整列処理をスキップ')
    return images
  }
  
  const alignedImages = [...images]
  
  // ステップ1: 全画像に対して選択領域位置合わせのパラメータを計算
  console.log('=== ステップ1: 全画像に対して選択領域位置合わせパラメータ計算 ===')
  
  // インデックス0の画像の移動パラメータを計算
  if (alignedImages[0].selectedArea) {
    console.log('インデックス0の画像の移動パラメータを計算中...')
    
    const newTransform = calculateCenterImageTransform(
      alignedImages[0].width,
      alignedImages[0].height,
      alignedImages[0].transform,
      alignedImages[0].selectedArea
    )
    
    alignedImages[0] = {
      ...alignedImages[0],
      transform: newTransform
    }
    
    console.log('インデックス0の画像移動パラメータ計算完了')
  }
  
  // N > 0の画像に対して選択領域を一致させる移動変換
  for (let i = 0; i < alignedImages.length - 1; i++) {
    const currentImage = alignedImages[i]
    const nextImage = alignedImages[i + 1]
    
    if (!currentImage.selectedArea || !nextImage.selectedArea) {
      console.log(`画像${i + 1}: 選択領域がないためスキップ`)
      continue
    }
    
    console.log(`画像${i + 1}の移動パラメータを計算中...`)
    
    // 移動パラメータを計算
    const newTransform = calculateAlignImagesTransform(
      currentImage.width,
      currentImage.height,
      currentImage.transform,
      nextImage.width,
      nextImage.height,
      nextImage.transform,
      currentImage.selectedArea,
      nextImage.selectedArea
    )
    
    alignedImages[i + 1] = {
      ...nextImage,
      transform: newTransform
    }
    
    console.log(`画像${i + 1}移動パラメータ計算完了`)
  }
  
  // ステップ2: 変換後の全画像に対して回転調整のパラメータを順次計算
  console.log('=== ステップ2: 変換後の全画像に対して回転調整パラメータ計算 ===')
  
  for (let i = 0; i < alignedImages.length - 1; i++) {
    const currentImage = alignedImages[i]
    const nextImage = alignedImages[i + 1]
    
    if (!currentImage.selectedArea || !nextImage.selectedArea) {
      console.log(`画像${i + 1}: 選択領域がないため回転調整をスキップ`)
      continue
    }
    
    console.log(`画像${i + 1}の回転調整パラメータを計算中...`)
    
    // ORB特徴点マッチングによる回転調整
    const alignmentResult = await alignImages(currentImage, nextImage)
    
    if (alignmentResult.success) {
      // 回転パラメータのみを適用（移動は既に完了済み）
      alignedImages[i + 1] = {
        ...nextImage,
        transform: {
          scale: nextImage.transform.scale,
          rotation: alignmentResult.transform.rotation,
          translateX: nextImage.transform.translateX,
          translateY: nextImage.transform.translateY
        }
      }
      
      console.log(`画像${i + 1}の回転調整パラメータ計算完了（回転角: ${alignmentResult.transform.rotation}度）`)
    } else {
      console.log(`画像${i + 1}: マッチング失敗のため回転調整をスキップ`)
    }
  }
  
  console.log('整列処理完了:', {
    processedCount: alignedImages.length,
    hasTransformedImages: alignedImages.some(img => img.transform.translateX !== 0 || img.transform.translateY !== 0 || img.transform.rotation !== 0)
  })
  
  return alignedImages
}

/**
 * 選択領域の位置合わせのみを行う（回転調整なし）
 */
export async function alignImagesByAreaOnly(images: ImageData[]): Promise<ImageData[]> {
  console.log('選択領域位置合わせ処理開始:', { imageCount: images.length })
  
  if (images.length < 2) {
    console.log('画像が2枚未満のため処理をスキップ')
    return images
  }
  
  const alignedImages = [...images]
  
  // インデックス0の画像の移動パラメータを計算
  if (alignedImages[0].selectedArea) {
    console.log('インデックス0の画像の移動パラメータを計算中...')
    
    const newTransform = calculateCenterImageTransform(
      alignedImages[0].width,
      alignedImages[0].height,
      alignedImages[0].transform,
      alignedImages[0].selectedArea
    )
    
    alignedImages[0] = {
      ...alignedImages[0],
      transform: newTransform
    }
    
    console.log('インデックス0の画像移動パラメータ計算完了')
  }
  
  // N > 0の画像に対して選択領域を一致させる移動変換
  for (let i = 0; i < alignedImages.length - 1; i++) {
    const currentImage = alignedImages[i]
    const nextImage = alignedImages[i + 1]
    
    if (!currentImage.selectedArea || !nextImage.selectedArea) {
      console.log(`画像${i + 1}: 選択領域がないためスキップ`)
      continue
    }
    
    console.log(`画像${i + 1}の移動パラメータを計算中...`)
    
    // 移動パラメータを計算
    const newTransform = calculateAlignImagesTransform(
      currentImage.width,
      currentImage.height,
      currentImage.transform,
      nextImage.width,
      nextImage.height,
      nextImage.transform,
      currentImage.selectedArea,
      nextImage.selectedArea
    )
    
    alignedImages[i + 1] = {
      ...nextImage,
      transform: newTransform
    }
    
    console.log(`画像${i + 1}移動パラメータ計算完了`)
  }
  
  console.log('選択領域位置合わせ処理完了:', {
    processedCount: alignedImages.length,
    hasTransformedImages: alignedImages.some(img => img.transform.translateX !== 0 || img.transform.translateY !== 0)
  })
  
  return alignedImages
}

/**
 * 回転調整のみを行う（選択領域の位置合わせは既に完了している前提）
 */
export async function alignImagesByRotationOnly(images: ImageData[]): Promise<ImageData[]> {
  console.log('回転調整処理開始:', { imageCount: images.length })
  
  if (images.length < 2) {
    console.log('画像が2枚未満のため処理をスキップ')
    return images
  }
  
  const alignedImages = [...images]
  
  // 変換後の全画像に対して回転調整のパラメータを順次計算
  for (let i = 0; i < alignedImages.length - 1; i++) {
    const currentImage = alignedImages[i]
    const nextImage = alignedImages[i + 1]
    
    if (!currentImage.selectedArea || !nextImage.selectedArea) {
      console.log(`画像${i + 1}: 選択領域がないため回転調整をスキップ`)
      continue
    }
    
    console.log(`画像${i + 1}の回転調整パラメータを計算中...`)
    
    // ORB特徴点マッチングによる回転調整
    const alignmentResult = await alignImages(currentImage, nextImage)
    
    if (alignmentResult.success) {
      // 回転パラメータのみを適用（移動は既に完了済み）
      alignedImages[i + 1] = {
        ...nextImage,
        transform: {
          scale: nextImage.transform.scale,
          rotation: alignmentResult.transform.rotation,
          translateX: nextImage.transform.translateX,
          translateY: nextImage.transform.translateY
        }
      }
      
      console.log(`画像${i + 1}の回転調整パラメータ計算完了（回転角: ${alignmentResult.transform.rotation}度）`)
    } else {
      console.log(`画像${i + 1}: マッチング失敗のため回転調整をスキップ`)
    }
  }
  
  console.log('回転調整処理完了:', {
    processedCount: alignedImages.length,
    hasTransformedImages: alignedImages.some(img => img.transform.rotation !== 0)
  })
  
  return alignedImages
} 