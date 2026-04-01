import { useEffect, useMemo, useState } from "react";
import "./App.css";

function RunGrid({ targets, acquiredRuns }) {
  const acquired = useMemo(() => new Set(acquiredRuns), [acquiredRuns]);

  return (
    <div className="run-grid">
      {targets.map((runValue) => (
        <div
          key={runValue}
          className={`run-cell ${acquired.has(runValue) ? "hit" : ""}`}
          title={`${runValue} runs`}
        >
          {runValue}
        </div>
      ))}
    </div>
  );
}

function TeamCard({ team, targets }) {
  return (
    <article className="team-card">
      <div className="team-title-row">
        <h3>{team.name}</h3>
        <span className="team-code">{team.code}</span>
      </div>
      <RunGrid targets={targets} acquiredRuns={team.acquiredRuns} />
      <p className="counts">
        <strong>{team.acquiredCount}</strong> acquired,{" "}
        <strong>{team.neededCount}</strong> needed
      </p>
      <p className="meta">{team.finalGamesTracked} final games tracked</p>
    </article>
  );
}

function PlayerCard({ player, targets }) {
  return (
    <section className="player-card">
      <header className="player-header">
        <h2>{player.name}</h2>
        <p>
          Combined progress: <strong>{player.acquiredCount}/14</strong> run endings,
          <strong> {player.neededCount}</strong> left
        </p>
      </header>
      <div className="teams">
        {player.teams.map((team) => (
          <TeamCard key={team.code} team={team} targets={targets} />
        ))}
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadScoreboard() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/scoreboard");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Could not load scoreboard");
      }

      setData(payload);
    } catch (err) {
      setError(err.message || "Could not load scoreboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScoreboard();
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>MLB 2026 Run Endings Tracker</h1>
          <p>
            Hit every run ending from 0 to 13. Green cells mark values already
            captured by a team.
          </p>
        </div>
        <button onClick={loadScoreboard} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Scores"}
        </button>
      </header>

      {loading && <p className="state">Loading live 2026 game results...</p>}
      {error && <p className="state error">{error}</p>}

      {data && !loading && !error && (
        <>
          <section className="top-meta">
            <p>
              Season: <strong>{data.season}</strong>
            </p>
            <p>Last update: {new Date(data.updatedAt).toLocaleString()}</p>
          </section>
          <section className="player-list">
            {data.players.map((player) => (
              <PlayerCard key={player.name} player={player} targets={data.targets} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default App;
