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
  // generateRandomShipPlacement は今回は直接使わないためコメントアウト
  // generateRandomShipPlacement,
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

  // AI配置後の自動遷移を制御するための ref (どのプレイヤーのAI配置が完了したかを記憶)
  const lastProcessedPlayerId = useRef<number | null>(null); // AI配置が完了し、次のプレイヤーへの遷移を試みたプレイヤーのID
  // コンポーネントの初期化中フラグ (状態が不安定な期間に操作を無効化)
  const isInitializingRef = useRef(false); // コンポーネントの初期化中かどうかのフラグ
  // 現在のプレイヤーがAIで、まだ配置がトリガーされていない場合に true になる
  const aiPlacementTriggeredRef = useRef<boolean>(false);

  // ★追加: コンポーネントレンダリング時のログ
  console.log(
    "ShipPlacement (Render): Current gameState.players:",
    gameState.players
  );
  console.log(
    "ShipPlacement (Render): Current gameState.currentPlayerTurnId:",
    gameState.currentPlayerTurnId
  );
  console.log("ShipPlacement (Render): Current currentPlayer:", currentPlayer);

  // プレイヤーが全ての船を配置済みか、次のプレイヤーへ遷移するか、ゲームを開始するかを判断する
  // この関数は、船配置が完了した際や、次のプレイヤーへ移動するボタンが押された際に呼び出される
  // useCallback でメモ化し、不要な再生成を防ぐ
  // 依存配列に gameState の要素 (players, playerBoards, currentPlayer, currentPlacedShips, advancePhase, setGameState) を含める
  const handleNextPlayerOrGameStart = useCallback(() => {
    if (!currentPlayer) {
      console.log("handleNextPlayerOrGameStart: currentPlayer が未定義です。");
      return;
    }

    // 人間プレイヤーの場合、全船配置が完了しているか確認
    if (
      currentPlayer.type === "human" &&
      currentPlacedShips.length !== ALL_SHIPS.length
    ) {
      alert("全ての船を配置してください！");
      return;
    }

    const activePlayers = players.filter((p) => p.type !== "none");
    const currentPlayerIndex = activePlayers.findIndex(
      (p) => p.id === currentPlayer.id
    );

    let nextPlayerIdToSet = -1;
    let allPlayersReady = true;

    // 全プレイヤーが船を配置し終えているかチェック
    for (let i = 0; i < activePlayers.length; i++) {
      const player =
        activePlayers[(currentPlayerIndex + 1 + i) % activePlayers.length]; // 現在のプレイヤーの次からチェック
      const board = playerBoards[player.id];

      if (!board || board.placedShips.length < ALL_SHIPS.length) {
        nextPlayerIdToSet = player.id; // まだ配置していないプレイヤーが見つかった
        allPlayersReady = false;
        break;
      }
    }

    if (allPlayersReady) {
      console.log(
        "ShipPlacement: 全てのプレイヤーが船の配置を完了しました。ゲームを開始します。"
      );
      advancePhase("in-game"); // ゲーム開始フェーズへ
    } else {
      console.log(
        `ShipPlacement: 次のプレイヤーへ移動: ${
          players.find((p) => p.id === nextPlayerIdToSet)?.name
        } (ID: ${nextPlayerIdToSet})`
      );
      setGameState((prev) => ({
        ...prev,
        currentPlayerTurnId: nextPlayerIdToSet,
      })); // 次のプレイヤーへ切り替え
    }
    // プレイヤー切り替えまたはフェーズ遷移後、直前のプレイヤーの処理済みフラグをクリア
    // この時点でcurrentPlayerが変更されるため、次のレンダリングでinitEffectが走る
    // その際に lastProcessedPlayerId と aiPlacementTriggeredRef は適切にリセットされるべき
    // ここでは特に何もしない (呼び出し元に任せる)
  }, [
    players,
    playerBoards,
    currentPlayer,
    currentPlacedShips,
    advancePhase,
    setGameState,
  ]);

  // **初期化処理のuseEffect:**
  // currentPlayer が変更されたときにボードの状態をリロード/初期化する。
  useEffect(() => {
    console.log("ShipPlacement(initEffect): useEffect triggered.");
    // ★追加: useEffect トリガー時の詳細ログ
    console.log(
      `ShipPlacement(initEffect) Triggered for Player ID: ${currentPlayer?.id}, Type: ${currentPlayer?.type}`
    );
    console.log(
      `ShipPlacement(initEffect) Current gameState.players on trigger:`,
      players
    );
    if (!currentPlayer || currentPlayer.type === "none") {
      console.log(
        "ShipPlacement(initEffect): currentPlayer が無効、または none です。"
      );
      return;
    }

    // 既に現在のプレイヤーのボードが完全に配置済みで、かつ一度処理済みとしてマークされている場合は
    // 不要な再初期化を行わないようにする (AIで無限ループを防ぐため)
    if (
      lastProcessedPlayerId.current === currentPlayer.id &&
      playerBoards[currentPlayer.id]?.placedShips.length === ALL_SHIPS.length
    ) {
      // 詳細ログを追加
      console.log(
        `ShipPlacement(initEffect): CurrentPlayer: ID ${currentPlayer.id}, Name: ${currentPlayer.name}, Type: ${currentPlayer.type}`
      );
      console.log(
        `ShipPlacement(initEffect): isInitializingRef: ${isInitializingRef.current}, isAiPlacing: ${isAiPlacing}, aiPlacementTriggeredRef: ${aiPlacementTriggeredRef.current}`
      );
      console.log(
        `ShipPlacement(initEffect): プレイヤー ${currentPlayer.name} (ID: ${currentPlayer.id}) は既に処理済みです。初期化をスキップします。`
      );
      return;
    }

    isInitializingRef.current = true; // 初期化開始フラグを立てる
    console.log(
      `ShipPlacement(initEffect): プレイヤー ${currentPlayer.name} (ID: ${currentPlayer.id}) のボードを初期化中...`
    );

    const boardForCurrentPlayer = playerBoards[currentPlayer.id];

    if (
      boardForCurrentPlayer &&
      boardForCurrentPlayer.placedShips.length === ALL_SHIPS.length
    ) {
      // 既に全ての船が配置済みの場合、その情報を復元
      setCurrentPlacedShips(boardForCurrentPlayer.placedShips);
      setCurrentShipIndex(ALL_SHIPS.length);
      lastProcessedPlayerId.current = currentPlayer.id; // このプレイヤーは処理済みとマーク
      // 詳細ログを追加
      console.log(
        `ShipPlacement(initEffect): CurrentPlayer: ID ${currentPlayer.id}, Name: ${currentPlayer.name}, Type: ${currentPlayer.type}`
      );
      console.log(
        `ShipPlacement(initEffect): isInitializingRef: ${isInitializingRef.current}, isAiPlacing: ${isAiPlacing}, aiPlacementTriggeredRef: ${aiPlacementTriggeredRef.current}`
      );
      console.log(
        `ShipPlacement(initEffect): プレイヤー ${currentPlayer.name} (ID: ${currentPlayer.id}) は全ての船を配置済みです。状態を復元しました。`
      );
    } else {
      // 未配置または一部配置済みの場合、既存の船をロードし、未配置状態にリセット
      const existingPlaced = boardForCurrentPlayer?.placedShips || [];
      setCurrentPlacedShips(existingPlaced);
      setCurrentShipIndex(existingPlaced.length);
      setCurrentOrientation("horizontal");
      setHoverCoord(null);
      lastProcessedPlayerId.current = null; // 新しいプレイヤーなので処理済みフラグをクリア
      // 詳細ログを追加
      console.log(
        `ShipPlacement(initEffect): CurrentPlayer: ID ${currentPlayer.id}, Name: ${currentPlayer.name}, Type: ${currentPlayer.type}`
      );
      console.log(
        `ShipPlacement(initEffect): isInitializingRef: ${isInitializingRef.current}, isAiPlacing: ${isAiPlacing}, aiPlacementTriggeredRef: ${aiPlacementTriggeredRef.current}`
      );
      aiPlacementTriggeredRef.current = false; // 初期化時にはAIトリガーもリセット
      console.log(
        `ShipPlacement(initEffect): プレイヤー ${currentPlayer.name} (ID: ${currentPlayer.id}) を未配置/一部配置済みの状態で初期化しました。配置済み船数: ${existingPlaced.length}`
      );
    }

    // 初期化が完了したらフラグを下げる。短い遅延を入れることで、Reactのバッチ更新が完了する機会を与える
    const timer = setTimeout(() => {
      isInitializingRef.current = false;
      console.log(
        `ShipPlacement(initEffect): 初期化完了、isInitializingRef を false に設定。`
      );
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [currentPlayer, playerBoards]);

  // 現在配置中の船の定義
  const shipToPlace = useMemo(() => {
    if (currentShipIndex >= ALL_SHIPS.length) {
      return null;
    }
    return ALL_SHIPS[currentShipIndex];
  }, [currentShipIndex]);

  // 自分のボードの表示用セルを生成
  const myDisplayCells = useMemo(() => {
    const initialBoardCells = createEmptyBoard(currentPlayer?.id ?? -1).cells;
    let boardCells = initialBoardCells.map((row) =>
      row.map((cell) => ({ ...cell }))
    );

    currentPlacedShips.forEach((pShip) => {
      boardCells = placeShipOnBoard(
        boardCells,
        pShip.definition,
        pShip.start,
        pShip.orientation
      );
    });

    // ホバープレビューは人間プレイヤーかつ配置中の場合のみ
    if (
      currentPlayer?.type === "human" &&
      shipToPlace &&
      hoverCoord &&
      currentShipIndex < ALL_SHIPS.length
    ) {
      const tempShip: PlacedShip = {
        id: shipToPlace.id,
        definition: shipToPlace,
        start: hoverCoord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };

      if (
        isShipWithinBounds(
          tempShip.start,
          tempShip.definition.size,
          tempShip.orientation
        ) &&
        isShipPlacementValid(
          boardCells,
          tempShip.start,
          tempShip.definition.size,
          tempShip.orientation
        )
      ) {
        const previewBoardCells = boardCells.map((row) =>
          row.map((cell) => ({ ...cell }))
        );
        for (let i = 0; i < tempShip.definition.size; i++) {
          const x =
            tempShip.orientation === "horizontal"
              ? tempShip.start.x + i
              : tempShip.start.x;
          const y =
            tempShip.orientation === "vertical"
              ? tempShip.start.y + i
              : tempShip.start.y;
          if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            if (previewBoardCells[y][x].status === "empty") {
              previewBoardCells[y][x] = {
                ...previewBoardCells[y][x],
                status: "ship",
              };
            }
          }
        }
        return previewBoardCells;
      }
    }
    return boardCells;
  }, [
    currentPlayer,
    currentPlacedShips,
    shipToPlace,
    hoverCoord,
    currentOrientation,
    currentShipIndex,
  ]);

  const handleCellClick = useCallback(
    (coord: Coordinate) => {
      if (isInitializingRef.current) {
        console.log("ShipPlacement: 初期化中はクリックを無視します。");
        return;
      }
      // AI配置中、または人間プレイヤーでない、または全ての船を配置済みの場合、クリックを無効化
      if (
        !currentPlayer ||
        currentPlayer.type !== "human" ||
        !shipToPlace ||
        isAiPlacing ||
        currentShipIndex >= ALL_SHIPS.length
      ) {
        console.log("ShipPlacement: クリック条件を満たしていません。");
        return;
      }

      const shipDefinition = ALL_SHIPS[currentShipIndex];
      const newShip: PlacedShip = {
        id: shipDefinition.id,
        definition: shipDefinition,
        start: coord,
        orientation: currentOrientation,
        hits: [],
        isSunk: false,
      };

      // 現在のボード状態を正確に再現して配置の有効性をチェック
      let tempCellsForValidation = createEmptyBoard(currentPlayer.id).cells.map(
        (row) => row.map((cell) => ({ ...cell }))
      );
      currentPlacedShips.forEach((s) => {
        tempCellsForValidation = placeShipOnBoard(
          tempCellsForValidation,
          s.definition,
          s.start,
          s.orientation
        );
      });

      if (
        isShipWithinBounds(
          newShip.start,
          newShip.definition.size,
          newShip.orientation
        ) &&
        isShipPlacementValid(
          tempCellsForValidation,
          newShip.start,
          newShip.definition.size,
          newShip.orientation
        )
      ) {
        const updatedPlacedShips = [...currentPlacedShips, newShip];
        setCurrentPlacedShips(updatedPlacedShips); // ローカルステートを更新

        setPlayerBoardShips(currentPlayer.id, updatedPlacedShips); // GameContextを更新

        setCurrentShipIndex((prev) => prev + 1); // 次の船へ
        setHoverCoord(null); // ホバー状態をリセット
        console.log(
          `ShipPlacement: 船 ${newShip.definition.name} を配置しました。合計配置数: ${updatedPlacedShips.length}`
        );
      } else {
        alert(
          "その場所には船を配置できません。他の船と重なっているか、ボードの外に出てしまいます。"
        );
      }
    },
    [
      currentPlayer,
      currentShipIndex,
      currentOrientation,
      currentPlacedShips,
      shipToPlace,
      isAiPlacing,
      setPlayerBoardShips,
    ]
  );

  const handleRotateShip = useCallback(() => {
    setCurrentOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  }, []);

  // AI またはランダム配置ボタンが押されたときに船をランダムに配置するロジック
  const handleRandomPlacement = useCallback(
    async (playerId: number) => {
      if (!currentPlayer || currentPlayer.id !== playerId || isAiPlacing) {
        console.log(
          `handleRandomPlacement: 既にAI配置中か、現在のプレイヤーと異なるためスキップします。PlayerId: ${playerId}, isAiPlacing: ${isAiPlacing}`
        );
        return;
      }

      setIsAiPlacing(true); // AIが配置中フラグを立てる
      console.log(
        `handleRandomPlacement: プレイヤー ${playerId} のAI配置を開始します。`
      );

      let newPlacedShips: PlacedShip[] = [];

      for (const shipDef of ALL_SHIPS) {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 5000; // 試行回数をさらに増やす

        while (!placed && attempts < maxAttempts) {
          const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
          const start: Coordinate = {
            x: Math.floor(Math.random() * 10),
            y: Math.floor(Math.random() * 10),
          };

          const tempShip: PlacedShip = {
            id: shipDef.id,
            definition: shipDef,
            start: start,
            orientation: orientation,
            hits: [],
            isSunk: false,
          };

          // 現時点での配置済み船を反映したボードで検証
          let tempBoardForValidation = createEmptyBoard(playerId).cells.map(
            (row) => row.map((cell) => ({ ...cell }))
          );
          newPlacedShips.forEach((s) => {
            tempBoardForValidation = placeShipOnBoard(
              tempBoardForValidation,
              s.definition,
              s.start,
              s.orientation
            );
          });

          if (
            isShipWithinBounds(start, shipDef.size, orientation) &&
            isShipPlacementValid(
              tempBoardForValidation,
              start,
              shipDef.size,
              orientation
            )
          ) {
            newPlacedShips.push(tempShip);
            placed = true;
            console.log(
              `  SUCCESS: Placed ${shipDef.name} at (${start.x},${start.y}) ${orientation} after ${attempts} attempts.`
            );
          }
          attempts++;
        }

        if (!placed) {
          console.error(
            `ShipPlacement(Error): プレイヤー ${playerId} の船 ${shipDef.name} をランダムに配置できませんでした (${attempts}回の試行後)。`
          );
          alert(
            "船のランダム配置に失敗しました。ボードの状態をリセットします。"
          );
          setIsAiPlacing(false); // エラー時はフラグを下げる
          setCurrentPlacedShips([]); // 失敗したら全てリセット
          setCurrentShipIndex(0);
          setPlayerBoardShips(playerId, []); // Contextもリセット
          lastProcessedPlayerId.current = null; // 処理済みフラグもクリア
          aiPlacementTriggeredRef.current = false; // AIトリガーもリセット
          return; // 失敗したら処理を中断
        }
      }

      // 全ての船の配置が完了した後に一度だけ UI と Context を更新
      setCurrentPlacedShips(newPlacedShips); // 最終的な配置済み船のリストをセット
      setPlayerBoardShips(playerId, newPlacedShips); // Contextを更新
      setCurrentShipIndex(ALL_SHIPS.length);
      setIsAiPlacing(false); // AI配置中フラグを下げる
      lastProcessedPlayerId.current = playerId; // このプレイヤーのAI配置は完了したとマーク
      console.log(
        `ShipPlacement: AI (${currentPlayer.name}) のランダム配置が完了しました。全ての船をContextに保存しました。isAiPlacing: ${isAiPlacing}`
      );
    },
    [currentPlayer, setPlayerBoardShips, isAiPlacing]
  ); // isAiPlacing を依存配列に追加し、関数内で再帰的に呼び出されないようにする

  const handleRedeploy = useCallback(() => {
    setCurrentPlacedShips([]); // 配置済みの船をリセット
    setCurrentShipIndex(0); // 配置中の船を最初に戻す
    setCurrentOrientation("horizontal"); // 向きもリセット
    setHoverCoord(null); // ホバーもリセット

    if (currentPlayer) {
      setPlayerBoardShips(currentPlayer.id, []); // Context のボードもリセット (船の情報をクリア)
    }
    lastProcessedPlayerId.current = null; // リデプロイしたので処理済みをクリア
    aiPlacementTriggeredRef.current = false; // AIトリガーもリセット (確実にする)
    setIsAiPlacing(false); //念のためAI配置中フラグもリセット
  }, [currentPlayer, setPlayerBoardShips]);

  // AIプレイヤーが現在のターンになったら自動で配置を開始するuseEffect
  // aiPlacementTriggeredRef を使用して、一度だけ確実にトリガーされるようにする
  useEffect(() => {
    // ★追加: useEffect トリガー時の詳細ログ
    console.log(
      `ShipPlacement(aiStartEffect): useEffect triggered. CurrentPlayer: ID ${currentPlayer?.id}, Type: ${currentPlayer?.type}`
    );
    console.log(
      `ShipPlacement(aiStartEffect): Current gameState.players on trigger:`,
      players
    );
    // 詳細ログを追加
    console.log(
      `ShipPlacement(aiStartEffect): States: isInitializingRef: ${isInitializingRef.current}, isAiPlacing: ${isAiPlacing}, aiPlacementTriggeredRef: ${aiPlacementTriggeredRef.current}, currentPlacedShips.length: ${currentPlacedShips.length}`
    );
    // 初期化中の場合は即座にスキップ
    if (isInitializingRef.current) {
      console.log("ShipPlacement(aiStartEffect): AI配置をスキップ (初期化中)");
      return;
    }
    // AI配置中、または既にAI配置がトリガー済みの場合スキップ
    if (isAiPlacing || aiPlacementTriggeredRef.current) {
      console.log(
        "ShipPlacement(aiStartEffect): AI配置をスキップ (配置中/既にトリガー済み): ",
        {
          isAiPlacing,
          aiPlacementTriggeredRef: aiPlacementTriggeredRef.current,
        }
      );
      return;
    }

    // AIプレイヤーで、まだ全ての船が配置されておらず、かつそのAIプレイヤーがまだ処理済みとしてマークされていない場合
    if (
      currentPlayer &&
      currentPlayer.type === "ai" &&
      currentPlacedShips.length < ALL_SHIPS.length &&
      lastProcessedPlayerId.current !== currentPlayer.id // AI配置が完了してないか、まだAIターンに到達していない
    ) {
      console.log(
        `ShipPlacement(aiStartEffect): AI (${currentPlayer.name}) の船配置を開始します。`
      );
      aiPlacementTriggeredRef.current = true; // トリガーされたとマーク
      const timer = setTimeout(() => {
        handleRandomPlacement(currentPlayer.id);
      }, 500); // AIが考えている風の遅延
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, currentPlacedShips, isAiPlacing, handleRandomPlacement]); // aiPlacementTriggeredRef を依存配列から削除

  // AIの配置が完了したら自動的に次のプレイヤーへ、またはゲーム開始するuseEffect
  useEffect(() => {
    // ★追加: useEffect トリガー時の詳細ログ
    console.log(
      `ShipPlacement(aiCompletionEffect): useEffect triggered. CurrentPlayer: ID ${currentPlayer?.id}, Type: ${currentPlayer?.type}`
    );
    console.log(
      `ShipPlacement(aiCompletionEffect): Current gameState.players on trigger:`,
      players
    );
    // 詳細ログを追加
    console.log(
      `ShipPlacement(aiCompletionEffect): States: isInitializingRef: ${isInitializingRef.current}, isAiPlacing: ${isAiPlacing}, currentPlacedShips.length: ${currentPlacedShips.length}, lastProcessedPlayerId: ${lastProcessedPlayerId.current}`
    );
    // 初期化中、またはAI配置中の場合スキップ
    if (isInitializingRef.current || isAiPlacing) {
      console.log(
        "ShipPlacement(aiCompletionEffect): AI完了処理をスキップ (初期化中/配置中)"
      );
      return;
    }

    // AIプレイヤーで、全船配置が完了しており、かつまだ次のステップへ遷移していない場合
    // (lastProcessedPlayerId.current は handleRandomPlacement 完了時にセットされる)
    if (
      currentPlayer &&
      currentPlayer.type === "ai" &&
      currentPlacedShips.length === ALL_SHIPS.length &&
      lastProcessedPlayerId.current === currentPlayer.id // この条件は、AIが自分の船を配置し終えたことを保証
    ) {
      console.log(
        `ShipPlacement(aiCompletionEffect): AI (${currentPlayer.name}) の船配置が完了し、Contextに保存しました。次のプレイヤーへ遷移します。`
      );
      const timer = setTimeout(() => {
        // 短い遅延を入れることで、UIの更新などが安定する機会を与える
        handleNextPlayerOrGameStart(); // 次のプレイヤーへ
      }, 500); // 少し待ってから次のプレイヤーへ
      return () => clearTimeout(timer);
    }
  }, [
    currentPlayer,
    currentPlacedShips,
    isAiPlacing,
    handleNextPlayerOrGameStart,
    lastProcessedPlayerId,
  ]); // lastProcessedPlayerId.current を依存配列に追加

  if (!currentPlayer) {
    return <div>プレイヤーが選択されていません。</div>;
  }

  // ゲームフェーズが'in-game'になったら、このコンポーネントは表示を終了する
  if (phase === "in-game") {
    return <div>ゲームを開始しています...</div>;
  }

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "20px auto",
        textAlign: "center",
        backgroundColor: "#333",
        padding: "20px",
        borderRadius: "10px",
      }}
    >
      <h2 style={{ color: "#fff" }}>船の配置 - {currentPlayer.name}</h2>
      {currentShipIndex < ALL_SHIPS.length && (
        <p style={{ color: "#fff" }}>
          次の船: {shipToPlace?.name} (サイズ: {shipToPlace?.size})
        </p>
      )}
      {currentShipIndex === ALL_SHIPS.length && (
        <p style={{ color: "#0f0", fontWeight: "bold" }}>
          全ての船の配置が完了しました！
        </p>
      )}

      <div
        style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}
      >
        <BoardGrid
          cells={myDisplayCells}
          isPlayerBoard={true}
          onCellClick={handleCellClick}
          onCellHover={setHoverCoord}
          onBoardLeave={() => setHoverCoord(null)}
          disableClick={
            currentPlayer.type !== "human" ||
            currentShipIndex >= ALL_SHIPS.length ||
            isAiPlacing ||
            isInitializingRef.current
          }
        />
      </div>

      <div style={{ color: "#fff", marginBottom: "20px" }}>
        <h4>配置済み船リスト:</h4>
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {ALL_SHIPS.map((ship, index) => (
            <li
              key={ship.id}
              style={{ color: index < currentShipIndex ? "#0f0" : "#aaa" }}
            >
              {ship.name} (サイズ: {ship.size}){" "}
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
              disabled={
                !shipToPlace ||
                currentShipIndex >= ALL_SHIPS.length ||
                isAiPlacing ||
                isInitializingRef.current
              }
              style={{ marginRight: "10px" }}
            >
              船を回転 (現在の向き:{" "}
              {currentOrientation === "horizontal" ? "横" : "縦"})
            </button>
            <button
              onClick={() => handleRandomPlacement(currentPlayer.id)}
              disabled={
                currentShipIndex >= ALL_SHIPS.length ||
                isAiPlacing ||
                isInitializingRef.current
              }
            >
              ランダム配置
            </button>
            <button
              onClick={handleRedeploy}
              disabled={isAiPlacing || isInitializingRef.current}
              style={{ marginLeft: "10px" }}
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
              disabled={isInitializingRef.current}
            >
              {players
                .filter((p) => p.type !== "none")
                .every(
                  (p) =>
                    playerBoards[p.id]?.placedShips.length === ALL_SHIPS.length
                )
                ? "ゲーム開始"
                : "次のプレイヤーへ"}
            </button>
          )}
      </div>
      {(currentPlayer.type === "ai" || isAiPlacing) && (
        <p style={{ color: "#fff" }}>
          AI ({currentPlayer.name}) が船を配置中...
        </p>
      )}
    </div>
  );
};

export default ShipPlacement;
