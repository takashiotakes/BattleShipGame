// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings } from '../models/types';

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack } = useGame(); // setGameState は handleCellClick では直接使わない
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // gameStateRef は handleAttack や handleAIAttack 内で最新の gameState を参照するために残す
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [message, setMessage] = useState<string | null>(null);
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false);
  const [aiAttackTargetCoord, setAiAttackTargetCoord] = useState<Coordinate | null>(null);
  const [aiAttackHighlightTargetPlayerId, setAiAttackHighlightTargetPlayerId] = useState<number | null>(null);
  const [humanAttackTargetPlayerId, setHumanAttackTargetPlayerId] = useState<number | null>(null); // 人間プレイヤーが攻撃対象に選んだ相手のID

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  const myDisplayCells = useMemo(() => {
    if (!myBoard) return createEmptyBoard(currentPlayerTurnId).cells;
    return myBoard.cells;
  }, [myBoard, currentPlayerTurnId]);

  // 攻撃可能な全ての敵プレイヤーのリストを取得する
  const enemyPlayers = useMemo(() => {
    return players.filter(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  // handleCellClick の引数に targetPlayerId を追加
  const handleCellClick = useCallback(
    async (targetPlayerId: number, coord: Coordinate) => {
      if (!currentPlayer || currentPlayer.type !== 'human' || isAttackOngoing) return;
      if (targetPlayerId === currentPlayer.id) return;

      const targetOpponent = players.find(p => p.id === targetPlayerId);
      if (!targetOpponent) {
          console.error(`Invalid target player ID: ${targetPlayerId}`);
          return;
      }

      setMessage(null);
      setIsAttackOngoing(true); // 攻撃中フラグを立てる

      // handleAttack は同期的に AttackResult を返す
      const result = handleAttack(currentPlayer.id, targetPlayerId, coord);

      // 攻撃結果メッセージを result を元に直接セット
      if (result.hit) {
        if (result.sunkShipId) {
          setMessage(`ヒット！ ${result.sunkShipName || '船'} を撃沈！`);
        } else {
          setMessage('ヒット！');
        }
      } else {
        setMessage('ミス！');
      }

      if (result.winnerId !== undefined && result.winnerId !== null) {
          console.log(`Winner detected: Player ${result.winnerId}`);
          setIsAttackOngoing(false);
          return;
      }

      // AIターンに進む前に少し待機
      setTimeout(() => {
        setIsAttackOngoing(false); // 攻撃中フラグを下げる
        advanceTurn(); // ターンを進める
      }, 1000); // 1秒待機
    },
    [currentPlayer, isAttackOngoing, handleAttack, advanceTurn, players]
  );


  const handleAIAttack = useCallback(async () => {
    if (!currentPlayer || currentPlayer.type !== 'ai' || isAttackOngoing) return;

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    const currentEnemyPlayers = gameStateRef.current.players.filter(p =>
        p.id !== gameStateRef.current.currentPlayerTurnId &&
        p.type !== 'none'
    );

    if (currentEnemyPlayers.length === 0) {
        console.warn("AI: No active enemy players to attack.");
        setIsAttackOngoing(false);
        advanceTurn();
        return;
    }

    const livingEnemyPlayers = currentEnemyPlayers.filter(enemy => {
        const board = gameStateRef.current.playerBoards[enemy.id];
        return board && board.placedShips.some(ship => !ship.isSunk);
    });

    if (livingEnemyPlayers.length === 0) {
        console.log("AI: All active enemy players have been sunk. Game should be over.");
        setIsAttackOngoing(false);
        // ここでゲーム終了処理が走るはずなので advanceTurn は不要
        return;
    }

    const targetOpponent = livingEnemyPlayers[Math.floor(Math.random() * livingEnemyPlayers.length)];
    const targetPlayerId = targetOpponent.id;

    const targetBoard = gameStateRef.current.playerBoards[targetPlayerId];
    if (!targetBoard) {
        console.error("AI: Target board not found for opponent.", targetOpponent);
        setIsAttackOngoing(false);
        advanceTurn();
        return;
    }

    let randomCoord: Coordinate;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      randomCoord = {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10),
      };
      attempts++;
    } while (
      (targetBoard.cells[randomCoord.y][randomCoord.x].status === 'hit' ||
       targetBoard.cells[randomCoord.y][randomCoord.x].status === 'miss' ||
       targetBoard.cells[randomCoord.y][randomCoord.x].status === 'sunk') &&
      attempts < maxAttempts
    );

    if (attempts === maxAttempts) {
        console.warn("AI could not find an unattacked cell after many attempts.");
        setIsAttackOngoing(false);
        advanceTurn();
        return;
    }

    setAiAttackTargetCoord(randomCoord); // AIの攻撃ターゲットセルをハイライト
    setAiAttackHighlightTargetPlayerId(targetPlayerId); // AIの攻撃ターゲットプレイヤーをハイライト
    await new Promise(resolve => setTimeout(resolve, 1500)); // AIの攻撃アニメーションや思考時間

    const result = handleAttack(currentPlayer.id, targetPlayerId, randomCoord);

    // 攻撃結果メッセージ
    if (result.hit) {
      if (result.sunkShipId) {
        setMessage(`AI (${currentPlayer.name}) の攻撃: ヒット！ ${result.sunkShipName || '船'} を撃沈！`);
      } else {
        setMessage(`AI (${currentPlayer.name}) の攻撃: ヒット！`);
      }
    } else {
      setMessage(`AI (${currentPlayer.name}) の攻撃: ミス！`);
    }

    setAiAttackTargetCoord(null); // ハイライトを解除
    setAiAttackHighlightTargetPlayerId(null); // ハイライトを解除

    if (result.winnerId !== undefined && result.winnerId !== null) {
        console.log(`Winner detected: Player ${result.winnerId}`);
        setIsAttackOngoing(false);
        return;
    }

    setTimeout(() => {
      setIsAttackOngoing(false);
      advanceTurn();
    }, 1000);
  }, [currentPlayer, isAttackOngoing, handleAttack, advanceTurn]);


  useEffect(() => {
    if (phase === 'in-game' && currentPlayer?.type === 'ai' && !isAttackOngoing) {
      const delay = message ? 2000 : 500;
      const timer = setTimeout(() => {
        handleAIAttack();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, phase, isAttackOngoing, handleAIAttack, message]);


  // ロード中の表示やデータの存在チェックを強化
  if (!myBoard || !currentPlayer || phase !== 'in-game') {
    console.log("GameScreen: Waiting for essential data or phase to be in-game.", { myBoard, currentPlayer, phase });
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ textAlign: 'center' }}>現在のターン: {currentPlayer?.name}</h3>

      {message && (
        <p style={{ color: 'yellow', fontWeight: 'bold' }}>{message}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', gap: '20px', flexWrap: 'wrap' }}>
        {/* 自分のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>あなたのボード ({currentPlayer?.name === players.find(p => p.id === currentPlayerTurnId)?.name ? '現在のターン' : '待機中'})</h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} />
        </div>

        {/* 敵のボードを複数表示 */}
        {enemyPlayers.map(opponentPlayer => {
          const opponentBoard = playerBoards[opponentPlayer.id];
          if (!opponentBoard) return null;

          const isOpponentSunk = opponentBoard.placedShips.every(ship => ship.isSunk);

          return (
            <div key={opponentPlayer.id} style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h4>
                {opponentPlayer.name} のボード
                {isOpponentSunk && <span style={{ color: 'red' }}> (沈没済み)</span>}
              </h4>
              <BoardGrid
                cells={opponentBoard.cells}
                isPlayerBoard={false}
                onCellClick={(coord) => handleCellClick(opponentPlayer.id, coord)}
                onCellHover={coord => {
                  if (currentPlayer?.type === 'human' && !isAttackOngoing && !isOpponentSunk) {
                    setHumanAttackTargetPlayerId(opponentPlayer.id);
                  }
                }}
                onBoardLeave={() => setHumanAttackTargetPlayerId(null)}
                disableClick={
                    currentPlayer?.type !== 'human' ||
                    isAttackOngoing ||
                    isOpponentSunk
                }
                aiAttackHighlightCoord={
                    (aiAttackHighlightTargetPlayerId === opponentPlayer.id)
                    ? aiAttackTargetCoord
                    : null
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameScreen;