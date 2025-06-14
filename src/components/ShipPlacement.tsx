// src/components/ShipPlacement.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlayerSettings, PlacedShip, ShipDefinition, Orientation, Coordinate } from '../models/types';
import BoardGrid from './BoardGrid';
import { useGame } from '../contexts/GameContext';
import { createEmptyBoard, updateCellsWithShips, isValidPlacement, getCellsWithPreview, placeShipRandomly } from '../lib/boardUtils';

interface ShipPlacementProps {
  // propsから削除し、useGameから取得
}

const ShipPlacement: React.FC<ShipPlacementProps> = () => {
  const { gameState, setGameState, advancePhase } = useGame();

  const activePlayers = useMemo(() => gameState.players.filter(p => p.type !== 'none'), [gameState.players]);

  // 配置フェーズ中の現在のプレイヤーIDを管理
  const [currentPlacementPlayerId, setCurrentPlacementPlayerId] = useState<number>(-1); // 初期値を-1に変更
  // AIの配置中かどうかを示すステート
  const [isAIPlacing, setIsAIPlacing] = useState<boolean>(false);

  // 現在選択中の船と向きを管理するローカルステート（人間プレイヤー用）
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [currentOrientation, setCurrentOrientation] = useState<Orientation>('horizontal');
  // プレビュー表示用の船の開始座標
  const [previewStartCoord, setPreviewStartCoord] = useState<Coordinate | null>(null);
  // 配置中のエラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 現在配置を行っているプレイヤーの情報を取得
  const currentPlayer = useMemo(() => activePlayers.find(p => p.id === currentPlacementPlayerId), [activePlayers, currentPlacementPlayerId]);

  // 現在のプレイヤーのボードデータを取得
  const currentBoard = useMemo(() => gameState.playerBoards[currentPlacementPlayerId], [gameState.playerBoards, currentPlacementPlayerId]);

  // 未配置の船リスト (メモ化して不要な再計算を避ける)
  const unplacedShips = useMemo(() => {
    return currentBoard?.placedShips.filter(ship => ship.start.x === -1) || [];
  }, [currentBoard]);

  // 配置済みの船リスト (メモ化して不要な再計算を避ける)
  const placedShips = useMemo(() => {
    return currentBoard?.placedShips.filter(ship => ship.start.x !== -1) || [];
  }, [currentBoard]);

  // 配置フェーズ開始時またはプレイヤー切り替え時に実行される初期化ロジック
  useEffect(() => {
    if (gameState.phase !== 'ship-placement') {
      return;
    }

    // currentPlacementPlayerId が初期値または無効な場合は、最初の有効なプレイヤーを設定
    if (currentPlacementPlayerId === -1 || !activePlayers.some(p => p.id === currentPlacementPlayerId)) {
      const firstHuman = activePlayers.find(p => p.type === 'human');
      if (firstHuman) {
        setCurrentPlacementPlayerId(firstHuman.id);
      } else if (activePlayers.length > 0) {
        setCurrentPlacementPlayerId(activePlayers[0].id); // 人間がいない場合は最初のAIから
      } else {
        setErrorMessage('ゲームを開始できるプレイヤーがいません。');
      }
      return; // 初期化が完了したら一度抜ける
    }
  }, [gameState.phase, activePlayers, currentPlacementPlayerId]);

  // AIプレイヤーの船配置ロジック
  useEffect(() => {
    if (gameState.phase !== 'ship-placement' || !currentPlayer) {
      return;
    }

    // 全てのプレイヤーの船が配置済みであれば、このuseEffectは早期終了
    const allPlayersAllShipsPlaced = activePlayers.every(player => {
      const board = gameState.playerBoards[player.id];
      return board && board.placedShips.every(ship => ship.start.x !== -1);
    });
    if (allPlayersAllShipsPlaced) {
      return;
    }

    if (currentPlayer.type === 'ai' && unplacedShips.length > 0 && !isAIPlacing) {
      setIsAIPlacing(true); // AI配置開始フラグを立てる
      setErrorMessage('AIが船を配置中です...');

      const placeAllAIShips = async () => {
        // 残っているAIの船を全て配置するループ
        for (const shipToPlace of unplacedShips) {
          await new Promise(resolve => setTimeout(resolve, 200)); // AIの思考時間を模倣

          setGameState(prevGameState => {
            const currentAIPlayerBoard = prevGameState.playerBoards[currentPlacementPlayerId];
            const currentAIPlacedShips = currentAIPlayerBoard.placedShips.filter(s => s.start.x !== -1); // 現在配置済みのAIの船

            // 現在配置しようとしている船の定義
            const shipDefToPlace = shipToPlace.definition;

            // ランダムに配置を試みる
            const placedShipInfo = placeShipRandomly(shipDefToPlace, currentAIPlacedShips); // ここで currentAIPlacedShips を渡す

            if (placedShipInfo) {
              const updatedPlacedShips = currentAIPlayerBoard.placedShips.map(s => {
                if (s.id === placedShipInfo.id) {
                  return placedShipInfo;
                }
                return s;
              });

              const updatedCells = updateCellsWithShips(createEmptyBoard(currentPlacementPlayerId).cells, updatedPlacedShips);

              return {
                ...prevGameState,
                playerBoards: {
                  ...prevGameState.playerBoards,
                  [currentPlacementPlayerId]: {
                    ...currentAIPlayerBoard,
                    placedShips: updatedPlacedShips,
                    cells: updatedCells,
                  },
                },
              };
            } else {
              console.error(`AI failed to place ship: ${shipDefToPlace.name}`);
              return prevGameState; // 配置失敗時は状態を変更しない
            }
          });
        }
        // ループ終了後、AIの配置が完了
        setIsAIPlacing(false);
        setErrorMessage(null);

        // 次のプレイヤーに移行
        const currentIndex = activePlayers.findIndex(p => p.id === currentPlacementPlayerId);
        const nextPlayer = activePlayers[currentIndex + 1];

        if (nextPlayer) {
          setCurrentPlacementPlayerId(nextPlayer.id);
        } else {
          // 全てのプレイヤーの配置が完了
          console.log('全てのプレイヤーの船が配置されました！');
        }
      };

      placeAllAIShips();
    }
  }, [currentPlayer, unplacedShips, isAIPlacing, placedShips, setGameState, currentPlacementPlayerId, activePlayers, gameState.phase]);


  // 人間プレイヤーの場合、未配置の最初の船を自動選択
  useEffect(() => {
    if (currentPlayer?.type === 'human' && unplacedShips.length > 0 && selectedShipId === null) {
      setSelectedShipId(unplacedShips[0].id);
    } else if (currentPlayer?.type === 'human' && unplacedShips.length === 0 && selectedShipId !== null) {
      setSelectedShipId(null);
      setPreviewStartCoord(null);
    }
  }, [unplacedShips, selectedShipId, currentPlayer]);


  // ボード上に表示するセルデータを生成 (プレビューを考慮)
  const displayCells = useMemo(() => {
    // 実際の配置済み船に基づいてボードを生成
    const baseCells = currentBoard ? updateCellsWithShips(createEmptyBoard(currentPlacementPlayerId).cells, placedShips) : [];

    // プレビュー表示（人間プレイヤーの場合のみ）
    if (currentPlayer?.type === 'human' && selectedShipId && previewStartCoord) {
      const shipDefToPreview = unplacedShips.find(s => s.id === selectedShipId)?.definition;
      if (shipDefToPreview) {
        const canPlacePreview = isValidPlacement(
            shipDefToPreview,
            previewStartCoord,
            currentOrientation,
            placedShips // 既存の配置済み船との衝突もチェック
        );
        // プレビュー表示用のセルデータを生成
        return getCellsWithPreview(baseCells, shipDefToPreview, previewStartCoord, currentOrientation, canPlacePreview);
      }
    }
    return baseCells;
  }, [currentBoard, placedShips, selectedShipId, previewStartCoord, currentOrientation, unplacedShips, currentPlacementPlayerId, currentPlayer]);

  // 未配置の船をクリックして選択 (人間プレイヤー用)
  const handleShipSelect = useCallback((shipId: string) => {
    if (isAIPlacing || currentPlayer?.type !== 'human') return;
    setSelectedShipId(shipId);
    setErrorMessage(null); // エラーメッセージをクリア
  }, [isAIPlacing, currentPlayer]);

  // ボードのセルをクリックして船を配置 (人間プレイヤー用)
  const handleCellClick = useCallback((coord: Coordinate) => {
    if (isAIPlacing || currentPlayer?.type !== 'human') return;

    if (!selectedShipId) {
      setErrorMessage('配置する船を選択してください。');
      return;
    }

    const shipToPlaceDef = unplacedShips.find(s => s.id === selectedShipId)?.definition;

    if (!shipToPlaceDef) {
      setErrorMessage('選択された船が見つかりません。');
      return;
    }

    // 配置のバリデーション
    const placementIsValid = isValidPlacement(
      shipToPlaceDef,
      coord,
      currentOrientation,
      placedShips // 既に配置済みの船を渡す
    );

    if (!placementIsValid) {
      setErrorMessage('その位置には船を配置できません。（範囲外または他の船と衝突）');
      return;
    }

    // 配置が有効な場合、gameStateを更新
    setGameState(prevGameState => {
      const updatedPlayerBoards = { ...prevGameState.playerBoards };
      const currentPlayerBoard = { ...updatedPlayerBoards[currentPlacementPlayerId] };

      const newPlacedShip: PlacedShip = {
        id: selectedShipId,
        definition: shipToPlaceDef,
        start: coord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };

      const updatedPlacedShips = currentPlayerBoard.placedShips.map(s => {
        if (s.id === selectedShipId) {
          return newPlacedShip;
        }
        return s;
      });

      const updatedCells = updateCellsWithShips(createEmptyBoard(currentPlacementPlayerId).cells, updatedPlacedShips);

      updatedPlayerBoards[currentPlacementPlayerId] = {
        ...currentPlayerBoard,
        placedShips: updatedPlacedShips,
        cells: updatedCells,
      };

      return {
        ...prevGameState,
        playerBoards: updatedPlayerBoards,
      };
    });

    setErrorMessage(null);
    setPreviewStartCoord(null);

    // 人間プレイヤーの船が全て配置されたら次のプレイヤーに移行
    const newlyUnplacedShips = unplacedShips.filter(s => s.id !== selectedShipId);
    if (newlyUnplacedShips.length === 0) {
      setSelectedShipId(null); // 全ての船が配置された
      const currentIndex = activePlayers.findIndex(p => p.id === currentPlacementPlayerId);
      const nextPlayer = activePlayers[currentIndex + 1];
      if (nextPlayer) {
        setCurrentPlacementPlayerId(nextPlayer.id);
      } else {
        console.log('全てのプレイヤーの船が配置されました！');
      }
    } else {
      // 次の未配置の船を自動選択
      setSelectedShipId(newlyUnplacedShips[0].id);
    }
  }, [selectedShipId, unplacedShips, currentOrientation, placedShips, setGameState, currentPlacementPlayerId, activePlayers, isAIPlacing, currentPlayer]);

  // 船を回転 (人間プレイヤー用)
  const handleRotateShip = useCallback(() => {
    if (isAIPlacing || currentPlayer?.type !== 'human') return;
    setCurrentOrientation(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    setErrorMessage(null);
  }, [isAIPlacing, currentPlayer]);

  // マウスオーバーでプレビュー表示 (人間プレイヤー用)
  const handleCellHover = useCallback((coord: Coordinate) => {
    if (isAIPlacing || currentPlayer?.type !== 'human') return;
    setPreviewStartCoord(coord);
  }, [isAIPlacing, currentPlayer]);

  // マウスがボードから離れたらプレビューをクリア (人間プレイヤー用)
  const handleBoardMouseLeave = useCallback(() => {
    if (isAIPlacing || currentPlayer?.type !== 'human') return;
    setPreviewStartCoord(null);
  }, [isAIPlacing, currentPlayer]);

  // 全てのプレイヤーの船が配置されたか
  const allPlayersAllShipsPlaced = useMemo(() => {
    return activePlayers.every(player => {
      const board = gameState.playerBoards[player.id];
      return board && board.placedShips.every(ship => ship.start.x !== -1);
    });
  }, [activePlayers, gameState.playerBoards]);

  const handleGameStart = useCallback(() => {
    if (allPlayersAllShipsPlaced) {
      advancePhase('in-game'); // ゲーム開始フェーズへ
    } else {
      setErrorMessage('全てのプレイヤーの船を配置してください。');
    }
  }, [allPlayersAllShipsPlaced, advancePhase]);

  // currentPlayer がまだ設定されていない場合は何も表示しない
  if (!currentPlayer) {
    return <div>ロード中...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>⚓ Battle Ship Game ⚓</h2>
      <h3 style={{ textAlign: 'center' }}>
        [{currentPlayer.name}] の船を配置してください
        {isAIPlacing && <span style={{ marginLeft: '10px', color: 'yellow' }}>(AI配置中...)</span>}
      </h3>

      {errorMessage && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMessage}</p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px',
          opacity: isAIPlacing ? 0.5 : 1, // AI配置中はボードを半透明にする
          pointerEvents: isAIPlacing ? 'none' : 'auto', // AI配置中はボードの操作を無効にする
        }}
        onMouseLeave={handleBoardMouseLeave}
      >
        <BoardGrid cells={displayCells} isPlayerBoard={true} onCellClick={handleCellClick} onCellHover={handleCellHover} />
      </div>

      {currentPlayer.type === 'human' && ( // 人間プレイヤーの場合のみ船リストと操作ボタンを表示
        <>
          <div style={{ marginBottom: '20px', textAlign: 'left', paddingLeft: '100px' }}>
            <strong>残りの船:</strong>
            <ul>
              {unplacedShips.map(ship => (
                <li
                  key={ship.id}
                  style={{
                    fontWeight: selectedShipId === ship.id ? 'bold' : 'normal',
                    backgroundColor: selectedShipId === ship.id ? '#ffffcc' : 'transparent',
                    cursor: 'pointer',
                    marginBottom: '5px',
                    padding: '3px',
                    borderRadius: '3px',
                    color: selectedShipId === ship.id ? 'black' : 'white',
                  }}
                  onClick={() => handleShipSelect(ship.id)}
                >
                  {ship.definition.name} ({ship.definition.size}マス)
                </li>
              ))}
            </ul>

            {placedShips.length > 0 && (
                <>
                    <strong>配置済みの船:</strong>
                    <ul>
                        {placedShips.map(ship => (
                            <li key={ship.id}>
                                {ship.definition.name} ({ship.definition.size}マス) @ ({String.fromCharCode(65 + ship.start.x)}, {ship.start.y + 1}) - {ship.orientation === 'horizontal' ? '水平' : '垂直'}
                            </li>
                        ))}
                    </ul>
                </>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button onClick={handleRotateShip} style={{ marginRight: '10px' }}>
              船を回転 ({currentOrientation === 'horizontal' ? '水平' : '垂直'})
            </button>
            <button disabled={true}>ランダム配置 (未実装)</button>
          </div>
        </>
      )}


      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button onClick={() => { /* TODO: 再配置ロジック */ }} disabled={true}>再配置 (未実装)</button>
        <button onClick={handleGameStart} disabled={!allPlayersAllShipsPlaced}>
          ゲーム開始
        </button>
      </div>
    </div>
  );
};

export default ShipPlacement;