const API = {
    nflNews: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news',
    ncaaNews: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/news',
    nflScoreboard: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    ncaaScoreboard: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
};

const APP = {
    timeoutMs: 16000,
    ncaaGroups: '80',
    ncaaLimit: '200',
    defaultNewsLimit: 24,
    defaultScoresLimit: 24
};

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function buildUrl(base, params) {
    const url = new URL(base);

    if (params && typeof params === 'object') {
        Object.keys(params).forEach(function (key) {
            const value = params[key];

            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });
    }

    return url.toString();
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function getObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function setActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('[data-nav]');

    links.forEach(function (link) {
        const href = link.getAttribute('href') || '';
        link.classList.toggle('active', href === page);
    });
}

function formatDisplayDateTime(dateString) {
    if (!dateString) {
        return 'Unknown time';
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDisplayDate(dateString) {
    if (!dateString) {
        return 'Unknown date';
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function createLoaderState(title, text) {
    return `
        <div class="state-box">
            <div class="loader"></div>
            <div class="state-title">${escapeHtml(title || 'Loading')}</div>
            <div class="state-text">${escapeHtml(text || 'Please wait.')}</div>
        </div>
    `;
}

function createEmptyState(title, text) {
    return `
        <div class="state-box">
            <div class="state-title">${escapeHtml(title || 'Nothing found')}</div>
            <div class="state-text">${escapeHtml(text || 'No items found.')}</div>
        </div>
    `;
}

function createErrorState(title, text) {
    return `
        <div class="state-box">
            <div class="state-title">${escapeHtml(title || 'Failed to load')}</div>
            <div class="state-text">${escapeHtml(text || 'The data source did not respond.')}</div>
        </div>
    `;
}

function renderState(container, html) {
    if (!container) {
        return;
    }

    container.innerHTML = html;
}

async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(function () {
        controller.abort();
    }, APP.timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error('Request failed: ' + response.status);
        }

        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function normalizeNewsArticle(article, leagueKey) {
    const item = getObject(article);
    const images = normalizeArray(item.images);
    const links = normalizeArray(item.links);
    const firstLink = getObject(links[0]);

    return {
        id: String(item.id || item.guid || item.link || item.headline || Math.random()),
        league: leagueKey,
        title: item.headline || item.title || 'Untitled article',
        description: item.description || item.story || '',
        published: item.published || item.lastModified || '',
        image: getObject(images[0]).url || '',
        link: firstLink.web || item.link || '',
        byline: item.byline || ''
    };
}

async function fetchLeagueNews(leagueKey) {
    const url = leagueKey === 'nfl' ? API.nflNews : API.ncaaNews;
    const data = await fetchJsonWithTimeout(url);
    const articles = normalizeArray(getObject(data).articles);

    return articles.map(function (article) {
        return normalizeNewsArticle(article, leagueKey);
    });
}

async function fetchAllNews() {
    const results = await Promise.allSettled([
        fetchLeagueNews('nfl'),
        fetchLeagueNews('ncaa')
    ]);

    const merged = [];

    results.forEach(function (result) {
        if (result.status === 'fulfilled') {
            merged.push.apply(merged, result.value);
        }
    });

    if (merged.length === 0) {
        throw new Error('No news feeds returned data');
    }

    return dedupeArticles(sortArticlesByDate(merged)).slice(0, APP.defaultNewsLimit);
}

function sortArticlesByDate(items) {
    return items.slice().sort(function (a, b) {
        const first = new Date(a.published).getTime();
        const second = new Date(b.published).getTime();

        if (Number.isNaN(first) && Number.isNaN(second)) {
            return 0;
        }

        if (Number.isNaN(first)) {
            return 1;
        }

        if (Number.isNaN(second)) {
            return -1;
        }

        return second - first;
    });
}

function dedupeArticles(items) {
    const seen = new Set();
    const result = [];

    items.forEach(function (item) {
        const key = (item.link || '') + '|' + (item.title || '');

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        result.push(item);
    });

    return result;
}

function filterArticles(items, query, leagueFilter) {
    const safeQuery = String(query || '').trim().toLowerCase();
    const safeLeague = String(leagueFilter || '').trim().toLowerCase();

    return items.filter(function (article) {
        const matchLeague = !safeLeague || safeLeague === 'all' || String(article.league || '').toLowerCase() === safeLeague;

        if (!matchLeague) {
            return false;
        }

        if (!safeQuery) {
            return true;
        }

        const haystack = [
            article.title,
            article.description,
            article.byline,
            article.league
        ].join(' ').toLowerCase();

        return haystack.includes(safeQuery);
    });
}

function renderArticleCard(article) {
    const leagueLabel = article.league === 'nfl' ? 'NFL' : 'NCAA';
    const imageBlock = article.image
        ? `
            <a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer" class="article-image-link">
                <img class="article-image" src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="lazy">
            </a>
        `
        : `
            <div class="article-image article-image-placeholder">
                <span>${escapeHtml(leagueLabel)}</span>
            </div>
        `;

    return `
        <article class="card article-card">
            ${imageBlock}
            <div class="card-body">
                <div class="badge ${article.league === 'nfl' ? 'green' : ''}">${escapeHtml(leagueLabel)}</div>
                <div class="article-title">${escapeHtml(article.title)}</div>
                <div class="article-meta">
                    ${article.published ? escapeHtml(formatDisplayDateTime(article.published)) : ''}
                    ${article.byline ? ' • ' + escapeHtml(article.byline) : ''}
                </div>
                <div class="article-desc">${escapeHtml(article.description || 'Open the article to read more.')}</div>
                <a class="article-link" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">Open Article</a>
            </div>
        </article>
    `;
}

function renderArticleCards(container, articles, emptyTitle, emptyText) {
    if (!container) {
        return;
    }

    if (!articles || articles.length === 0) {
        renderState(container, createEmptyState(emptyTitle, emptyText));
        return;
    }

    container.innerHTML = articles.map(renderArticleCard).join('');
}

function getCompetitorsFromEvent(event) {
    const competitions = normalizeArray(getObject(event).competitions);
    const competition = getObject(competitions[0]);
    return normalizeArray(competition.competitors);
}

function getCompetitionFromEvent(event) {
    const competitions = normalizeArray(getObject(event).competitions);
    return getObject(competitions[0]);
}

function getCompetitorByHomeAway(event, side) {
    const competitors = getCompetitorsFromEvent(event);

    return competitors.find(function (competitor) {
        return String(getObject(competitor).homeAway || '').toLowerCase() === side;
    }) || competitors[side === 'home' ? 1 : 0] || {};
}

function getTeamName(competitor) {
    const team = getObject(getObject(competitor).team);

    return (
        team.displayName ||
        team.shortDisplayName ||
        team.name ||
        getObject(competitor).displayName ||
        'Team'
    );
}

function getTeamAbbreviation(competitor) {
    const team = getObject(getObject(competitor).team);

    return (
        team.abbreviation ||
        team.shortDisplayName ||
        getTeamName(competitor)
    );
}

function getTeamScore(competitor) {
    const score = getObject(competitor).score;

    if (score === null || score === undefined || score === '') {
        return '-';
    }

    return String(score);
}

function getTeamRecord(competitor) {
    const records = normalizeArray(getObject(competitor).records);
    const first = getObject(records[0]);

    return first.summary || first.displayValue || '';
}

function getStatusText(event) {
    const status = getObject(getObject(event).status);
    const type = getObject(status.type);

    return type.detail || type.shortDetail || type.description || 'Status unavailable';
}

function getStatusCategory(event) {
    const status = getObject(getObject(event).status);
    const type = getObject(status.type);
    const state = String(type.state || type.name || '').toLowerCase();
    const completed = Boolean(type.completed);

    if (completed || state.includes('post') || state.includes('final')) {
        return 'final';
    }

    if (state.includes('in') || state.includes('live')) {
        return 'live';
    }

    return 'upcoming';
}

function getLeagueLabel(leagueKey) {
    return leagueKey === 'nfl' ? 'NFL' : 'NCAA';
}

function normalizeScoreEvent(event, leagueKey) {
    const item = getObject(event);
    const competition = getCompetitionFromEvent(item);
    const home = getCompetitorByHomeAway(item, 'home');
    const away = getCompetitorByHomeAway(item, 'away');
    const venue = getObject(competition.venue);
    const broadcast = normalizeArray(competition.broadcasts)[0] || {};
    const week = getObject(item.week);

    return {
        id: String(item.id || ''),
        league: leagueKey,
        name: item.name || item.shortName || 'Game',
        shortName: item.shortName || item.name || 'Game',
        date: item.date || '',
        statusText: getStatusText(item),
        statusCategory: getStatusCategory(item),
        weekText: week.text || '',
        venue: venue.fullName || '',
        broadcast: getObject(broadcast).names ? normalizeArray(getObject(broadcast).names).join(', ') : '',
        home: {
            name: getTeamName(home),
            shortName: getTeamAbbreviation(home),
            score: getTeamScore(home),
            record: getTeamRecord(home)
        },
        away: {
            name: getTeamName(away),
            shortName: getTeamAbbreviation(away),
            score: getTeamScore(away),
            record: getTeamRecord(away)
        }
    };
}

async function fetchLeagueScores(leagueKey) {
    const url = leagueKey === 'nfl'
        ? buildUrl(API.nflScoreboard, { limit: APP.defaultScoresLimit })
        : buildUrl(API.ncaaScoreboard, { groups: APP.ncaaGroups, limit: APP.ncaaLimit });

    const data = await fetchJsonWithTimeout(url);
    const events = normalizeArray(getObject(data).events);

    return events.map(function (event) {
        return normalizeScoreEvent(event, leagueKey);
    });
}

async function fetchAllScores() {
    const results = await Promise.allSettled([
        fetchLeagueScores('nfl'),
        fetchLeagueScores('ncaa')
    ]);

    const merged = [];

    results.forEach(function (result) {
        if (result.status === 'fulfilled') {
            merged.push.apply(merged, result.value);
        }
    });

    if (merged.length === 0) {
        throw new Error('No scoreboards returned data');
    }

    return sortScoresByDate(merged);
}

function sortScoresByDate(items) {
    return items.slice().sort(function (a, b) {
        const first = new Date(a.date).getTime();
        const second = new Date(b.date).getTime();

        if (Number.isNaN(first) && Number.isNaN(second)) {
            return 0;
        }

        if (Number.isNaN(first)) {
            return 1;
        }

        if (Number.isNaN(second)) {
            return -1;
        }

        return first - second;
    });
}

function splitScoresByStatus(items) {
    const groups = {
        live: [],
        upcoming: [],
        final: []
    };

    items.forEach(function (item) {
        const category = item.statusCategory || 'upcoming';

        if (groups[category]) {
            groups[category].push(item);
        } else {
            groups.upcoming.push(item);
        }
    });

    return groups;
}

function filterScores(items, leagueFilter, tabFilter) {
    const safeLeague = String(leagueFilter || '').trim().toLowerCase();
    const safeTab = String(tabFilter || '').trim().toLowerCase();

    return items.filter(function (item) {
        const matchLeague = !safeLeague || safeLeague === 'all' || String(item.league || '').toLowerCase() === safeLeague;
        const matchTab = !safeTab || safeTab === 'all' || String(item.statusCategory || '').toLowerCase() === safeTab;

        return matchLeague && matchTab;
    });
}

function renderScoreCard(game) {
    const leagueLabel = getLeagueLabel(game.league);
    const metaParts = [];

    if (game.weekText) {
        metaParts.push(game.weekText);
    }

    if (game.venue) {
        metaParts.push(game.venue);
    }

    if (game.broadcast) {
        metaParts.push(game.broadcast);
    }

    return `
        <article class="card score-card">
            <div class="card-body">
                <div class="score-top">
                    <div class="score-status ${escapeHtml(game.statusCategory)}">
                        ${game.statusCategory === 'live' ? '<span class="dot-live"></span>' : ''}
                        <span>${escapeHtml(game.statusText)}</span>
                    </div>
                    <div class="score-time">${escapeHtml(formatDisplayDateTime(game.date))}</div>
                </div>

                <div class="badge ${game.league === 'nfl' ? 'green' : ''}">${escapeHtml(leagueLabel)}</div>

                <div class="teams">
                    <div class="team-row">
                        <div class="team-main">
                            <div class="team-name">${escapeHtml(game.away.name)}</div>
                            <div class="team-extra">${escapeHtml(game.away.record || '')}</div>
                        </div>
                        <div class="team-score">${escapeHtml(game.away.score)}</div>
                    </div>

                    <div class="team-row">
                        <div class="team-main">
                            <div class="team-name">${escapeHtml(game.home.name)}</div>
                            <div class="team-extra">${escapeHtml(game.home.record || '')}</div>
                        </div>
                        <div class="team-score">${escapeHtml(game.home.score)}</div>
                    </div>
                </div>

                <div class="score-meta">${escapeHtml(metaParts.join(' • '))}</div>
            </div>
        </article>
    `;
}

function renderScoreCards(container, items, emptyTitle, emptyText) {
    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        renderState(container, createEmptyState(emptyTitle, emptyText));
        return;
    }

    container.innerHTML = items.map(renderScoreCard).join('');
}

document.addEventListener('DOMContentLoaded', function () {
    setActiveNav();
});
