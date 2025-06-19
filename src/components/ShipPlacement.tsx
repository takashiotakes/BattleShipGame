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
  GamePhase,
} from "../models/types";
import {
  createEmptyBoard,
  isShipWithinBounds,
  isShipPlacementValid,
  placeShipOnBoard,
  generateRandomShipPlacement,
  updateCellsWithShips,
} from "../lib/boardUtils";

interface ShipPlacementProps {}

const ShipPlacement: React.FC<ShipPlacementProps> = () => {
  const { gameState, advancePhase, setPlayerBoardShips, setGameState } =
    useGame();
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

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
  const [isAiPlacing, setIsAiPlacing] = useState<boolean>(false);

  const lastProcessedPlayerId = useRef<number | null>(null);

  const handleAIPlacement = useCallback(
    async (player: PlayerSettings) => {
      if (player.type !== "ai") return;

      setIsAiPlacing(true);
      setCurrentShipIndex(0);
      setCurrentPlacedShips([]); // AI配置開始時にローカル状態をリセット

      const placedShipsForAI: PlacedShip[] = [];
      for (const shipDef of ALL_SHIPS) {
        const placement = generateRandomShipPlacement(
          player.id,
          shipDef,
          placedShipsForAI
        );
        if (placement) {
          placedShipsForAI.push(placement);
          await new Promise((resolve) => setTimeout(resolve, 50));
          setCurrentShipIndex((prev) => prev + 1);
        } else {
          console.error(
            `AI (${player.name}): Failed to place ${shipDef.name}. No valid placement found.`
          );
          setIsAiPlacing(false);
          alert(
            `AI (${player.name}) の船配置中に問題が発生しました。全ての船を配置できませんでした。ゲームをリセットしてください。`
          );
          return;
        }
      }

      setPlayerBoardShips(player.id, placedShipsForAI);
      setIsAiPlacing(false);
      lastProcessedPlayerId.current = player.id;
      console.log(
        `AI (${player.name}) の船配置が完了し、Contextに保存しました。`
      );
    },
    [setPlayerBoardShips]
  );

  useEffect(() => {
    if (
      currentPlayer &&
      phase === "ship-placement" &&
      currentPlayer.type === "ai" &&
      currentPlayer.id !== lastProcessedPlayerId.current &&
      playerBoards[currentPlayer.id] &&
      playerBoards[currentPlayer.id].placedShips.length === 0
    ) {
      console.log(`AI (${currentPlayer.name}) の船配置を開始します。`);
      handleAIPlacement(currentPlayer);
    }
  }, [currentPlayer, phase, playerBoards, handleAIPlacement]);

  const handleNextPlayerOrGameStart = useCallback(() => {
    // Humanプレイヤーの場合、ここでローカルの currentPlacedShips を Context に保存する
    // AIプレイヤーの場合は既に handleAIPlacement で保存済み
    if (
      currentPlayer?.type === "human" &&
      currentPlacedShips.length !== ALL_SHIPS.length
    ) {
      alert("全ての船を配置してください。");
      return;
    }

    // Humanプレイヤーの場合のみ、Contextに保存されていない場合は保存をトリガー
    // AIの場合は既に保存済みなのでスキップ
    if (
      currentPlayer?.type === "human" &&
      playerBoards[currentPlayer.id]?.placedShips.length !==
        currentPlacedShips.length
    ) {
      console.log(
        `Humanプレイヤー (${currentPlayer.name}) の配置をContextに保存します。`
      );
      setPlayerBoardShips(currentPlayer.id, currentPlacedShips);
    }

    const activePlayers = players.filter((p) => p.type !== "none");
    const currentIndex = activePlayers.findIndex(
      (p) => p.id === currentPlayerTurnId
    );

    let nextPlayerToPlace: PlayerSettings | undefined;
    let nextIndex = (currentIndex + 1) % activePlayers.length;
    let attempts = 0;

    while (attempts < activePlayers.length) {
      const potentialNextPlayer = activePlayers[nextIndex];
      if (
        playerBoards[potentialNextPlayer.id] &&
        playerBoards[potentialNextPlayer.id].placedShips.length <
          ALL_SHIPS.length
      ) {
        nextPlayerToPlace = potentialNextPlayer;
        break;
      }
      nextIndex = (nextIndex + 1) % activePlayers.length;
      attempts++;
    }

    if (nextPlayerToPlace) {
      setGameState((prev) => ({
        ...prev,
        currentPlayerTurnId: nextPlayerToPlace!.id,
      }));
      setCurrentPlacedShips([]); // 次のプレイヤー用にローカルの状態をリセット
      setCurrentShipIndex(0);
      setHoverCoord(null);
      setCurrentOrientation("horizontal");
      lastProcessedPlayerId.current = null;
    } else {
      advancePhase("in-game");
    }
  }, [
    currentPlayerTurnId,
    currentPlacedShips,
    players,
    setPlayerBoardShips,
    advancePhase,
    setGameState,
    playerBoards,
    currentPlayer,
  ]);

  useEffect(() => {
    if (
      !isAiPlacing &&
      currentPlayer &&
      currentPlayer.type === "ai" &&
      playerBoards[currentPlayer.id] &&
      playerBoards[currentPlayer.id].placedShips.length === ALL_SHIPS.length &&
      lastProcessedPlayerId.current === currentPlayer.id
    ) {
      console.log(
        `AI (${currentPlayer.name}) の船配置が Context に反映され、次のプレイヤーへ遷移します。`
      );
      handleNextPlayerOrGameStart();
    }
  }, [
    isAiPlacing,
    currentPlayer,
    playerBoards,
    handleNextPlayerOrGameStart,
    lastProcessedPlayerId.current,
  ]);

  const currentBoardCells = useMemo(() => {
    if (!currentPlayer || !playerBoards[currentPlayer.id]) {
      return createEmptyBoard(currentPlayer?.id ?? -1).cells;
    }

    let cells = updateCellsWithShips(currentPlayer.id, currentPlacedShips);

    const shipToPlace = ALL_SHIPS[currentShipIndex];
    if (
      shipToPlace &&
      hoverCoord &&
      currentPlayer.type === "human" &&
      currentShipIndex < ALL_SHIPS.length
    ) {
      if (
        isShipWithinBounds(hoverCoord, shipToPlace.size, currentOrientation) &&
        isShipPlacementValid(
          cells,
          hoverCoord,
          shipToPlace.size,
          currentOrientation
        )
      ) {
        cells = placeShipOnBoard(
          cells,
          shipToPlace,
          hoverCoord,
          currentOrientation
        );
      }
    }
    return cells;
  }, [
    currentPlayer,
    playerBoards,
    currentPlacedShips,
    currentShipIndex,
    hoverCoord,
    currentOrientation,
  ]);

  const handleCellClick = useCallback(
    (coord: Coordinate) => {
      if (
        currentPlayer?.type !== "human" ||
        isAiPlacing ||
        currentShipIndex >= ALL_SHIPS.length
      )
        return;

      const shipToPlace = ALL_SHIPS[currentShipIndex];
      if (!shipToPlace) return;

      if (
        isShipWithinBounds(coord, shipToPlace.size, currentOrientation) &&
        isShipPlacementValid(
          currentBoardCells,
          coord,
          shipToPlace.size,
          currentOrientation
        )
      ) {
        const newPlacedShip: PlacedShip = {
          id: shipToPlace.id,
          definition: shipToPlace,
          start: coord,
          orientation: currentOrientation,
          hits: [],
          isSunk: false,
        };

        const updatedPlacedShips = [...currentPlacedShips, newPlacedShip];
        setCurrentPlacedShips(updatedPlacedShips); // ローカルの状態を更新
        setCurrentShipIndex((prev) => prev + 1);
        setHoverCoord(null);
      } else {
        alert(
          "その場所には船を配置できません。他の船と重なっているか、ボードの範囲外です。"
        );
      }
    },
    [
      currentShipIndex,
      currentPlacedShips,
      currentOrientation,
      currentPlayer,
      isAiPlacing,
      currentBoardCells,
    ]
  );

  const handleRotateShip = useCallback(() => {
    setCurrentOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  }, []);

  const handleRandomPlacement = useCallback(
    (playerId: number) => {
      if (
        !currentPlayer ||
        currentPlayer.id !== playerId ||
        isAiPlacing ||
        currentShipIndex === ALL_SHIPS.length
      )
        return;

      const newPlacedShips: PlacedShip[] = [];
      let allShipsPlacedSuccessfully = true;
      for (const shipDef of ALL_SHIPS) {
        const placement = generateRandomShipPlacement(
          playerId,
          shipDef,
          newPlacedShips
        );
        if (placement) {
          newPlacedShips.push(placement);
        } else {
          allShipsPlacedSuccessfully = false;
          alert(
            `船 ${shipDef.name} のランダム配置に失敗しました。再試行してください。`
          );
          break;
        }
      }

      if (allShipsPlacedSuccessfully) {
        setCurrentPlacedShips(newPlacedShips);
        setCurrentShipIndex(ALL_SHIPS.length);
        setPlayerBoardShips(playerId, newPlacedShips); // Contextに保存
      }
    },
    [currentPlayer, isAiPlacing, currentShipIndex, setPlayerBoardShips]
  );

  const handleRedeploy = useCallback(() => {
    setPlayerBoardShips(currentPlayerTurnId, []); // Contextもクリア
    setCurrentPlacedShips([]);
    setCurrentShipIndex(0);
    setHoverCoord(null);
    setCurrentOrientation("horizontal");
  }, [setPlayerBoardShips, currentPlayerTurnId]);

  // ★変更点★ ここが最も重要です。ContextのplayerBoardsが更新された際にローカルの状態を同期するロジック
  useEffect(() => {
    if (!currentPlayer || !playerBoards[currentPlayer.id]) {
      return;
    }

    const contextPlacedShips = playerBoards[currentPlayer.id].placedShips;

    // AIの場合、ContextのplacedShipsで常にローカル状態を上書きする
    // 人間プレイヤーの場合、AIが配置を完了した後、次の人間プレイヤーのターンになった時にのみ、
    // Contextから初期状態をロードする (ただし、空の配列で上書きしないように注意)
    if (currentPlayer.type === "ai") {
      if (
        currentPlacedShips.length !== contextPlacedShips.length ||
        JSON.stringify(currentPlacedShips) !==
          JSON.stringify(contextPlacedShips)
      ) {
        setCurrentPlacedShips(contextPlacedShips);
        setCurrentShipIndex(contextPlacedShips.length);
      }
    } else {
      // Human Player
      // 人間プレイヤーが船を配置し始めたばかりの場合 (currentPlacedShipsが空で、Contextも空の場合)
      // または、リロードなどで状態がリセットされた場合にContextから初期ロード
      // ただし、人間が手動で配置中にContextの古い情報で上書きされないように注意
      if (
        contextPlacedShips.length > 0 && // Contextに船がある場合
        (currentPlacedShips.length !== contextPlacedShips.length ||
          JSON.stringify(currentPlacedShips) !==
            JSON.stringify(contextPlacedShips))
      ) {
        setCurrentPlacedShips(contextPlacedShips);
        setCurrentShipIndex(contextPlacedShips.length);
      } else if (
        currentPlacedShips.length === 0 &&
        contextPlacedShips.length === 0 &&
        currentPlayer.id === currentPlayerTurnId
      ) {
        // 現在の人間プレイヤーの配置フェーズが始まったばかりで、両方空の場合
        // 明示的にローカルの状態を空に設定し、currentIndexも0に
        setCurrentPlacedShips([]);
        setCurrentShipIndex(0);
      }
    }
  }, [currentPlayer, playerBoards, currentPlayerTurnId]); // currentPlacedShips は依存配列から削除

  useEffect(() => {
    return () => {
      lastProcessedPlayerId.current = null;
    };
  }, []);

  if (
    !currentPlayer ||
    !playerBoards[currentPlayer.id] ||
    phase !== "ship-placement"
  ) {
    return <div>船配置を準備中...</div>;
  }

  const shipToPlace = ALL_SHIPS[currentShipIndex];
  const allShipsArePlaced = currentPlacedShips.length === ALL_SHIPS.length;

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center" }}>{currentPlayer.name} の船配置</h3>
      <p>
        {currentPlayer.type === "human"
          ? `船を配置してください: ${
              shipToPlace ? shipToPlace.name : "全ての船を配置しました"
            }`
          : `AI (${currentPlayer.name}) が船を配置中...`}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <BoardGrid
          cells={currentBoardCells}
          isPlayerBoard={true}
          onCellClick={handleCellClick}
          onCellHover={(coord) => setHoverCoord(coord)}
          onBoardLeave={() => setHoverCoord(null)}
          disableClick={
            currentPlayer.type === "ai" || isAiPlacing || allShipsArePlaced
          }
        />
      </div>

      <div style={{ margin: "20px 0" }}>
        <h4>配置状況:</h4>
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {ALL_SHIPS.map((ship, index) => (
            <li
              key={ship.id}
              style={{
                color: index < currentShipIndex ? "lightgreen" : "gray",
              }}
            >
              {ship.name} ({ship.size}){" "}
              {index < currentShipIndex ? "[配置済み]" : "(未配置)"}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "center",
          gap: "10px",
        }}
      >
        {currentPlayer.type === "human" && (
          <>
            <button
              onClick={handleRotateShip}
              disabled={!shipToPlace || allShipsArePlaced || isAiPlacing}
              style={{ marginRight: "10px" }}
            >
              船を回転 (現在の向き:{" "}
              {currentOrientation === "horizontal" ? "横" : "縦"})
            </button>
            <button
              onClick={() => handleRandomPlacement(currentPlayer.id)}
              disabled={allShipsArePlaced || isAiPlacing}
            >
              ランダム配置
            </button>
            <button
              onClick={handleRedeploy}
              disabled={isAiPlacing || currentPlacedShips.length === 0}
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
            disabled={!allShipsArePlaced || isAiPlacing}
          >
            配置完了
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
