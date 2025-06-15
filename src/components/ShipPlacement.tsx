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

  const shipToPlace = useMemo(() => {
    return ALL_SHIPS[currentShipIndex];
  }, [currentShipIndex]);

  // handleNextPlayerOrGameStart を useCallback でラップ
  const handleNextPlayerOrGameStart = useCallback(() => {
    setGameState((prev) => {
      // 現在のプレイヤーのボードが完全に配置されていることを確認
      const currentBoard = prev.playerBoards[prev.currentPlayerTurnId];
      if (
        !currentBoard ||
        currentBoard.placedShips.length !== ALL_SHIPS.length
      ) {
        console.warn(
          `プレイヤー ${prev.currentPlayerTurnId} の船が完全に配置されていません。`
        );
        // 不足している場合は次のプレイヤーへ遷移しない
        return prev;
      }

      console.log(
        `AI (${
          prev.players.find((p) => p.id === prev.currentPlayerTurnId)?.name
        }) の船配置が Context に反映され、次のプレイヤーへ遷移します。`
      );

      const activePlayers = prev.players.filter((p) => p.type !== "none");
      const currentActivePlayerIndex = activePlayers.findIndex(
        (p) => p.id === prev.currentPlayerTurnId
      );

      // 次の有効なプレイヤーを見つける
      let nextPlayerIndex =
        (currentActivePlayerIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextPlayerIndex].id;

      // 全てのプレイヤーが船配置を終えたかチェック
      const allPlayersPlaced = activePlayers.every((player) => {
        const board = prev.playerBoards[player.id];
        return board && board.placedShips.length === ALL_SHIPS.length;
      });

      if (allPlayersPlaced) {
        // 全員配置完了 -> ゲーム開始フェーズへ
        console.log(
          "全てのプレイヤーの船配置が完了しました。ゲームを開始します。"
        );
        // ゲーム開始時も最初の有効なプレイヤーにターンを戻す
        const firstActivePlayer = activePlayers[0];
        return {
          ...prev,
          phase: "in-game",
          currentPlayerTurnId: firstActivePlayer.id,
        };
      } else {
        // 次のプレイヤーの船配置へ
        return {
          ...prev,
          currentPlayerTurnId: nextPlayerId,
        };
      }
    });
    // ローカルの状態をリセット
    setCurrentShipIndex(0);
    setCurrentPlacedShips([]);
    setHoverCoord(null);
    setCurrentOrientation("horizontal");
  }, [setGameState]);

  const handleAIPlacement = useCallback(
    async (player: PlayerSettings) => {
      // 追加: AIタイプでない場合は即座に終了
      if (player.type !== "ai") {
        console.warn(
          `Attempted AI placement for non-AI player: ${player.name} (type: ${player.type})`
        );
        setIsAiPlacing(false);
        lastProcessedPlayerId.current = player.id; // 処理済みとしてマーク
        handleNextPlayerOrGameStart(); // 次のプレイヤーへ進める
        return;
      }

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

      // AIの配置が完了したら、すぐに次のプレイヤーへ移行を試みる
      // Contextへの保存が完了した後、少し待ってから次のプレイヤーへ
      setTimeout(() => {
        handleNextPlayerOrGameStart();
      }, 500); // 0.5秒待機
    },
    [setPlayerBoardShips, handleNextPlayerOrGameStart]
  );

  // プレイヤーが切り替わったときに、AIの配置をトリガー
  useEffect(() => {
    if (
      currentPlayer &&
      phase === "ship-placement" &&
      currentPlayer.type === "ai" && // AIタイプであること
      currentPlayer.id !== lastProcessedPlayerId.current && // 既に処理されていないこと
      playerBoards[currentPlayer.id] && // ボードが存在すること
      playerBoards[currentPlayer.id].placedShips.length === 0 // まだ船が配置されていないこと
    ) {
      console.log(`AI (${currentPlayer.name}) の船配置を開始します。`);
      handleAIPlacement(currentPlayer);
    } else if (
      currentPlayer &&
      phase === "ship-placement" &&
      currentPlayer.type === "none" && // 「なし」タイプの場合
      currentPlayer.id !== lastProcessedPlayerId.current
    ) {
      // 既に処理されていないこと
      console.log(
        `プレイヤー ${currentPlayer.name} (ID: ${currentPlayer.id}) は「なし」タイプのため、船配置をスキップし、次のプレイヤーへ遷移します。`
      );
      lastProcessedPlayerId.current = currentPlayer.id; // 処理済みとしてマーク
      handleNextPlayerOrGameStart(); // 次のプレイヤーへ進める
    }
  }, [
    currentPlayer,
    phase,
    playerBoards,
    handleAIPlacement,
    handleNextPlayerOrGameStart,
  ]);

  const handlePlaceShip = useCallback(
    (coord: Coordinate) => {
      if (!shipToPlace || !currentPlayer || isAiPlacing) return;

      const currentBoard = createEmptyBoard(currentPlayer.id);
      // すでに配置済みの船を仮にボードに描画
      let tempCells = currentBoard.cells;
      currentPlacedShips.forEach((pShip) => {
        tempCells = placeShipOnBoard(
          tempCells,
          pShip.definition,
          pShip.start,
          pShip.orientation
        );
      });

      if (
        isShipWithinBounds(coord, shipToPlace.size, currentOrientation) &&
        isShipPlacementValid(
          tempCells,
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
        setCurrentPlacedShips(updatedPlacedShips);
        setCurrentShipIndex((prev) => prev + 1);

        // Context にも船の配置を保存
        setPlayerBoardShips(currentPlayer.id, updatedPlacedShips);
      } else {
        alert(
          "船をここに配置できません。他の船と重なるか、ボードの外に出ます。"
        );
      }
    },
    [
      shipToPlace,
      currentPlayer,
      currentOrientation,
      currentPlacedShips,
      isAiPlacing,
      setPlayerBoardShips,
    ]
  );

  const handleRotateShip = useCallback(() => {
    setCurrentOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  }, []);

  const handleRandomPlacement = useCallback(
    (playerId: number) => {
      const newPlacedShips: PlacedShip[] = [];
      ALL_SHIPS.forEach((shipDef) => {
        const placement = generateRandomShipPlacement(
          playerId,
          shipDef,
          newPlacedShips
        );
        if (placement) {
          newPlacedShips.push(placement);
        } else {
          console.error(
            `プレイヤー ${playerId}: ${shipDef.name} のランダム配置に失敗しました。`
          );
          alert(
            "ランダム配置に失敗しました。ボードをリセットして再度お試しください。"
          );
          return; // 全ての船を配置できない場合は中断
        }
      });
      setCurrentPlacedShips(newPlacedShips);
      setCurrentShipIndex(ALL_SHIPS.length); // 全ての船が配置された状態にする
      setPlayerBoardShips(playerId, newPlacedShips); // Contextに保存
    },
    [setPlayerBoardShips]
  );

  const handleRedeploy = useCallback(() => {
    setCurrentShipIndex(0);
    setCurrentPlacedShips([]);
    setHoverCoord(null);
    setCurrentOrientation("horizontal");
    setPlayerBoardShips(currentPlayerTurnId, []); // Contextの船もリセット
  }, [currentPlayerTurnId, setPlayerBoardShips]);

  const getBoardCellsForDisplay = useMemo(() => {
    if (!currentPlayer || !playerBoards[currentPlayer.id]) {
      return createEmptyBoard(0).cells; // エラー回避のため空のボードを返す
    }
    const currentBoard = playerBoards[currentPlayer.id];
    let cells = currentBoard.cells;

    // 現在配置中の船の仮表示
    if (currentPlayer.type === "human" && shipToPlace && hoverCoord) {
      const tempPlacedShip: PlacedShip = {
        id: shipToPlace.id,
        definition: shipToPlace,
        start: hoverCoord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };

      // 既存の船と重ねて表示
      let tempCells = createEmptyBoard(currentPlayer.id).cells;
      currentPlacedShips.forEach((pShip) => {
        tempCells = placeShipOnBoard(
          tempCells,
          pShip.definition,
          pShip.start,
          pShip.orientation
        );
      });

      // 現在配置しようとしている船を仮表示
      if (
        isShipWithinBounds(hoverCoord, shipToPlace.size, currentOrientation) &&
        isShipPlacementValid(
          tempCells,
          hoverCoord,
          shipToPlace.size,
          currentOrientation
        )
      ) {
        cells = placeShipOnBoard(
          tempCells,
          shipToPlace,
          hoverCoord,
          currentOrientation
        );
      } else {
        // 無効な位置の場合、赤色で表示するロジック（オプション）
        // 例: placeShipOnBoard を呼び出す前に、無効な位置のセルを特定して色を変える
        cells = tempCells; // 有効でない場合は既存のボードに戻す
      }
    } else {
      // AI配置中またはHumanの未配置の場合、ボードの状態をそのまま反映
      cells = currentBoard.cells;
    }
    return cells;
  }, [
    currentPlayer,
    playerBoards,
    shipToPlace,
    hoverCoord,
    currentOrientation,
    currentPlacedShips,
  ]);

  if (!currentPlayer || phase !== "ship-placement") {
    return <div>船配置を準備中...</div>;
  }

  // 「なし」プレイヤーの場合、UIは表示しない
  if (currentPlayer.type === "none") {
    return null; // または「次のプレイヤーの準備中...」のようなメッセージ
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2 style={{ textAlign: "center" }}>{currentPlayer.name} の船配置</h2>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h4>あなたのボード</h4>
          <BoardGrid
            cells={getBoardCellsForDisplay}
            isPlayerBoard={true}
            onCellClick={handlePlaceShip}
            onCellHover={setHoverCoord}
            onBoardLeave={() => setHoverCoord(null)}
            disableClick={
              currentPlayer.type === "ai" ||
              isAiPlacing ||
              currentShipIndex >= ALL_SHIPS.length
            }
          />
        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h4>配置する船</h4>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {ALL_SHIPS.map((ship, index) => (
              <li
                key={ship.id}
                style={{
                  fontWeight: index === currentShipIndex ? "bold" : "normal",
                  color: index === currentShipIndex ? "#0f0" : "#fff",
                  marginBottom: "5px",
                }}
              >
                {ship.name} ({ship.size}マス)
                {index < currentShipIndex ? "[配置済み]" : "(未配置)"}
              </li>
            ))}
          </ul>
        </div>
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

export default ShipPlacement; // ★この行を追加★
