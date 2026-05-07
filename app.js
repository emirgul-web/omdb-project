/*
    app.js – MovieFinder application logic
    Handles OMDB API calls, search, pagination, detail modal, and localStorage persistence.
*/

(function () {
    "use strict";

    // ---- DOM refs ----


    const searchInput   = document.getElementById("search-input");
    const typeFilter    = document.getElementById("type-filter");
    const yearFilter    = document.getElementById("year-filter");
    const searchBtn     = document.getElementById("search-btn");

    const loader        = document.getElementById("loader");
    const messageArea   = document.getElementById("message-area");

    const resultsGrid   = document.getElementById("results-grid");
    const pagination    = document.getElementById("pagination");
    const prevBtn       = document.getElementById("prev-btn");
    const nextBtn       = document.getElementById("next-btn");
    const pageInfo      = document.getElementById("page-info");

    const modalOverlay  = document.getElementById("modal-overlay");
    const modalBody     = document.getElementById("modal-body");
    const modalClose    = document.getElementById("modal-close");

    // ---- state ----
    var apiKey      = "b3661580";
    let currentPage = 1;
    let totalResults = 0;
    let lastQuery   = "";
    let lastType    = "";
    let lastYear    = "";

    // cache for detail responses so we don't re-fetch the same movie
    const detailCache = {};

    // ---- init ----
    function init() {
        restoreLastSearch();
        searchBtn.addEventListener("click", function () { doSearch(1); });
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doSearch(1);
        });
        prevBtn.addEventListener("click", function () { doSearch(currentPage - 1); });
        nextBtn.addEventListener("click", function () { doSearch(currentPage + 1); });
        modalClose.addEventListener("click", closeModal);
        modalOverlay.addEventListener("click", function (e) {
            if (e.target === modalOverlay) closeModal();
        });

        // esc to close modal
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeModal();
        });
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

        // persist in localStorage
        persistSearch();

        // build URL
        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(apiKey)
            + "&s=" + encodeURIComponent(query)
            + "&page=" + currentPage;

        if (lastType) url += "&type=" + lastType;
        if (lastYear) url += "&y=" + lastYear;

        hideMessage();
        showLoader();
        clearResults();

        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                hideLoader();
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
                hideLoader();
                showMessage("Network error – please try again. (" + err.message + ")", "error");
            });
    }

    // ---- render search results ----
    function renderResults(movies) {
        resultsGrid.innerHTML = "";

        movies.forEach(function (m) {
            var card = document.createElement("div");
            card.className = "movie-card";
            card.setAttribute("tabindex", "0");

            var hasPoster = m.Poster && m.Poster !== "N/A";

            if (hasPoster) {
                card.innerHTML =
                    '<img src="' + escapeHtml(m.Poster) + '" alt="' + escapeHtml(m.Title) + '" loading="lazy" onerror="this.outerHTML=\'<div class=no-poster>No Poster</div>\'">' +
                    '<div class="card-info"><h3>' + escapeHtml(m.Title) + '</h3><span>' + escapeHtml(m.Year) + '</span></div>';
            } else {
                card.innerHTML =
                    '<div class="no-poster">No Poster</div>' +
                    '<div class="card-info"><h3>' + escapeHtml(m.Title) + '</h3><span>' + escapeHtml(m.Year) + '</span></div>';
            }

            card.addEventListener("click", function () { openDetail(m.imdbID); });
            card.addEventListener("keydown", function (e) {
                if (e.key === "Enter") openDetail(m.imdbID);
            });

            resultsGrid.appendChild(card);
        });
    }

    // ---- detail modal ----
    function openDetail(imdbID) {
        // check cache first
        if (detailCache[imdbID]) {
            renderDetail(detailCache[imdbID]);
            return;
        }

        var url = "https://www.omdbapi.com/?apikey=" + encodeURIComponent(apiKey)
            + "&i=" + encodeURIComponent(imdbID) + "&plot=full";

        modalBody.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
        modalOverlay.classList.remove("hidden");

        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.Response === "False") {
                    modalBody.innerHTML = '<p style="color:#f87171;padding:20px">Could not load movie details.</p>';
                    return;
                }
                detailCache[imdbID] = data;
                renderDetail(data);
            })
            .catch(function () {
                modalBody.innerHTML = '<p style="color:#f87171;padding:20px">Network error while fetching details.</p>';
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
    }

    function closeModal() {
        modalOverlay.classList.add("hidden");
        modalBody.innerHTML = "";
    }

    // ---- pagination ----
    function updatePagination() {
        var totalPages = Math.ceil(totalResults / 10); // omdb returns 10 per page
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
                // automatically replay last search
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
    function showLoader() { loader.classList.remove("hidden"); }
    function hideLoader() { loader.classList.add("hidden"); }

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = type; // 'error' or 'info'
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

    // run
    init();
})();
