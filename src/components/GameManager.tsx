import React, { useEffect, useState } from 'react';
import { PlayerType, GamePhase, Player, Ship } from '../types';
import GameBoard from './GameBoard';
import GameResultModal from './GameResultModal';
import { isAllShipsSunk } from '../utils/gameUtils';

type GameManagerProps = {
  players: Player[];
};

const GameManager: React.FC<GameManagerProps> = ({ players }) => {
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const checkVictory = () => {
    const alivePlayers = players.filter(p => p.type !== 'none' && p.ships && !isAllShipsSunk(p.ships));
    if (alivePlayers.length === 1) {
      const winnerName = alivePlayers[0].name;
      setWinner(winnerName);
      setPhase('ended');
      setShowResultModal(true);
    }
  };

  useEffect(() => {
    if (phase === 'playing') {
      checkVictory();
    }
  }, [players, phase]);

  const handleCloseModal = () => {
    setShowResultModal(false);
    // ゲーム再開またはタイトル戻りは別途実装
  };

  return (
    <div>
      <h1>⚓ Battle Ship Game ⚓</h1>
      <GameBoard currentPlayer={players[currentTurn]} />
      {showResultModal && (
        <GameResultModal winner={winner} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default GameManager;
