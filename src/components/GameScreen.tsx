// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { createEmptyBoard, applyAttackToBoard, checkAllShipsSunk } from '../lib/boardUtils'; // applyAttackToBoardをインポート
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings, Cell } from '../models/types'; // PlayerSettings と Cell をインポート

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  const opponentPlayer = useMemo(() => {
    // currentPlayerTurnId 以外の、最初の「none」ではないプレイヤーを見つける
    return players.find(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  const opponentBoard = useMemo(() => opponentPlayer ? playerBoards[opponentPlayer.id] : null, [opponentPlayer, playerBoards]);

  // メッセージ表示用
  const [message, setMessage] = useState<string>('');
  // 攻撃処理中のフラグ
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false);


  // ★修正箇所★ myDisplayCells
  const myDisplayCells = useMemo(() => {
    // myBoard が存在しない場合は空のボードを返す
    if (!myBoard) return createEmptyBoard(-1).cells; // 仮のID

    const cells: Cell[][] = [];
    for (let y = 0; y < 10; y++) {
      cells[y] = [];
      for (let x = 0; x < 10; x++) {
        // 自分のボードなので常に船を表示
        cells[y][x] = { ...myBoard.cells[y][x], isShipVisible: true };
      }
    }
    return cells;
  }, [myBoard]);

  // ★修正箇所★ opponentDisplayCells
  const opponentDisplayCells = useMemo(() => {
    // opponentBoard が存在しない場合は空のボードを返す
    if (!opponentBoard) return createEmptyBoard(-1).cells; // 仮のID

    const cells: Cell[][] = [];
    for (let y = 0; y < 10; y++) {
      cells[y] = [];
      for (let x = 0; x < 10; x++) {
        const originalCell = opponentBoard.cells[y][x];
        const attackedStatus = opponentBoard.attackedCells[`${x},${y}`];

        // 相手のボードでは船の位置は通常見えない
        let statusToShow = originalCell.status;
        let isShipVisible = false;

        if (attackedStatus === 'hit') {
          statusToShow = 'hit';
        } else if (attackedStatus === 'miss') {
          statusToShow = 'miss';
        } else if (originalCell.status === 'sunk') {
          // 船が沈没した場合は、相手ボードにも船が見えるようになる
          statusToShow = 'sunk';
          isShipVisible = true; // 沈没した船は見える
        } else {
          statusToShow = 'empty'; // 攻撃していないマスは'empty'として表示
        }

        cells[y][x] = {
          x,
          y,
          status: statusToShow,
          shipId: originalCell.shipId, // shipIdは保持するが、isShipVisibleで制御
          isShipVisible: isShipVisible,
        };
      }
    }
    return cells;
  }, [opponentBoard]);


  // AIの攻撃ロジック
  const handleAIAttack = useCallback(async () => {
    if (isAttackOngoing || !opponentPlayer || !myBoard || currentPlayer?.type !== 'ai') {
      return;
    }

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // 短い遅延を入れてAIが考えているように見せる
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 簡単なAIロジック（ランダムな座標を攻撃）
    let attackCoord: Coordinate;
    let attempts = 0;
    const maxAttempts = 100; // 無限ループ防止

    do {
      attackCoord = {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10),
      };
      attempts++;
    } while (
      // 既に攻撃済みのマスは避ける
      gameStateRef.current.playerBoards[myBoard.playerId]?.attackedCells[`${attackCoord.x},${attackCoord.y}`] &&
      attempts < maxAttempts
    );

    if (attempts >= maxAttempts) {
      console.warn("AI could not find an unattacked cell after many attempts.");
      setIsAttackOngoing(false);
      advanceTurn();
      return;
    }

    // ContextのhandleAttackを呼び出す
    const attackResult = handleAttack(currentPlayer.id, myBoard.playerId, attackCoord);

    // AI攻撃後のメッセージ
    if (attackResult.hit) {
      setMessage(`${currentPlayer.name} の攻撃！ヒット！`);
      if (attackResult.sunkShipId) {
        // 撃沈された船の名前を見つける
        const sunkShipName = ALL_SHIPS.find(s => s.id === attackResult.sunkShipId)?.name;
        setMessage(prev => `${prev} 敵の${sunkShipName}を撃沈しました！`);
      }
    } else {
      setMessage(`${currentPlayer.name} の攻撃！ミス！`);
    }

    // 攻撃結果が全滅でなければターンを進める
    if (!attackResult.allShipsSunk) {
      // 少し遅延させて結果を見せる
      await new Promise(resolve => setTimeout(resolve, 1500));
      advanceTurn();
    } else {
      // ゲーム終了なのでメッセージを保持
      setMessage(prev => `${prev} ${opponentPlayer.name} の船が全て沈みました！`);
    }

    setIsAttackOngoing(false);
  }, [currentPlayer, opponentPlayer, myBoard, handleAttack, advanceTurn, isAttackOngoing]);


  // 人間プレイヤーの攻撃処理
  const handleHumanAttack = useCallback((coord: Coordinate) => {
    if (isAttackOngoing || !opponentPlayer || !opponentBoard || currentPlayer?.type !== 'human') {
      return;
    }

    setIsAttackOngoing(true);
    setMessage(`攻撃中...`);

    // すでに攻撃済みのマスは攻撃できない
    const coordKey = `${coord.x},${coord.y}`;
    if (opponentBoard.attackedCells[coordKey]) {
      setMessage('そこはもう攻撃しました！');
      setIsAttackOngoing(false);
      return;
    }

    const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, coord);

    if (attackResult.hit) {
      setMessage(`あなたの攻撃！ヒット！`);
      if (attackResult.sunkShipId) {
        const sunkShipName = ALL_SHIPS.find(s => s.id === attackResult.sunkShipId)?.name;
        setMessage(prev => `${prev} 敵の${sunkShipName}を撃沈しました！`);
      }
    } else {
      setMessage(`あなたの攻撃！ミス！`);
    }

    if (!attackResult.allShipsSunk) {
      // 少し遅延させて結果を見せる
      setTimeout(() => {
        advanceTurn();
        setIsAttackOngoing(false); // ターンが進んだら攻撃中フラグを解除
      }, 1500);
    } else {
      // ゲーム終了
      setIsAttackOngoing(false); // ゲーム終了なのでフラグ解除
    }
  }, [currentPlayer, opponentPlayer, opponentBoard, handleAttack, advanceTurn, isAttackOngoing]);


  // AIのターンになったら自動で攻撃を開始
  useEffect(() => {
    if (currentPlayer?.type === 'ai' && !isAttackOngoing && phase === 'in-game') {
      handleAIAttack();
    }
  }, [currentPlayer, isAttackOngoing, phase, handleAIAttack]); // 依存配列に isAttackOngoing を含める


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
          {/* 自分のボードはisPlayerBoard={true}で船を表示 */}
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} disableClick={true} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4>{opponentPlayer?.name} のボード ({opponentPlayer?.id === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          {/* 相手のボードはisPlayerBoard={false}で船を非表示、クリック可能（人間プレイヤーの場合のみ） */}
          <BoardGrid
            cells={opponentDisplayCells}
            isPlayerBoard={false}
            onCellClick={currentPlayer?.type === 'human' ? handleHumanAttack : undefined}
            disableClick={currentPlayer?.type !== 'human' || isAttackOngoing} // AIのターン中または攻撃中はクリック不可
          />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;