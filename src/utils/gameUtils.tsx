import { Ship } from '../types';

export const isAllShipsSunk = (ships: Ship[]): boolean => {
  return ships.every(ship => ship.positions.every(pos => pos.hit));
};
