/*
    app.js – MovieFinder application logic (Premium Edition)
    OMDB API search, favorites, history, themes, skeleton loading, particles.
*/

(function () {
    "use strict";

    var API_KEY = "f84fc31d";

    /* ---- DOM refs ---- */
    var searchInput      = document.getElementById("search-input");
    var typeFilter       = document.getElementById("type-filter");
    var yearFilter       = document.getElementById("year-filter");
    var searchBtn        = document.getElementById("search-btn");
    var skeletonLoader   = document.getElementById("skeleton-loader");
    var skeletonGrid     = document.getElementById("skeleton-grid");
    var messageArea      = document.getElementById("message-area");
    var emptyState       = document.getElementById("empty-state");
    var resultsGrid      = document.getElementById("results-grid");
    var pagination       = document.getElementById("pagination");
    var prevBtn          = document.getElementById("prev-btn");
    var nextBtn          = document.getElementById("next-btn");
    var pageInfo         = document.getElementById("page-info");
    var modalOverlay     = document.getElementById("modal-overlay");
    var modalBody        = document.getElementById("modal-body");
    var modalClose       = document.getElementById("modal-close");
    var themeToggle      = document.getElementById("theme-toggle");
    var themeIconDark    = document.getElementById("theme-icon-dark");
    var themeIconLight   = document.getElementById("theme-icon-light");
    var searchHistoryEl  = document.getElementById("search-history");
    var historyList      = document.getElementById("history-list");
    var clearHistoryBtn  = document.getElementById("clear-history-btn");
    var favSection       = document.getElementById("favorites-section");
    var favGrid          = document.getElementById("favorites-grid");
    var toggleFavBtn     = document.getElementById("toggle-favorites-btn");
    var scrollTopBtn     = document.getElementById("scroll-top-btn");
    var bgParticles      = document.getElementById("bg-particles");

    /* ---- state ---- */
    var currentPage  = 1;
    var totalResults = 0;
    var lastQuery    = "";
    var lastType     = "";
    var lastYear     = "";
    var favorites    = [];
    var history      = [];
    var favsOpen     = false;
    var detailCache  = {};

    /* ========== INIT ========== */
    function init() {
        createParticles();
        buildSkeletons();
        loadTheme();
        loadFavorites();
        loadHistory();
        renderFavorites();
        restoreLastSearch();

        searchBtn.addEventListener("click", function () { doSearch(1); });
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { doSearch(1); }
        });
        searchInput.addEventListener("focus", showHistory);
        searchInput.addEventListener("input", showHistory);

        document.addEventListener("click", function (e) {
            if (!searchInput.contains(e.target) && !searchHistoryEl.contains(e.target)) {
                searchHistoryEl.classList.add("hidden");
            }
        });

        clearHistoryBtn.addEventListener("click", function () {
            history = [];
            localStorage.removeItem("mf_history");
            searchHistoryEl.classList.add("hidden");
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

        themeToggle.addEventListener("click", toggleTheme);

        toggleFavBtn.addEventListener("click", function () {
            favsOpen = !favsOpen;
            favGrid.classList.toggle("hidden", !favsOpen);
            toggleFavBtn.textContent = favsOpen ? "Hide" : "Show";
        });

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

    /* ========== PARTICLES ========== */
    function createParticles() {
        var colors = ["rgba(124,106,239,.25)", "rgba(0,210,211,.2)", "rgba(255,107,107,.15)"];
        for (var i = 0; i < 20; i++) {
            var p = document.createElement("div");
            p.className = "particle";
            var size = Math.random() * 6 + 2;
            p.style.width = size + "px";
            p.style.height = size + "px";
            p.style.left = Math.random() * 100 + "%";
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDelay = (Math.random() * 18) + "s";
            p.style.animationDuration = (Math.random() * 12 + 12) + "s";
            bgParticles.appendChild(p);
        }
    }

    /* ========== SKELETONS ========== */
    function buildSkeletons() {
        var html = "";
        for (var i = 0; i < 8; i++) {
            html += '<div class="skeleton-card">' +
                '<div class="skel-img"></div>' +
                '<div class="skel-title"></div>' +
                '<div class="skel-year"></div>' +
                '</div>';
        }
        skeletonGrid.innerHTML = html;
    }

    /* ========== THEME ========== */
    function loadTheme() {
        var t = localStorage.getItem("mf_theme");
        applyTheme(t === "light" ? "light" : "dark");
    }

    function toggleTheme() {
        var cur = document.documentElement.getAttribute("data-theme");
        applyTheme(cur === "light" ? "dark" : "light");
    }

    function applyTheme(t) {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem("mf_theme", t);
        if (t === "light") {
            themeIconDark.classList.add("hidden");
            themeIconLight.classList.remove("hidden");
        } else {
            themeIconDark.classList.remove("hidden");
            themeIconLight.classList.add("hidden");
        }
    }

    /* ========== FAVORITES ========== */
    function loadFavorites() {
        try { var s = localStorage.getItem("mf_favs"); if (s) favorites = JSON.parse(s); } catch(e) { favorites = []; }
    }

    function saveFavorites() {
        localStorage.setItem("mf_favs", JSON.stringify(favorites));
    }

    function isFav(id) {
        for (var i = 0; i < favorites.length; i++) { if (favorites[i].imdbID === id) return true; }
        return false;
    }

    function toggleFav(movie, evt) {
        if (evt) { evt.stopPropagation(); evt.preventDefault(); }
        var idx = -1;
        for (var i = 0; i < favorites.length; i++) {
            if (favorites[i].imdbID === movie.imdbID) { idx = i; break; }
        }
        if (idx >= 0) {
            favorites.splice(idx, 1);
        } else {
            favorites.push({
                imdbID: movie.imdbID,
                Title: movie.Title,
                Year: movie.Year,
                Poster: movie.Poster,
                Type: movie.Type
            });
        }
        saveFavorites();
        renderFavorites();
        refreshFavBtns();
    }

    function refreshFavBtns() {
        var btns = document.querySelectorAll(".fav-btn[data-imdb]");
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var id = b.getAttribute("data-imdb");
            if (isFav(id)) {
                b.classList.add("active");
                b.innerHTML = "&#10084;";
            } else {
                b.classList.remove("active");
                b.innerHTML = "&#9825;";
            }
        }
    }

    function renderFavorites() {
        if (favorites.length === 0) {
            favSection.classList.add("hidden");
            return;
        }
        favSection.classList.remove("hidden");
        favGrid.innerHTML = "";
        for (var i = 0; i < favorites.length; i++) {
            favGrid.appendChild(buildCard(favorites[i], i));
        }
    }

    /* ========== SEARCH HISTORY ========== */
    function loadHistory() {
        try { var s = localStorage.getItem("mf_history"); if (s) history = JSON.parse(s); } catch(e) { history = []; }
    }

    function pushHistory(q) {
        var lower = q.toLowerCase();
        history = history.filter(function (h) { return h.toLowerCase() !== lower; });
        history.unshift(q);
        if (history.length > 8) history = history.slice(0, 8);
        localStorage.setItem("mf_history", JSON.stringify(history));
    }

    function showHistory() {
        if (history.length === 0) { searchHistoryEl.classList.add("hidden"); return; }
        var filter = searchInput.value.trim().toLowerCase();
        var list = history.filter(function (h) {
            return !filter || h.toLowerCase().indexOf(filter) >= 0;
        });
        if (list.length === 0) { searchHistoryEl.classList.add("hidden"); return; }

        historyList.innerHTML = "";
        for (var i = 0; i < list.length; i++) {
            (function (term) {
                var li = document.createElement("li");
                li.textContent = term;
                li.addEventListener("click", function () {
                    searchInput.value = term;
                    searchHistoryEl.classList.add("hidden");
                    doSearch(1);
                });
                historyList.appendChild(li);
            })(list[i]);
        }
        searchHistoryEl.classList.remove("hidden");
    }

    /* ========== SEARCH ========== */
    function doSearch(page) {
        var q = searchInput.value.trim();
        if (!q) { showMsg("Please enter a movie name to search.", "info"); return; }

        currentPage = page;
        lastQuery = q;
        lastType  = typeFilter.value;
        lastYear  = yearFilter.value;

        persistSearch();
        pushHistory(q);
        searchHistoryEl.classList.add("hidden");

        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(API_KEY)
            + "&s=" + encodeURIComponent(q)
            + "&page=" + currentPage;
        if (lastType) url += "&type=" + lastType;
        if (lastYear) url += "&y="    + lastYear;

        hideMsg();
        emptyState.classList.add("hidden");
        skeletonLoader.classList.remove("hidden");
        clearResults();

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                skeletonLoader.classList.add("hidden");
                if (d.Response === "False") {
                    showMsg(d.Error || "No results found.", "error");
                    pagination.classList.add("hidden");
                    return;
                }
                totalResults = parseInt(d.totalResults, 10) || 0;
                renderResults(d.Search);
                updatePagination();
            })
            .catch(function (err) {
                skeletonLoader.classList.add("hidden");
                showMsg("Network error – " + err.message, "error");
            });
    }

    /* ========== BUILD CARD ========== */
    function buildCard(m, index) {
        var card = document.createElement("div");
        card.className = "movie-card";
        card.setAttribute("tabindex", "0");
        card.style.animationDelay = (index * 0.06) + "s";

        var poster = (m.Poster && m.Poster !== "N/A");
        var fav = isFav(m.imdbID);

        var html = '<div class="card-badges">';
        if (m.Type) html += '<span class="badge badge-type">' + esc(m.Type) + '</span>';
        if (m.Year) html += '<span class="badge badge-year">' + esc(m.Year) + '</span>';
        html += '</div>';

        html += '<button class="fav-btn' + (fav ? ' active' : '') + '" data-imdb="' + esc(m.imdbID) + '">' + (fav ? '&#10084;' : '&#9825;') + '</button>';

        html += '<div class="poster-wrap">';
        if (poster) {
            html += '<img src="' + esc(m.Poster) + '" alt="' + esc(m.Title) + '" loading="lazy"'
                + ' onerror="this.parentNode.innerHTML=\'<div class=no-poster>No Poster</div>\'">';
        } else {
            html += '<div class="no-poster">No Poster</div>';
        }
        html += '</div>';

        html += '<div class="card-info"><h3>' + esc(m.Title) + '</h3><span>' + esc(m.Year) + '</span></div>';

        card.innerHTML = html;

        card.addEventListener("click", function () { openDetail(m.imdbID); });
        card.addEventListener("keydown", function (e) { if (e.key === "Enter") openDetail(m.imdbID); });

        var fb = card.querySelector(".fav-btn");
        fb.addEventListener("click", function (e) { toggleFav(m, e); });

        return card;
    }

    /* ========== RENDER RESULTS ========== */
    function renderResults(movies) {
        resultsGrid.innerHTML = "";
        emptyState.classList.add("hidden");
        for (var i = 0; i < movies.length; i++) {
            resultsGrid.appendChild(buildCard(movies[i], i));
        }
    }

    /* ========== DETAIL MODAL ========== */
    function openDetail(id) {
        if (detailCache[id]) { renderDetail(detailCache[id]); return; }

        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(API_KEY)
            + "&i=" + encodeURIComponent(id) + "&plot=full";

        modalBody.innerHTML = '<div style="text-align:center;padding:50px"><div class="spinner"></div></div>';
        modalOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.Response === "False") {
                    modalBody.innerHTML = '<p style="color:var(--danger);padding:24px">Could not load details.</p>';
                    return;
                }
                detailCache[id] = d;
                renderDetail(d);
            })
            .catch(function () {
                modalBody.innerHTML = '<p style="color:var(--danger);padding:24px">Network error.</p>';
            });
    }

    function renderDetail(d) {
        var poster = (d.Poster && d.Poster !== "N/A");
        var ratings = "";
        if (d.Ratings && d.Ratings.length) {
            for (var i = 0; i < d.Ratings.length; i++) {
                var r = d.Ratings[i];
                ratings += '<span class="rating-badge"><strong>' + esc(r.Value) + '</strong> ' + esc(r.Source) + '</span>';
            }
        }

        var img = poster
            ? '<div class="detail-poster"><img src="' + esc(d.Poster) + '" alt="' + esc(d.Title) + '"></div>'
            : '<div class="detail-poster"><div class="no-poster" style="height:330px">No Poster</div></div>';

        var h = '<div class="detail-top">' + img +
            '<div class="detail-info">' +
            '<h2>' + esc(d.Title) + '</h2>' +
            '<div class="meta"><span>' + esc(d.Year) + '</span><span>' + esc(d.Rated||"N/A") + '</span><span>' + esc(d.Runtime||"N/A") + '</span></div>' +
            (ratings ? '<div class="rating-row">' + ratings + '</div>' : '') +
            '<div class="detail-row"><strong>Genre:</strong> '    + esc(d.Genre||"N/A")    + '</div>' +
            '<div class="detail-row"><strong>Director:</strong> ' + esc(d.Director||"N/A") + '</div>' +
            '<div class="detail-row"><strong>Writer:</strong> '   + esc(d.Writer||"N/A")   + '</div>' +
            '<div class="detail-row"><strong>Actors:</strong> '   + esc(d.Actors||"N/A")   + '</div>' +
            (d.BoxOffice ? '<div class="detail-row"><strong>Box Office:</strong> ' + esc(d.BoxOffice) + '</div>' : '') +
            (d.Awards && d.Awards !== "N/A" ? '<div class="detail-row"><strong>Awards:</strong> ' + esc(d.Awards) + '</div>' : '') +
            '</div></div>' +
            '<div class="detail-row plot-text"><strong>Plot:</strong> ' + esc(d.Plot||"N/A") + '</div>';

        modalBody.innerHTML = h;
        modalOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modalOverlay.classList.add("hidden");
        modalBody.innerHTML = "";
        document.body.style.overflow = "";
    }

    /* ========== PAGINATION ========== */
    function updatePagination() {
        var pages = Math.ceil(totalResults / 10);
        if (pages <= 1) { pagination.classList.add("hidden"); return; }
        pagination.classList.remove("hidden");
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= pages;
        pageInfo.textContent = "Page " + currentPage + " / " + pages + "  (" + totalResults + " results)";
    }

    /* ========== PERSIST ========== */
    function persistSearch() {
        localStorage.setItem("mf_search", JSON.stringify({
            query: lastQuery, type: lastType, year: lastYear, page: currentPage
        }));
    }

    function restoreLastSearch() {
        try {
            var s = localStorage.getItem("mf_search");
            if (!s) return;
            var o = JSON.parse(s);
            if (o.query) {
                searchInput.value = o.query;
                typeFilter.value  = o.type || "";
                yearFilter.value  = o.year || "";
                currentPage = o.page || 1;
                lastQuery = o.query;
                lastType  = o.type || "";
                lastYear  = o.year || "";
                doSearch(currentPage);
            }
        } catch(e) {}
    }

    /* ========== HELPERS ========== */
    function showMsg(t, c) { messageArea.textContent = t; messageArea.className = c; messageArea.classList.remove("hidden"); }
    function hideMsg() { messageArea.classList.add("hidden"); }
    function clearResults() { resultsGrid.innerHTML = ""; pagination.classList.add("hidden"); }

    function esc(s) {
        if (!s) return "";
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
    }

    /* ---- go ---- */
    init();
})();
