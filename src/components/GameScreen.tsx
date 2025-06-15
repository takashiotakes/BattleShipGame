// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings } from '../models/types';

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame();
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [message, setMessage] = useState<string | null>(null);
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false);
  const [aiAttackTargetCoord, setAiAttackTargetCoord] = useState<Coordinate | null>(null);
  const [humanAttackTargetPlayerId, setHumanAttackTargetPlayerId] = useState<number | null>(null); // 人間プレイヤーが攻撃対象に選んだ相手のID

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  // ★変更点1: 攻撃可能な全ての敵プレイヤーのリストを取得する★
  const enemyPlayers = useMemo(() => {
    return players.filter(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  const myDisplayCells = useMemo(() => {
    if (!myBoard) return createEmptyBoard(currentPlayerTurnId).cells;
    return updateCellsWithShips(currentPlayerTurnId, myBoard.placedShips);
  }, [myBoard, currentPlayerTurnId]);


  // ★変更点2: handleCellClick の引数に targetPlayerId を追加★
  const handleCellClick = useCallback(
    async (targetPlayerId: number, coord: Coordinate) => {
      // isAttackOngoing が true の場合はクリックを無効にする
      if (!currentPlayer || currentPlayer.type !== 'human' || isAttackOngoing) return;

      // クリックされたのが自分自身のボードの場合も攻撃しない
      if (targetPlayerId === currentPlayer.id) return;

      const targetOpponent = players.find(p => p.id === targetPlayerId);
      if (!targetOpponent) {
          console.error(`Invalid target player ID: ${targetPlayerId}`);
          return;
      }

      setMessage(null);
      setIsAttackOngoing(true); // 攻撃中フラグを立てる

      const result = handleAttack(currentPlayer.id, targetPlayerId, coord);

      // 攻撃結果メッセージ
      if (result.hit) {
        setMessage('ヒット！');
        const targetBoard = playerBoards[targetPlayerId];
        if (result.sunkShipId) {
          const sunkShipName = targetBoard?.placedShips.find(s => s.id === result.sunkShipId)?.definition.name;
          setMessage(`ヒット！ ${sunkShipName || '船'} を撃沈！`);
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
    [currentPlayer, isAttackOngoing, handleAttack, advanceTurn, players, playerBoards]
  );


  const handleAIAttack = useCallback(async () => {
    if (!currentPlayer || currentPlayer.type !== 'ai' || isAttackOngoing) return;

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // ★変更点3: AIの攻撃対象をランダムに選択する★
    const currentEnemyPlayers = gameStateRef.current.players.filter(p =>
        p.id !== gameStateRef.current.currentPlayerTurnId &&
        p.type !== 'none'
    );

    if (currentEnemyPlayers.length === 0) {
        console.warn("AI: No active enemy players to attack.");
        setIsAttackOngoing(false);
        advanceTurn(); // 敵がいない場合はそのまま次のターンへ (ゲームオーバーになるはずだが念のため)
        return;
    }

    // 生きている敵（全ての船が沈んでいない敵）の中からランダムに選択
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

    setAiAttackTargetCoord(randomCoord); // AIの攻撃ターゲットをハイライト
    await new Promise(resolve => setTimeout(resolve, 1500)); // AIの攻撃アニメーションや思考時間

    const result = handleAttack(currentPlayer.id, targetPlayerId, randomCoord);

    // 攻撃結果メッセージ
    if (result.hit) {
      setMessage(`AI (${currentPlayer.name}) の攻撃: ヒット！`);
      const opponentBoardForMsg = gameStateRef.current.playerBoards[targetPlayerId];
      if (result.sunkShipId) {
        const sunkShipName = opponentBoardForMsg?.placedShips.find(s => s.id === result.sunkShipId)?.definition.name;
        setMessage(`AI (${currentPlayer.name}) の攻撃: ヒット！ ${sunkShipName || '船'} を撃沈！`);
      }
    } else {
      setMessage(`AI (${currentPlayer.name}) の攻撃: ミス！`);
    }

    setAiAttackTargetCoord(null); // ハイライトを解除

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
  // currentPlayer と myBoard は必須
  if (!myBoard || !currentPlayer || phase !== 'in-game') {
    console.log("GameScreen: Waiting for essential data or phase to be in-game.", { myBoard, currentPlayer, phase });
    return <div>ゲームボードを準備中...</div>;
  }

  // ★変更点4: 敵のボードのレンダリングをループに変更★
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
          if (!opponentBoard) return null; // ボードがない場合はスキップ

          // 全ての船が沈んでいる敵は表示しない、または沈没済みと表示する
          const isOpponentSunk = opponentBoard.placedShips.every(ship => ship.isSunk);

          return (
            <div key={opponentPlayer.id} style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h4>
                {opponentPlayer.name} のボード
                {isOpponentSunk && <span style={{ color: 'red' }}> (沈没済み)</span>}
              </h4>
              <BoardGrid
                cells={opponentBoard.cells}
                isPlayerBoard={false} // 相手のボードは船が見えないように
                onCellClick={(coord) => handleCellClick(opponentPlayer.id, coord)} // ★クリック時に相手のIDを渡す★
                onCellHover={coord => {
                  if (currentPlayer?.type === 'human' && !isAttackOngoing && !isOpponentSunk) {
                    setHumanAttackTargetPlayerId(opponentPlayer.id); // ホバーしたボードのプレイヤーをターゲットとして記憶
                  }
                }}
                onBoardLeave={() => setHumanAttackTargetPlayerId(null)} // ボードから離れたらターゲットを解除
                disableClick={
                    currentPlayer?.type !== 'human' || // 人間プレイヤーでなければクリック無効
                    isAttackOngoing || // 攻撃中であればクリック無効
                    isOpponentSunk || // 相手が沈没済みであればクリック無効
                    // humanAttackTargetPlayerId !== null && humanAttackTargetPlayerId !== opponentPlayer.id // 別のボードをターゲットしている間も無効
                    // ↑このロジックはUIが複雑になるので一旦コメントアウト
                    false // クリック可能
                }
                highlightAttackTarget={
                    currentPlayer?.type === 'ai' &&
                    opponentPlayer.id === (gameStateRef.current.players.find(p => p.id === gameStateRef.current.currentPlayerTurnId)?.type === 'ai' ? gameStateRef.current.players.filter(p => p.id !== gameStateRef.current.currentPlayerTurnId && p.type !== 'none').find(p => gameStateRef.current.playerBoards[p.id]?.placedShips.every(ship => !ship.isSunk)) : null)?.id // AIが攻撃対象としているボードをハイライト (これは複雑なので後回しか、BoardGridの引数にするべき)
                    // ★暫定的な対応: AIのターゲットはBoardGrid側でハイライトされないため、ここでは無効★
                }
                aiAttackHighlightCoord={
                    currentPlayer?.type === 'ai' && opponentPlayer.id === gameStateRef.current.players.find(p => p.id === gameStateRef.current.currentPlayerTurnId)?.id // これはAI自身のボードなので不要
                    ? aiAttackTargetCoord // AIのターゲットセルを渡す
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