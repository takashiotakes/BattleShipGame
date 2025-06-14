import React, { useState, useEffect } from 'react';
import { Player, Coordinate } from '../types';
import GameBoard from './GameBoard';

type GameManagerProps = {
  players: Player[];
  currentPlayerId: number;
  onGameEnd: (winnerIds: number[]) => void;
  onUpdatePlayers: (players: Player[]) => void;
};

const GameManager: React.FC<GameManagerProps> = ({
  players,
  currentPlayerId,
  onGameEnd,
  onUpdatePlayers,
}) => {
  const [localPlayers, setLocalPlayers] = useState<Player[]>(players);
  const [currentTurn, setCurrentTurn] = useState(currentPlayerId);

  useEffect(() => {
    setLocalPlayers(players);
    setCurrentTurn(currentPlayerId);
  }, [players, currentPlayerId]);

  const handleAttack = (targetPlayerId: number, coord: Coordinate) => {
    if (targetPlayerId === currentTurn) {
      // 自分のボードは攻撃できない
      return;
    }

    const attacker = localPlayers[currentTurn];
    const defender = localPlayers[targetPlayerId];

    // すでに攻撃済みのマスは無効
    const cellState = defender.board[coord.row][coord.col];
    if (cellState === 'hit' || cellState === 'miss') return;

    // 攻撃判定
    const newBoard = defender.board.map((row) => [...row]);
    if (cellState === 'ship') {
      newBoard[coord.row][coord.col] = 'hit';
    } else {
      newBoard[coord.row][coord.col] = 'miss';
    }

    const newDefender = { ...defender, board: newBoard };
    const newPlayers = localPlayers.map((p) =>
      p.id === targetPlayerId ? newDefender : p
    );

    setLocalPlayers(newPlayers);
    onUpdatePlayers(newPlayers);

    // TODO: 勝敗判定ロジック

    // 次のターンへ（なしプレイヤーはスキップ）
    let nextTurn = (currentTurn + 1) % newPlayers.length;
    while (newPlayers[nextTurn].type === 'none') {
      nextTurn = (nextTurn + 1) % newPlayers.length;
      if (nextTurn === currentTurn) break; // 全員なしの場合回避
    }
    setCurrentTurn(nextTurn);
  };

  return (
    <div>
      <h2>現在のターン: プレイヤー {currentTurn + 1}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {localPlayers
          .filter((p) => p.type !== 'none' && p.id !== currentTurn)
          .map((p) => (
            <GameBoard
              key={p.id}
              player={p}
              currentPlayerId={currentTurn}
              onAttack={handleAttack}
            />
          ))}
      </div>
    </div>
  );
};

export default GameManager;
