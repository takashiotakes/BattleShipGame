// src/components/ShipPlacement.tsx

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useGame } from "../contexts/GameContext.tsx"; // 拡張子を .tsx に変更
import BoardGrid from "./BoardGrid.tsx"; // 拡張子を .tsx に変更
import {
  PlayerSettings,
  ShipDefinition,
  PlacedShip,
  Coordinate,
  Orientation,
  ALL_SHIPS,
} from "../models/types.tsx"; // 拡張子を .tsx に変更
import {
  createEmptyBoard,
  isShipWithinBounds,
  isShipPlacementValid,
  placeShipOnBoard,
  generateRandomShipPlacement,
  updateCellsWithShips, // 追加
} from "../lib/boardUtils.tsx"; // 拡張子を .tsx に変更

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

  // 初期ロード時、またはプレイヤー設定変更時に最初の配置プレイヤーを設定
  useEffect(() => {
    // 既に配置フェーズで currentPlayerTurnId が設定されている場合は何もしない
    if (
      gameState.phase === "ship-placement" &&
      gameState.currentPlayerTurnId !== -1
    ) {
      return;
    }

    const activePlayers = players.filter((p) => p.type !== "none");
    if (activePlayers.length > 0) {
      setGameState((prev) => ({
        ...prev,
        currentPlayerTurnId: activePlayers[0].id,
      }));
    }
  }, [players, gameState.phase, gameState.currentPlayerTurnId, setGameState]);

  // 現在のプレイヤーが切り替わったときに、配置状態をリセット
  useEffect(() => {
    if (currentPlayer) {
      const placedShipsForCurrentPlayer =
        playerBoards[currentPlayer.id]?.placedShips || [];
      setCurrentPlacedShips(placedShipsForCurrentPlayer);
      setCurrentShipIndex(placedShipsForCurrentPlayer.length);
      setHoverCoord(null); // ホバー状態をリセット
    }
  }, [currentPlayer, playerBoards]);

  // 全てのプレイヤーの配置が完了したかチェックし、次のフェーズへ移行
  const handleNextPlayerOrGameStart = useCallback(() => {
    const activePlayers = players.filter((p) => p.type !== "none");

    // 現在のプレイヤーが最後の配置担当プレイヤーであるか、または AI が配置を終えたばかりの場合
    if (
      currentPlayer &&
      playerBoards[currentPlayer.id]?.placedShips.length === ALL_SHIPS.length
    ) {
      const currentIndex = activePlayers.findIndex(
        (p) => p.id === currentPlayer.id
      );

      // 次のプレイヤーを探す
      let nextPlayerToPlace: PlayerSettings | undefined;
      for (let i = currentIndex + 1; i < activePlayers.length; i++) {
        const player = activePlayers[i];
        if (playerBoards[player.id]?.placedShips.length !== ALL_SHIPS.length) {
          nextPlayerToPlace = player;
          break;
        }
      }

      if (nextPlayerToPlace) {
        // 次のプレイヤーの配置へ
        setGameState((prev) => ({
          ...prev,
          currentPlayerTurnId: nextPlayerToPlace!.id,
        }));
        setIsAiPlacing(false); // 次のAIが配置を開始できるようにリセット
      } else {
        // 全てのプレイヤーが配置を完了した
        advancePhase("in-game");
      }
    } else {
      console.warn(
        "Attempted to advance placement phase, but current player has not finished placing ships or is not the current placer."
      );
    }
  }, [players, currentPlayer, playerBoards, advancePhase, setGameState]);

  // AIの自動配置ロジック
  useEffect(() => {
    if (
      currentPlayer &&
      currentPlayer.type === "ai" &&
      currentPlayer.id === currentPlayerTurnId &&
      !isAiPlacing
    ) {
      setIsAiPlacing(true);
      const timer = setTimeout(() => {
        const newPlacedShips: PlacedShip[] = [];
        let tempCurrentBoardCells = createEmptyBoard(currentPlayer.id).cells; // 一時的なボードセル

        ALL_SHIPS.forEach((shipDef) => {
          const placedShip = generateRandomShipPlacement(
            currentPlayer.id,
            shipDef,
            newPlacedShips
          );
          if (placedShip) {
            newPlacedShips.push(placedShip);
            // 船をボードに仮配置して、次の船の配置判定に使う
            tempCurrentBoardCells = placeShipOnBoard(
              tempCurrentBoardCells,
              placedShip.definition,
              placedShip.start,
              placedShip.orientation
            );
          } else {
            console.error(
              `Could not place ship ${shipDef.name} for AI player ${currentPlayer.name}`
            );
          }
        });

        setPlayerBoardShips(currentPlayer.id, newPlacedShips);
        setIsAiPlacing(false);
        lastProcessedPlayerId.current = currentPlayer.id; // このAIプレイヤーの配置が完了したことを記録
        handleNextPlayerOrGameStart(); // 配置完了後に次のプレイヤーへ
      }, 1000); // AIが配置するまでの待ち時間
      return () => clearTimeout(timer);
    }
  }, [
    currentPlayer,
    currentPlayerTurnId,
    isAiPlacing,
    setPlayerBoardShips,
    handleNextPlayerOrGameStart,
  ]);

  const handleCellClick = useCallback(
    (coord: Coordinate) => {
      if (
        !currentPlayer ||
        currentPlayer.type !== "human" ||
        currentShipIndex >= ALL_SHIPS.length
      ) {
        return;
      }

      const shipToPlaceDef = ALL_SHIPS[currentShipIndex];
      const newPlacedShip: PlacedShip = {
        id: `${shipToPlaceDef.id}-${currentShipIndex}`,
        definition: shipToPlaceDef,
        start: coord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };

      // 既存の船と新しい船の衝突チェック (配置される前のcurrentPlacedShipsを使う)
      const tempCells = updateCellsWithShips(
        createEmptyBoard(currentPlayer.id).cells,
        currentPlacedShips,
        true
      );

      if (
        isShipWithinBounds(
          newPlacedShip.start,
          newPlacedShip.definition.size,
          newPlacedShip.orientation
        ) &&
        isShipPlacementValid(
          tempCells,
          newPlacedShip.start,
          newPlacedShip.definition.size,
          newPlacedShip.orientation
        )
      ) {
        const updatedShips = [...currentPlacedShips, newPlacedShip];
        setCurrentPlacedShips(updatedShips);
        setCurrentShipIndex((prev) => prev + 1);
        setPlayerBoardShips(currentPlayer.id, updatedShips); // Contextに保存

        // 全ての船を配置し終えたら、hoverCoordをリセット
        if (updatedShips.length === ALL_SHIPS.length) {
          setHoverCoord(null);
        }
      } else {
        alert(
          "船を配置できません。他の船と重なっているか、ボードの範囲外です。"
        );
      }
    },
    [
      currentPlayer,
      currentShipIndex,
      currentPlacedShips,
      currentOrientation,
      setPlayerBoardShips,
    ]
  );

  const handleRotateShip = useCallback(() => {
    setCurrentOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  }, []);

  const handleRandomPlacement = useCallback(() => {
    if (!currentPlayer) return;

    const newPlacedShips: PlacedShip[] = [];
    let tempCurrentBoardCells = createEmptyBoard(currentPlayer.id).cells; // 一時的なボードセル

    ALL_SHIPS.forEach((shipDef) => {
      const placedShip = generateRandomShipPlacement(
        currentPlayer.id,
        shipDef,
        newPlacedShips
      );
      if (placedShip) {
        newPlacedShips.push(placedShip);
        // 船をボードに仮配置して、次の船の配置判定に使う
        tempCurrentBoardCells = placeShipOnBoard(
          tempCurrentBoardCells,
          placedShip.definition,
          placedShip.start,
          placedShip.orientation
        );
      } else {
        console.error(`Could not place ship ${shipDef.name}`);
        // エラー処理：配置できなかった場合のユーザーへの通知など
        return;
      }
    });

    setCurrentPlacedShips(newPlacedShips);
    setCurrentShipIndex(ALL_SHIPS.length);
    setPlayerBoardShips(currentPlayer.id, newPlacedShips); // Contextに保存
    setHoverCoord(null); // ホバー状態をリセット
  }, [currentPlayer, setPlayerBoardShips]);

  const handleRedeploy = useCallback(() => {
    setCurrentPlacedShips([]);
    setCurrentShipIndex(0);
    setPlayerBoardShips(currentPlayer?.id || -1, []); // Contextの船もリセット
    setHoverCoord(null); // ホバー状態をリセット
  }, [currentPlayer, setPlayerBoardShips]);

  // ボード表示用のセルデータを生成
  const displayCells = useMemo(() => {
    if (!currentPlayer) {
      return createEmptyBoard(0).cells;
    }
    const currentBoardCells =
      playerBoards[currentPlayer.id]?.cells ||
      createEmptyBoard(currentPlayer.id).cells;
    let cellsWithPlacedShips = updateCellsWithShips(
      currentBoardCells,
      currentPlacedShips,
      true
    );

    // ホバー中の船の仮表示
    if (hoverCoord && currentShipIndex < ALL_SHIPS.length) {
      const shipToPlaceDef = ALL_SHIPS[currentShipIndex];
      const tempShip: PlacedShip = {
        id: "hover-ship", // 仮のID
        definition: shipToPlaceDef,
        start: hoverCoord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };
      // ホバー中の船が範囲内かつ有効な配置なら表示
      if (
        isShipWithinBounds(
          tempShip.start,
          tempShip.definition.size,
          tempShip.orientation
        ) &&
        isShipPlacementValid(
          cellsWithPlacedShips,
          tempShip.start,
          tempShip.definition.size,
          tempShip.orientation
        )
      ) {
        cellsWithPlacedShips = placeShipOnBoard(
          cellsWithPlacedShips,
          tempShip.definition,
          tempShip.start,
          tempShip.orientation,
          "hover"
        );
      }
    }
    return cellsWithPlacedShips;
  }, [
    currentPlayer,
    currentPlacedShips,
    currentShipIndex,
    currentOrientation,
    hoverCoord,
    playerBoards,
  ]);

  if (!currentPlayer) {
    return <div>配置するプレイヤーがいません。</div>;
  }

  // 既に全てのプレイヤーが配置を完了しているかチェック
  const allPlayersPlaced = useMemo(() => {
    const activePlayers = players.filter((p) => p.type !== "none");
    return activePlayers.every(
      (p) => playerBoards[p.id]?.placedShips.length === ALL_SHIPS.length
    );
  }, [players, playerBoards]);

  // 全てのプレイヤーが配置完了しているが、まだフェーズが移行していない場合に自動的に移行
  useEffect(() => {
    if (allPlayersPlaced && phase === "ship-placement") {
      // AIが最後に配置を終えた場合など、自動的にゲーム開始フェーズへ移行
      const timer = setTimeout(() => {
        advancePhase("in-game");
      }, 500); // 少し待ってから移行
      return () => clearTimeout(timer);
    }
  }, [allPlayersPlaced, phase, advancePhase]);

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center" }}>
        船の配置 - {currentPlayer.name} の番
      </h3>
      {(currentPlayer.type === "ai" || isAiPlacing) && (
        <p style={{ color: "yellow", fontWeight: "bold" }}>
          AI ({currentPlayer.name}) が船を配置中...
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "40px",
          marginTop: "20px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h4>あなたのボード</h4>
          <BoardGrid
            cells={displayCells}
            isPlayerBoard={true}
            onCellClick={handleCellClick}
            onCellHover={(coord) => {
              if (
                currentPlayer.type === "human" &&
                currentShipIndex < ALL_SHIPS.length
              ) {
                setHoverCoord(coord);
              }
            }}
            onBoardLeave={() => setHoverCoord(null)}
            disableClick={
              currentPlayer.type === "ai" ||
              currentShipIndex >= ALL_SHIPS.length ||
              isAiPlacing
            }
          />
        </div>

        <div style={{ textAlign: "left", minWidth: "150px" }}>
          <h4>未配置の船</h4>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {ALL_SHIPS.map((shipDef, index) => (
              <li
                key={shipDef.id}
                style={{
                  color: index < currentShipIndex ? "lightgray" : "white",
                  textDecoration:
                    index < currentShipIndex ? "line-through" : "none",
                  fontWeight: index === currentShipIndex ? "bold" : "normal",
                }}
              >
                {shipDef.name} ({shipDef.size}){" "}
                {index < currentShipIndex ? "[配置済み]" : "(未配置)"}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginBottom: "20px", marginTop: "20px" }}>
        {currentPlayer.type === "human" &&
          currentShipIndex < ALL_SHIPS.length && (
            <>
              <button
                onClick={handleRotateShip}
                disabled={isAiPlacing}
                style={{ marginRight: "10px", padding: "10px 15px" }}
              >
                船を回転 (現在の向き:{" "}
                {currentOrientation === "horizontal" ? "横" : "縦"})
              </button>
              <button
                onClick={handleRandomPlacement}
                disabled={isAiPlacing}
                style={{ marginRight: "10px", padding: "10px 15px" }}
              >
                ランダム配置
              </button>
              <button
                onClick={handleRedeploy}
                disabled={isAiPlacing}
                style={{ padding: "10px 15px" }}
              >
                再配置
              </button>
            </>
          )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        {currentPlayer.type === "human" &&
          currentPlacedShips.length === ALL_SHIPS.length && (
            <button
              onClick={handleNextPlayerOrGameStart}
              disabled={isAiPlacing || allPlayersPlaced} // AIが配置中か、全員配置済みなら無効
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: "#4CAF50",
                color: "white",
              }}
            >
              {allPlayersPlaced ? "ゲーム開始" : "配置完了 (次のプレイヤーへ)"}
            </button>
          )}
      </div>
    </div>
  );
};

export default ShipPlacement;
