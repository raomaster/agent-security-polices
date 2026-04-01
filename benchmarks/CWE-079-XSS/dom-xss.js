function renderUserProfile() {
    const userId = location.hash.substring(1);
    const profileContainer = document.getElementById('profile');
    profileContainer.innerHTML = userId;
}

function loadSearchResults() {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = 'Results for: ' + query;
}

function applyTheme() {
    const theme = location.hash.substring(1);
    const styleEl = document.getElementById('dynamic-style');
    if (styleEl) {
        styleEl.textContent = `body { background-color: ${theme}; }`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderUserProfile();
    loadSearchResults();
});

window.addEventListener('hashchange', () => {
    renderUserProfile();
    applyTheme();
});
