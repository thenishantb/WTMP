/* Movie Database Explorer - TVmaze Integration */
(function () {
    const TVMAZE_BASE = 'https://api.tvmaze.com';

    const els = {
        grid: document.getElementById('grid'),
        loading: document.getElementById('loading'),
        error: document.getElementById('errorBanner'),
        pageInfo: document.getElementById('pageInfo'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        statusText: document.getElementById('statusText'),
        form: document.getElementById('searchForm'),
        resetBtn: document.getElementById('resetBtn'),
        genre: document.getElementById('genre'),
        modal: document.getElementById('modal'),
        modalContent: document.getElementById('modalContent'),
        watchlistToggle: document.getElementById('watchlistToggle')
    };

    let state = {
        page: 1,
        totalPages: 1,
        query: '',
        genreId: '',
        year: '',
        minRating: '',
        sortBy: 'popularity.desc',
        mode: 'discover', // 'discover' | 'search' | 'watchlist'
        genres: [],
        loading: false
    };

    function setLoading(isLoading) {
        state.loading = isLoading;
        els.loading.classList.toggle('hidden', !isLoading);
    }

    function showError(message) {
        els.error.textContent = message;
        els.error.classList.remove('hidden');
        setTimeout(() => els.error.classList.add('hidden'), 5000);
    }

    function setStatus(text) {
        els.statusText.textContent = text;
    }

    function getWatchlist() {
        try {
            const raw = localStorage.getItem('watchlist_v1') || '[]';
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    function setWatchlist(list) {
        localStorage.setItem('watchlist_v1', JSON.stringify(list));
    }

    function isInWatchlist(movieId) {
        return getWatchlist().some(m => m.id === movieId);
    }

    function toggleWatchlist(movie) {
        const list = getWatchlist();
        const idx = list.findIndex(m => m.id === movie.id);
        if (idx >= 0) {
            list.splice(idx, 1);
            setWatchlist(list);
            return false;
        } else {
            list.push({ id: movie.id, title: movie.title, poster_path: movie.poster_path, vote_average: movie.vote_average });
            setWatchlist(list);
            return true;
        }
    }

    async function api(path, params = {}) {
        let url = TVMAZE_BASE + path;
        if (Object.keys(params).length) {
            const usp = new URLSearchParams(params);
            url += '?' + usp.toString();
        }
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error('Request failed: ' + res.status);
            }
            return await res.json();
        } catch (err) {
            showError(err.message || 'Network error');
            throw err;
        }
    }

    async function fetchGenres() {
        // TVmaze does not provide a genre list endpoint, so we extract genres from the dataset
        const data = await api('/shows', { page: 0 });
        const genreSet = new Set();
        data.forEach(show => (show.genres || []).forEach(g => genreSet.add(g)));
        state.genres = Array.from(genreSet);
        els.genre.innerHTML = '<option value="">All</option>' + state.genres.map(g => `<option value="${g}">${g}</option>`).join('');
    }

    function buildImageUrl(path) {
        return path || '';
    }

    function movieCard(show) {
        const poster = buildImageUrl(show.image?.medium) || '';
        const inWatch = isInWatchlist(show.id);
        return `
        <article class="group relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-lg hover:shadow-primary-900/30 hover:border-primary-700 transition">
            <button data-id="${show.id}" class="absolute inset-0 z-10" aria-label="Open details"></button>
            <div class="aspect-[2/3] bg-slate-800">
                ${poster ? `<img src="${poster}" alt="${show.name}" class="h-full w-full object-cover group-hover:scale-[1.03] transition-transform">` : `<div class=\"h-full w-full grid place-items-center text-slate-500\">No Image</div>`}
            </div>
            <div class="p-3 flex flex-col gap-1">
                <h3 class="text-sm font-semibold line-clamp-2">${show.name}</h3>
                <div class="flex items-center justify-between text-xs text-slate-400">
                    <span>⭐ ${show.rating?.average || 'N/A'}</span>
                    <span>${(show.premiered || '').slice(0, 4) || ''}</span>
                </div>
                <button data-watch-id="${show.id}" class="mt-2 px-2 py-1 rounded-md text-xs border ${inWatch ? 'border-primary-700 bg-primary-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-100'} hover:opacity-90">${inWatch ? 'In Watchlist' : 'Add to Watchlist'}</button>
            </div>
        </article>`;
    }

    function renderMovies(list, page, totalPages) {
        els.grid.innerHTML = list.map(movieCard).join('');
        els.pageInfo.textContent = `Page ${page} / ${totalPages}`;
        els.prevPage.disabled = page <= 1;
        els.nextPage.disabled = page >= totalPages;
    }

    async function loadMovies() {
        setLoading(true);
        setStatus('Fetching shows...');
        try {
            let data;
            if (state.mode === 'watchlist') {
                const wl = getWatchlist();
                // Fake pagination for watchlist
                const perPage = 20;
                state.totalPages = Math.max(1, Math.ceil(wl.length / perPage));
                const slice = wl.slice((state.page - 1) * perPage, state.page * perPage);
                renderMovies(slice, state.page, state.totalPages);
                return;
            }
            if (state.query) {
                data = await api('/search/shows', { q: state.query });
                data = data.map(r => r.show); // TVmaze returns array of {show}
                state.mode = 'search';
            } else {
                // TVmaze paginates shows by page (0-based)
                data = await api('/shows', { page: state.page - 1 });
                // Filter by genre if selected
                if (state.genreId) {
                    data = data.filter(show => show.genres.includes(state.genreId));
                }
                state.mode = 'discover';
            }
            state.totalPages = 10; // TVmaze has up to 10 pages (0-9)
            renderMovies(data || [], state.page, state.totalPages);
            setStatus(`${(data.length || 0).toLocaleString()} results`);
        } catch (e) {
            // error handled in api()
        } finally {
            setLoading(false);
        }
    }

    async function openModal(showId) {
        try {
            setStatus('Loading details...');
            const details = await api(`/shows/${showId}`);
            const poster = buildImageUrl(details.image?.original);
            els.modalContent.innerHTML = `
                <div class="relative">
                    ${poster ? `<img src="${poster}" alt="poster" class="w-full h-48 sm:h-64 object-cover opacity-40">` : ''}
                    <div class="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900"></div>
                </div>
                <div class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div class="sm:col-span-1 flex flex-col gap-4">
                        ${poster ? `<img src="${poster}" alt="${details.name}" class="rounded-lg border border-slate-700">` : ''}
                        <button data-watch-id="${details.id}" class="px-3 py-2 rounded-md text-sm border ${isInWatchlist(details.id) ? 'border-primary-700 bg-primary-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-100'}">${isInWatchlist(details.id) ? 'In Watchlist' : 'Add to Watchlist'}</button>
                    </div>
                    <div class="sm:col-span-2">
                        <h3 class="text-xl font-bold mb-1">${details.name}</h3>
                        <p class="text-slate-300 text-sm mb-3">${details.type || ''}</p>
                        <div class="flex flex-wrap gap-3 text-sm text-slate-300 mb-4">
                            <span>⭐ ${details.rating?.average || 'N/A'}</span>
                            <span>📅 ${(details.premiered || '').slice(0,4)}</span>
                            <span>${(details.genres || []).join(', ')}</span>
                        </div>
                        <p class="text-slate-200 leading-relaxed mb-4">${details.summary ? details.summary.replace(/<[^>]+>/g, '') : 'No summary available.'}</p>
                    </div>
                </div>
            `;
            els.modal.classList.remove('hidden');
        } catch (e) {
            // errors already shown
        } finally {
            setStatus('');
        }
    }

    function closeModal() {
        els.modal.classList.add('hidden');
        els.modalContent.innerHTML = '';
    }

    function attachEvents() {
        els.form.addEventListener('submit', (e) => {
            e.preventDefault();
            state.query = (document.getElementById('query').value || '').trim();
            state.genreId = els.genre.value;
            state.year = (document.getElementById('year').value || '').trim();
            state.minRating = (document.getElementById('rating').value || '').trim();
            state.sortBy = document.getElementById('sort').value;
            state.page = 1;
            loadMovies();
        });

        els.resetBtn.addEventListener('click', () => {
            els.form.reset();
            state = { ...state, page: 1, query: '', genreId: '', year: '', minRating: '', sortBy: 'popularity.desc', mode: 'discover' };
            loadMovies();
        });

        els.prevPage.addEventListener('click', () => {
            if (state.page > 1) { state.page -= 1; loadMovies(); }
        });
        els.nextPage.addEventListener('click', () => {
            if (state.page < state.totalPages) { state.page += 1; loadMovies(); }
        });

        els.grid.addEventListener('click', (e) => {
            const detailsBtn = e.target.closest('[data-id]');
            if (detailsBtn) {
                const id = Number(detailsBtn.getAttribute('data-id'));
                openModal(id);
                return;
            }
            const watchBtn = e.target.closest('[data-watch-id]');
            if (watchBtn) {
                const id = Number(watchBtn.getAttribute('data-watch-id'));
                const card = watchBtn.closest('article');
                const title = card.querySelector('h3')?.textContent || '';
                const img = card.querySelector('img')?.getAttribute('src') || '';
                const ratingText = card.querySelector('span')?.textContent || '';
                const rating = Number((ratingText.match(/([0-9]+\.[0-9]+)/) || [])[1]) || 0;
                const added = toggleWatchlist({ id, title, poster_path: img.replace(IMG_BASE + 'w342', ''), vote_average: rating });
                watchBtn.textContent = added ? 'In Watchlist' : 'Add to Watchlist';
                watchBtn.classList.toggle('bg-primary-600', added);
                watchBtn.classList.toggle('border-primary-700', added);
                watchBtn.classList.toggle('bg-slate-800', !added);
                watchBtn.classList.toggle('border-slate-700', !added);
            }
        });

        els.modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-modal-close]')) closeModal();
            const rec = e.target.closest('[data-rec-id]');
            if (rec) {
                const id = Number(rec.getAttribute('data-rec-id'));
                openModal(id);
            }
            const watchBtn = e.target.closest('[data-watch-id]');
            if (watchBtn) {
                const id = Number(watchBtn.getAttribute('data-watch-id'));
                const added = toggleWatchlist({ id });
                watchBtn.textContent = added ? 'In Watchlist' : 'Add to Watchlist';
                watchBtn.classList.toggle('bg-primary-600', added);
                watchBtn.classList.toggle('border-primary-700', added);
                watchBtn.classList.toggle('bg-slate-800', !added);
                watchBtn.classList.toggle('border-slate-700', !added);
            }
        });

        els.watchlistToggle.addEventListener('click', () => {
            if (state.mode === 'watchlist') {
                state.mode = 'discover';
                els.watchlistToggle.textContent = 'Watchlist';
            } else {
                state.mode = 'watchlist';
                els.watchlistToggle.textContent = 'All Movies';
            }
            state.page = 1;
            loadMovies();
        });
    }

    async function init() {
        attachEvents();
        await fetchGenres();
        await loadMovies();
    }

    document.addEventListener('DOMContentLoaded', init);
})();


