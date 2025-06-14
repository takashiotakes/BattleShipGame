import React from 'react';
import { CellState, Coordinate, Player } from '../types';

type GameBoardProps = {
  player: Player;
  currentPlayerId: number;
  onAttack: (targetPlayerId: number, coord: Coordinate) => void;
};

const letters = 'ABCDEFGHIJ'.split('');

const GameBoard: React.FC<GameBoardProps> = ({
  player,
  currentPlayerId,
  onAttack,
}) => {
  const isCurrentPlayer = player.id === currentPlayerId;

  const handleCellClick = (row: number, col: number) => {
    if (!isCurrentPlayer) {
      onAttack(player.id, { row, col });
    }
  };

  return (
    <div style={{ margin: '10px' }}>
      <h3>Player {player.id + 1} のボード</h3>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th></th>
            {letters.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {player.board.map((row, rIdx) => (
            <tr key={rIdx}>
              <th>{rIdx + 1}</th>
              {row.map((cell, cIdx) => {
                let display = '';
                let color = '#ADD8E6';
                if (cell === 'hit') {
                  display = '💥';
                  color = '#ff4444';
                } else if (cell === 'miss') {
                  display = '・';
                  color = '#ccc';
                }

                return (
                  <td
                    key={cIdx}
                    onClick={() => !isCurrentPlayer && handleCellClick(rIdx, cIdx)}
                    style={{
                      width: 30,
                      height: 30,
                      textAlign: 'center',
                      backgroundColor: color,
                      border: '1px solid #333',
                      cursor: !isCurrentPlayer ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GameBoard;
