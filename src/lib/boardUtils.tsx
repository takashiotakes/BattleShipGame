// src/lib/boardUtils.tsx

import { Cell, PlayerBoard, ALL_SHIPS, PlacedShip, Orientation, Coordinate, ShipDefinition, CellStatus } from '../models/types'; // CellStatusを追加

/**
 * 10x10の空のボードを生成します。
 * @param playerId ボードを所有するプレイヤーのID
 * @returns 初期化されたPlayerBoardオブジェクト
 */
export const createEmptyBoard = (playerId: number): PlayerBoard => {
  const cells: Cell[][] = Array.from({ length: 10 }, (_, rowIndex) =>
    Array.from({ length: 10 }, (_, colIndex) => ({
      x: colIndex,
      y: rowIndex,
      status: 'empty',
    }))
  );

  // 初期状態の船の定義リストから、未配置のPlacedShipリストを生成
  const initialPlacedShips: PlacedShip[] = ALL_SHIPS.map(shipDef => ({
    id: shipDef.id,
    definition: shipDef,
    start: { x: -1, y: -1 }, // 未配置を示す仮の値
    orientation: 'horizontal' as Orientation, // 仮の値
    hits: [],
    isSunk: false,
  }));

  return {
    playerId: playerId,
    cells: cells,
    placedShips: initialPlacedShips, // 初期化された船のリストを設定
  };
};

/**
 * 指定されたPlacedShipリストに基づいてボードのセルを更新します。
 * この関数は、船を配置した結果の「最終的な」ボード状態を生成するために使用します。
 * @param baseCells 空のボードのセルデータ（通常は createEmptyBoard で得られたもの）
 * @param placedShips 配置された船のリスト
 * @returns 船が配置された状態のセルデータ
 */
export const updateCellsWithShips = (baseCells: Cell[][], placedShips: PlacedShip[]): Cell[][] => {
  // 元の cells を変更しないようにディープコピー
  const newCells = baseCells.map(row => row.map(cell => ({ ...cell })));

  placedShips.forEach(ship => {
    // 船がまだ配置されていないか、スタート座標が無効な場合はスキップ
    if (ship.start.x === -1 || ship.start.y === -1) {
      return;
    }

    for (let i = 0; i < ship.definition.size; i++) {
      let x = ship.start.x;
      let y = ship.start.y;

      if (ship.orientation === 'horizontal') {
        x += i;
      } else {
        y += i;
      }

      // 範囲チェック
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        // 既存のセルの状態を維持しつつ、船の情報を追加
        newCells[y][x] = {
          ...newCells[y][x],
          status: 'ship', // 船があることを示す
          shipId: ship.id,
        };
      }
    }
  });

  return newCells;
};

/**
 * 指定された座標がボードの範囲内にあるかチェックします。
 * @param coord チェックする座標
 * @returns 範囲内であればtrue、そうでなければfalse
 */
export const isCoordinateInBounds = (coord: Coordinate): boolean => {
  return coord.x >= 0 && coord.x < 10 && coord.y >= 0 && coord.y < 10;
};

/**
 * 船の配置が有効であるか（ボード範囲内、他の船と重ならない）をチェックします。
 * @param shipDef 配置しようとしている船の定義
 * @param start 開始座標
 * @param orientation 向き
 * @param existingPlacedShips 既に配置済みの船のリスト（衝突判定用）
 * @returns 配置が有効であればtrue、そうでなければfalse
 */
export const isValidPlacement = (
  shipDef: ShipDefinition,
  start: Coordinate,
  orientation: Orientation,
  existingPlacedShips: PlacedShip[]
): boolean => {
  const boardSize = 10;

  for (let i = 0; i < shipDef.size; i++) {
    let x = start.x;
    let y = start.y;

    if (orientation === 'horizontal') {
      x += i;
    } else {
      y += i;
    }

    const currentCoord: Coordinate = { x, y };

    // 1. ボードの範囲内かチェック
    if (!isCoordinateInBounds(currentCoord)) {
      return false;
    }

    // 2. 他の船と重ならないかチェック
    for (const existingShip of existingPlacedShips) {
      // プレビュー対象の船自身と衝突判定しないように、idが同じ場合はスキップ
      for (let j = 0; j < existingShip.definition.size; j++) {
        let existingX = existingShip.start.x;
        let existingY = existingShip.start.y;

        if (existingShip.orientation === 'horizontal') {
          existingX += j;
        } else {
          existingY += j;
        }

        if (currentCoord.x === existingX && currentCoord.y === existingY) {
          // 既存の船のいずれかのセルと衝突
          return false;
        }
      }
    }
  }
  return true;
};

/**
 * 既存のセルデータと仮置きする船の情報を元に、プレビュー表示用のセルデータを生成します。
 * この関数は実際のボードの状態を変更せず、一時的な表示のために使われます。
 * @param currentCells 現在のボードのセルデータ
 * @param shipToPreviewDef プレビューする船の定義
 * @param previewStart プレビュー開始座標
 * @param previewOrientation プレビュー向き
 * @param isValidPreviewPlacement プレビューが有効な配置かどうかのフラグ
 * @returns プレビューが反映されたセルデータ
 */
export const getCellsWithPreview = (
  currentCells: Cell[][],
  shipToPreviewDef: ShipDefinition,
  previewStart: Coordinate,
  previewOrientation: Orientation,
  isValidPreviewPlacement: boolean // isValidPlacementの結果を外部から受け取る
): Cell[][] => {
  // 元の cells を変更しないようにディープコピー
  const cellsWithPreview = currentCells.map(row => row.map(cell => ({ ...cell })));

  // 配置が有効な場合のみプレビューを反映
  if (isValidPreviewPlacement) {
    for (let i = 0; i < shipToPreviewDef.size; i++) {
      let x = previewStart.x;
      let y = previewStart.y;

      if (previewOrientation === 'horizontal') {
        x += i;
      } else {
        y += i;
      }

      // 範囲チェック (isCoordinateInBoundsで既にチェック済みだが念のため)
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        // プレビュー用の新しい状態を設定
        cellsWithPreview[y][x] = {
          ...cellsWithPreview[y][x],
          status: 'ship', // プレビューとして'ship'状態にする (既存の船はisValidPlacementで除外されているはずなので上書きOK)
        };
      }
    }
  }
  return cellsWithPreview;
};

/**
 * ランダムな座標を生成します。
 */
const getRandomCoordinate = (): Coordinate => {
  return {
    x: Math.floor(Math.random() * 10),
    y: Math.floor(Math.random() * 10),
  };
};

/**
 * ランダムな向きを生成します。
 */
const getRandomOrientation = (): Orientation => {
  return Math.random() < 0.5 ? 'horizontal' : 'vertical';
};

/**
 * 指定された船をボードにランダムに配置します。
 * @param shipToPlaceDef 配置する船の定義
 * @param currentPlacedShips 現在配置済みの船のリスト
 * @returns 配置に成功したPlacedShipオブジェクト、または失敗した場合はnull
 */
export const placeShipRandomly = (
  shipToPlaceDef: ShipDefinition,
  currentPlacedShips: PlacedShip[]
): PlacedShip | null => {
  let attempts = 0;
  const maxAttempts = 500; // 無限ループを防ぐための最大試行回数

  while (attempts < maxAttempts) {
    const startCoord = getRandomCoordinate();
    const orientation = getRandomOrientation();

    // 仮のPlacedShipオブジェクトを作成（IDは元の船の定義から引き継ぐ）
    const tempShip: PlacedShip = {
        id: shipToPlaceDef.id, // ここでidを使用する
        definition: shipToPlaceDef,
        start: startCoord,
        orientation: orientation,
        hits: [],
        isSunk: false,
    };

    // 配置が有効かチェック
    // isValidPlacementはすでに配置済みの船との衝突もチェックしてくれる
    if (isValidPlacement(shipToPlaceDef, startCoord, orientation, currentPlacedShips)) {
      return tempShip; // 有効な配置が見つかった
    }
    attempts++;
  }

  console.warn(`Warning: Could not place ship ${shipToPlaceDef.name} after ${maxAttempts} attempts.`);
  return null; // 配置できなかった
};