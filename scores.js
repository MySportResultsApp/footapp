document.addEventListener('DOMContentLoaded', function () {
    initScoresPage();
});

let ALL_GAMES = [];

async function initScoresPage() {
    const container = document.getElementById('scoresGrid');
    const gamesCountBadge = document.getElementById('gamesCountBadge');
    const liveCountBadge = document.getElementById('liveCountBadge');

    const leagueSelect = document.getElementById('leagueSelect');
    const statusSelect = document.getElementById('statusSelect');
    const clearBtn = document.getElementById('clearBtn');

    renderState(container, createLoaderState(
        'Loading scores',
        'Fetching NFL and NCAA football games...'
    ));

    try {
        const games = await fetchAllScores();
        ALL_GAMES = games;

        renderScoreCards(
            container,
            games,
            'No games found',
            'No football games are available right now.'
        );

        updateScoreBadges(gamesCountBadge, liveCountBadge, games);
    } catch (error) {
        console.error('=SCORES ERROR=', error);

        renderState(container, createErrorState(
            'Failed to load scores',
            'Could not fetch NFL and NCAA scoreboard data from ESPN.'
        ));

        if (gamesCountBadge) {
            gamesCountBadge.textContent = 'Error';
        }

        if (liveCountBadge) {
            liveCountBadge.textContent = 'Unavailable';
        }
    }

    function applyFilters() {
        const league = leagueSelect.value;
        const status = statusSelect.value;

        const filtered = filterScores(ALL_GAMES, league, status);

        renderScoreCards(
            container,
            filtered,
            'No matching games',
            'No games match the selected filters.'
        );

        if (gamesCountBadge) {
            gamesCountBadge.textContent = filtered.length + ' game' + (filtered.length !== 1 ? 's' : '');
        }

        if (liveCountBadge) {
            const liveCount = filtered.filter(function (game) {
                return game.statusCategory === 'live';
            }).length;

            liveCountBadge.textContent = liveCount + ' live';
        }
    }

    leagueSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);

    clearBtn.addEventListener('click', function () {
        leagueSelect.value = 'all';
        statusSelect.value = 'all';

        renderScoreCards(
            container,
            ALL_GAMES,
            'No games found',
            'No football games are available right now.'
        );

        updateScoreBadges(gamesCountBadge, liveCountBadge, ALL_GAMES);
    });
}

function updateScoreBadges(gamesCountBadge, liveCountBadge, games) {
    if (gamesCountBadge) {
        gamesCountBadge.textContent = games.length + ' game' + (games.length !== 1 ? 's' : '');
    }

    if (liveCountBadge) {
        const liveCount = games.filter(function (game) {
            return game.statusCategory === 'live';
        }).length;

        liveCountBadge.textContent = liveCount + ' live';
    }
}
