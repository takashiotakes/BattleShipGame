// src/lib/boardUtils.ts

import { Cell, CellStatus, Coordinate, Orientation, PlacedShip, ShipDefinition } from '../models/types';

export function createEmptyBoard(playerId: number): { playerId: number; cells: Cell[][] } {
  const cells: Cell[][] = [];
  for (let y = 0; y < 10; y++) {
    cells[y] = [];
    for (let x = 0; x < 10; x++) {
      cells[y][x] = { x, y, status: 'empty' };
    }
  }
  return { playerId, cells };
}

// 船がボードの範囲内に収まっているかチェック
export function isShipWithinBounds(start: Coordinate, size: number, orientation: Orientation): boolean {
  if (orientation === 'horizontal') {
    return start.x + size <= 10;
  } else {
    return start.y + size <= 10;
  }
}

// 船が他の船と衝突しないかチェック
export function isShipPlacementValid(
  boardCells: Cell[][], // 検証対象のボードの状態
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;

    // ボードの範囲外、または既に船があるマスに配置しようとしていないか
    if (x < 0 || x >= 10 || y < 0 || y >= 10 || boardCells[y][x].status === 'ship') {
      return false; // 無効な配置
    }
  }
  return true; // 有効な配置
}

// 船をボードに配置する関数 (既存のボードを書き換えるのではなく、新しいボードを返すように)
export function placeShipOnBoard(
  boardCells: Cell[][],
  shipDefinition: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = boardCells.map(row => row.map(cell => ({ ...cell }))); // ディープコピー

  for (let i = 0; i < shipDefinition.size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;

    if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        // 既にヒットしているセルは 'hit' のままにする
        // ここは船の配置ロジックなので、'hit'や'sunk'セルは元々存在しないはずだが、
        // 念のためこのチェックを残す
        if (newCells[y][x].status !== 'hit' && newCells[y][x].status !== 'sunk') {
            newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: shipDefinition.id };
        }
    }
  }
  return newCells;
}

// ランダムに船を配置するヘルパー関数
export function generateRandomShipPlacement(
  playerId: number,
  shipDefinition: ShipDefinition,
  existingPlacedShips: PlacedShip[] // 既に配置済みの船のリストを渡す
): PlacedShip | null {
  const orientations: Orientation[] = ['horizontal', 'vertical'];
  let attempts = 0;
  const maxAttempts = 1000; // 無限ループ防止

  while (attempts < maxAttempts) {
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];
    const start: Coordinate = {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

    // 新しい船を仮に配置してみる
    const tempShip: PlacedShip = {
      id: shipDefinition.id,
      definition: shipDefinition,
      start: start,
      orientation: orientation,
      hits: [],
      isSunk: false,
    };

    // 現在配置済みの船を含めた一時的なボードを作成し、配置可能かチェック
    // 毎回空のボードから作り直し、既存の船を全て配置する
    let tempBoardCells = createEmptyBoard(playerId).cells;
    existingPlacedShips.forEach(pShip => {
      tempBoardCells = placeShipOnBoard(tempBoardCells, pShip.definition, pShip.start, pShip.orientation);
    });

    if (isShipWithinBounds(start, shipDefinition.size, orientation) &&
        isShipPlacementValid(tempBoardCells, start, shipDefinition.size, orientation)) {
      return tempShip; // 有効な配置が見つかった
    }
    attempts++;
  }
  return null; // 配置できなかった
}