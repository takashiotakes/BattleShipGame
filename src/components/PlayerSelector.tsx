// src/components/PlayerSelector.tsx
// ★このファイルは変更なしでOKです。

import React from 'react';
import { useGame } from '../contexts/GameContext';
import { PlayerType, AIDifficulty, PlayerSettings } from '../models/types';

interface PlayerSelectorProps {
  onNext: () => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  onNext,
}) => {
  const { gameState, updatePlayers } = useGame();
  const { players } = gameState;

  const handlePlayerTypeChange = (index: number, type: PlayerType) => {
    const updatedPlayers = [...players];
    updatedPlayers[index].type = type;

    if (type === 'ai' && !updatedPlayers[index].difficulty) {
      updatedPlayers[index].difficulty = 'easy';
    } else if (type !== 'ai') {
      const { difficulty, ...rest } = updatedPlayers[index];
      updatedPlayers[index] = rest;
    }

    updatePlayers(updatedPlayers); // Context の updatePlayers を直接呼び出す
  };

  const handleAILevelChange = (index: number, level: AIDifficulty) => {
    const updatedPlayers = [...players];
    if (updatedPlayers[index].type === 'ai') {
      updatedPlayers[index].difficulty = level;
      updatePlayers(updatedPlayers);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      {players.map((player, index) => (
        <div key={player.id} style={{ marginBottom: '10px' }}>
          <label>
            プレイヤー{index + 1}:
            <select
              value={player.type}
              onChange={(e) =>
                handlePlayerTypeChange(index, e.target.value as PlayerType)
              }
              style={{ marginLeft: '10px' }}
            >
              <option value="human">人間</option>
              <option value="ai">AI</option>
              <option value="none">なし</option>
            </select>
            {player.type === 'ai' && (
              <select
                value={player.difficulty || 'easy'}
                onChange={(e) => handleAILevelChange(index, e.target.value as AIDifficulty)}
                style={{ marginLeft: '10px' }}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            )}
          </label>
        </div>
      ))}

      <button onClick={onNext} style={{ padding: '10px 20px', fontSize: '16px' }}>
        船の配置へ進む
      </button>
    </div>
  );
};

export default PlayerSelector;