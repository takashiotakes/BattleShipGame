// src/components/ShipPlacement.tsx

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import BoardGrid from './BoardGrid'; // BoardGrid が同じ階層か確認
import {
  PlayerSettings,
  ShipDefinition,
  PlacedShip,
  Coordinate,
  Orientation,
  ALL_SHIPS, // 全ての船の定義をインポート
} from '../models/types';
import {
  createEmptyBoard,
  isShipWithinBounds,
  isShipPlacementValid,
  placeShipOnBoard,
  generateRandomShipPlacement,
} from '../lib/boardUtils'; // 必要なユーティリティをインポート

interface ShipPlacementProps {
  // players: PlayerSettings[]; // GameContext から取得するため不要
  // currentPlayerIndex: number; // GameContext から取得するため不要
}

const ShipPlacement: React.FC<ShipPlacementProps> = () => {
  const { gameState, advancePhase, setPlayerBoardShips, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // 現在船を配置しているプレイヤー
  const currentPlayer = useMemo(() => players.find(p => p.id === currentPlayerTurnId), [players, currentPlayerTurnId]);

  // 配置中の船のインデックス（ALL_SHIPS配列の）
  const [currentShipIndex, setCurrentShipIndex] = useState<number>(0);
  // 現在のプレイヤーが配置した船のリスト (UI表示用の一時的なstate)
  const [currentPlacedShips, setCurrentPlacedShips] = useState<PlacedShip[]>([]);
  // 現在プレビュー中の船の向き
  const [currentOrientation, setCurrentOrientation] = useState<Orientation>('horizontal');
  // 現在プレビュー中の船の開始座標 (ホバー時)
  const [hoverCoord, setHoverCoord] = useState<Coordinate | null>(null);

  // 初回ロード時または currentPlayer が変わった時に状態をリセット
  useEffect(() => {
    // currentPlayerId が有効かつ、まだこのプレイヤーの船が配置されていない場合のみリセット
    if (currentPlayer && playerBoards[currentPlayer.id]?.placedShips.length === 0) {
      setCurrentShipIndex(0);
      setCurrentPlacedShips([]);
      setCurrentOrientation('horizontal');
      setHoverCoord(null);

      // AIプレイヤーの場合、自動配置を実行
      if (currentPlayer.type === 'ai') {
        handleRandomPlacement(currentPlayer.id);
      }
    }
  }, [currentPlayer, playerBoards]); // currentPlayer, playerBoards に依存

  // 現在配置すべき船の定義
  const shipToPlace = useMemo(() => {
    return ALL_SHIPS[currentShipIndex] || null;
  }, [currentShipIndex]);

  // 現在のボードの状態（配置済みの船も含む）
  const currentBoardCells = useMemo(() => {
    const empty = createEmptyBoard(currentPlayer?.id || 0).cells;
    return currentPlacedShips.reduce((cells, pShip) => {
      return placeShipOnBoard(cells, pShip.definition, pShip.start, pShip.orientation);
    }, empty);
  }, [currentPlayer, currentPlacedShips]);

  // ボードのクリックハンドラ（船の配置）
  const handleBoardClick = useCallback((coord: Coordinate) => {
    if (!shipToPlace || !currentPlayer || currentPlayer.type === 'ai') return; // 配置すべき船がないか、AIプレイヤーなら何もしない

    // 配置が有効かチェック
    const isValid = isShipWithinBounds(coord, shipToPlace.size, currentOrientation) &&
                    isShipPlacementValid(currentBoardCells, coord, shipToPlace.size, currentOrientation);

    if (isValid) {
      const newPlacedShip: PlacedShip = {
        id: shipToPlace.id, // ShipDefinitionのidを使う
        definition: shipToPlace,
        start: coord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };
      setCurrentPlacedShips(prev => [...prev, newPlacedShip]);
      setCurrentShipIndex(prev => prev + 1); // 次の船へ
    } else {
      console.warn("Invalid placement: Ship out of bounds or overlaps with another ship.");
    }
  }, [shipToPlace, currentOrientation, currentBoardCells, currentPlayer]);

  // ボードのホバーハンドラ（プレビュー表示）
  const handleBoardHover = useCallback((coord: Coordinate) => {
    setHoverCoord(coord);
  }, []);

  // ボードからマウスが離れた時
  const handleBoardLeave = useCallback(() => {
    setHoverCoord(null);
  }, []);

  // 船を回転
  const handleRotateShip = useCallback(() => {
    setCurrentOrientation(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  // ランダム配置
  const handleRandomPlacement = useCallback((playerId: number) => {
    const newPlacedShips: PlacedShip[] = [];
    let tempCells = createEmptyBoard(playerId).cells; // 仮のボード状態
    let allShipsPlacedSuccessfully = true;

    for (const shipDef of ALL_SHIPS) {
      const placedShip = generateRandomShipPlacement(playerId, shipDef, newPlacedShips); // 既存の船を考慮して配置
      if (placedShip) {
        newPlacedShips.push(placedShip);
        // 仮のボードを更新して、次の船の配置判断に使う (これは isShipPlacementValid の内部で処理されるのでここでは不要だが、念のため)
        tempCells = placeShipOnBoard(tempCells, placedShip.definition, placedShip.start, placedShip.orientation);
      } else {
        console.error(`Failed to place ship ${shipDef.name} randomly for player ${playerId}.`);
        allShipsPlacedSuccessfully = false;
        break; // 一つでも配置できなければ中断
      }
    }

    if (allShipsPlacedSuccessfully) {
      setPlayerBoardShips(playerId, newPlacedShips); // Contextを更新
      setCurrentPlacedShips(newPlacedShips); // UIの状態も更新
      setCurrentShipIndex(ALL_SHIPS.length); // 全ての船を配置済みにする
    } else {
        console.error("Random placement failed for some ships. Resetting for manual placement.");
        setCurrentShipIndex(0);
        setCurrentPlacedShips([]);
    }
  }, [setPlayerBoardShips, ALL_SHIPS]);


  // ★修正: 全てのプレイヤーの配置が完了したらゲーム開始、そうでなければ次のプレイヤーへ
  // setPlayerBoardShips が Context の状態を更新した後に実行されるように useEffect を使用
  useEffect(() => {
      // currentPlayer が定義されており、現在のフェーズが ship-placement であることを確認
      if (!currentPlayer || phase !== 'ship-placement') {
          return;
      }

      // 現在のプレイヤーのボードの placedShips が ALL_SHIPS の数と一致する場合
      // かつ、それが実際に GameContext に反映されていることを確認 (UI state ではなく context state を参照)
      const currentPlayersBoardInContext = playerBoards[currentPlayer.id];
      if (currentPlayersBoardInContext && currentPlayersBoardInContext.placedShips.length === ALL_SHIPS.length) {
          // 短い遅延を入れて UI 更新と Context の状態伝播を待つ
          setTimeout(() => {
              const activePlayers = players.filter(p => p.type !== 'none');
              const currentPlayerIndex = activePlayers.findIndex(p => p.id === currentPlayer.id);

              if (currentPlayerIndex < activePlayers.length - 1) {
                  // 次のプレイヤーの配置フェーズへ
                  const nextPlayer = activePlayers[currentPlayerIndex + 1];
                  // GameContext の currentPlayerTurnId を直接更新
                  setGameState(prev => ({ ...prev, currentPlayerTurnId: nextPlayer.id }));
              } else {
                  // 全てのプレイヤーの配置が完了したらゲーム開始
                  advancePhase('in-game');
              }
          }, 200); // 適切な遅延時間を設定
      }
  }, [playerBoards, players, currentPlayer, phase, setGameState, advancePhase]); // 依存配列に setGameState, advancePhase を追加


  // "配置完了" / "次のプレイヤーへ" ボタンのハンドラ
  const handleNextPlayerOrGameStart = useCallback(() => {
    if (currentPlacedShips.length === ALL_SHIPS.length) {
      setPlayerBoardShips(currentPlayer?.id || 0, currentPlacedShips); // 最終確定をContextに保存
      // ここで直接 next player や game start へ遷移するロジックは削除
      // 上記の useEffect が setPlayerBoardShips の完了を検知して遷移する
    } else {
      alert("全ての船を配置してください！");
    }
  }, [currentPlacedShips, currentPlayer, setPlayerBoardShips]); // 依存配列から moveToNextPlayerOrGameStart を削除


  if (!currentPlayer || phase !== 'ship-placement') {
    return <div>船の配置フェーズではありません。</div>;
  }

  // プレビュー用のセル状態を計算
  const previewCells = useMemo(() => {
    if (!hoverCoord || !shipToPlace) return currentBoardCells;

    // ホバー中の船が有効かチェック
    const isValidPreview = isShipWithinBounds(hoverCoord, shipToPlace.size, currentOrientation) &&
                           isShipPlacementValid(currentBoardCells, hoverCoord, shipToPlace.size, currentOrientation);

    if (!isValidPreview) return currentBoardCells; // 無効なプレビューは表示しない

    const cellsWithPreview = currentBoardCells.map(row => row.map(cell => ({ ...cell })));

    for (let i = 0; i < shipToPlace.size; i++) {
      const x = currentOrientation === 'horizontal' ? hoverCoord.x + i : hoverCoord.x;
      const y = currentOrientation === 'vertical' ? hoverCoord.y + i : hoverCoord.y;

      if (cellsWithPreview[y] && cellsWithPreview[y][x]) {
        cellsWithPreview[y][x].status = 'ship'; // プレビュー中は常に 'ship' として表示
        // 必要であれば、プレビュー用の特別なスタイルやクラスを追加するために、status を 'preview-ship' のようにすることも可能
      }
    }
    return cellsWithPreview;
  }, [hoverCoord, shipToPlace, currentOrientation, currentBoardCells]);


  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ textAlign: 'center' }}>⚓ 戦艦ゲーム ⚓</h2>
      <h3 style={{ textAlign: 'center' }}>
        [{currentPlayer.name}] の船を配置してください
      </h3>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <BoardGrid
          cells={previewCells} // プレビューセルを表示
          isPlayerBoard={true} // 自分のボードとして表示
          onCellClick={handleBoardClick}
          onCellHover={handleBoardHover}
          onBoardLeave={handleBoardLeave}
          disableClick={currentPlayer.type === 'ai' || currentShipIndex >= ALL_SHIPS.length} // AIはクリックできないように & 全て配置済みならクリック不可
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>残りの船:</strong>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {ALL_SHIPS.map((shipDef, index) => (
            <li key={shipDef.id} style={{ opacity: index < currentShipIndex ? 0.5 : 1 }}>
              {shipDef.name} ({shipDef.size}マス){' '}
              {index < currentShipIndex ? '[配置済み]' : '(未配置)'}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {currentPlayer.type === 'human' && (
          <>
            <button
              onClick={handleRotateShip}
              disabled={!shipToPlace || currentShipIndex >= ALL_SHIPS.length}
              style={{ marginRight: '10px' }}
            >
              船を回転 (現在の向き: {currentOrientation === 'horizontal' ? '横' : '縦'})
            </button>
            <button
                onClick={() => handleRandomPlacement(currentPlayer.id)}
                disabled={currentShipIndex >= ALL_SHIPS.length}
            >
              ランダム配置
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        {currentPlayer.type === 'human' && (
          <button onClick={handleNextPlayerOrGameStart} disabled={currentPlacedShips.length !== ALL_SHIPS.length}>
            {currentShipIndex < ALL_SHIPS.length ? '全ての船を配置して次へ' : '配置完了'}
          </button>
        )}
      </div>
      {/* AIプレイヤーが配置中のメッセージ */}
      {currentPlayer.type === 'ai' && currentShipIndex < ALL_SHIPS.length && (
        <p>AI ({currentPlayer.name}) が船を配置中...</p>
      )}
    </div>
  );
};

export default ShipPlacement;