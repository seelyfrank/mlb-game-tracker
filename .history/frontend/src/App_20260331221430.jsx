import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SCOREBOARD_URL = API_BASE_URL
  ? `${API_BASE_URL}/api/scoreboard`
  : "/api/scoreboard";
const TOTAL_TARGETS = 14;

function getBestTeam(player) {
  if (!player?.teams?.length) {
    return null;
  }

  return player.teams.reduce((best, team) => {
    if (!best) {
      return team;
    }
    if (team.acquiredCount > best.acquiredCount) {
      return team;
    }
    if (team.acquiredCount < best.acquiredCount) {
      return best;
    }
    return team.name.localeCompare(best.name) < 0 ? team : best;
  }, null);
}

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

function PlayerCard({ player, targets, place }) {
  const bestTeam = getBestTeam(player);
  const bestAcquired = bestTeam?.acquiredCount ?? 0;
  const bestNeeded = TOTAL_TARGETS - bestAcquired;

  return (
    <section className="player-card">
      <span className="place-badge">#{place}</span>
      <header className="player-header">
        <h2>{player.name}</h2>
        <p>
          Best single-team progress: <strong>{bestAcquired}/{TOTAL_TARGETS}</strong>{" "}
          ({bestTeam?.code || "N/A"}), <strong>{bestNeeded}</strong> left to win
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
  const rankedPlayers = useMemo(() => {
    if (!data?.players) {
      return [];
    }

    return data.players
      .slice()
      .sort((a, b) => {
        const aBest = getBestTeam(a);
        const bBest = getBestTeam(b);
        const aAcquired = aBest?.acquiredCount ?? 0;
        const bAcquired = bBest?.acquiredCount ?? 0;

        if (bAcquired !== aAcquired) {
          return bAcquired - aAcquired;
        }

        const aNeeded = TOTAL_TARGETS - aAcquired;
        const bNeeded = TOTAL_TARGETS - bAcquired;
        if (aNeeded !== bNeeded) {
          return aNeeded - bNeeded;
        }
        return a.name.localeCompare(b.name);
      });
  }, [data]);
  const rankedPlayersWithPlace = useMemo(() => {
    let lastScoreKey = "";
    let lastPlace = 0;

    return rankedPlayers.map((player, index) => {
      const bestTeam = getBestTeam(player);
      const acquired = bestTeam?.acquiredCount ?? 0;
      const needed = TOTAL_TARGETS - acquired;
      const scoreKey = `${acquired}-${needed}`;
      const place = scoreKey === lastScoreKey ? lastPlace : index + 1;

      lastScoreKey = scoreKey;
      lastPlace = place;

      return {
        player,
        place,
      };
    });
  }, [rankedPlayers]);

  async function loadScoreboard() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(SCOREBOARD_URL);
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
            Win condition: one single team must hit all run endings from 0 to 13.
            Green cells mark values that specific team has captured.
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
            {rankedPlayersWithPlace.map(({ player, place }) => (
              <PlayerCard
                key={player.name}
                player={player}
                targets={data.targets}
                place={place}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default App;
