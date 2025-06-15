// src/utils/useAiAttackLogic.tsx
import { useCallback } from 'react';
import { PlayerBoard, Coordinate, CellStatus, AIDifficulty, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types';

interface AiAttackLogic {
  getAiAttackCoordinate: (
    difficulty: AIDifficulty,
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[], // 撃沈された船のリスト
    remainingShipDefinitions: ShipDefinition[] // まだ見つかっていない船の定義リスト
  ) => Coordinate;
}

export const useAiAttackLogic = (): AiAttackLogic => {

  // EasyモードのAIロジック
  const getEasyAttack = useCallback((opponentBoard: PlayerBoard): Coordinate => {
    const availableCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cellStatus = opponentBoard.cells[r][c].status;
        if (cellStatus === 'empty' || cellStatus === 'ship') { // まだ攻撃していないマス
          availableCells.push({ x: c, y: r });
        }
      }
    }
    if (availableCells.length === 0) {
      // 全てのマスが攻撃済みの場合（デバッグ用）
      // このケースは本来到達しないはずだが、念のため無限ループを避ける
      return { x: 0, y: 0 };
    }
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    return availableCells[randomIndex];
  }, []);

  // NormalモードのAIロジック
  const getNormalAttack = useCallback((opponentBoard: PlayerBoard): Coordinate => {
    // 1. ヒットした船の周囲を探す (船が沈んでいない場合)
    const hitCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (opponentBoard.cells[r][c].status === 'hit' && opponentBoard.cells[r][c].shipId) {
          const ship = opponentBoard.placedShips.find(s => s.id === opponentBoard.cells[r][c].shipId);
          if (ship && !ship.isSunk) {
            hitCells.push({ x: c, y: r });
          }
        }
      }
    }

    if (hitCells.length > 0) {
      // ヒットしたマスの周囲（上下左右）を優先的に攻撃
      const targetCandidates: Coordinate[] = [];
      hitCells.forEach(hitCoord => {
        const potentialTargets = [
          { x: hitCoord.x + 1, y: hitCoord.y },
          { x: hitCoord.x - 1, y: hitCoord.y },
          { x: hitCoord.x, y: hitCoord.y + 1 },
          { x: hitCoord.x, y: hitCoord.y - 1 },
        ];
        potentialTargets.forEach(p => {
          if (p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10) {
            const status = opponentBoard.cells[p.y][p.x].status;
            if (status === 'empty' || status === 'ship') {
              targetCandidates.push(p);
            }
          }
        });
      });

      if (targetCandidates.length > 0) {
        // 重複を削除してランダムに選択
        const uniqueCandidates = Array.from(new Set(targetCandidates.map(c => `${c.x},${c.y}`)))
                                    .map(s => { const [x, y] = s.split(',').map(Number); return { x, y }; });
        return uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)];
      }
    }

    // 2. ヒットしたマスがない場合、または周囲に攻撃可能なマスがない場合、ランダムに奇数/偶数マスを攻撃 (Normalモードの特徴)
    const availableOddEvenCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cellStatus = opponentBoard.cells[r][c].status;
        // (r + c) % 2 === 0 は市松模様の攻撃パターン
        if ((r + c) % 2 === 0 && (cellStatus === 'empty' || cellStatus === 'ship')) {
          availableOddEvenCells.push({ x: c, y: r });
        }
      }
    }

    if (availableOddEvenCells.length > 0) {
      return availableOddEvenCells[Math.floor(Math.random() * availableOddEvenCells.length)];
    }

    // 奇数/偶数マスも全て埋まっている場合、Easyモードと同じランダム攻撃
    return getEasyAttack(opponentBoard);
  }, [getEasyAttack]);

  // HardモードのAIロジック
  const getHardAttack = useCallback((
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[],
    remainingShipDefinitions: ShipDefinition[]
  ): Coordinate => {
    const probabilities: { [key: string]: number } = {};
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        probabilities[`${c},${r}`] = 0;
      }
    }

    // 1. ヒットした船の周囲を探す (Normalモードと同様のロジックをより強化)
    const hitCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (opponentBoard.cells[r][c].status === 'hit' && opponentBoard.cells[r][c].shipId) {
          const ship = opponentBoard.placedShips.find(s => s.id === opponentBoard.cells[r][c].shipId);
          if (ship && !ship.isSunk) {
            hitCells.push({ x: c, y: r });
          }
        }
      }
    }

    if (hitCells.length > 0) {
      // 複数のヒット箇所がある場合、船の方向を推測し、その方向を優先的に攻撃
      const targetCandidates: Coordinate[] = [];
      const potentialDirections: { [key: string]: boolean } = {}; // 'horizontal' or 'vertical'

      // ヒットしたセルのペアから方向を推測
      if (hitCells.length >= 2) {
        // x座標が同じでy座標が異なる -> 垂直方向の船
        const isVertical = hitCells.every(coord => coord.x === hitCells[0].x);
        // y座標が同じでx座標が異なる -> 水平方向の船
        const isHorizontal = hitCells.every(coord => coord.y === hitCells[0].y);

        if (isVertical) potentialDirections.vertical = true;
        if (isHorizontal) potentialDirections.horizontal = true;

        if (isVertical || isHorizontal) { // 方向が特定できた場合
            const minX = Math.min(...hitCells.map(c => c.x));
            const maxX = Math.max(...hitCells.map(c => c.x));
            const minY = Math.min(...hitCells.map(c => c.y));
            const maxY = Math.max(...hitCells.map(c => c.y));

            for (const hitCoord of hitCells) {
                // 特定された方向で次の攻撃候補を探す
                if (potentialDirections.vertical) {
                    // 上方向
                    if (hitCoord.y - 1 >= 0 && (opponentBoard.cells[hitCoord.y - 1][hitCoord.x].status === 'empty' || opponentBoard.cells[hitCoord.y - 1][hitCoord.x].status === 'ship')) {
                        targetCandidates.push({ x: hitCoord.x, y: hitCoord.y - 1 });
                    }
                    // 下方向
                    if (hitCoord.y + 1 < 10 && (opponentBoard.cells[hitCoord.y + 1][hitCoord.x].status === 'empty' || opponentBoard.cells[hitCoord.y + 1][hitCoord.x].status === 'ship')) {
                        targetCandidates.push({ x: hitCoord.x, y: hitCoord.y + 1 });
                    }
                }
                if (potentialDirections.horizontal) {
                    // 左方向
                    if (hitCoord.x - 1 >= 0 && (opponentBoard.cells[hitCoord.y][hitCoord.x - 1].status === 'empty' || opponentBoard.cells[hitCoord.y][hitCoord.x - 1].status === 'ship')) {
                        targetCandidates.push({ x: hitCoord.x - 1, y: hitCoord.y });
                    }
                    // 右方向
                    if (hitCoord.x + 1 < 10 && (opponentBoard.cells[hitCoord.y][hitCoord.x + 1].status === 'empty' || opponentBoard.cells[hitCoord.y][hitCoord.x + 1].status === 'ship')) {
                        targetCandidates.push({ x: hitCoord.x + 1, y: hitCoord.y });
                    }
                }
            }
        }
      }

      // 方向が特定できない場合や単一ヒットの場合、全方向をチェック
      if (targetCandidates.length === 0) {
          hitCells.forEach(hitCoord => {
            const potentialTargets = [
              { x: hitCoord.x + 1, y: hitCoord.y },
              { x: hitCoord.x - 1, y: hitCoord.y },
              { x: hitCoord.x, y: hitCoord.y + 1 },
              { x: hitCoord.x, y: hitCoord.y - 1 },
            ];
            potentialTargets.forEach(p => {
              if (p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10) {
                const status = opponentBoard.cells[p.y][p.x].status;
                if (status === 'empty' || status === 'ship') {
                  targetCandidates.push(p);
                }
              }
            });
          });
      }

      if (targetCandidates.length > 0) {
        const uniqueCandidates = Array.from(new Set(targetCandidates.map(c => `${c.x},${c.y}`)))
                                    .map(s => { const [x, y] = s.split(',').map(Number); return { x, y }; });
        return uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)];
      }
    }


    // 2. まだ沈んでいない船の定義と、攻撃されていないマスから、各マスに船が存在する確率を計算
    remainingShipDefinitions.forEach(shipDef => {
      // 水平方向の配置を試行
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c <= 10 - shipDef.size; c++) {
          let canPlace = true;
          for (let i = 0; i < shipDef.size; i++) {
            const cellStatus = opponentBoard.cells[r][c + i].status;
            if (cellStatus === 'hit' || cellStatus === 'miss' || cellStatus === 'sunk') {
              canPlace = false;
              break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < shipDef.size; i++) {
              probabilities[`${c + i},${r}`]++;
            }
          }
        }
      }

      // 垂直方向の配置を試行
      for (let c = 0; c < 10; c++) {
        for (let r = 0; r <= 10 - shipDef.size; r++) {
          let canPlace = true;
          for (let i = 0; i < shipDef.size; i++) {
            const cellStatus = opponentBoard.cells[r + i][c].status;
            if (cellStatus === 'hit' || cellStatus === 'miss' || cellStatus === 'sunk') {
              canPlace = false;
              break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < shipDef.size; i++) {
              probabilities[`${c},${r + i}`]++;
            }
          }
        }
      }
    });

    let maxProbability = -1;
    let bestCandidates: Coordinate[] = [];

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const coordKey = `${c},${r}`; // x,y の順
        const currentProbability = probabilities[coordKey];
        const cellStatus = opponentBoard.cells[r][c].status;

        // 既に攻撃済みのマスは対象外
        if (cellStatus === 'hit' || cellStatus === 'miss' || cellStatus === 'sunk') {
          continue;
        }

        if (currentProbability > maxProbability) {
          maxProbability = currentProbability;
          bestCandidates = [{ x: c, y: r }];
        } else if (currentProbability === maxProbability) {
          bestCandidates.push({ x: c, y: r });
        }
      }
    }

    if (bestCandidates.length > 0) {
      // 確率が最も高いマスが複数ある場合、ランダムに選択
      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
    }

    // 3. 確率計算でも候補が見つからない場合（ほぼ発生しないはずだが念のため）、Easyモードと同じランダム攻撃
    return getEasyAttack(opponentBoard);

  }, [getEasyAttack]);


  const getAiAttackCoordinate = useCallback((
    difficulty: AIDifficulty,
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[],
    remainingShipDefinitions: ShipDefinition[]
  ): Coordinate => {
    if (difficulty === 'easy') {
      return getEasyAttack(opponentBoard);
    } else if (difficulty === 'normal') {
      return getNormalAttack(opponentBoard);
    } else if (difficulty === 'hard') {
      return getHardAttack(opponentBoard, sunkShips, remainingShipDefinitions);
    }
    // デフォルトはEasy
    return getEasyAttack(opponentBoard);
  }, [getEasyAttack, getNormalAttack, getHardAttack]);

  return { getAiAttackCoordinate };
};