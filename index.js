document.addEventListener('DOMContentLoaded', function () {
    initNewsPage();
});

let ALL_ARTICLES = [];

async function initNewsPage() {
    const container = document.getElementById('newsGrid');
    const countBadge = document.getElementById('countBadge');
    const sourceBadge = document.getElementById('sourceBadge');

    const searchInput = document.getElementById('searchInput');
    const leagueSelect = document.getElementById('leagueSelect');
    const clearBtn = document.getElementById('clearBtn');

    renderState(container, createLoaderState(
        'Loading news',
        'Fetching NFL and NCAA articles...'
    ));

    try {
        const articles = await fetchAllNews();
        ALL_ARTICLES = articles;

        renderArticleCards(
            container,
            articles,
            'No articles',
            'No football news available right now.'
        );

        updateBadges(countBadge, sourceBadge, articles);

    } catch (error) {
        console.error('=NEWS ERROR=', error);

        renderState(container, createErrorState(
            'Failed to load news',
            'Could not fetch articles from ESPN.'
        ));

        if (countBadge) countBadge.textContent = 'Error';
        if (sourceBadge) sourceBadge.textContent = 'Unavailable';
    }

    // SEARCH + FILTER
    function applyFilters() {
        const query = searchInput.value;
        const league = leagueSelect.value;

        const filtered = filterArticles(ALL_ARTICLES, query, league);

        renderArticleCards(
            container,
            filtered,
            'No results',
            'No articles match your filters.'
        );

        if (countBadge) {
            countBadge.textContent = filtered.length + ' article' + (filtered.length !== 1 ? 's' : '');
        }
    }

    searchInput.addEventListener('input', applyFilters);
    leagueSelect.addEventListener('change', applyFilters);

    clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        leagueSelect.value = 'all';

        renderArticleCards(
            container,
            ALL_ARTICLES,
            'No articles',
            'No football news available.'
        );

        if (countBadge) {
            countBadge.textContent = ALL_ARTICLES.length + ' article' + (ALL_ARTICLES.length !== 1 ? 's' : '');
        }
    });
}

function updateBadges(countBadge, sourceBadge, articles) {
    if (countBadge) {
        countBadge.textContent = articles.length + ' article' + (articles.length !== 1 ? 's' : '');
    }

    if (sourceBadge) {
        const leagues = [...new Set(articles.map(a => a.league))];
        sourceBadge.textContent = leagues.map(l => l.toUpperCase()).join(' • ');
    }
}
