// src/components/ShipPlacement.tsx

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useGame } from "../contexts/GameContext";
import BoardGrid from "./BoardGrid";
import {
  PlayerSettings,
  ShipDefinition,
  PlacedShip,
  Coordinate,
  Orientation,
  ALL_SHIPS,
} from "../models/types";
import {
  createEmptyBoard,
  isShipWithinBounds,
  isShipPlacementValid,
  placeShipOnBoard,
  generateRandomShipPlacement,
} from "../lib/boardUtils";

interface ShipPlacementProps {}

const ShipPlacement: React.FC<ShipPlacementProps> = () => {
  const { gameState, advancePhase, setPlayerBoardShips, setGameState } =
    useGame();
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // currentPlayer は useMemo を使うことで依存関係が変更されない限り再計算されない
  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerTurnId),
    [players, currentPlayerTurnId]
  );

  const [currentShipIndex, setCurrentShipIndex] = useState<number>(0);
  const [currentPlacedShips, setCurrentPlacedShips] = useState<PlacedShip[]>(
    []
  );
  const [currentOrientation, setCurrentOrientation] =
    useState<Orientation>("horizontal");
  const [hoverCoord, setHoverCoord] = useState<Coordinate | null>(null);
  const [isAiPlacing, setIsAiPlacing] = useState<boolean>(false); // AIが配置中かどうかのフラグ

  // AI配置後の自動遷移を制御するための ref
  const lastProcessedPlayerId = useRef<number | null>(null);

  // currentPlayerTurnId が変更されたとき、またはAI配置が完了したときに状態をリセット
  // この useEffect は、プレイヤーの切り替え時に ShipPlacement の内部状態を初期化するために重要
  useEffect(() => {
    if (currentPlayer) {
      const currentPlayersBoardInContext = playerBoards[currentPlayer.id];
      // 現在のプレイヤーが既に船を配置済みでない場合にのみリセット
      if (currentPlayersBoardInContext?.placedShips.length === 0) {
        setCurrentShipIndex(0);
        setCurrentPlacedShips([]);
        setCurrentOrientation("horizontal");
        setHoverCoord(null);
      }
    }
  }, [currentPlayer, playerBoards]);

  // AIの自動配置ロジック
  const handleRandomPlacement = useCallback(
    async (playerId: number) => {
      if (isAiPlacing || lastProcessedPlayerId.current === playerId) {
        // 既に配置中か、このAIプレイヤーの配置が直前に処理された場合はスキップ
        return;
      }

      setIsAiPlacing(true); // 配置開始フラグを立てる
      lastProcessedPlayerId.current = playerId; // 処理中のAIを記録

      const newPlacedShips: PlacedShip[] = [];
      let allShipsPlacedSuccessfully = true;

      // 既存の船の配置を考慮せずに、毎回空のボードから再計算する
      let tempCells = createEmptyBoard(playerId).cells;

      for (const shipDef of ALL_SHIPS) {
        let attempts = 0;
        const maxAttempts = 200; // 試行回数を増やす
        let placedShip: PlacedShip | null = null;

        while (attempts < maxAttempts) {
          placedShip = generateRandomShipPlacement(
            playerId,
            shipDef,
            newPlacedShips
          ); // 既存の newPlacedShips を渡す
          if (placedShip) {
            newPlacedShips.push(placedShip);
            // 実際に船を配置した結果の cells を更新
            tempCells = placeShipOnBoard(
              tempCells,
              placedShip.definition,
              placedShip.start,
              placedShip.orientation
            );
            break; // 配置成功したら次の船へ
          }
          attempts++;
        }

        if (!placedShip) {
          console.error(
            `Failed to place ship ${shipDef.name} after many attempts. Player: ${playerId}`
          );
          allShipsPlacedSuccessfully = false;
          break;
        }
      }

      if (allShipsPlacedSuccessfully) {
        await new Promise((resolve) => setTimeout(resolve, 800)); // AIが配置している間の視覚的な遅延を少し長くする
        setPlayerBoardShips(playerId, newPlacedShips); // Context に船を保存

        // ここでsetCurrentPlacedShipsとsetCurrentShipIndexを更新することで、
        // UIがAIの配置完了状態を認識できるようになる
        setCurrentPlacedShips(newPlacedShips);
        setCurrentShipIndex(ALL_SHIPS.length);
      } else {
        console.error("Random placement failed for some ships.");
        // エラー時は状態をリセットし、UIを更新しない（無限ループ防止）
        setCurrentShipIndex(0);
        setCurrentPlacedShips([]);
      }
      setIsAiPlacing(false); // 配置終了フラグを下げる
      lastProcessedPlayerId.current = null; // 処理完了
    },
    [setPlayerBoardShips, isAiPlacing, ALL_SHIPS]
  );

  // 船の定義
  const shipToPlace = useMemo(() => {
    return ALL_SHIPS[currentShipIndex] || null;
  }, [currentShipIndex]);

  // 現在のボードの状態（プレビュー含む）
  const currentBoardCells = useMemo(() => {
    const empty = createEmptyBoard(currentPlayer?.id || 0).cells;
    return currentPlacedShips.reduce((cells, pShip) => {
      return placeShipOnBoard(
        cells,
        pShip.definition,
        pShip.start,
        pShip.orientation
      );
    }, empty);
  }, [currentPlayer, currentPlacedShips]);

  // 手動配置時のボードクリックハンドラ
  const handleBoardClick = useCallback(
    (coord: Coordinate) => {
      if (
        !shipToPlace ||
        !currentPlayer ||
        currentPlayer.type === "ai" ||
        isAiPlacing
      )
        return;

      const isValid =
        isShipWithinBounds(coord, shipToPlace.size, currentOrientation) &&
        isShipPlacementValid(
          currentBoardCells,
          coord,
          shipToPlace.size,
          currentOrientation
        );

      if (isValid) {
        const newPlacedShip: PlacedShip = {
          id: shipToPlace.id, // ShipDefinition の ID を使用
          definition: shipToPlace,
          start: coord,
          orientation: currentOrientation,
          hits: [],
          isSunk: false,
        };
        setCurrentPlacedShips((prev) => [...prev, newPlacedShip]);
        setCurrentShipIndex((prev) => prev + 1);
      } else {
        console.warn(
          "Invalid placement: Ship out of bounds or overlaps with another ship."
        );
      }
    },
    [
      shipToPlace,
      currentOrientation,
      currentBoardCells,
      currentPlayer,
      isAiPlacing,
    ]
  );

  // マウスオーバー時のプレビュー
  const handleBoardHover = useCallback((coord: Coordinate) => {
    setHoverCoord(coord);
  }, []);

  const handleBoardLeave = useCallback(() => {
    setHoverCoord(null);
  }, []);

  const handleRotateShip = useCallback(() => {
    setCurrentOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  }, []);

  const handleRedeploy = useCallback(() => {
    if (!currentPlayer) return;

    // 現在のプレイヤーの配置情報をリセット
    setCurrentPlacedShips([]);
    setCurrentShipIndex(0);
    setCurrentOrientation("horizontal");
    setHoverCoord(null);

    // GameContext 内のプレイヤーボードの船情報もクリア
    setPlayerBoardShips(currentPlayer.id, []);
  }, [currentPlayer, setPlayerBoardShips]);

  // フェーズ進行とAIの自動配置を制御する主要な useEffect
  useEffect(() => {
    if (phase !== "ship-placement" || !currentPlayer) {
      return;
    }

    const currentPlayersBoardInContext = playerBoards[currentPlayer.id];
    const isCurrentPlayerShipsPlacedInContext =
      currentPlayersBoardInContext?.placedShips.length === ALL_SHIPS.length;

    // AIプレイヤーの場合
    if (currentPlayer.type === "ai") {
      // まだ配置がコンテキストに保存されていない場合、AI配置を開始
      if (!isCurrentPlayerShipsPlacedInContext && !isAiPlacing) {
        console.log(`AI ${currentPlayer.name} の船を自動配置開始...`);
        handleRandomPlacement(currentPlayer.id);
        // AIが配置を開始したら、このuseEffectは次のサイクルまで待つ
        return;
      }
      // AIが配置を完了し、その情報がコンテキストに反映されたら、次の処理へ進む
      // isAiPlacing が false になった後、この条件が true になることを期待
      if (isCurrentPlayerShipsPlacedInContext && !isAiPlacing) {
        console.log(`AI ${currentPlayer.name} の船の配置が完了しました。`);
        // そのまま下の全プレイヤー配置完了チェックへ進む
      } else {
        // AI配置中、または既に配置済みだがまだ isAiPlacing が true の場合
        return;
      }
    }

    // 全てのプレイヤーの配置が完了したかチェック (人間、AI問わず)
    const activePlayers = players.filter((p) => p.type !== "none");
    const allActivePlayersPlaced = activePlayers.every(
      (p) => playerBoards[p.id]?.placedShips.length === ALL_SHIPS.length
    );

    if (allActivePlayersPlaced) {
      console.log("全てのプレイヤーの船が配置されました。ゲームを開始します。");
      advancePhase("in-game");
    } else if (isCurrentPlayerShipsPlacedInContext) {
      // 現在のプレイヤーの配置が完了しており、かつまだ配置が必要なプレイヤーがいる場合
      const currentPlayerIndex = activePlayers.findIndex(
        (p) => p.id === currentPlayer.id
      );
      const nextPlayer = activePlayers[currentPlayerIndex + 1];

      if (nextPlayer) {
        console.log(`次のプレイヤー (${nextPlayer.name}) の配置へ進みます。`);
        // currentPlayerTurnId を次のプレイヤーに設定
        setGameState((prev) => ({
          ...prev,
          currentPlayerTurnId: nextPlayer.id,
        }));
      } else {
        // これは起こるべきではない（allActivePlayersPlacedがtrueになるはず）が、念のため
        console.warn(
          "論理エラー: 全てのプレイヤーの配置が完了したはずなのに次のプレイヤーが見つかりません。"
        );
        advancePhase("in-game"); // 強制的にゲーム開始
      }
    }
    // else: 現在のプレイヤー（人間）がまだ配置中、またはまだ配置開始前の状態
  }, [
    phase,
    currentPlayer,
    playerBoards,
    players,
    isAiPlacing,
    setGameState,
    advancePhase,
    handleRandomPlacement,
  ]);

  // 人間プレイヤーが「配置完了」ボタンを押すロジック
  const handleNextPlayerOrGameStart = useCallback(() => {
    if (currentPlacedShips.length === ALL_SHIPS.length) {
      setPlayerBoardShips(currentPlayer?.id || 0, currentPlacedShips);
      // setPlayerBoardShips が呼ばれることで useEffect が再評価され、次のプレイヤーへの遷移が自動的に行われる
    } else {
      alert("全ての船を配置してください！");
    }
  }, [currentPlacedShips, currentPlayer, setPlayerBoardShips]);

  if (!currentPlayer || phase !== "ship-placement") {
    return <div>船の配置フェーズではありません。</div>;
  }

  // プレビュー表示のためのセル計算
  const previewCells = useMemo(() => {
    // AIの場合、プレビューは不要なので現在のボードの状態を返す
    if (currentPlayer.type === "ai") {
      return currentBoardCells;
    }
    if (!hoverCoord || !shipToPlace) return currentBoardCells;

    const isValidPreview =
      isShipWithinBounds(hoverCoord, shipToPlace.size, currentOrientation) &&
      isShipPlacementValid(
        currentBoardCells,
        hoverCoord,
        shipToPlace.size,
        currentOrientation
      );

    if (!isValidPreview) return currentBoardCells;

    // プレビュー用のセルをコピーして、元のボードの状態を変更しないようにする
    const cellsWithPreview = currentBoardCells.map((row) =>
      row.map((cell) => ({ ...cell }))
    );

    for (let i = 0; i < shipToPlace.size; i++) {
      const x =
        currentOrientation === "horizontal" ? hoverCoord.x + i : hoverCoord.x;
      const y =
        currentOrientation === "vertical" ? hoverCoord.y + i : hoverCoord.y;

      if (cellsWithPreview[y] && cellsWithPreview[y][x]) {
        cellsWithPreview[y][x].status = "ship"; // プレビューとして船を表示
      }
    }
    return cellsWithPreview;
  }, [
    hoverCoord,
    shipToPlace,
    currentOrientation,
    currentBoardCells,
    currentPlayer,
  ]);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
      {/* <h2>⚓ 戦艦ゲーム ⚓</h2> ← この行を削除 */}
      <h3 style={{ textAlign: "center" }}>
        [{currentPlayer.name}] の船を配置してください
      </h3>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <BoardGrid
          cells={previewCells}
          isPlayerBoard={true}
          onCellClick={handleBoardClick}
          onCellHover={handleBoardHover}
          onBoardLeave={handleBoardLeave}
          // AIが配置中、または全ての船が配置済みの場合はクリック無効
          disableClick={
            currentPlayer.type === "ai" ||
            currentShipIndex >= ALL_SHIPS.length ||
            isAiPlacing
          }
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <strong>残りの船:</strong>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ALL_SHIPS.map((shipDef, index) => (
            <li
              key={shipDef.id}
              style={{ opacity: index < currentShipIndex ? 0.5 : 1 }}
            >
              {shipDef.name} ({shipDef.size}マス){" "}
              {index < currentShipIndex ? "[配置済み]" : "(未配置)"}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: "20px" }}>
        {currentPlayer.type === "human" && (
          <>
            <button
              onClick={handleRotateShip}
              disabled={!shipToPlace || currentShipIndex >= ALL_SHIPS.length}
              style={{ marginRight: "10px" }}
            >
              船を回転 (現在の向き:{" "}
              {currentOrientation === "horizontal" ? "横" : "縦"})
            </button>
            <button
              onClick={() => handleRandomPlacement(currentPlayer.id)}
              disabled={currentShipIndex >= ALL_SHIPS.length}
            >
              ランダム配置
            </button>
            <button
              onClick={handleRedeploy}
              disabled={isAiPlacing}
              style={{ marginLeft: "10px" }}
            >
              再配置
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        {currentPlayer.type === "human" && (
          <button
            onClick={handleNextPlayerOrGameStart}
            disabled={currentPlacedShips.length !== ALL_SHIPS.length}
          >
            {currentShipIndex < ALL_SHIPS.length
              ? "全ての船を配置して次へ"
              : "配置完了"}
          </button>
        )}
      </div>
      {(currentPlayer.type === "ai" || isAiPlacing) && (
        <p>AI ({currentPlayer.name}) が船を配置中...</p>
      )}
    </div>
  );
};

export default ShipPlacement;
