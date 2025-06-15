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

  const myBoard = useMemo(() => playerBoards[currentPlayerTurnId], [playerBoards, currentPlayerTurnId]);

  const opponentPlayer = useMemo(() => {
    // currentPlayerTurnId 以外の、最初の「none」ではないプレイヤーを見つける
    return players.find(p => p.id !== currentPlayerTurnId && p.type !== 'none');
  }, [players, currentPlayerTurnId]);

  const opponentBoard = useMemo(() => opponentPlayer ? playerBoards[opponentPlayer.id] : null, [opponentPlayer, playerBoards]);

  // ★修正箇所★ myDisplayCells
  const myDisplayCells = useMemo(() => {
    // myBoard が存在しない場合は空の配列を返す
    if (!myBoard) {
        console.warn("myBoard is null/undefined in myDisplayCells memo.");
        return createEmptyBoard(0).cells; // または適切なデフォルト値
    }
    // updateCellsWithShips に渡す cells は、myBoard.cells を使う (配置済みの船情報を含むため)
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips);
  }, [myBoard]);

  // ★修正箇所★ opponentDisplayCells
  const opponentDisplayCells = useMemo(() => {
    if (!opponentBoard) {
        console.warn("opponentBoard is null/undefined in opponentDisplayCells memo.");
        return createEmptyBoard(0).cells; // または適切なデフォルト値
    }

    // 相手のボードは、攻撃履歴に基づいて表示する
    const cellsForOpponentView = createEmptyBoard(opponentBoard.playerId).cells;

    // myBoard.attackedCells を参照して、相手のボードにヒット/ミスの状態を反映
    if (myBoard) { // 自分のボードがまだ準備できていない場合はスキップ
        for (const key in myBoard.attackedCells) {
            const [x, y] = key.split(',').map(Number);
            if (cellsForOpponentView[y] && cellsForOpponentView[y][x]) {
                const attackedStatus = myBoard.attackedCells[key]; // 自分の攻撃履歴
                const targetOriginalCell = opponentBoard.cells[y][x]; // 相手ボードの実際のセル

                if (attackedStatus === 'hit') {
                    // ヒットした場合、相手のボードの実際の船が沈んでいるか確認
                    const isSunk = targetOriginalCell.status === 'ship' &&
                                   opponentBoard.placedShips.find(s => s.id === targetOriginalCell.shipId)?.isSunk;
                    if (isSunk) {
                        // 沈んだ船の全てのマスを 'sunk' に更新
                        const sunkShip = opponentBoard.placedShips.find(s => s.id === targetOriginalCell.shipId);
                        if(sunkShip) { // sunkShip が見つかった場合のみ処理
                            for(let i=0; i<sunkShip.definition.size; i++) {
                                const sx = sunkShip.orientation === 'horizontal' ? sunkShip.start.x + i : sunkShip.start.x;
                                const sy = sunkShip.orientation === 'vertical' ? sunkShip.start.y + i : sunkShip.start.y;
                                if(cellsForOpponentView[sy] && cellsForOpponentView[sy][sx]) {
                                    cellsForOpponentView[sy][sx].status = 'sunk';
                                }
                            }
                        } else {
                            // 沈んだはずの船が見つからない場合は、とりあえずヒットとして表示
                            cellsForOpponentView[y][x].status = 'hit';
                        }
                    } else {
                        cellsForOpponentView[y][x].status = 'hit';
                    }
                } else if (attackedStatus === 'miss') {
                    cellsForOpponentView[y][x].status = 'miss';
                }
            }
        }
    }
    return cellsForOpponentView;
  }, [opponentBoard, myBoard]); // myBoard も依存配列に含める

  const [message, setMessage] = useState<string | null>(null);
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃が進行中かどうかの新しいフラグ

  // 敵のボードをクリックした際の攻撃処理 (人間プレイヤー用)
  const handleOpponentBoardClick = useCallback(async (coord: Coordinate) => {
    // 攻撃が進行中の場合、または自分のターンでない場合は何もしない
    if (isAttackOngoing || gameStateRef.current.phase !== 'in-game' || !currentPlayer || currentPlayer.type !== 'human') {
        if (isAttackOngoing) {
             // 攻撃中は沈黙
        } else if (currentPlayer && currentPlayer.type === 'ai') {
            setMessage("AIのターンです。");
        } else {
            setMessage("ゲームが開始されていません。");
        }
        return;
    }
    if (!opponentPlayer || !opponentBoard) {
        setMessage("攻撃対象が見つかりません。");
        return;
    }
    if (myBoard?.attackedCells[`${coord.x},${coord.y}`]) {
        setMessage("このマスは既に攻撃済みです。");
        return;
    }

    setIsAttackOngoing(true); // 攻撃処理開始
    setMessage(null); // メッセージをクリア

    const attackResult = handleAttack(currentPlayer.id, opponentPlayer.id, coord);

    if (attackResult.alreadyAttacked) { // handleAttack から既に攻撃済みという結果が返された場合
        setMessage("このマスは既に攻撃済みです。");
        setIsAttackOngoing(false); // 処理終了
        return;
    }

    if (attackResult.sunkShipId) {
        const sunkShipName = opponentBoard.placedShips.find(s => s.id === attackResult.sunkShipId)?.definition.name;
        setMessage(`${opponentPlayer.name} の ${sunkShipName} を撃沈しました！`);
    } else if (attackResult.hit) {
        setMessage("ヒット！");
    } else {
        setMessage("ミス！");
    }

    // 攻撃結果の表示とsetStateの反映を待つため、少し遅延を入れてからターンを進める
    // このsetTimeoutは、人間プレイヤーの「クリック後の処理」を遅延させる目的
    setTimeout(() => {
        // UIに結果が表示され、人間の認識時間も確保された後、
        // 攻撃処理フラグを解除し、ゲームが終了していなければターンを進める
        setIsAttackOngoing(false); // 攻撃処理終了

        // gameStateRef.current を参照して、最新のフェーズを確認
        if (gameStateRef.current.phase === 'in-game') {
            advanceTurn(); // ゲームが終了していなければターンを進める
        }
    }, 1000); // 遅延を 1000ms (1秒) に延長。UI表示と次のターンへの切り替えをより明確にする

  }, [isAttackOngoing, currentPlayer, opponentPlayer, opponentBoard, myBoard, handleAttack, advanceTurn]);

  // AIのターン処理
  useEffect(() => {
    // AIのターン処理を実行する厳密な条件:
    // 1. ゲームが 'in-game' フェーズであること
    // 2. 現在のプレイヤーがAIであること
    // 3. 攻撃が進行中でないこと (人間、AIどちらの攻撃も)
    if (gameStateRef.current.phase !== 'in-game' ||
        !currentPlayer ||
        currentPlayer.type !== 'ai' ||
        isAttackOngoing // 攻撃が進行中の場合はAIは動作しない
    ) {
      return;
    }

    // AIのターン開始を通知 (このログはAIが動き始める直前に出る)
    console.log(`AIのターン開始: ${currentPlayer.name}`);

    const aiAttack = async () => {
      // AIが攻撃を開始することをシステムに通知
      setIsAttackOngoing(true); // AIの攻撃処理開始

      // AIの思考時間
      await new Promise(resolve => setTimeout(resolve, 1000)); // AIの思考時間を確保 (1秒)

      // 処理中にゲームフェーズが変わっていないか再確認 (特にAIの長い遅延後に重要)
      if (gameStateRef.current.phase !== 'in-game') {
          console.log("AI: ゲームフェーズが変更されたため、攻撃を中止します。");
          setIsAttackOngoing(false); // 攻撃処理終了フラグをリセット
          return;
      }

      if (!opponentPlayer || !opponentBoard || !myBoard) { // myBoard もチェック
          console.error("AI: 攻撃対象または自身のボードが見つかりません。ターンを進めます。");
          setIsAttackOngoing(false); // 攻撃処理終了フラグをリセット
          advanceTurn(); // ターンを進める（無限ループ防止）
          return;
      }

      let targetCoord: Coordinate;
      let isValidAttack = false;

      // ランダムに未攻撃のセルを探す
      const maxAttempts = 100;
      let attempts = 0;
      // 既に攻撃済みの座標をセットで保持すると高速化できる
      const attackedCoordsSet = new Set(Object.keys(myBoard.attackedCells));

      do {
        targetCoord = { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) };
        // 既に攻撃済みの座標かどうかをチェック
        if (!attackedCoordsSet.has(`${targetCoord.x},${targetCoord.y}`)) {
          isValidAttack = true;
        }
        attempts++;
      } while (!isValidAttack && attempts < maxAttempts);

      if (!isValidAttack) {
          console.error("AI: 攻撃可能なマスが見つかりませんでした。ターンを進めます。");
          setIsAttackOngoing(false); // 攻撃処理終了フラグをリセット
          advanceTurn();
          return;
      }

      setMessage(`${currentPlayer.name} が攻撃中...`);

      const attackResult: AttackResult = handleAttack(currentPlayer.id, opponentPlayer.id, targetCoord);

      if (attackResult.sunkShipId) {
          const sunkShipName = opponentBoard.placedShips.find(s => s.id === attackResult.sunkShipId)?.definition.name;
          setMessage(`${currentPlayer.name} が ${opponentPlayer.name} の ${sunkShipName} を撃沈！`);
      } else if (attackResult.hit) {
          setMessage(`${currentPlayer.name} がヒット！`);
      } else {
          setMessage(`${currentPlayer.name} がミス！`);
      }

      // AI攻撃結果表示とsetState反映を待つため、少し遅延を入れてからターンを進める
      setTimeout(() => {
          setIsAttackOngoing(false); // AIの攻撃処理終了

          if (gameStateRef.current.phase === 'in-game') {
              advanceTurn();
          }
      }, 2000); // AIの攻撃後、次のターンに進むまでの遅延をさらに長く (1500ms から 2000ms へ)

    };

    aiAttack();

  }, [currentPlayer, opponentPlayer, opponentBoard, myBoard, handleAttack, advanceTurn, isAttackOngoing]); // 依存配列に isAttackOngoing を含める

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
          <BoardGrid cells={opponentDisplayCells} isPlayerBoard={false} onCellClick={handleOpponentBoardClick} disableClick={isAttackOngoing || currentPlayer.type === 'ai'} />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;