// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, Cell } from '../models/types';

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack } = useGame();
  const { players, playerBoards, currentPlayerTurnId } = gameState;

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  // 現在のプレイヤー（自分）のボード
  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  // 敵のボード（ターゲット）
  // 複数プレイヤーの場合、誰を攻撃するか選択するロジックが必要だが、ここではシンプルに自分以外の最初のプレイヤーを敵とする
  const opponentPlayer = useMemo(() => {
    return players.find(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  const opponentBoard = useMemo(() => opponentPlayer ? playerBoards[opponentPlayer.id] : null, [opponentPlayer, playerBoards]);

  // 自分のボードに表示するセルデータ（船が見える）
  const myDisplayCells = useMemo(() => {
    return myBoard ? updateCellsWithShips(createEmptyBoard(myBoard.playerId).cells, myBoard.placedShips) : [];
  }, [myBoard]);

  // 敵のボードに表示するセルデータ（船は見えないが、攻撃結果は見える）
  const opponentDisplayCells = useMemo(() => {
    if (!opponentBoard) return [];

    // 敵のボードのコピーを作成
    const cellsCopy = createEmptyBoard(opponentBoard.playerId).cells;

    // 自分の attackedCells を元に敵のボードを更新
    // 攻撃済みのセルのみを反映
    if (myBoard) {
        for (const key in myBoard.attackedCells) {
            const [x, y] = key.split(',').map(Number);
            if (cellsCopy[y] && cellsCopy[y][x]) {
                const attackedStatus = myBoard.attackedCells[key];
                if (attackedStatus === 'hit') {
                    // ヒットの場合、敵の船が沈んでいるかどうかも考慮する必要がある
                    // 敵の placedShips を見て、該当セルがどの船の一部で、その船が沈んでいるかを確認する
                    const originalCellStatus = opponentBoard.cells[y][x].status;
                    if (originalCellStatus === 'ship' && opponentBoard.placedShips.find(s => s.id === opponentBoard.cells[y][x].shipId)?.isSunk) {
                        cellsCopy[y][x].status = 'sunk';
                    } else {
                        cellsCopy[y][x].status = 'hit';
                    }
                } else if (attackedStatus === 'miss') {
                    cellsCopy[y][x].status = 'miss';
                }
            }
        }
    }
    return cellsCopy;
  }, [opponentBoard, myBoard]);

  // 敵のボードをクリックした際の攻撃処理
  const handleOpponentBoardClick = useCallback((coord: Coordinate) => {
    if (!currentPlayer || currentPlayer.type !== 'human') {
        setErrorMessage("AIのターンです。");
        return;
    }
    if (!opponentPlayer || !opponentBoard) {
        setErrorMessage("攻撃対象が見つかりません。");
        return;
    }
    // 既に攻撃済みのセルはクリックできないようにする
    if (myBoard?.attackedCells[`${coord.x},${coord.y}`]) {
        setErrorMessage("このマスは既に攻撃済みです。");
        return;
    }

    setErrorMessage(null); // エラーメッセージをクリア

    const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, coord);

    if (attackResult.sunkShipId) {
        setErrorMessage(`${opponentPlayer.name} の ${opponentBoard.placedShips.find(s => s.id === attackResult.sunkShipId)?.definition.name} を撃沈しました！`);
    } else if (attackResult.hit) {
        setErrorMessage("ヒット！");
    } else {
        setErrorMessage("ミス！");
    }

    // ゲーム終了判定
    const allOpponentShipsSunk = opponentBoard.placedShips.every(ship => ship.isSunk);
    if (allOpponentShipsSunk) {
      setErrorMessage(`${opponentPlayer.name} の船を全て撃沈しました！ ${currentPlayer.name} の勝利です！`);
      // advancePhase('game-over'); // ゲームオーバーフェーズへ移行
    } else {
      advanceTurn(); // 次のターンへ
    }
  }, [currentPlayer, opponentPlayer, opponentBoard, myBoard, handleAttack, advanceTurn]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AIのターン処理
  useEffect(() => {
    if (gameState.phase !== 'in-game' || !currentPlayer || currentPlayer.type === 'human') {
      return;
    }

    // AIのターンになったら自動で攻撃
    const aiAttack = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // AIの思考時間

      if (!opponentPlayer || !opponentBoard) {
          console.error("AI: 攻撃対象が見つかりません。");
          advanceTurn(); // 念のためターンを進める
          return;
      }

      let targetCoord: Coordinate;
      let isValidAttack = false;

      // ランダムに未攻撃のセルを探す
      const maxAttempts = 100;
      let attempts = 0;
      do {
        targetCoord = { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) };
        if (!myBoard?.attackedCells[`${targetCoord.x},${targetCoord.y}`]) { // 既に攻撃済みでないか確認
          isValidAttack = true;
        }
        attempts++;
      } while (!isValidAttack && attempts < maxAttempts);

      if (!isValidAttack) {
          console.error("AI: 攻撃可能なマスが見つかりませんでした。");
          advanceTurn(); // ターンを進める
          return;
      }

      setErrorMessage(`${currentPlayer.name} が攻撃中...`);

      const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, targetCoord);

      if (attackResult.sunkShipId) {
          setErrorMessage(`${currentPlayer.name} が ${opponentPlayer.name} の ${opponentBoard.placedShips.find(s => s.id === attackResult.sunkShipId)?.definition.name} を撃沈！`);
      } else if (attackResult.hit) {
          setErrorMessage(`${currentPlayer.name} がヒット！`);
      } else {
          setErrorMessage(`${currentPlayer.name} がミス！`);
      }

      // ゲーム終了判定
      // 注意：handleAttackはsetStateを非同期で行うため、最新のgameStateを参照する必要がある
      // ここでは即座に判定せず、次のレンダリングサイクルで最新の状態が反映されてから判定すべきかもしれない
      // しかし、簡単のためにここでは攻撃結果を元に判定
      const checkGameOver = () => {
          const latestOpponentBoard = gameState.playerBoards[opponentPlayer.id]; // 最新のボード状態を取得
          const allOpponentShipsSunk = latestOpponentBoard.placedShips.every(ship => ship.isSunk);
          if (allOpponentShipsSunk) {
              setErrorMessage(`${opponentPlayer.name} の船を全て撃沈しました！ ${currentPlayer.name} の勝利です！`);
              // advancePhase('game-over'); // ゲームオーバーフェーズへ移行
              return true;
          }
          return false;
      };

      // setStateが完了した後に実行されるように少し遅延させる
      setTimeout(() => {
        if (!checkGameOver()) {
            advanceTurn(); // ゲームがまだ終わっていなければ次のターンへ
        }
      }, 500); // UIの更新を待つ
    };

    aiAttack();

  }, [currentPlayer, opponentPlayer, opponentBoard, myBoard, handleAttack, advanceTurn, gameState.phase, gameState.playerBoards]); // gameState.playerBoards を依存配列に追加

  if (!myBoard || !opponentBoard) {
    return <div>ゲームボードの準備中...</div>; // ロード中の表示
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ textAlign: 'center' }}>⚓ Battle Ship Game ⚓</h2>
      <h3 style={{ textAlign: 'center' }}>現在のターン: {currentPlayer?.name}</h3>

      {errorMessage && (
        <p style={{ color: 'yellow', fontWeight: 'bold' }}>{errorMessage}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', gap: '20px', flexWrap: 'wrap' }}>
        {/* 自分のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>あなたのボード ({myBoard.playerId === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} />
        </div>

        {/* 敵のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>{opponentPlayer?.name} のボード ({opponentPlayer?.id === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid cells={opponentDisplayCells} isPlayerBoard={false} onCellClick={handleOpponentBoardClick} />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;