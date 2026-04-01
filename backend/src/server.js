const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { PLAYERS, TARGET_RUNS, TEAMS, SEASON } = require("./config");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const mlbApi = axios.create({
  baseURL: "https://statsapi.mlb.com/api/v1",
  timeout: 15000,
});

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

    res.json({
      season: SEASON,
      targets: TARGET_RUNS,
      updatedAt: new Date().toISOString(),
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
