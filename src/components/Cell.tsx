import React from "react";
import { CellStatus, Coordinate } from "../models/types";

interface CellProps {
  coordinate: Coordinate;
  status: CellStatus;
  isShipVisible: boolean; // 船の表示/非表示を制御 (自ボードかターゲットボードかによる)
  onClick?: (coord: Coordinate) => void;
  onMouseEnter?: (coord: Coordinate) => void;
}

const Cell: React.FC<CellProps> = ({
  coordinate,
  status,
  isShipVisible,
  onClick,
  onMouseEnter,
}) => {
  const getBackgroundColor = () => {
    switch (status) {
      case "hit":
        return "red"; // ヒット
      case "miss":
        return "lightgray"; // ミス
      case "sunk":
        return "darkred"; // 撃沈された船の一部
      case "ship":
        return isShipVisible ? "darkblue" : "lightblue"; // 自ボードなら船を表示、相手ボードなら空と同じ色
      case "empty":
      default:
        return "lightblue"; // 空のマス
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(coordinate);
    }
  };

  const handleMouseEnter = () => {
    if (onMouseEnter) {
      onMouseEnter(coordinate);
    }
  };

  return (
    <td
      style={{
        width: "25px",
        height: "25px",
        border: "1px solid #333",
        backgroundColor: getBackgroundColor(),
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* デバッグ用に座標を表示することも可能だが、今回は非表示 */}
    </td>
  );
};

export default Cell;
