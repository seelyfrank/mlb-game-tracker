const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { PLAYERS, TARGET_RUNS, TEAMS, SEASON } = require("./config");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const mlbApi = axios.create({
  baseURL: "https://statsapi.mlb.com/api/v1",
  timeout: 15000,
});
const WINNER_STATE_PATH = path.join(__dirname, "winner-state.json");

function readLockedWinnerName() {
  try {
    const raw = fs.readFileSync(WINNER_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed?.winnerName === "string" && parsed.winnerName ? parsed.winnerName : "";
  } catch (_error) {
    return "";
  }
}

function persistWinnerName(winnerName) {
  try {
    fs.writeFileSync(
      WINNER_STATE_PATH,
      JSON.stringify(
        {
          winnerName,
          lockedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error("Failed to persist winner state:", error.message);
  }
}

function resolveLockedWinnerName(players) {
  const existingWinnerName = readLockedWinnerName();
  if (existingWinnerName) {
    return existingWinnerName;
  }

  const winnerCandidate = players
    .slice()
    .sort((a, b) => {
      if (b.acquiredCount !== a.acquiredCount) {
        return b.acquiredCount - a.acquiredCount;
      }
      if (a.neededCount !== b.neededCount) {
        return a.neededCount - b.neededCount;
      }
      return a.name.localeCompare(b.name);
    })
    .find((player) => player.acquiredCount >= 14);

  if (!winnerCandidate) {
    return "";
  }

  persistWinnerName(winnerCandidate.name);
  return winnerCandidate.name;
}

function buildTeamProgress(teamCode, games) {
  const teamInfo = TEAMS[teamCode];

  if (!teamInfo) {
    throw new Error(`Unknown team code: ${teamCode}`);
  }

  const finalGames = [];

  for (const game of games) {
    if (game.status?.abstractGameCode !== "F") {
      continue;
    }

    const isHome = game.teams?.home?.team?.id === teamInfo.id;
    const side = isHome ? game.teams?.home : game.teams?.away;
    const runs = side?.score;

    if (typeof runs !== "number") {
      continue;
    }

    finalGames.push({
      gamePk: game.gamePk,
      date: game.gameDate,
      runs,
      opponent: isHome ? game.teams?.away?.team?.name : game.teams?.home?.team?.name,
      result: side?.isWinner ? "W" : "L",
    });
  }

  const acquired = new Set(
    finalGames
      .filter((g) => TARGET_RUNS.includes(g.runs))
      .map((g) => g.runs)
  );

  return {
    code: teamCode,
    name: teamInfo.name,
    teamId: teamInfo.id,
    acquiredRuns: [...acquired].sort((a, b) => a - b),
    acquiredCount: acquired.size,
    neededCount: TARGET_RUNS.length - acquired.size,
    finalGamesTracked: finalGames.length,
    recentGames: finalGames.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
  };
}

async function fetchTeamSchedule(teamId) {
  const response = await mlbApi.get("/schedule", {
    params: {
      sportId: 1,
      season: SEASON,
      teamId,
      gameType: "R",
      hydrate: "team,linescore",
    },
  });

  const dates = response.data?.dates || [];
  return dates.flatMap((d) => d.games || []);
}

app.get("/api/scoreboard", async (_req, res) => {
  try {
    const uniqueTeamCodes = [...new Set(PLAYERS.flatMap((p) => p.teamCodes))];
    const teamGameMap = {};

    await Promise.all(
      uniqueTeamCodes.map(async (teamCode) => {
        const teamInfo = TEAMS[teamCode];
        if (!teamInfo) {
          throw new Error(`Team code ${teamCode} is not configured in TEAMS.`);
        }
        teamGameMap[teamCode] = await fetchTeamSchedule(teamInfo.id);
      })
    );

    const players = PLAYERS.map((player) => {
      const teams = player.teamCodes.map((teamCode) =>
        buildTeamProgress(teamCode, teamGameMap[teamCode] || [])
      );
      const bestTeam = teams.reduce((best, team) =>
        !best || team.acquiredCount > best.acquiredCount ? team : best
      , null);
      const bestTeamAcquired = bestTeam ? bestTeam.acquiredCount : 0;

      return {
        name: player.name,
        teams,
        acquiredCount: bestTeamAcquired,
        neededCount: TARGET_RUNS.length - bestTeamAcquired,
        bestTeamCode: bestTeam?.code || null,
        bestTeamName: bestTeam?.name || null,
      };
    });

    const winnerName = resolveLockedWinnerName(players);

    res.json({
      season: SEASON,
      targets: TARGET_RUNS,
      updatedAt: new Date().toISOString(),
      winnerName,
      players,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load MLB score data.",
      error: error.message,
    });
  }
});

app.get("/api/config", (_req, res) => {
  res.json({
    season: SEASON,
    targets: TARGET_RUNS,
    players: PLAYERS,
    teams: TEAMS,
  });
});

app.listen(PORT, () => {
  console.log(`MLB tracker API listening on http://localhost:${PORT}`);
});
