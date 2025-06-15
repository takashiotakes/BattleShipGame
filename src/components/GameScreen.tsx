// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext.tsx'; // 拡張子を .tsx に変更
import BoardGrid from './BoardGrid.tsx'; // 拡張子を .tsx に変更
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils.tsx'; // 拡張子を .tsx に変更
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings, MultiAttackResult } from '../models/types.tsx'; // MultiAttackResult をインポート

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame();
  const { players, playerBoards, currentPlayerTurnId, phase, latestMultiAttackResult } = gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  // 自分以外の生存しているプレイヤーのボードをすべて取得
  const targetPlayerBoards = useMemo(() => {
    // プレイヤー全員をフィルタリングし、自分自身と 'none' タイプのプレイヤーを除外
    const activeOpponentPlayers = players.filter(
      p => p.id !== currentPlayerTurnId && p.type !== 'none'
    );

    // 各アクティブな相手プレイヤーのボードを取得し、船が全て沈んでいないプレイヤーのみを対象とする
    return activeOpponentPlayers.map(p => playerBoards[p.id]).filter(board => board && !board.placedShips.every(ship => ship.isSunk));
  }, [players, currentPlayerTurnId, playerBoards]); // playerBoards を依存配列に追加

  // 自分のボード表示用のセルデータを生成
  const myDisplayCells = useMemo(() => {
    if (!myBoard) return createEmptyBoard(0).cells; // myBoard が存在しない場合は空のボードを返す
    // 自分のボードは船が見える状態
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips, true);
  }, [myBoard]);

  // AIの思考時間のための状態
  const [isAttackOngoing, setIsAttackOngoing] = useState(false);
  const [message, setMessage] = useState<string>('');

  // ターン終了後のメッセージ表示と次のターンへの移行
  useEffect(() => {
    if (latestMultiAttackResult) {
      // 攻撃結果メッセージを生成
      const resultsMessages = latestMultiAttackResult.results.map(res => {
        const targetPlayerName = players.find(p => p.id === res.targetPlayerId)?.name || `プレイヤー${res.targetPlayerId + 1}`;
        if (res.isAlreadyAttacked) {
            return `${targetPlayerName} のマス (${latestMultiAttackResult.coordinate.x + 1},${latestMultiAttackResult.coordinate.y + 1}) は既に攻撃済みでした。`;
        } else if (res.sunkShipId) {
            return `${targetPlayerName} の ${res.shipName || '船'} を撃沈！`;
        } else if (res.hit) {
            return `${targetPlayerName} にヒット！`;
        } else {
            return `${targetPlayerName} はミス。`;
        }
      }).join(' ');
      
      setMessage(`攻撃結果: ${resultsMessages}`);

      const handleNextTurn = () => {
        // AIの思考後に次のターンへ
        setIsAttackOngoing(false); // 攻撃進行中フラグをリセット
        advanceTurn(); // 次のターンへ
      };

      // 人間プレイヤーの攻撃結果はすぐに表示し、OKボタンなどで次に進む方が良いが、
      // 今回はシンプルに一定時間後に次へ進むようにする
      const timer = setTimeout(handleNextTurn, 2000); // 2秒後に次へ

      return () => clearTimeout(timer); // クリーンアップ
    }
  }, [latestMultiAttackResult, advanceTurn, players]);


  // AIの行動ロジック
  useEffect(() => {
    if (currentPlayer && currentPlayer.type === 'ai' && !isAttackOngoing && phase === 'in-game') {
      setIsAttackOngoing(true);
      setMessage(`AI (${currentPlayer.name}) が攻撃中...`);

      // 擬似的なAI思考時間
      const aiAttackTimer = setTimeout(() => {
        const currentBoardState = gameStateRef.current.playerBoards[currentPlayer.id];
        if (!currentBoardState) {
          console.error("AI's board not found for attack simulation.");
          setIsAttackOngoing(false);
          advanceTurn();
          return;
        }

        let attackCoord: Coordinate | null = null;
        let attempts = 0;
        const maxAttempts = 100; // 無限ループ防止

        // 全てのターゲットボードに対して未攻撃のマスを探す
        const potentialTargets: Coordinate[] = [];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                let isAlreadyAttackedAllTargets = true;
                // 全てのターゲットが既に攻撃済みかチェック
                for (const targetBoard of targetPlayerBoards) {
                    if (!targetBoard.attackedCellsByTarget[currentPlayer.id] || !targetBoard.attackedCellsByTarget[currentPlayer.id][`${x},${y}`]) {
                        isAlreadyAttackedAllTargets = false;
                        break;
                    }
                }
                if (!isAlreadyAttackedAllTargets) {
                    potentialTargets.push({ x, y });
                }
            }
        }

        if (potentialTargets.length > 0) {
            attackCoord = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        } else {
            console.warn("No unattacked cells found for AI to target. Advancing turn.");
            setIsAttackOngoing(false);
            advanceTurn();
            return;
        }

        if (attackCoord) {
          handleAttack(currentPlayer.id, attackCoord);
          // handleAttack の中で最新MultiAttackResultがセットされ、useEffectが発火
        } else {
            console.warn("AI could not find a valid attack coordinate.");
            setIsAttackOngoing(false);
            advanceTurn();
        }
      }, 1500); // 1.5秒思考

      return () => clearTimeout(aiAttackTimer);
    }
  }, [currentPlayer, isAttackOngoing, phase, handleAttack, advanceTurn, targetPlayerBoards]); // 依存配列に isAttackOngoing を含める


  // ★重要★ ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  if (!myBoard || !currentPlayer || phase !== 'in-game') {
    // 進行中のフェーズでない場合もここで待機
    console.log("GameScreen: Waiting for all data to be ready or phase to be in-game.", { myBoard, currentPlayer, phase });
    return <div>ゲームボードを準備中...</div>;
  }

  // 人間プレイヤーが攻撃可能な状態か
  const isHumanTurnAndReady = currentPlayer.type === 'human' && currentPlayer.id === currentPlayerTurnId && !isAttackOngoing && !latestMultiAttackResult;

  // ターゲットボードを Flexbox で動的に配置
  const boardGridContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '20px',
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ textAlign: 'center' }}>現在のターン: {currentPlayer?.name}</h3>

      {message && (
        <p style={{ color: 'yellow', fontWeight: 'bold' }}>{message}</p>
      )}

      <div style={boardGridContainerStyle}>
        {/* 自分のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px', border: myBoard.playerId === currentPlayerTurnId ? '2px solid gold' : 'none', padding: '10px' }}>
          <h4>あなたのボード ({myBoard.playerId === currentPlayerTurnId ? '攻撃中' : '待機中'})</h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} disableClick={true} /> {/* 自分のボードはクリック不可 */}
        </div>

        {/* ターゲットとなる相手のボード群 */}
        {targetPlayerBoards.length > 0 ? (
          targetPlayerBoards.map(board => (
            <div key={board.playerId} style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h4>{players.find(p => p.id === board.playerId)?.name || `プレイヤー${board.playerId + 1}`} のボード</h4>
              <BoardGrid
                cells={board.cells} // 相手のボードは元のセルデータを使用
                isPlayerBoard={false} // 相手のボードなので船は非表示
                onCellClick={isHumanTurnAndReady ? (coord) => handleAttack(currentPlayer.id, coord) : undefined}
                disableClick={!isHumanTurnAndReady} // 人間プレイヤーのターンかつ攻撃中でない場合のみクリック可能
              />
            </div>
          ))
        ) : (
            // アクティブなターゲットがいない場合 (ゲームオーバーに近い状態など)
            <p>攻撃する相手がいません。</p>
        )}
      </div>

    </div>
  );
};

export default GameScreen;