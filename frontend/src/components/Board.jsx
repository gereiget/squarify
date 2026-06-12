import { Orientation } from "../gameEngine";

function lineOwnerClass(players, line, useNeutralClaimedLines) {
  if (useNeutralClaimedLines) {
    return "line-claimed";
  }

  const index = players.findIndex((player) => player.id === line.claimedBy);
  if (index === 0) {
    return "line-player-one";
  }
  if (index === 1) {
    return "line-player-two";
  }
  return "line-claimed";
}

function boxOwnerClass(players, box) {
  const index = players.findIndex((player) => player.id === box.claimedBy);
  return index === 0 ? "box-player-one" : "box-player-two";
}

export function Board({ game, disabled, onMove, useNeutralClaimedLines = false }) {
  const rows = [];

  for (let row = 0; row < game.gridSize * 2 + 1; row += 1) {
    for (let col = 0; col < game.gridSize * 2 + 1; col += 1) {
      const isDot = row % 2 === 0 && col % 2 === 0;
      const isHorizontal = row % 2 === 0 && col % 2 === 1;
      const isVertical = row % 2 === 1 && col % 2 === 0;

      if (isDot) {
        rows.push(<div key={`${row}-${col}`} className="board-dot" />);
        continue;
      }

      if (isHorizontal) {
        const lineRow = row / 2;
        const lineCol = (col - 1) / 2;
        const line = game.lines.find(
          (item) => item.orientation === Orientation.HORIZONTAL && item.row === lineRow && item.col === lineCol
        );

        rows.push(
          <button
            key={`${row}-${col}`}
            type="button"
            className={`board-line board-line-horizontal ${line ? `claimed ${lineOwnerClass(game.players, line, useNeutralClaimedLines)}` : ""}`}
            disabled={disabled || Boolean(line)}
            onClick={() => onMove({ orientation: Orientation.HORIZONTAL, row: lineRow, col: lineCol })}
            aria-label={`Claim horizontal line ${lineRow}, ${lineCol}`}
          />
        );
        continue;
      }

      if (isVertical) {
        const lineRow = (row - 1) / 2;
        const lineCol = col / 2;
        const line = game.lines.find(
          (item) => item.orientation === Orientation.VERTICAL && item.row === lineRow && item.col === lineCol
        );

        rows.push(
          <button
            key={`${row}-${col}`}
            type="button"
            className={`board-line board-line-vertical ${line ? `claimed ${lineOwnerClass(game.players, line, useNeutralClaimedLines)}` : ""}`}
            disabled={disabled || Boolean(line)}
            onClick={() => onMove({ orientation: Orientation.VERTICAL, row: lineRow, col: lineCol })}
            aria-label={`Claim vertical line ${lineRow}, ${lineCol}`}
          />
        );
        continue;
      }

      const boxRow = (row - 1) / 2;
      const boxCol = (col - 1) / 2;
      const box = game.boxes.find((item) => item.row === boxRow && item.col === boxCol);

      rows.push(
        <div
          key={`${row}-${col}`}
          className={`board-box ${box ? boxOwnerClass(game.players, box) : ""}`}
        >
          {box ? (game.players.find((player) => player.id === box.claimedBy)?.name?.[0] || "") : ""}
        </div>
      );
    }
  }

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${game.gridSize * 2 + 1}, minmax(0, 1fr))`
      }}
    >
      {rows}
    </div>
  );
}
