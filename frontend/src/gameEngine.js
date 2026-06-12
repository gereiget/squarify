export const GameStatus = {
  WAITING: "waiting",
  ACTIVE: "active",
  FINISHED: "finished"
};

export const Orientation = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical"
};

export function createLocalGame(gridSize, playerOneName, playerTwoName) {
  const playerOne = { id: "local_p1", name: playerOneName.trim() || "Player 1" };
  const playerTwo = { id: "local_p2", name: playerTwoName.trim() || "Player 2" };

  return {
    gameId: "local",
    joinCode: "",
    gridSize,
    players: [playerOne, playerTwo],
    currentPlayerId: playerOne.id,
    lines: [],
    boxes: [],
    scores: {
      [playerOne.id]: 0,
      [playerTwo.id]: 0
    },
    status: GameStatus.ACTIVE,
    winner: null
  };
}

export function applyLocalMove(state, playerId, line) {
  if (state.status !== GameStatus.ACTIVE) {
    throw new Error("The game is not active.");
  }
  if (state.currentPlayerId !== playerId) {
    throw new Error("It is not your turn.");
  }
  if (state.lines.some((item) => item.orientation === line.orientation && item.row === line.row && item.col === line.col)) {
    throw new Error("That line is already taken.");
  }
  if (!isInBounds(state.gridSize, line)) {
    throw new Error("Move is outside the board.");
  }

  const nextLines = [...state.lines, { ...line, claimedBy: playerId }];
  const completedBoxes = candidateBoxes(state.gridSize, line)
    .filter(({ row, col }) => !state.boxes.some((box) => box.row === row && box.col === col))
    .filter(({ row, col }) => isBoxComplete(nextLines, row, col))
    .map(({ row, col }) => ({ row, col, claimedBy: playerId }));

  const scores = { ...state.scores };
  if (completedBoxes.length > 0) {
    scores[playerId] = (scores[playerId] || 0) + completedBoxes.length;
  }

  const boxes = [...state.boxes, ...completedBoxes];
  const finished = boxes.length === state.gridSize * state.gridSize;
  const otherPlayerId = state.players.find((player) => player.id !== playerId)?.id || playerId;
  const winner = finished ? getWinnerId(state.players, scores) : null;

  return {
    ...state,
    lines: nextLines,
    boxes,
    scores,
    currentPlayerId: completedBoxes.length > 0 || finished ? playerId : otherPlayerId,
    status: finished ? GameStatus.FINISHED : GameStatus.ACTIVE,
    winner
  };
}

export function normalizeGame(game) {
  return {
    ...game,
    scores: game.scores || {},
    lines: game.lines || [],
    boxes: game.boxes || [],
    players: game.players || []
  };
}

function isInBounds(gridSize, line) {
  if (line.orientation === Orientation.HORIZONTAL) {
    return line.row >= 0 && line.row <= gridSize && line.col >= 0 && line.col < gridSize;
  }
  return line.row >= 0 && line.row < gridSize && line.col >= 0 && line.col <= gridSize;
}

function candidateBoxes(gridSize, line) {
  const positions =
    line.orientation === Orientation.HORIZONTAL
      ? [
          { row: line.row - 1, col: line.col },
          { row: line.row, col: line.col }
        ]
      : [
          { row: line.row, col: line.col - 1 },
          { row: line.row, col: line.col }
        ];

  return positions.filter(({ row, col }) => row >= 0 && col >= 0 && row < gridSize && col < gridSize);
}

function isBoxComplete(lines, row, col) {
  return (
    hasLine(lines, Orientation.HORIZONTAL, row, col) &&
    hasLine(lines, Orientation.HORIZONTAL, row + 1, col) &&
    hasLine(lines, Orientation.VERTICAL, row, col) &&
    hasLine(lines, Orientation.VERTICAL, row, col + 1)
  );
}

function hasLine(lines, orientation, row, col) {
  return lines.some((line) => line.orientation === orientation && line.row === row && line.col === col);
}

function getWinnerId(players, scores) {
  if (players.length < 2) {
    return null;
  }
  const [first, second] = players;
  const firstScore = scores[first.id] || 0;
  const secondScore = scores[second.id] || 0;
  if (firstScore === secondScore) {
    return null;
  }
  return firstScore > secondScore ? first.id : second.id;
}
