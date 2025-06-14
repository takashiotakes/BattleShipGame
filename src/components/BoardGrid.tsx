import React from 'react';
import { Cell as CellType, Coordinate, AttackedCellStatus } from '../models/types'; // AttackedCellStatusを追加
import Cell from './Cell';

interface BoardGridProps {
  cells: CellType[][];
  isPlayerBoard: boolean; // プレイヤー自身のボードかどうか (船の表示制御に使う)
  // attackedCells?: { [key: string]: AttackedCellStatus }; // 攻撃履歴（相手のボード表示用）
  onCellClick?: (coord: Coordinate) => void; // セルがクリックされたときのコールバック
  onCellHover?: (coord: Coordinate) => void; // マウスがセルにホバーしたときのコールバック
  // disabled?: boolean; // ボード操作を無効にするフラグ
}

const BoardGrid: React.FC<BoardGridProps> = ({ cells, isPlayerBoard, onCellClick, onCellHover }) => {
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        margin: '0 auto', // 中央揃え
        textAlign: 'center',
      }}
    >
      <thead>
        <tr>
          <th></th>
          {Array.from({ length: 10 }, (_, i) => (
            <th key={i}>{String.fromCharCode(65 + i)}</th> // A, B, C...
          ))}
        </tr>
      </thead>
      <tbody>
        {cells.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <td>{rowIndex + 1}</td> {/* 1, 2, 3... */}
            {row.map((cell, colIndex) => (
              <Cell
                key={`${cell.x}-${cell.y}`}
                coordinate={{ x: cell.x, y: cell.y }}
                status={cell.status}
                isShipVisible={isPlayerBoard} // プレイヤー自身のボードなら船を表示
                onClick={onCellClick}
                onMouseEnter={onCellHover}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default BoardGrid;