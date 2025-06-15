// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings, CellStatus, AITargetingMode, ShipDefinition } from '../models/types'; // PlayerSettings と新しい型をインポート
import { ALL_SHIPS } from '../models/types';


const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [message, setMessage] = useState<string>('');
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃中フラグ

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  const opponentPlayer = useMemo(() => {
    // currentPlayerTurnId 以外の、最初の「none」ではないプレイヤーを見つける
    return players.find(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  const opponentBoard = useMemo(() => opponentPlayer ? playerBoards[opponentPlayer.id] : null, [opponentPlayer, playerBoards]);

  // ★修正箇所★ myDisplayCells
  const myDisplayCells = useMemo(() => {
    // myBoard が存在しない場合は空の配列を返す
    if (!myBoard) return createEmptyBoard(-1).cells;

    // 自分のボードは常に船が見える状態
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips, true);
  }, [myBoard]);

  // ★修正箇所★ opponentDisplayCells
  const opponentDisplayCells = useMemo(() => {
    // opponentBoard が存在しない場合は空の配列を返す
    if (!opponentBoard) return createEmptyBoard(-1).cells;

    // 相手のボードは船が見えない状態で、攻撃結果のみ表示
    return updateCellsWithShips(opponentBoard.cells, opponentBoard.placedShips, false);
  }, [opponentBoard]);


  // AIの攻撃ロジック
  const performAIAttack = useCallback(async () => {
    if (!opponentPlayer || !opponentBoard || !currentPlayer || currentPlayer.type !== 'ai') return;

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // AIの難易度に基づいて攻撃を遅延
    let delay = 500; // default for easy/normal
    if (currentPlayer.difficulty === 'hard') {
      delay = 1000; // Hardモードは思考時間を長く見せる
    }
    await new Promise(resolve => setTimeout(resolve, delay));

    const targetBoard = gameStateRef.current.playerBoards[opponentPlayer.id];
    const attackedCells = targetBoard.attackedCells; // 既に攻撃したマス
    const placedShips = targetBoard.placedShips; // 敵の配置済みの船情報（AIには見えないがロジックで使用）

    let chosenCoord: Coordinate | null = null;
    let targetingMode: AITargetingMode = 'hunting'; // 初期モード

    // ヒットしたマスの中で、まだ沈んでいない船に属するものを探す
    const hitCells: Coordinate[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const coordKey = `${x},${y}`;
        if (attackedCells[coordKey] === 'hit') {
          // ヒットしたマスが属する船がまだ沈んでいないか確認
          const cell = targetBoard.cells[y][x];
          const ship = placedShips.find(s => s.id === cell.shipId);
          if (ship && !ship.isSunk) {
            hitCells.push({ x, y });
          }
        }
      }
    }

    if (currentPlayer.difficulty === 'hard' && hitCells.length > 0) {
      targetingMode = 'targeting';

      // ターゲティングモード: ヒットしたマスの周囲を優先
      // ヒットしたマスから船の方向を推測し、次の攻撃座標を決定
      let potentialTargets: Coordinate[] = [];

      // 複数のヒットがあれば、方向を推測
      if (hitCells.length >= 2) {
        // ヒットしたマスをソートして、直線上の繋がりを確認
        hitCells.sort((a, b) => (a.x - b.x !== 0 ? a.x - b.x : a.y - b.y));

        const firstHit = hitCells[0];
        const secondHit = hitCells[1];

        let assumedOrientation: Orientation | null = null;
        if (firstHit.x === secondHit.x) { // 縦方向
          assumedOrientation = 'vertical';
        } else if (firstHit.y === secondHit.y) { // 横方向
          assumedOrientation = 'horizontal';
        }

        if (assumedOrientation) {
          // 推測した方向に沿って、両端の未攻撃マスを探す
          const minX = Math.min(...hitCells.map(c => c.x));
          const maxX = Math.max(...hitCells.map(c => c.x));
          const minY = Math.min(...hitCells.map(c => c.y));
          const maxY = Math.max(...hitCells.map(c => c.y));

          if (assumedOrientation === 'horizontal') {
            // 左側
            if (minX > 0 && !attackedCells[`${minX - 1},${firstHit.y}`]) {
              potentialTargets.push({ x: minX - 1, y: firstHit.y });
            }
            // 右側
            if (maxX < 9 && !attackedCells[`${maxX + 1},${firstHit.y}`]) {
              potentialTargets.push({ x: maxX + 1, y: firstHit.y });
            }
          } else { // vertical
            // 上側
            if (minY > 0 && !attackedCells[`${firstHit.x},${minY - 1}`]) {
              potentialTargets.push({ x: firstHit.x, y: minY - 1 });
            }
            // 下側
            if (maxY < 9 && !attackedCells[`${firstHit.x},${maxY + 1}`]) {
              potentialTargets.push({ x: firstHit.x, y: maxY + 1 });
            }
          }
        }
      } else { // ヒットが1つだけの場合、十字方向を探索
        const { x, y } = hitCells[0];
        const directions = [
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, // 上下
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 }  // 左右
        ];
        for (const dir of directions) {
          const nextX = x + dir.dx;
          const nextY = y + dir.dy;
          if (nextX >= 0 && nextX < 10 && nextY >= 0 && nextY < 10 && !attackedCells[`${nextX},${nextY}`]) {
            potentialTargets.push({ x: nextX, y: nextY });
          }
        }
      }

      // 未攻撃の有効なターゲットが見つかれば選択
      if (potentialTargets.length > 0) {
        chosenCoord = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
      } else {
        // 周囲に打つ場所がなければ、ハンティングモードにフォールバック
        targetingMode = 'hunting';
        console.log("Hard AI: Fallback to hunting mode as no valid targeting options found.");
      }
    }

    if (targetingMode === 'hunting' || chosenCoord === null) {
      // ハンティングモード: まだ攻撃していないマスからランダムに、または確率に基づいて攻撃
      let availableCoords: Coordinate[] = [];

      if (currentPlayer.difficulty === 'hard') {
        // 確率に基づいた攻撃 (より効率的なハンティング)
        // 各セルが船の一部である可能性を計算
        const probabilityGrid = Array(10).fill(0).map(() => Array(10).fill(0));
        const remainingShips = ALL_SHIPS.filter(shipDef => {
          const placedShip = placedShips.find(ps => ps.id.startsWith(shipDef.id.slice(0, -1)) && ps.definition.size === shipDef.size);
          return !placedShip || !placedShip.isSunk;
        });

        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            const coordKey = `${x},${y}`;
            // 既に攻撃済み、または沈没した船のマスはスキップ
            if (attackedCells[coordKey] === 'hit' || attackedCells[coordKey] === 'miss' || targetBoard.cells[y][x].status === 'sunk') {
              probabilityGrid[y][x] = 0;
              continue;
            }

            let cellProbability = 0;
            // 残りの各船について可能性を評価
            for (const shipDef of remainingShips) {
              // 水平方向
              for (let i = 0; i <= 10 - shipDef.size; i++) {
                const tempPlacedShip: PlacedShip = {
                  id: `temp-${shipDef.id}`,
                  definition: shipDef,
                  start: { x: i, y: y },
                  orientation: 'horizontal',
                  hits: [],
                  isSunk: false,
                };
                // 船がボード内に収まり、既存の船やヒット/ミスと衝突しないか確認
                let isValidPlacement = true;
                for (let s = 0; s < shipDef.size; s++) {
                  const currentX = i + s;
                  const currentY = y;
                  if (currentX < 0 || currentX >= 10 || currentY < 0 || currentY >= 10 || attackedCells[`${currentX},${currentY}`] === 'hit' || attackedCells[`${currentX},${currentY}`] === 'miss' || targetBoard.cells[currentY][currentX].status === 'sunk') {
                    isValidPlacement = false;
                    break;
                  }
                }
                if (isValidPlacement && x >= i && x < i + shipDef.size) {
                  cellProbability++;
                }
              }

              // 垂直方向
              for (let j = 0; j <= 10 - shipDef.size; j++) {
                const tempPlacedShip: PlacedShip = {
                  id: `temp-${shipDef.id}`,
                  definition: shipDef,
                  start: { x: x, y: j },
                  orientation: 'vertical',
                  hits: [],
                  isSunk: false,
                };
                let isValidPlacement = true;
                for (let s = 0; s < shipDef.size; s++) {
                  const currentX = x;
                  const currentY = j + s;
                  if (currentX < 0 || currentX >= 10 || currentY < 0 || currentY >= 10 || attackedCells[`${currentX},${currentY}`] === 'hit' || attackedCells[`${currentX},${currentY}`] === 'miss' || targetBoard.cells[currentY][currentX].status === 'sunk') {
                    isValidPlacement = false;
                    break;
                  }
                }
                if (isValidPlacement && y >= j && y < j + shipDef.size) {
                  cellProbability++;
                }
              }
            }
            probabilityGrid[y][x] = cellProbability;
          }
        }

        let maxProbability = 0;
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            if (probabilityGrid[y][x] > maxProbability) {
              maxProbability = probabilityGrid[y][x];
              availableCoords = [{ x, y }]; // 最大確率のマスが見つかったらリセット
            } else if (probabilityGrid[y][x] === maxProbability && maxProbability > 0) {
              availableCoords.push({ x, y });
            }
          }
        }

        if (availableCoords.length > 0) {
          chosenCoord = availableCoords[Math.floor(Math.random() * availableCoords.length)];
        } else {
          // 確率計算で有効なマスが見つからなかった場合、最終手段として未攻撃マスからランダムに選択
          for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
              const coordKey = `${x},${y}`;
              if (!attackedCells[coordKey]) { // まだ攻撃していないマス
                availableCoords.push({ x, y });
              }
            }
          }
          if (availableCoords.length > 0) {
            chosenCoord = availableCoords[Math.floor(Math.random() * availableCoords.length)];
          }
        }

      } else { // Easy / Normal AI
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            const coordKey = `${x},${y}`;
            if (!attackedCells[coordKey]) { // まだ攻撃していないマス
              availableCoords.push({ x, y });
            }
          }
        }
        if (availableCoords.length > 0) {
          chosenCoord = availableCoords[Math.floor(Math.random() * availableCoords.length)];
        }
      }
    }


    if (chosenCoord) {
      const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, chosenCoord);
      let attackMessage = `${currentPlayer.name} の攻撃: ${String.fromCharCode(65 + chosenCoord.x)}${chosenCoord.y + 1} に発射！`;

      if (attackResult.hit) {
        attackMessage += 'ヒット！';
        if (attackResult.sunkShipId) {
          const sunkShipName = ALL_SHIPS.find(s => s.id === attackResult.sunkShipId)?.name || '船';
          attackMessage += ` そして ${sunkShipName} を撃沈！`;
        }
      } else {
        attackMessage += 'ミス！';
      }
      setMessage(attackMessage);

      if (attackResult.isGameOver) {
        // handleAttack内でphaseが'game-over'に設定されるため、ここではメッセージ表示のみ
        setMessage(attackMessage + ' ゲーム終了！');
        // 勝敗結果の表示はGameOverScreenに任せる
      } else {
        // 次のターンへ
        // AIの攻撃後に人間プレイヤーのターンに移る前に少し間を置く
        await new Promise(resolve => setTimeout(resolve, 1500));
        advanceTurn();
      }
    } else {
      setMessage("AIが攻撃する場所を見つけられませんでした。（エラーまたはゲーム終了）");
      // これ以上攻撃する場所がない場合、ゲームを終了させるなどの処理が必要になる可能性
      // 現在のロジックではありえないはずだが、念のため
      setGameState(prev => ({ ...prev, phase: 'game-over', winnerId: currentPlayer.id }));
    }
    setIsAttackOngoing(false);
  }, [handleAttack, advanceTurn, opponentPlayer, opponentBoard, currentPlayer, setGameState]); // 依存配列に isAttackOngoing を含める


  useEffect(() => {
    // currentPlayerTurnId が変わったときに、現在のプレイヤーがAIであれば攻撃を実行
    if (phase === 'in-game' && currentPlayer?.type === 'ai' && !isAttackOngoing) {
      performAIAttack();
    }
  }, [currentPlayerTurnId, phase, currentPlayer, isAttackOngoing, performAIAttack]); // 依存配列に isAttackOngoing を含める

  // ★重要★ ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  if (!myBoard || !opponentBoard || !currentPlayer || phase !== 'in-game') {
    // 進行中のフェーズでない場合もここで待機
    console.log("GameScreen: Waiting for all data to be ready or phase to be in-game.", { myBoard, opponentBoard, currentPlayer, phase });
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ textAlign: 'center' }}>現在のターン: {currentPlayer?.name}</h3>

      {message && (
        <p style={{ color: 'yellow', fontWeight: 'bold' }}>{message}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>あなたのボード ({myBoard.playerId === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>{opponentPlayer?.name} のボード ({opponentPlayer?.id === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid
            cells={opponentDisplayCells}
            isPlayerBoard={false}
            onCellClick={
              currentPlayer?.type === 'human' && !isAttackOngoing // 人間プレイヤーのターンかつ攻撃中でない場合のみクリック可能
                ? (coord) => {
                  setMessage(''); // 新しい攻撃前にメッセージをクリア
                  const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, coord);
                  let attackMessage = `あなたの攻撃: ${String.fromCharCode(65 + coord.x)}${coord.y + 1} に発射！`;

                  if (attackResult.hit) {
                    attackMessage += 'ヒット！';
                    if (attackResult.sunkShipId) {
                      const sunkShipName = ALL_SHIPS.find(s => s.id === attackResult.sunkShipId)?.name || '船';
                      attackMessage += ` そして ${sunkShipName} を撃沈！`;
                    }
                  } else {
                    attackMessage += 'ミス！';
                  }
                  setMessage(attackMessage);

                  if (attackResult.isGameOver) {
                    // handleAttack内でphaseが'game-over'に設定されるため、ここではメッセージ表示のみ
                    setMessage(attackMessage + ' ゲーム終了！');
                  } else {
                    advanceTurn();
                  }
                }
                : undefined
            }
            disableClick={isAttackOngoing || currentPlayer?.type !== 'human'} // AIの攻撃中か、AIターン中はクリック無効
          />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;