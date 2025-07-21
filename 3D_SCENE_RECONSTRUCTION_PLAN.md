# 3Dシーン再構築機能追加計画

## 概要

画像整列アプリに3Dシーン再構築機能を追加する技術的計画書。アップロードされた画像群に対して整列処理を施した後、OpenCVを使用した特徴点検出により撮影時のカメラ姿勢を推定し、画像群から3Dシーンを再構築する機能を実装する。

## 1. 3Dシーン再構築の技術的アプローチ

### 1.1 Structure from Motion (SfM) パイプライン

現在のプロジェクトで使用しているOpenCV.jsは、3Dシーン再構築に必要な多くの機能を提供しています：

#### 主要なOpenCV機能
- **特徴点検出・マッチング**: 既に実装済み（ORB、BFMatcher）
- **Essential Matrix計算**: `cv.findEssentialMat()`
- **カメラ姿勢推定**: `cv.recoverPose()`
- **三角測量**: `cv.triangulatePoints()`
- **Bundle Adjustment**: 基本的な最適化機能

### 1.2 推奨アルゴリズム

#### 基本パイプライン
```
1. 特徴点検出・マッチング（既存機能活用）
2. Essential Matrix計算
3. カメラ姿勢推定（R, t）
4. 3D点群の三角測量
5. Bundle Adjustment最適化
6. 3Dシーンの可視化・出力
```

#### 詳細実装方針

**ステップ1: カメラキャリブレーション**
```typescript
// カメラ内部パラメータの推定（既知の場合は固定値使用）
const cameraMatrix = cv.initCameraMatrix2D(objectPoints, imagePoints, imageSize);
const distCoeffs = new cv.Mat(); // 歪み係数
```

**ステップ2: Essential Matrix計算**
```typescript
// マッチした特徴点からEssential Matrixを計算
const essentialMatrix = cv.findEssentialMat(
  points1, points2, 
  cameraMatrix, 
  cv.RANSAC, 0.999, 1.0
);
```

**ステップ3: カメラ姿勢推定**
```typescript
// Essential Matrixからカメラ姿勢を復元
const { R, t, mask } = cv.recoverPose(
  essentialMatrix, points1, points2, cameraMatrix
);
```

**ステップ4: 3D点群生成**
```typescript
// 三角測量で3D点を計算
const points3D = cv.triangulatePoints(
  P1, P2, points1, points2
);
```

## 2. 技術的課題と解決策

### 2.1 OpenCV.jsの制限事項

#### 制限事項
- **Bundle Adjustment**: 高度な最適化機能が不足
- **大規模点群処理**: メモリ制限による処理速度の低下
- **3D可視化**: 基本的な可視化機能のみ

#### 解決策

**A. 外部ライブラリの組み合わせ**
```typescript
// 推奨ライブラリ構成
- OpenCV.js: 基本的なSfM処理
- Three.js: 3D可視化・レンダリング
- Ceres.js (WebAssembly): Bundle Adjustment最適化
- Draco: 3D点群圧縮・最適化
```

**B. 段階的処理アプローチ**
```typescript
// 1. 軽量な初期推定（OpenCV.js）
// 2. 高精度な最適化（外部ライブラリ）
// 3. 3D可視化（Three.js）
```

### 2.2 実装方針の詳細

#### 方針A: OpenCV.js + Three.js（推奨）

**利点:**
- 既存コードとの統合が容易
- Three.jsによる高品質な3D可視化
- WebGLによる高速レンダリング

**実装構成:**
```typescript
// 新しいユーティリティファイル
src/utils/
├── structureFromMotion.ts    // SfM処理
├── cameraCalibration.ts      // カメラキャリブレーション
├── threeSceneRenderer.ts     // Three.js可視化
└── pointCloudProcessor.ts    // 点群処理
```

#### 方針B: 専用SfMライブラリの使用

**COLMAP.js（WebAssembly版）**
- より高精度なSfM処理
- 大規模点群に対応
- ただし、実装が複雑

**OpenMVS.js**
- メッシュ生成機能
- テクスチャマッピング
- より完全な3D再構築

## 3. 具体的な実装計画

### 3.1 段階的実装アプローチ

#### Phase 1: 基本的なSfM処理
```typescript
// 既存の整列処理の後に追加
export async function generate3DScene(
  alignedImages: ImageData[]
): Promise<Scene3D> {
  // 1. 特徴点マッチング（既存機能活用）
  const matches = await matchAllImages(alignedImages);
  
  // 2. Essential Matrix計算
  const essentialMatrices = calculateEssentialMatrices(matches);
  
  // 3. カメラ姿勢推定
  const cameraPoses = estimateCameraPoses(essentialMatrices);
  
  // 4. 3D点群生成
  const pointCloud = triangulatePoints(matches, cameraPoses);
  
  return { pointCloud, cameraPoses };
}
```

#### Phase 2: 3D可視化機能
```typescript
// Three.jsによる3Dシーン表示
export class Scene3DRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  constructor(container: HTMLElement) {
    this.setupThreeJS(container);
  }
  
  renderPointCloud(pointCloud: Point3D[]) {
    // 点群の可視化
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pointCloud.length * 3);
    // ... 実装
  }
  
  renderCameraPoses(cameraPoses: CameraPose[]) {
    // カメラ位置の可視化
    // ... 実装
  }
}
```

#### Phase 3: 高度な最適化
```typescript
// Bundle Adjustment（外部ライブラリ使用）
export async function optimizeScene(
  scene: Scene3D
): Promise<Scene3D> {
  // Ceres.jsによる最適化
  const optimizedScene = await bundleAdjustment(scene);
  return optimizedScene;
}
```

### 3.2 新しいUIコンポーネント

```typescript
// 3Dシーン表示コンポーネント
const Scene3DViewer: React.FC<{
  scene: Scene3D | null;
  onExport: (format: 'obj' | 'ply' | 'gltf') => void;
}> = ({ scene, onExport }) => {
  // Three.jsレンダラー
  // カメラ制御
  // エクスポート機能
};

// 3D処理制御パネル
const Scene3DControls: React.FC<{
  onGenerate3D: () => void;
  onOptimize: () => void;
  onExport: (format: string) => void;
}> = ({ onGenerate3D, onOptimize, onExport }) => {
  // 3D生成ボタン
  // 最適化オプション
  // エクスポート形式選択
};
```

## 4. 技術的推奨事項

### 4.1 ライブラリ選択

**必須ライブラリ:**
```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0",
    "draco3d": "^1.5.7"
  }
}
```

**オプションライブラリ:**
- **Ceres.js**: Bundle Adjustment最適化
- **COLMAP.js**: 高精度SfM処理
- **Draco**: 点群圧縮・最適化

### 4.2 パフォーマンス最適化

**メモリ管理:**
```typescript
// 段階的処理によるメモリ効率化
export async function processLargeScene(
  images: ImageData[]
): Promise<Scene3D> {
  // 1. 画像をバッチ処理
  const batches = chunk(images, 10);
  
  // 2. 各バッチでSfM処理
  const partialScenes = await Promise.all(
    batches.map(batch => processBatch(batch))
  );
  
  // 3. 部分シーンを統合
  return mergeScenes(partialScenes);
}
```

**WebGL最適化:**
```typescript
// Three.jsの最適化設定
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

## 5. 実装の優先順位

### 5.1 段階的実装計画

**Phase 1（基本機能）:**
1. OpenCV.jsによる基本的なSfM処理
2. Three.jsによる3D可視化
3. 基本的なエクスポート機能（PLY形式）

**Phase 2（最適化）:**
1. Bundle Adjustment最適化
2. 点群フィルタリング・ノイズ除去
3. カメラ軌跡の可視化

**Phase 3（高度機能）:**
1. メッシュ生成
2. テクスチャマッピング
3. 複数形式でのエクスポート（OBJ、GLTF）

### 5.2 技術的リスクと対策

**リスク:**
- OpenCV.jsの処理速度制限
- 大規模点群のメモリ使用量
- 3D可視化のパフォーマンス

**対策:**
- 段階的処理による負荷分散
- Web Workersによる並列処理
- Level of Detail（LOD）による可視化最適化

## 6. データ構造とインターフェース

### 6.1 新しいデータ型

```typescript
// 3Dシーンデータ構造
interface Scene3D {
  pointCloud: Point3D[];
  cameraPoses: CameraPose[];
  metadata: SceneMetadata;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
  color?: { r: number; g: number; b: number };
  confidence?: number;
}

interface CameraPose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  imageId: string;
}

interface SceneMetadata {
  imageCount: number;
  pointCount: number;
  processingTime: number;
  quality: 'low' | 'medium' | 'high';
}
```

### 6.2 既存コードとの統合

```typescript
// App.tsxへの追加
interface AppState {
  // 既存の状態
  images: ImageData[];
  selectedImageId: string | null;
  
  // 新しい3D状態
  scene3D: Scene3D | null;
  isGenerating3D: boolean;
  sceneViewerMode: '2d' | '3d';
}
```

## 7. エクスポート機能

### 7.1 対応形式

**点群形式:**
- **PLY**: 基本的な点群データ
- **XYZ**: シンプルな座標データ
- **PCD**: Point Cloud Library形式

**3Dモデル形式:**
- **OBJ**: メッシュデータ（Phase 3）
- **GLTF**: 現代的な3D形式（Phase 3）
- **STL**: 3Dプリント用（Phase 3）

### 7.2 エクスポート実装

```typescript
export async function exportScene3D(
  scene: Scene3D,
  format: 'ply' | 'obj' | 'gltf'
): Promise<void> {
  switch (format) {
    case 'ply':
      return exportAsPLY(scene);
    case 'obj':
      return exportAsOBJ(scene);
    case 'gltf':
      return exportAsGLTF(scene);
  }
}
```

## 8. まとめ

この方針により、既存の画像整列機能を活用しながら、段階的に3Dシーン再構築機能を追加することが可能です。OpenCV.js + Three.jsの組み合わせが最も実用的で、既存コードとの統合も容易になります。

### 推奨実装順序

1. **Phase 1**: 基本的なSfM処理と3D可視化
2. **Phase 2**: 最適化とフィルタリング
3. **Phase 3**: 高度な機能（メッシュ生成、テクスチャマッピング）

この段階的アプローチにより、リスクを最小化しながら、実用的な3Dシーン再構築機能を実現できます。 