import React, { useState } from 'react';
import PlayerSelector from './components/PlayerSelector';
import ShipPlacement from './components/ShipPlacement';

export type PlayerType = 'human' | 'ai' | 'none';
export type AIDifficulty = 'Easy' | 'Normal' | 'Hard';

interface PlayerSettings {
  type: PlayerType;
  aiLevel?: AIDifficulty;
}

const App: React.FC = () => {
  const [step, setStep] = useState<'select' | 'placement'>('select');

  const [players, setPlayers] = useState<PlayerSettings[]>([
    { type: 'human' },
    { type: 'ai', aiLevel: 'Easy' },
    { type: 'none' },
    { type: 'none' },
  ]);

  const handleStartPlacement = () => {
    setStep('placement');
  };

  const handlePlayersChange = (newPlayers: PlayerSettings[]) => {
    setPlayers(newPlayers);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>⚓ Battle Ship Game ⚓</h1>
      {step === 'select' ? (
        <PlayerSelector
          players={players}
          onPlayersChange={handlePlayersChange}
          onNext={handleStartPlacement}
        />
      ) : (
        <ShipPlacement players={players} />
      )}
    </div>
  );
};

export default App;
