import React from 'react';

type GameResultModalProps = {
  winner: string | null;
  onClose: () => void;
};

const GameResultModal: React.FC<GameResultModalProps> = ({ winner, onClose }) => {
  if (!winner) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2>🎉 勝者: {winner} 🎉</h2>
        <button onClick={onClose} style={styles.button}>OK</button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '1rem',
    textAlign: 'center',
    minWidth: '300px',
  },
  button: {
    marginTop: '1.5rem',
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
  },
};

export default GameResultModal;
