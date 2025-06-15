// src/lib/boardUtils.ts

import { Cell, CellStatus, Coordinate, Orientation, PlacedShip, ShipDefinition, PlayerBoard } from '../models/types';

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
  boardCells: Cell[][],
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;

    // 範囲チェックはisShipWithinBoundsで別途行うため、ここでは不要だが念のため
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      return false;
    }
    // 'ship' または 'sunk' のマスに重ねて配置できないようにする
    if (boardCells[y][x].status === 'ship' || boardCells[y][x].status === 'sunk') {
      return false; // 既に船があるマスとは衝突
    }
  }
  return true;
}


// 船をボードに配置するヘルパー関数
// (placedShips から更新されるので、直接 boardCells を更新するロジックは削除)
export function placeShipOnBoard(
  currentCells: Cell[][],
  shipDefinition: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = currentCells.map(row => [...row]); // ディープコピー
  for (let i = 0; i < shipDefinition.size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;
    if (newCells[y] && newCells[y][x]) { // 範囲外アクセス防止
      newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: shipDefinition.id };
    }
  }
  return newCells;
}

// 船が全て撃沈されたかチェックする関数
export function checkShipSunk(placedShip: PlacedShip, attackedCells: { [key: string]: 'hit' | 'miss' }): boolean {
  for (let i = 0; i < placedShip.definition.size; i++) {
    const x = placedShip.orientation === 'horizontal' ? placedShip.start.x + i : placedShip.start.x;
    const y = placedShip.orientation === 'vertical' ? placedShip.start.y + i : placedShip.start.y;
    const coordKey = `${x},${y}`;
    if (attackedCells[coordKey] !== 'hit') {
      return false; // 1箇所でもヒットしていなければ沈んでいない
    }
  }
  return true;
}

// 全ての船が沈没したかチェックする関数
export function checkAllShipsSunk(placedShips: PlacedShip[]): boolean {
  return placedShips.every(ship => ship.isSunk);
}


// 攻撃結果に基づいてボードのセルを更新し、被弾した船の情報を更新する関数
export function applyAttackToBoard(
  originalBoard: PlayerBoard,
  coord: Coordinate
): { updatedBoard: PlayerBoard; hitShipId?: string; isSunk?: boolean; allShipsSunk: boolean } {
  const newCells = originalBoard.cells.map(row => [...row]);
  const newPlacedShips = originalBoard.placedShips.map(ship => ({ ...ship, hits: [...ship.hits] })); // ディープコピー
  const newAttackedCells = { ...originalBoard.attackedCells };

  const { x, y } = coord;
  const targetCell = newCells[y][x];

  let hit = false;
  let hitShipId: string | undefined;
  let isSunk = false;
  let allShipsSunk = false;

  newAttackedCells[`${x},${y}`] = 'miss'; // デフォルトはミス

  if (targetCell.status === 'ship') {
    hit = true;
    targetCell.status = 'hit'; // セルをヒット状態に更新
    newAttackedCells[`${x},${y}`] = 'hit'; // 攻撃済みセルをヒットとして記録

    // どの船がヒットしたか特定し、ヒット情報を更新
    const shipToUpdate = newPlacedShips.find(ship => ship.id === targetCell.shipId);
    if (shipToUpdate) {
      shipToUpdate.hits.push(coord); // ヒット座標を追加
      hitShipId = shipToUpdate.id;

      // 船が全てヒットしたかチェックし、沈没状態を更新
      if (shipToUpdate.hits.length === shipToUpdate.definition.size) {
        shipToUpdate.isSunk = true;
        isSunk = true;
        // 沈没した船のセルを 'sunk' に更新
        for (let i = 0; i < shipToUpdate.definition.size; i++) {
          const sx = shipToUpdate.orientation === 'horizontal' ? shipToUpdate.start.x + i : shipToUpdate.start.x;
          const sy = shipToUpdate.orientation === 'vertical' ? shipToUpdate.start.y + i : shipToUpdate.start.y;
          if (newCells[sy] && newCells[sy][sx]) {
            newCells[sy][sx].status = 'sunk';
          }
        }
      }
    }
  } else {
    // 船がない場合、または既にヒット/ミスのマスの場合、ステータスはそのまま
    // ただし、'empty' の場合は 'miss' にする
    if (targetCell.status === 'empty') {
      targetCell.status = 'miss';
    }
  }

  // 全ての船が沈没したか最終チェック
  allShipsSunk = newPlacedShips.every(ship => ship.isSunk);

  const updatedBoard: PlayerBoard = {
    ...originalBoard,
    cells: newCells,
    placedShips: newPlacedShips,
    attackedCells: newAttackedCells,
  };

  return { updatedBoard, hitShipId, isSunk, allShipsSunk };
}

// ランダムに船を配置するヘルパー関数
export function generateRandomShipPlacement(
  boardId: number,
  shipDefinition: ShipDefinition,
  existingPlacedShips: PlacedShip[]
): PlacedShip | null {
  // 既存の船が配置された状態の仮想ボードを作成
  let tempCells = createEmptyBoard(boardId).cells;
  existingPlacedShips.forEach(pShip => {
    tempCells = placeShipOnBoard(tempCells, pShip.definition, pShip.start, pShip.orientation);
  });

  const orientations: Orientation[] = ['horizontal', 'vertical'];
  let attempts = 0;
  const maxAttempts = 1000; // 無限ループ防止

  while (attempts < maxAttempts) {
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];
    const start: Coordinate = {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

    // 既存の船が配置された tempCells を使って有効性をチェック
    if (isShipWithinBounds(start, shipDefinition.size, orientation) &&
        isShipPlacementValid(tempCells, start, shipDefinition.size, orientation)) {
      return {
        id: shipDefinition.id,
        definition: shipDefinition,
        start,
        orientation,
        hits: [], // 新しく配置される船なのでヒットはまだない
        isSunk: false,
      };
    }
    attempts++;
  }
  console.warn(`Failed to place ship ${shipDefinition.name} after ${maxAttempts} attempts.`);
  return null;
}