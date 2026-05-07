/*
    app.js – MovieFinder application logic (Premium Edition)
    Handles OMDB API calls, search, pagination, detail modal,
    favorites, search history, theme toggle, and localStorage persistence.
*/

(function () {
    "use strict";

    // ---- config ----
    var apiKey = "f84fc31d";

    // ---- DOM refs ----
    var searchInput   = document.getElementById("search-input");
    var typeFilter    = document.getElementById("type-filter");
    var yearFilter    = document.getElementById("year-filter");
    var searchBtn     = document.getElementById("search-btn");

    var skeletonLoader = document.getElementById("skeleton-loader");
    var messageArea    = document.getElementById("message-area");
    var emptyState     = document.getElementById("empty-state");

    var resultsGrid   = document.getElementById("results-grid");
    var pagination    = document.getElementById("pagination");
    var prevBtn       = document.getElementById("prev-btn");
    var nextBtn       = document.getElementById("next-btn");
    var pageInfo      = document.getElementById("page-info");

    var modalOverlay  = document.getElementById("modal-overlay");
    var modalBody     = document.getElementById("modal-body");
    var modalClose    = document.getElementById("modal-close");

    var themeToggle   = document.getElementById("theme-toggle");
    var themeIcon     = document.getElementById("theme-icon");

    var searchHistory    = document.getElementById("search-history");
    var historyList      = document.getElementById("history-list");
    var clearHistoryBtn  = document.getElementById("clear-history-btn");

    var favoritesSection = document.getElementById("favorites-section");
    var favoritesGrid    = document.getElementById("favorites-grid");
    var toggleFavBtn     = document.getElementById("toggle-favorites-btn");

    var scrollTopBtn     = document.getElementById("scroll-top-btn");

    // ---- state ----
    var currentPage  = 1;
    var totalResults = 0;
    var lastQuery    = "";
    var lastType     = "";
    var lastYear     = "";
    var favorites    = [];
    var historyItems = [];
    var favsVisible  = false;

    // cache for detail responses
    var detailCache = {};

    // ---- init ----
    function init() {
        loadTheme();
        loadFavorites();
        loadHistory();
        restoreLastSearch();
        renderFavoritesSection();

        searchBtn.addEventListener("click", function () { doSearch(1); });
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doSearch(1);
        });
        searchInput.addEventListener("focus", showHistoryDropdown);
        searchInput.addEventListener("input", showHistoryDropdown);

        // close history dropdown when clicking outside
        document.addEventListener("click", function (e) {
            if (!searchInput.contains(e.target) && !searchHistory.contains(e.target)) {
                searchHistory.classList.add("hidden");
            }
        });

        clearHistoryBtn.addEventListener("click", function () {
            historyItems = [];
            localStorage.removeItem("omdb_search_history");
            searchHistory.classList.add("hidden");
        });

        prevBtn.addEventListener("click", function () { doSearch(currentPage - 1); });
        nextBtn.addEventListener("click", function () { doSearch(currentPage + 1); });

        modalClose.addEventListener("click", closeModal);
        modalOverlay.addEventListener("click", function (e) {
            if (e.target === modalOverlay) closeModal();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeModal();
        });

        // theme toggle
        themeToggle.addEventListener("click", toggleTheme);

        // favorites toggle
        toggleFavBtn.addEventListener("click", function () {
            favsVisible = !favsVisible;
            favoritesGrid.classList.toggle("hidden", !favsVisible);
            toggleFavBtn.textContent = favsVisible ? "Hide" : "Show";
        });

        // scroll to top
        window.addEventListener("scroll", function () {
            if (window.scrollY > 400) {
                scrollTopBtn.classList.add("visible");
                scrollTopBtn.classList.remove("hidden");
            } else {
                scrollTopBtn.classList.remove("visible");
            }
        });

        scrollTopBtn.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // ---- theme ----
    function loadTheme() {
        var saved = localStorage.getItem("omdb_theme");
        if (saved === "light") {
            document.documentElement.setAttribute("data-theme", "light");
            themeIcon.textContent = "☀️";
        }
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute("data-theme");
        if (current === "light") {
            document.documentElement.setAttribute("data-theme", "dark");
            themeIcon.textContent = "🌙";
            localStorage.setItem("omdb_theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
            themeIcon.textContent = "☀️";
            localStorage.setItem("omdb_theme", "light");
        }
    }

    // ---- favorites ----
    function loadFavorites() {
        try {
            var saved = localStorage.getItem("omdb_favorites");
            if (saved) favorites = JSON.parse(saved);
        } catch (e) { favorites = []; }
    }

    function saveFavorites() {
        localStorage.setItem("omdb_favorites", JSON.stringify(favorites));
    }

    function isFavorite(imdbID) {
        return favorites.some(function (f) { return f.imdbID === imdbID; });
    }

    function toggleFavorite(movie, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        var idx = -1;
        for (var i = 0; i < favorites.length; i++) {
            if (favorites[i].imdbID === movie.imdbID) { idx = i; break; }
        }
        if (idx >= 0) {
            favorites.splice(idx, 1);
        } else {
            favorites.push({ imdbID: movie.imdbID, Title: movie.Title, Year: movie.Year, Poster: movie.Poster, Type: movie.Type });
        }
        saveFavorites();
        renderFavoritesSection();
        // update heart buttons in results grid
        updateFavButtons();
    }

    function updateFavButtons() {
        var btns = document.querySelectorAll(".fav-btn[data-id]");
        btns.forEach(function (btn) {
            var id = btn.getAttribute("data-id");
            if (isFavorite(id)) {
                btn.classList.add("is-fav");
                btn.textContent = "❤️";
            } else {
                btn.classList.remove("is-fav");
                btn.textContent = "🤍";
            }
        });
    }

    function renderFavoritesSection() {
        if (favorites.length === 0) {
            favoritesSection.classList.add("hidden");
            return;
        }
        favoritesSection.classList.remove("hidden");
        favoritesGrid.innerHTML = "";

        favorites.forEach(function (m) {
            var card = createMovieCard(m, true);
            favoritesGrid.appendChild(card);
        });
    }

    // ---- search history ----
    function loadHistory() {
        try {
            var saved = localStorage.getItem("omdb_search_history");
            if (saved) historyItems = JSON.parse(saved);
        } catch (e) { historyItems = []; }
    }

    function addToHistory(query) {
        // remove duplicate if exists
        historyItems = historyItems.filter(function (h) { return h.toLowerCase() !== query.toLowerCase(); });
        historyItems.unshift(query);
        if (historyItems.length > 8) historyItems = historyItems.slice(0, 8);
        localStorage.setItem("omdb_search_history", JSON.stringify(historyItems));
    }

    function showHistoryDropdown() {
        if (historyItems.length === 0) {
            searchHistory.classList.add("hidden");
            return;
        }
        var filterText = searchInput.value.trim().toLowerCase();
        var filtered = historyItems.filter(function (h) {
            return !filterText || h.toLowerCase().indexOf(filterText) >= 0;
        });
        if (filtered.length === 0) {
            searchHistory.classList.add("hidden");
            return;
        }
        historyList.innerHTML = "";
        filtered.forEach(function (term) {
            var li = document.createElement("li");
            li.textContent = term;
            li.addEventListener("click", function () {
                searchInput.value = term;
                searchHistory.classList.add("hidden");
                doSearch(1);
            });
            historyList.appendChild(li);
        });
        searchHistory.classList.remove("hidden");
    }

    // ---- search ----
    function doSearch(page) {
        var query = searchInput.value.trim();
        if (!query) {
            showMessage("Please enter a movie name to search.", "info");
            return;
        }

        currentPage = page;
        lastQuery = query;
        lastType  = typeFilter.value;
        lastYear  = yearFilter.value;

        // persist & add to history
        persistSearch();
        addToHistory(query);
        searchHistory.classList.add("hidden");

        // build URL
        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(apiKey)
            + "&s=" + encodeURIComponent(query)
            + "&page=" + currentPage;

        if (lastType) url += "&type=" + lastType;
        if (lastYear) url += "&y=" + lastYear;

        hideMessage();
        emptyState.classList.add("hidden");
        showSkeleton();
        clearResults();

        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                hideSkeleton();
                if (data.Response === "False") {
                    showMessage(data.Error || "No results found.", "error");
                    hidePagination();
                    return;
                }
                totalResults = parseInt(data.totalResults, 10) || 0;
                renderResults(data.Search);
                updatePagination();
            })
            .catch(function (err) {
                hideSkeleton();
                showMessage("Network error – please try again. (" + err.message + ")", "error");
            });
    }

    // ---- create movie card (reused for results & favorites) ----
    function createMovieCard(m, isFavCard) {
        var card = document.createElement("div");
        card.className = "movie-card";
        card.setAttribute("tabindex", "0");

        var hasPoster = m.Poster && m.Poster !== "N/A";

        // badges
        var badgesHtml = '<div class="card-badges">';
        if (m.Type) {
            badgesHtml += '<span class="badge badge-type">' + escapeHtml(m.Type) + '</span>';
        }
        if (m.Year) {
            badgesHtml += '<span class="badge badge-year">' + escapeHtml(m.Year) + '</span>';
        }
        badgesHtml += '</div>';

        // favorite button
        var isFav = isFavorite(m.imdbID);
        var favHtml = '<button class="fav-btn' + (isFav ? ' is-fav' : '') + '" data-id="' + escapeHtml(m.imdbID) + '">' + (isFav ? '❤️' : '🤍') + '</button>';

        // poster
        var posterHtml;
        if (hasPoster) {
            posterHtml = '<img src="' + escapeHtml(m.Poster) + '" alt="' + escapeHtml(m.Title) + '" loading="lazy" onerror="this.outerHTML=\'<div class=no-poster>No Poster</div>\'">';
        } else {
            posterHtml = '<div class="no-poster">No Poster</div>';
        }

        card.innerHTML = badgesHtml + favHtml + posterHtml +
            '<div class="card-info"><h3>' + escapeHtml(m.Title) + '</h3><span>' + escapeHtml(m.Year) + '</span></div>';

        // stagger animation
        card.style.animationDelay = "0s";

        // click to open detail
        card.addEventListener("click", function () { openDetail(m.imdbID); });
        card.addEventListener("keydown", function (e) {
            if (e.key === "Enter") openDetail(m.imdbID);
        });

        // favorite button event
        var favBtn = card.querySelector(".fav-btn");
        favBtn.addEventListener("click", function (e) {
            toggleFavorite(m, e);
        });

        return card;
    }

    // ---- render search results ----
    function renderResults(movies) {
        resultsGrid.innerHTML = "";
        emptyState.classList.add("hidden");

        movies.forEach(function (m, i) {
            var card = createMovieCard(m, false);
            // staggered animation delay
            card.style.animationDelay = (i * 0.06) + "s";
            resultsGrid.appendChild(card);
        });
    }

    // ---- detail modal ----
    function openDetail(imdbID) {
        if (detailCache[imdbID]) {
            renderDetail(detailCache[imdbID]);
            return;
        }

        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(apiKey)
            + "&i=" + encodeURIComponent(imdbID) + "&plot=full";

        modalBody.innerHTML = '<div style="text-align:center;padding:50px"><div class="spinner"></div></div>';
        modalOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.Response === "False") {
                    modalBody.innerHTML = '<p style="color:var(--danger);padding:20px">Could not load movie details.</p>';
                    return;
                }
                detailCache[imdbID] = data;
                renderDetail(data);
            })
            .catch(function () {
                modalBody.innerHTML = '<p style="color:var(--danger);padding:20px">Network error while fetching details.</p>';
            });
    }

    function renderDetail(d) {
        var hasPoster = d.Poster && d.Poster !== "N/A";

        var ratingsHtml = "";
        if (d.Ratings && d.Ratings.length) {
            d.Ratings.forEach(function (r) {
                ratingsHtml += '<span class="rating-badge"><strong>' + escapeHtml(r.Value) + '</strong> ' + escapeHtml(r.Source) + '</span>';
            });
        }

        var posterBlock = hasPoster
            ? '<div class="detail-poster"><img src="' + escapeHtml(d.Poster) + '" alt="' + escapeHtml(d.Title) + '"></div>'
            : '<div class="detail-poster"><div class="no-poster" style="height:330px">No Poster</div></div>';

        var html =
            '<div class="detail-top">' +
                posterBlock +
                '<div class="detail-info">' +
                    '<h2>' + escapeHtml(d.Title) + '</h2>' +
                    '<div class="meta">' +
                        '<span>' + escapeHtml(d.Year) + '</span>' +
                        '<span>' + escapeHtml(d.Rated || "N/A") + '</span>' +
                        '<span>' + escapeHtml(d.Runtime || "N/A") + '</span>' +
                    '</div>' +
                    (ratingsHtml ? '<div class="rating-row">' + ratingsHtml + '</div>' : '') +
                    '<div class="detail-row"><strong>Genre:</strong> ' + escapeHtml(d.Genre || "N/A") + '</div>' +
                    '<div class="detail-row"><strong>Director:</strong> ' + escapeHtml(d.Director || "N/A") + '</div>' +
                    '<div class="detail-row"><strong>Writer:</strong> ' + escapeHtml(d.Writer || "N/A") + '</div>' +
                    '<div class="detail-row"><strong>Actors:</strong> ' + escapeHtml(d.Actors || "N/A") + '</div>' +
                    (d.BoxOffice ? '<div class="detail-row"><strong>Box Office:</strong> ' + escapeHtml(d.BoxOffice) + '</div>' : '') +
                    (d.Awards && d.Awards !== "N/A" ? '<div class="detail-row"><strong>Awards:</strong> ' + escapeHtml(d.Awards) + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="detail-row plot-text"><strong>Plot:</strong> ' + escapeHtml(d.Plot || "N/A") + '</div>';

        modalBody.innerHTML = html;
        modalOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modalOverlay.classList.add("hidden");
        modalBody.innerHTML = "";
        document.body.style.overflow = "";
    }

    // ---- pagination ----
    function updatePagination() {
        var totalPages = Math.ceil(totalResults / 10);
        if (totalPages <= 1) {
            hidePagination();
            return;
        }
        pagination.classList.remove("hidden");
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        pageInfo.textContent = "Page " + currentPage + " / " + totalPages + "  (" + totalResults + " results)";
    }

    function hidePagination() {
        pagination.classList.add("hidden");
    }

    // ---- localStorage persistence ----
    function persistSearch() {
        var state = {
            query: lastQuery,
            type: lastType,
            year: lastYear,
            page: currentPage
        };
        localStorage.setItem("omdb_last_search", JSON.stringify(state));
    }

    function restoreLastSearch() {
        var saved = localStorage.getItem("omdb_last_search");
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (state.query) {
                searchInput.value = state.query;
                typeFilter.value  = state.type || "";
                yearFilter.value  = state.year || "";
                currentPage = state.page || 1;
                lastQuery = state.query;
                lastType  = state.type || "";
                lastYear  = state.year || "";
                doSearch(currentPage);
            }
        } catch (e) {
            // corrupt data, ignore
        }
    }

    // ---- UI helpers ----
    function showSkeleton() { skeletonLoader.classList.remove("hidden"); }
    function hideSkeleton() { skeletonLoader.classList.add("hidden"); }

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = type;
        messageArea.classList.remove("hidden");
    }

    function hideMessage() { messageArea.classList.add("hidden"); }

    function clearResults() {
        resultsGrid.innerHTML = "";
        hidePagination();
    }

    // basic XSS prevention for injected content
    function escapeHtml(str) {
        if (!str) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ---- spinner (for modal loading) ----
    var style = document.createElement("style");
    style.textContent = ".spinner{width:40px;height:40px;border:4px solid var(--border-subtle);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);

    // run
    init();
})();
