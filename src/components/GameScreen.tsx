// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid'; // BoardGrid (内部でGameBoardを使用) を使用
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings } from '../models/types';

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame();
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [message, setMessage] = useState<string>('');
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃アニメーション中などのフラグ

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  // 自分のボード
  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  // 自分のボードの表示（船が見える状態）
  const myDisplayCells = useMemo(() => {
    if (!myBoard) return createEmptyBoard(currentPlayerTurnId).cells; // myBoardがない場合は空ボード
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips);
  }, [myBoard, currentPlayerTurnId]);

  // 敵プレイヤーのリスト (自分自身と'none'タイプを除く)
  const opponentPlayers = useMemo(() => {
    return players.filter(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  // AIの攻撃ロジック
  const performAiAttack = useCallback(async () => {
    if (!currentPlayer || currentPlayer.type !== 'ai' || isAttackOngoing) return;

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // AIが攻撃対象を選ぶ（生存している敵プレイヤーからランダムに選択）
    const livingOpponents = opponentPlayers.filter(op => {
      const targetPlayerBoard = playerBoards[op.id];
      if (!targetPlayerBoard) return false;
      const allShipsSunk = targetPlayerBoard.placedShips.every(ship =>
          ship.hits.length === ship.definition.size
      );
      return !allShipsSunk; // 全ての船が沈んでいなければ生存
    });

    if (livingOpponents.length === 0) {
        console.warn("AI: 攻撃可能なターゲットが見つかりません。");
        setIsAttackOngoing(false);
        if (gameStateRef.current.phase === 'in-game') { // ゲームがまだ継続中の場合のみターンを進める
            advanceTurn();
        }
        return;
    }

    const targetPlayer = livingOpponents[Math.floor(Math.random() * livingOpponents.length)];
    const targetPlayerBoard = playerBoards[targetPlayer.id];

    // 攻撃済みのマスを除外した上で、ランダムな座標を選択
    let randomCoord: Coordinate;
    let attempts = 0;
    const maxAttempts = 100;
    const attackedKeys = Object.keys(targetPlayerBoard.attackedCells);

    do {
      randomCoord = {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10),
      };
      attempts++;
    } while (
        attackedKeys.includes(`${randomCoord.x},${randomCoord.y}`) &&
        attempts < maxAttempts
    );

    if (attempts >= maxAttempts) {
        console.warn("AI: 攻撃可能な空きマスが見つかりませんでした。");
        setIsAttackOngoing(false);
        if (gameStateRef.current.phase === 'in-game') {
            advanceTurn();
        }
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // AIの思考時間

    const result = handleAttack(currentPlayer.id, targetPlayer.id, randomCoord);

    let displayMessage = `${currentPlayer.name} が ${targetPlayer.name} の (${String.fromCharCode(65 + randomCoord.x)}${randomCoord.y + 1}) を攻撃！結果: `;
    switch (result.result) {
      case 'hit':
        displayMessage += 'ヒット！';
        break;
      case 'miss':
        displayMessage += 'ミス！';
        break;
      case 'sunk':
        displayMessage += `撃沈！ ${result.sunkShipName} を撃沈しました！`;
        break;
    }
    setMessage(displayMessage);

    await new Promise(resolve => setTimeout(resolve, 1500)); // 結果表示時間

    setIsAttackOngoing(false);
    setMessage('');
    // 攻撃後、勝敗判定は handleAttack の中で行われ、phase が変わるはず
    if (gameStateRef.current.phase === 'in-game') { // 最新のフェーズを確認
        advanceTurn();
    }

  }, [currentPlayer, opponentPlayers, isAttackOngoing, handleAttack, advanceTurn, playerBoards]);


  // 人間プレイヤーの攻撃ハンドラ
  const handleHumanAttack = useCallback(async (targetPlayerId: number, coord: Coordinate) => {
    if (!currentPlayer || currentPlayer.type !== 'human' || isAttackOngoing) return;

    setIsAttackOngoing(true);
    setMessage('攻撃中...');

    // 自分のボードは攻撃できない
    if (targetPlayerId === currentPlayer.id) {
        setMessage("自分のボードは攻撃できません！");
        setIsAttackOngoing(false);
        return;
    }

    const targetPlayerBoard = playerBoards[targetPlayerId];
    if (!targetPlayerBoard) {
        setMessage("無効なターゲットプレイヤーです。");
        setIsAttackOngoing(false);
        return;
    }

    // 既に攻撃済みのマスは再度攻撃できない
    const attackedKey = `${coord.x},${coord.y}`;
    if (targetPlayerBoard.attackedCells[attackedKey]) {
        setMessage("そのマスはすでに攻撃済みです。");
        setIsAttackOngoing(false);
        return;
    }

    const targetPlayer = players.find(p => p.id === targetPlayerId);

    const result = handleAttack(currentPlayer.id, targetPlayerId, coord);

    let displayMessage = `${currentPlayer.name} が ${targetPlayer?.name} の (${String.fromCharCode(65 + coord.x)}${coord.y + 1}) を攻撃！結果: `;
    switch (result.result) {
      case 'hit':
        displayMessage += 'ヒット！';
        break;
      case 'miss':
        displayMessage += 'ミス！';
        break;
      case 'sunk':
        displayMessage += `撃沈！ ${result.sunkShipName} を撃沈しました！`;
        break;
    }
    setMessage(displayMessage);

    await new Promise(resolve => setTimeout(resolve, 1500)); // 結果表示時間

    setIsAttackOngoing(false);
    setMessage('');
    // 攻撃後、勝敗判定は handleAttack の中で行われ、phase が変わるはず
    if (gameStateRef.current.phase === 'in-game') { // 最新のフェーズを確認
        advanceTurn();
    }

  }, [currentPlayer, isAttackOngoing, handleAttack, playerBoards, players, advanceTurn]);


  // AIのターンになったら自動攻撃
  useEffect(() => {
    if (phase === 'in-game' && currentPlayer?.type === 'ai') {
      const timer = setTimeout(() => {
        performAiAttack();
      }, 1000); // AIが攻撃を開始するまでの待機時間

      return () => clearTimeout(timer); // クリーンアップ
    }
  }, [phase, currentPlayer, performAiAttack]); // 依存配列に performAiAttack を含める

  // ★重要★ ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  if (!myBoard || !currentPlayer || phase !== 'in-game') {
    console.log("GameScreen: Waiting for all data to be ready or phase to be in-game.", { myBoard, currentPlayer, phase });
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ textAlign: 'center', minHeight: '30px' }}>
        現在のターン: {currentPlayer?.name}
      </h3>

      {message && (
        <p style={{ color: 'yellow', fontWeight: 'bold', minHeight: '24px' }}>{message}</p>
      )}

      {/* 複数ボード表示のためのコンテナ */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap', // ボードが収まらない場合は折り返す
        justifyContent: 'center',
        gap: '20px', // ボード間の間隔
        width: '100%',
      }}>
        {/* 自分のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px', border: currentPlayer.id === myBoard.playerId ? '2px solid gold' : 'none' }}>
          <h4>あなたのボード ({myBoard.playerId === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} disableClick={true} /> {/* 自分のボードはクリック不可 */}
        </div>

        {/* 敵のボード */}
        {opponentPlayers.map(opponent => {
          const opponentPlayerBoard = playerBoards[opponent.id];
          if (!opponentPlayerBoard) return null; // ボードデータがない場合は表示しない

          // 敵ボードの表示 (船は隠し、攻撃結果のみ表示)
          // updateCellsWithShips の第三引数を true にすることで船を隠す
          const opponentDisplayCells = updateCellsWithShips(opponentPlayerBoard.cells, opponentPlayerBoard.placedShips, true);

          // 攻撃中、AIターン、または相手が全滅している場合はクリック無効
          const disableOpponentClick = isAttackOngoing || currentPlayer.type === 'ai' || opponentPlayerBoard.placedShips.every(s => s.hits.length === s.definition.size);

          return (
            <div key={opponent.id} style={{ textAlign: 'center', marginBottom: '20px', border: opponent.id === currentPlayerTurnId ? '2px solid gold' : 'none' }}>
              <h4>
                {opponent.name} のボード ({opponent.id === currentPlayerTurnId ? 'ターン' : '待機中'})
              </h4>
              <BoardGrid
                cells={opponentDisplayCells}
                isPlayerBoard={false} // 相手のボード
                onCellClick={(_coord) => handleHumanAttack(opponent.id, _coord)} // 敵ボードのみクリック可能
                disableClick={disableOpponentClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameScreen;