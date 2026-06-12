import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { POLL_INTERVAL_MS, API_BASE_URL } from "./config";
import { createGameSoundPlayer } from "./audio";
import { Board } from "./components/Board";
import { applyLocalMove, createLocalGame, GameStatus, normalizeGame } from "./gameEngine";

const screens = {
  MENU: "menu",
  LOCAL_SETUP: "local_setup",
  ONLINE_SETUP: "online_setup",
  WAITING: "waiting",
  GAME: "game"
};

const modes = {
  LOCAL: "local",
  ONLINE: "online"
};

const FRONTEND_VERSION = __APP_VERSION__;

export default function App() {
  const [screen, setScreen] = useState(screens.MENU);
  const [mode, setMode] = useState(modes.LOCAL);
  const [game, setGame] = useState(null);
  const [localPlayerId, setLocalPlayerId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);
  const previousGameRef = useRef(null);
  const soundPlayerRef = useRef(null);

  if (!soundPlayerRef.current) {
    soundPlayerRef.current = createGameSoundPlayer();
  }

  useEffect(() => () => {
    window.clearInterval(pollRef.current);
    soundPlayerRef.current?.release();
  }, []);

  useEffect(() => {
    if (!game) {
      previousGameRef.current = null;
      return;
    }

    if (mode !== modes.ONLINE) {
      previousGameRef.current = game;
      return;
    }

    const previousGame = previousGameRef.current;
    if (!previousGame || previousGame.gameId !== game.gameId) {
      previousGameRef.current = game;
      return;
    }

    const newLine = game.lines.find(
      (line) =>
        !previousGame.lines.some(
          (previousLine) =>
            previousLine.orientation === line.orientation &&
            previousLine.row === line.row &&
            previousLine.col === line.col
        )
    );

    if (newLine?.claimedBy && newLine.claimedBy !== localPlayerId) {
      const completedBoxes = game.boxes.length - previousGame.boxes.length;
      if (completedBoxes > 0) {
        soundPlayerRef.current?.playOtherBox();
      } else {
        soundPlayerRef.current?.playOtherLine();
      }
    }

    previousGameRef.current = game;
  }, [game, localPlayerId, mode]);

  function resetToMenu() {
    window.clearInterval(pollRef.current);
    pollRef.current = null;
    previousGameRef.current = null;
    setScreen(screens.MENU);
    setMode(modes.LOCAL);
    setGame(null);
    setLocalPlayerId("");
    setError("");
    setLoading(false);
  }

  function startPolling(gameId) {
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await api.getGame(gameId);
        const updated = normalizeGame(response.game);
        setGame(updated);
        setScreen(updated.status === GameStatus.WAITING ? screens.WAITING : screens.GAME);
        setError("");
      } catch (requestError) {
        setError(requestError.message || "Polling failed.");
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleCreateOnlineGame(form) {
    setLoading(true);
    setError("");
    try {
      const response = await api.createGame({
        gridSize: Number(form.gridSize),
        playerName: form.playerName
      });
      const nextGame = normalizeGame(response.game);
      setMode(modes.ONLINE);
      setLocalPlayerId(response.playerId);
      setGame(nextGame);
      setScreen(nextGame.status === GameStatus.WAITING ? screens.WAITING : screens.GAME);
      startPolling(response.gameId);
    } catch (requestError) {
      setError(requestError.message || "Could not create game.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinOnlineGame(form) {
    setLoading(true);
    setError("");
    try {
      const response = await api.joinGame({
        joinCode: form.joinCode.toUpperCase(),
        playerName: form.playerName
      });
      const nextGame = normalizeGame(response.game);
      setMode(modes.ONLINE);
      setLocalPlayerId(response.playerId);
      setGame(nextGame);
      setScreen(screens.GAME);
      startPolling(response.gameId);
    } catch (requestError) {
      setError(requestError.message || "Could not join game.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartLocalGame(form) {
    const nextGame = createLocalGame(Number(form.gridSize), form.playerOne, form.playerTwo);
    setMode(modes.LOCAL);
    setLocalPlayerId(nextGame.currentPlayerId);
    setGame(nextGame);
    setError("");
    setScreen(screens.GAME);
  }

  async function handleMove(line) {
    if (!game || game.status !== GameStatus.ACTIVE) {
      return;
    }

    setError("");

    if (mode === modes.LOCAL) {
      try {
        const nextGame = applyLocalMove(game, game.currentPlayerId, line);
        const completedBoxes = nextGame.boxes.length - game.boxes.length;
        setGame(nextGame);
        if (completedBoxes > 0) {
          soundPlayerRef.current?.playBox();
        } else {
          soundPlayerRef.current?.playLine();
        }
      } catch (moveError) {
        setError(moveError.message);
      }
      return;
    }

    if (game.currentPlayerId !== localPlayerId) {
      setError("Wait for your turn.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.move(game.gameId, {
        playerId: localPlayerId,
        orientation: line.orientation,
        row: line.row,
        col: line.col
      });
      const nextGame = normalizeGame(response.game);
      const completedBoxes = nextGame.boxes.length - game.boxes.length;
      setGame(nextGame);
      if (completedBoxes > 0) {
        soundPlayerRef.current?.playBox();
      } else {
        soundPlayerRef.current?.playLine();
      }
    } catch (moveError) {
      setError(moveError.message || "Could not submit move.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    if (!game) {
      return;
    }

    setError("");

    if (mode === modes.LOCAL) {
      const [firstPlayer, secondPlayer] = game.players;
      setGame(createLocalGame(game.gridSize, firstPlayer?.name || "Player 1", secondPlayer?.name || "Player 2"));
      return;
    }

    setLoading(true);
    try {
      const response = await api.restart(game.gameId, { playerId: localPlayerId });
      const nextGame = normalizeGame(response.game);
      setGame(nextGame);
      setScreen(nextGame.status === GameStatus.WAITING ? screens.WAITING : screens.GAME);
    } catch (requestError) {
      setError(requestError.message || "Could not restart game.");
    } finally {
      setLoading(false);
    }
  }

  const currentPlayer = game?.players.find((player) => player.id === game.currentPlayerId);
  const localPlayer = game?.players.find((player) => player.id === localPlayerId);
  const winnerName = game?.players.find((player) => player.id === game?.winner)?.name || null;
  const isMyTurn = mode === modes.LOCAL || game?.currentPlayerId === localPlayerId;

  return (
    <div className="app-shell">
      <main className="app-panel">
        <header className="hero">
          <p className="eyebrow">games.umalii.com/squarify</p>
          <h1>Squarify</h1>
          <p className="subhead">Play Dots and Boxes on the web or Android with the same backend rules.</p>
        </header>

        {error ? <div className="notice notice-error">{error}</div> : null}
        {loading ? <div className="notice">Working...</div> : null}

        {screen === screens.MENU ? (
          <section className="stack">
            <div className="card">
              <h2>Choose Mode</h2>
              <p>Local mode runs entirely in the browser. Online mode uses the multiplayer backend.</p>
            </div>
            <div className="actions">
              <button className="primary" type="button" onClick={() => setScreen(screens.LOCAL_SETUP)}>
                Local Two-Player
              </button>
              <button className="secondary" type="button" onClick={() => {
                setMode(modes.ONLINE);
                setScreen(screens.ONLINE_SETUP);
              }}>
                Online Multiplayer
              </button>
            </div>
            <div className="card subtle">
              <strong>API base URL</strong>
              <span>{API_BASE_URL}</span>
            </div>
          </section>
        ) : null}

        {screen === screens.LOCAL_SETUP ? (
          <LocalSetup onBack={resetToMenu} onStart={handleStartLocalGame} />
        ) : null}

        {screen === screens.ONLINE_SETUP ? (
          <OnlineSetup onBack={resetToMenu} onCreate={handleCreateOnlineGame} onJoin={handleJoinOnlineGame} />
        ) : null}

        {screen === screens.WAITING && game ? (
          <section className="stack">
            <div className="card">
              <h2>Waiting for Opponent</h2>
              <p>Share this join code:</p>
              <div className="join-code">{game.joinCode}</div>
              <p>{game.players.length}/2 players joined.</p>
            </div>
            <button className="secondary" type="button" onClick={resetToMenu}>Leave Lobby</button>
          </section>
        ) : null}

        {screen === screens.GAME && game ? (
          <section className="stack">
            <div className="stats-grid">
              <div className="card">
                <h2>Current Turn</h2>
                <p>{currentPlayer?.name || "-"}</p>
                {mode === modes.ONLINE ? <small>{isMyTurn ? "Your move" : `Watching ${currentPlayer?.name || "opponent"}`}</small> : null}
              </div>
              <div className="card">
                <h2>Score</h2>
                <div className="score-list">
                  {game.players.map((player) => (
                    <div key={player.id} className="score-row">
                      <span>{player.name}</span>
                      <strong>{game.scores[player.id] || 0}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2>Status</h2>
                {game.status === GameStatus.FINISHED ? (
                  <p>{winnerName ? `${winnerName} wins` : "Draw game"}</p>
                ) : (
                  <p>{mode === modes.ONLINE ? `You are ${localPlayer?.name || "-"}` : "Pass the device after each turn"}</p>
                )}
              </div>
            </div>

            <Board
              game={game}
              disabled={loading || (mode === modes.ONLINE && !isMyTurn) || game.status !== GameStatus.ACTIVE}
              onMove={handleMove}
            />

            <div className="actions">
              <button className="secondary" type="button" onClick={resetToMenu}>Leave</button>
              <button className="primary" type="button" onClick={handleRestart}>
                {game.status === GameStatus.FINISHED ? "Play Again" : "Restart"}
              </button>
            </div>
          </section>
        ) : null}

        <footer className="build-version">Frontend build {FRONTEND_VERSION}</footer>
      </main>
    </div>
  );
}

function LocalSetup({ onBack, onStart }) {
  const [playerOne, setPlayerOne] = useState("Player 1");
  const [playerTwo, setPlayerTwo] = useState("Player 2");
  const [gridSize, setGridSize] = useState("4");

  return (
    <section className="stack">
      <div className="card">
        <h2>Local Match</h2>
        <p>Two players, one browser session.</p>
      </div>
      <label className="field">
        <span>Player 1</span>
        <input value={playerOne} onChange={(event) => setPlayerOne(event.target.value)} />
      </label>
      <label className="field">
        <span>Player 2</span>
        <input value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)} />
      </label>
      <GridPicker value={gridSize} onChange={setGridSize} />
      <div className="actions">
        <button className="secondary" type="button" onClick={onBack}>Back</button>
        <button className="primary" type="button" onClick={() => onStart({ playerOne, playerTwo, gridSize })}>Start</button>
      </div>
    </section>
  );
}

function OnlineSetup({ onBack, onCreate, onJoin }) {
  const [hostName, setHostName] = useState("Host");
  const [joinName, setJoinName] = useState("Guest");
  const [joinCode, setJoinCode] = useState("");
  const [gridSize, setGridSize] = useState("4");

  return (
    <section className="stack">
      <div className="card">
        <h2>Online Match</h2>
        <p>Create a room or join a game code from any browser or Android client.</p>
      </div>
      <div className="card">
        <h3>Create Game</h3>
        <label className="field">
          <span>Your name</span>
          <input value={hostName} onChange={(event) => setHostName(event.target.value)} />
        </label>
        <GridPicker value={gridSize} onChange={setGridSize} />
        <button className="primary full" type="button" onClick={() => onCreate({ playerName: hostName, gridSize })}>
          Create Online Game
        </button>
      </div>
      <div className="card">
        <h3>Join Game</h3>
        <label className="field">
          <span>Your name</span>
          <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
        </label>
        <label className="field">
          <span>Join code</span>
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
        </label>
        <button className="primary full" type="button" onClick={() => onJoin({ playerName: joinName, joinCode })}>
          Join Online Game
        </button>
      </div>
      <div className="actions">
        <button className="secondary" type="button" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}

function GridPicker({ value, onChange }) {
  return (
    <div className="segmented">
      {["3", "4", "5"].map((size) => (
        <button
          key={size}
          type="button"
          className={value === size ? "segment selected" : "segment"}
          onClick={() => onChange(size)}
        >
          {size}x{size}
        </button>
      ))}
    </div>
  );
}
