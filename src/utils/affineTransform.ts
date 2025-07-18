// アフィン変換の計算を行うユーティリティ関数

export interface Point {
  x: number
  y: number
}

export interface AffineTransform {
  a: number  // スケールX
  b: number  // スキューY
  c: number  // スキューX
  d: number  // スケールY
  tx: number // 平行移動X
  ty: number // 平行移動Y
}

export interface TransformParams {
  scale: number
  rotation: number
  translateX: number
  translateY: number
}

/**
 * 2つの点集合からアフィン変換行列を計算
 */
export function calculateAffineTransform(
  sourcePoints: Point[],
  targetPoints: Point[]
): AffineTransform {
  if (sourcePoints.length < 3 || targetPoints.length < 3) {
    throw new Error('少なくとも3つの点が必要です')
  }

  // 最小二乗法でアフィン変換を計算
  const n = sourcePoints.length
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0
  let sumU = 0, sumV = 0, sumUX = 0, sumUY = 0, sumVX = 0, sumVY = 0

  for (let i = 0; i < n; i++) {
    const src = sourcePoints[i]
    const tgt = targetPoints[i]
    
    sumX += src.x
    sumY += src.y
    sumX2 += src.x * src.x
    sumY2 += src.y * src.y
    sumXY += src.x * src.y
    sumU += tgt.x
    sumV += tgt.y
    sumUX += tgt.x * src.x
    sumUY += tgt.x * src.y
    sumVX += tgt.y * src.x
    sumVY += tgt.y * src.y
  }

  const det = n * sumX2 * sumY2 + 2 * sumX * sumY * sumXY - sumX2 * sumY * sumY - sumY2 * sumX * sumX - sumXY * sumXY

  if (Math.abs(det) < 1e-10) {
    throw new Error('変換行列が計算できません')
  }

  const a = (n * sumUX * sumY2 + sumUY * sumXY * sumY + sumU * sumY * sumXY - sumUX * sumY * sumY - sumUY * sumX * sumY2 - sumU * sumXY * sumXY) / det
  const b = (n * sumUY * sumX2 + sumUX * sumXY * sumX + sumU * sumX * sumXY - sumUY * sumX * sumX - sumUX * sumY * sumX2 - sumU * sumXY * sumXY) / det
  const c = (n * sumVX * sumY2 + sumVY * sumXY * sumY + sumV * sumY * sumXY - sumVX * sumY * sumY - sumVY * sumX * sumY2 - sumV * sumXY * sumXY) / det
  const d = (n * sumVY * sumX2 + sumVX * sumXY * sumX + sumV * sumX * sumXY - sumVY * sumX * sumX - sumVX * sumY * sumX2 - sumV * sumXY * sumXY) / det
  const tx = (sumU - a * sumX - b * sumY) / n
  const ty = (sumV - c * sumX - d * sumY) / n

  return { a, b, c, d, tx, ty }
}

/**
 * アフィン変換を適用して点を変換
 */
export function applyAffineTransform(point: Point, transform: AffineTransform): Point {
  return {
    x: transform.a * point.x + transform.b * point.y + transform.tx,
    y: transform.c * point.x + transform.d * point.y + transform.ty
  }
}

/**
 * TransformParamsからアフィン変換行列を生成
 */
export function createAffineTransformFromParams(params: TransformParams): AffineTransform {
  const { scale, rotation, translateX, translateY } = params
  const rad = (rotation * Math.PI) / 180
  
  return {
    a: scale * Math.cos(rad),
    b: scale * Math.sin(rad),
    c: -scale * Math.sin(rad),
    d: scale * Math.cos(rad),
    tx: translateX,
    ty: translateY
  }
}

/**
 * 2つの領域の中心点を計算
 */
export function calculateCenter(area: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: area.x + area.width / 2,
    y: area.y + area.height / 2
  }
}

/**
 * 領域の4隅の点を計算
 */
export function calculateCorners(area: { x: number; y: number; width: number; height: number }): Point[] {
  return [
    { x: area.x, y: area.y }, // 左上
    { x: area.x + area.width, y: area.y }, // 右上
    { x: area.x + area.width, y: area.y + area.height }, // 右下
    { x: area.x, y: area.y + area.height } // 左下
  ]
} 