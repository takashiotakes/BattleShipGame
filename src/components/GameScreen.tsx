// src/components/GameScreen.tsx

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid';
import { updateCellsWithShips, createEmptyBoard } from '../lib/boardUtils';
import { PlayerBoard, AttackResult, Coordinate, PlayerSettings } from '../models/types'; // PlayerSettings をインポート

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  // 現在のプレイヤー自身のボード
  const myPlayerBoard = useMemo(() => {
    // currentPlayerTurnId が有効な数値で、かつ playerBoards にそのIDのボードが存在する場合のみ返す
    if (currentPlayerTurnId !== -1 && playerBoards[currentPlayerTurnId]) {
      return playerBoards[currentPlayerTurnId];
    }
    return null; // 有効なボードがない場合は null
  }, [playerBoards, currentPlayerTurnId]);

  // 他のプレイヤーのボード（自分と'none'タイプではないプレイヤー）
  const opponentPlayers = useMemo(() => {
    return players.filter(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  // UI表示用のメッセージ
  const [message, setMessage] = useState<string>('');
  // 攻撃アニメーションやAI処理中のフラグ
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false);
  // 攻撃対象となるセルの座標 (ハイライト用)
  const [attackTargetCoord, setAttackTargetCoord] = useState<Coordinate | null>(null);

  // 自分のボードの表示用セルデータ (船が見える状態)
  const myDisplayCells = useMemo(() => {
    if (!myPlayerBoard) return createEmptyBoard(-1).cells; // myPlayerBoard がなければ空を返す
    // 自分のボードは placedShips を使って表示を更新
    return updateCellsWithShips(myPlayerBoard.cells, myPlayerBoard.placedShips);
  }, [myPlayerBoard]);


  // AIの攻撃ロジック
  const aiAttack = useCallback(async () => {
    if (!currentPlayer || currentPlayer.type !== 'ai' || phase !== 'in-game') return; // フェーズチェックを追加

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // AIの難易度に応じて攻撃座標を決定（ここでは簡易的なランダム選択）
    // TODO: 難易度に応じた賢いAIロジックを実装
    let selectedCoord: Coordinate;
    const availableCoords: Coordinate[] = [];

    // 全ての相手ボードに対して、まだ攻撃していない有効なマスを探す
    const targetOpponentBoards = opponentPlayers
      .map(p => playerBoards[p.id])
      .filter(board => board); // null/undefined を除外

    // どのボードも攻撃済みでないマスを探す
    // 同時攻撃なので、攻撃済みのマスは全てのボードで攻撃済みであるべき
    // そのため、ここでは最初の相手ボードの attackedCells を参照して決定する簡易的なロジック
    // 厳密には全てのターゲットボードの attackedCells を比較すべきだが、UI/ロジック上は同じマスを攻撃するため、これで十分
    if (targetOpponentBoards.length > 0) {
        const referenceBoard = targetOpponentBoards[0];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (!referenceBoard.attackedCells[`${x},${y}`]) {
                    availableCoords.push({ x, y });
                }
            }
        }
    }


    if (availableCoords.length > 0) {
      selectedCoord = availableCoords[Math.floor(Math.random() * availableCoords.length)];
    } else {
      // 攻撃できるマスがない場合は、既に攻撃済みのマスからランダムに選ぶ（ゲームロジック的にはありえないはずだが念のため）
      // あるいは、ゲームオーバーに移行すべき状況かもしれない
      console.warn("AI: No unattacked cells found. Selecting random attacked cell.");
      selectedCoord = { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) };
    }

    setAttackTargetCoord(selectedCoord); // 攻撃対象をハイライト
    await new Promise(resolve => setTimeout(resolve, 1500)); // AIの思考時間

    // handleAttack を呼び出す
    const attackResults = handleAttack(currentPlayer.id, selectedCoord);

    // 結果に基づいてメッセージを設定
    const allMiss = attackResults.every(result => !result.hit);
    const anySunk = attackResults.some(result => result.sunkShipId);

    if (anySunk) {
      setMessage(`${currentPlayer.name} の攻撃！ いくつかの船が沈没！`);
    } else if (allMiss) {
      setMessage(`${currentPlayer.name} の攻撃は全てミス！`);
    } else {
      setMessage(`${currentPlayer.name} の攻撃！ ヒット！`);
    }

    setAttackTargetCoord(null); // ハイライトを解除
    setIsAttackOngoing(false);
    // handleAttack 内でターンが進められるため、ここでは advanceTurn を呼ばない
  }, [currentPlayer, opponentPlayers, playerBoards, handleAttack, phase]);


  // 人間プレイヤーのセルクリックハンドラ
  const handleCellClick = useCallback(
    (coord: Coordinate) => {
      // 自分のターンで、かつ攻撃が進行中でない場合のみクリックを処理
      if (currentPlayer?.type === 'human' && !isAttackOngoing && phase === 'in-game') { // フェーズチェックを追加
        setIsAttackOngoing(true); // 攻撃開始フラグを立てる
        setMessage(`攻撃中... ${String.fromCharCode(65 + coord.x)}${coord.y + 1} へ一斉攻撃！`);
        setAttackTargetCoord(coord); // 攻撃対象をハイライト

        // 実際の攻撃処理は handleAttack に任せる
        handleAttack(currentPlayer.id, coord);

        // UIの状態をリセット
        // setTimeout を使ってアニメーションの表示を維持する時間を与える
        setTimeout(() => {
          setAttackTargetCoord(null);
          setIsAttackOngoing(false);
          setMessage(''); // メッセージをクリア
        }, 1000); // 1秒間ハイライトとメッセージを表示
      }
    },
    [currentPlayer, isAttackOngoing, handleAttack, phase]
  );


  // AIのターンになったら自動で攻撃処理を開始
  useEffect(() => {
    // isAttackOngoing が true の間は、新しい AI 攻撃を開始しない
    // また、ゲームオーバーフェーズでは AI 攻撃をトリガーしない
    if (phase === 'in-game' && currentPlayer?.type === 'ai' && !isAttackOngoing && gameState.winnerId === null) {
      aiAttack();
    }
  }, [phase, currentPlayer, isAttackOngoing, aiAttack, gameState.winnerId]); // gameState.winnerId を依存配列に追加


  // ゲームオーバー画面への遷移
  useEffect(() => {
    if (phase === 'game-over') {
      // ゲーム終了時にメッセージ表示などをしたい場合
      if (gameState.winnerId !== null) {
        setMessage(`${gameState.players.find(p => p.id === gameState.winnerId)?.name} の勝利！`);
      } else {
        setMessage('ゲーム終了！ 引き分け');
      }
      setIsAttackOngoing(false); // ゲームオーバー時は攻撃アニメーションを停止
    }
  }, [phase, gameState.winnerId, gameState.players]);


  // ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  // currentPlayerTurnId が -1 の場合、または myPlayerBoard/currentPlayer が null の場合は準備中
  if (phase !== 'in-game' || !myPlayerBoard || !currentPlayer || currentPlayerTurnId === -1) {
    console.log("GameScreen: Waiting for all data to be ready or phase to be in-game. Current values:", { myPlayerBoard, currentPlayer, phase, currentPlayerTurnId });
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ textAlign: 'center' }}>現在のターン: {currentPlayer?.name}</h3>

      {message && (
        <p style={{ color: 'yellow', fontWeight: 'bold' }}>{message}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px', flexWrap: 'wrap' }}>
        {/* 自分のボード */}
        <div style={{ textAlign: 'center', marginBottom: '20px', border: currentPlayer.id === myPlayerBoard.playerId && phase === 'in-game' ? '2px solid gold' : 'none' }}>
          <h4>あなたのボード ({myPlayerBoard.playerId === currentPlayerTurnId ? 'ターン' : '待機中'})</h4>
          <BoardGrid
            cells={myDisplayCells}
            isPlayerBoard={true}
            disableClick={true} // 自分のボードはクリック不可
          />
        </div>

        {/* 相手のボード群 */}
        {opponentPlayers.map(opponentPlayer => {
          const opponentBoard = playerBoards[opponentPlayer.id];
          if (!opponentBoard) return null; // ボードデータがない場合はスキップ

          // 相手ボードの表示用セルデータ (船が見えない状態)
          const opponentDisplayCells = opponentBoard.cells.map(row =>
            row.map(cell => ({
              ...cell,
              // 相手のボードでは、船は表示せず、攻撃結果のみ表示
              status: cell.status === 'ship' ? 'empty' : cell.status
            }))
          );

          // 攻撃ターゲットのハイライト表示を BoardGrid に渡す
          const highlightCoordForOpponent = attackTargetCoord; // 全ての相手ボードに同じハイライトを適用

          return (
            <div
              key={opponentPlayer.id}
              style={{
                textAlign: 'center',
                marginBottom: '20px',
                border: currentPlayer.id === opponentPlayer.id && phase === 'in-game' ? '2px solid gold' : 'none' // AIターンでもハイライト
              }}
            >
              <h4>{opponentPlayer.name} のボード</h4>
              <BoardGrid
                cells={opponentDisplayCells}
                isPlayerBoard={false} // 相手のボード
                onCellClick={handleCellClick} // 人間プレイヤーのターンであればクリック可能
                disableClick={isAttackOngoing || currentPlayer?.type !== 'human' || phase !== 'in-game'} // 攻撃中かAIターン、またはゲーム中以外ならクリック不可
                highlightCoord={highlightCoordForOpponent} // ハイライト座標を渡す
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameScreen;