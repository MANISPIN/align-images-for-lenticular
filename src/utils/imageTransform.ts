// 画像変換パラメータを計算するユーティリティ関数

export interface TransformedImage {
  id: string
  file: File
  url: string
  width: number
  height: number
  selectedArea: { x: number; y: number; width: number; height: number } | null
  transform: { scale: number; rotation: number; translateX: number; translateY: number }
  // transformedDataUrlを削除
}

/**
 * 選択領域が画像の中心に来るように移動パラメータを計算
 */
export function calculateCenterImageTransform(
  width: number,
  height: number,
  currentTransform: { scale: number; rotation: number; translateX: number; translateY: number },
  selectedArea?: { x: number; y: number; width: number; height: number }
): { scale: number; rotation: number; translateX: number; translateY: number } {
  let translateX = 0;
  let translateY = 0;
  
  if (selectedArea) {
    // 選択領域の中心を計算
    const selectedCenterX = selectedArea.x + selectedArea.width / 2;
    const selectedCenterY = selectedArea.y + selectedArea.height / 2;
    
    // 画像中心からの相対位置を計算
    const relativeCenterX = selectedCenterX - width / 2;
    const relativeCenterY = selectedCenterY - height / 2;
    
    console.log('calculateCenterImageTransform詳細計算:', {
      selectedArea,
      selectedCenterX, selectedCenterY,
      imageWidth: width, imageHeight: height,
      relativeCenterX, relativeCenterY
    });
    
    // 選択領域が画像の中心に来るように画像を移動
    translateX = -relativeCenterX;
    translateY = -relativeCenterY;
    
    console.log('calculateCenterImageTransform移動量計算:', {
      relativeCenterX, relativeCenterY,
      translateX, translateY,
      説明: '画像を選択領域が画像の中心に来るように移動'
    });
  }
  
  const newTransform = {
    scale: 1.0, // スケールは常に1.0
    rotation: currentTransform.rotation,
    translateX: translateX,
    translateY: translateY
  };
  
  console.log('calculateCenterImageTransform結果:', {
    selectedArea,
    selectedCenterX: selectedArea ? selectedArea.x + selectedArea.width / 2 : 'なし',
    selectedCenterY: selectedArea ? selectedArea.y + selectedArea.height / 2 : 'なし',
    relativeCenterX: selectedArea ? (selectedArea.x + selectedArea.width / 2) - width / 2 : 'なし',
    relativeCenterY: selectedArea ? (selectedArea.y + selectedArea.height / 2) - height / 2 : 'なし',
    translateX, translateY,
    newTransform,
    注意: 'スケールは常に1.0に固定'
  });
  
  return newTransform;
}

/**
 * 2つの画像の選択領域を一致させる移動パラメータを計算
 */
export function calculateAlignImagesTransform(
  image1Width: number,
  image1Height: number,
  image1Transform: { scale: number; rotation: number; translateX: number; translateY: number },
  image2Width: number,
  image2Height: number,
  image2Transform: { scale: number; rotation: number; translateX: number; translateY: number },
  image1SelectedArea?: { x: number; y: number; width: number; height: number },
  image2SelectedArea?: { x: number; y: number; width: number; height: number }
): { scale: number; rotation: number; translateX: number; translateY: number } {
  let translateX = 0;
  let translateY = 0;
  if (image1SelectedArea && image2SelectedArea) {
    // 前の画像（image1）の選択領域の中心を計算（画像座標系）
    const image1SelectedCenterX = image1SelectedArea.x + image1SelectedArea.width / 2;
    const image1SelectedCenterY = image1SelectedArea.y + image1SelectedArea.height / 2;
    
    // 現在の画像（image2）の選択領域の中心を計算（画像座標系）
    const image2SelectedCenterX = image2SelectedArea.x + image2SelectedArea.width / 2;
    const image2SelectedCenterY = image2SelectedArea.y + image2SelectedArea.height / 2;
    
    // 前の画像の選択領域の中心がキャンバス上のどこにあるかを計算
    // 前の画像は既に変換済みなので、その変換を考慮
    const image1CanvasCenterX = image1Transform.translateX + (image1SelectedCenterX - image1Width / 2) * 1.0;
    const image1CanvasCenterY = image1Transform.translateY + (image1SelectedCenterY - image1Height / 2) * 1.0;
    
    // 現在の画像の選択領域の中心がキャンバス上のどこにあるかを計算（変換前）
    const image2CanvasCenterX = (image2SelectedCenterX - image2Width / 2) * 1.0;
    const image2CanvasCenterY = (image2SelectedCenterY - image2Height / 2) * 1.0;
    
    // 前の画像の選択領域の中心に合わせるための移動量を計算
    translateX = image1CanvasCenterX - image2CanvasCenterX;
    translateY = image1CanvasCenterY - image2CanvasCenterY;
    
    console.log('calculateAlignImagesTransform計算:', {
      image1SelectedArea,
      image2SelectedArea,
      image1SelectedCenterX, image1SelectedCenterY,
      image2SelectedCenterX, image2SelectedCenterY,
      image1CanvasCenterX, image1CanvasCenterY,
      image2CanvasCenterX, image2CanvasCenterY,
      translateX, translateY,
      説明: '前の画像の選択領域の中心に合わせるように移動'
    });
  }
  
  // スケールは常に1.0に固定
  const newTransform = {
    scale: 1.0, // スケールは常に1.0に固定
    rotation: image2Transform.rotation,
    translateX: translateX,
    translateY: translateY
  };
  
  console.log('calculateAlignImagesTransform結果:', {
    image1SelectedArea,
    image2SelectedArea,
    translateX, translateY,
    newTransform,
    注意: 'スケールは常に1.0に固定'
  });
  
  return newTransform;
}

/**
 * 複数の変換パラメータを順次適用して合成する
 */
export function combineTransforms(...transforms: { scale: number; rotation: number; translateX: number; translateY: number }[]): { scale: number; rotation: number; translateX: number; translateY: number } {
  let combined = { scale:1, rotation:0, translateX: 0, translateY: 0 };
  
  for (const transform of transforms) {
    // 回転の合成
    const newRotation = combined.rotation + transform.rotation;
    
    // 移動の合成（回転を考慮）
    const rad = (combined.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const rotatedTranslateX = transform.translateX * cos - transform.translateY * sin;
    const rotatedTranslateY = transform.translateX * sin + transform.translateY * cos;
    
    combined = {
      scale: combined.scale * transform.scale,
      rotation: newRotation,
      translateX: combined.translateX + rotatedTranslateX,
      translateY: combined.translateY + rotatedTranslateY
    };
  }
  
  return combined;
} 