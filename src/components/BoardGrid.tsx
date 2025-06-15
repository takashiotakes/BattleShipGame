// src/components/BoardGrid.tsx

import React from 'react';
import GameBoard from './GameBoard'; // 新しい GameBoard をインポート
import { Cell as CellType, Coordinate } from '../models/types';

interface BoardGridProps {
  cells: CellType[][];
  isPlayerBoard: boolean;
  onCellClick?: (coord: Coordinate) => void;
  onCellHover?: (coord: Coordinate) => void;
  onBoardLeave?: () => void;
  disableClick?: boolean; // GameBoard の disableInteraction にマッピング
  isPreview?: boolean; // ShipPlacement からのプレビュー表示用
}

const BoardGrid: React.FC<BoardGridProps> = ({
  cells,
  isPlayerBoard,
  onCellClick,
  onCellHover,
  onBoardLeave,
  disableClick = false,
  isPreview = false,
}) => {
  return (
    <GameBoard
      cells={cells}
      isPlayerBoard={isPlayerBoard}
      onCellClick={onCellClick}
      onCellHover={onCellHover}
      onBoardLeave={onBoardLeave}
      disableInteraction={disableClick} // Prop名を合わせて渡す
      isPreview={isPreview} // 必要に応じて渡す
    />
  );
};

export default BoardGrid;