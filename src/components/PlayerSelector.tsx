import React from 'react';
import { PlayerType, AIDifficulty } from '../App';

interface PlayerSettings {
  type: PlayerType;
  aiLevel?: AIDifficulty;
}

interface PlayerSelectorProps {
  players: PlayerSettings[];
  onPlayersChange: (players: PlayerSettings[]) => void;
  onNext: () => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  players,
  onPlayersChange,
  onNext,
}) => {
  const handlePlayerTypeChange = (index: number, type: PlayerType) => {
    const updatedPlayers = [...players];
    updatedPlayers[index].type = type;

    // AIレベルが必要な場合は初期化、不要な場合は削除
    if (type === 'ai' && !updatedPlayers[index].aiLevel) {
      updatedPlayers[index].aiLevel = 'Easy';
    } else if (type !== 'ai') {
      delete updatedPlayers[index].aiLevel;
    }

    onPlayersChange(updatedPlayers);
  };

  const handleAILevelChange = (index: number, level: AIDifficulty) => {
    const updatedPlayers = [...players];
    if (updatedPlayers[index].type === 'ai') {
      updatedPlayers[index].aiLevel = level;
      onPlayersChange(updatedPlayers);
    }
  };

  const activeAIs = players.filter(p => p.type === 'ai');

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      {players.map((player, index) => (
        <div key={index} style={{ marginBottom: '10px' }}>
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
          </label>
        </div>
      ))}

      {activeAIs.length > 0 && (
        <div style={{ margin: '20px 0' }}>
          <label>
            AI難易度設定:
            <select
              value={activeAIs[0].aiLevel}
              onChange={(e) =>
                handleAILevelChange(
                  players.findIndex(p => p.type === 'ai'),
                  e.target.value as AIDifficulty
                )
              }
              style={{ marginLeft: '10px' }}
            >
              <option value="Easy">Easy</option>
              <option value="Normal">Normal</option>
              <option value="Hard">Hard</option>
            </select>
          </label>
        </div>
      )}

      <button onClick={onNext} style={{ padding: '10px 20px', fontSize: '16px' }}>
        配置設定
      </button>
    </div>
  );
};

export default PlayerSelector;

