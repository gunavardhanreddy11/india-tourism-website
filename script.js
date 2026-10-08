/* ==========================================================
   Safarnama — interactions (multi-page)
   One script for every page: each block only runs if its
   elements exist on the current page. Data comes from data.js.
   ========================================================== */
(function () {
    "use strict";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const NOW_MONTH = new Date().getMonth() + 1;          // getMonth() is 0-based
    const params = new URLSearchParams(location.search);
    const byId = Object.fromEntries(DESTINATIONS.map(d => [d.id, d]));
    const regionLabel = Object.fromEntries(REGIONS.map(r => [r.id, r.label]));
    const interestLabel = Object.fromEntries(INTERESTS.map(i => [i.id, i.label]));
    const placeUrl = id => "place.html?id=" + encodeURIComponent(id);
    const regionText = d => d.region === "islands" ? "Islands" : regionLabel[d.region] + " India";

    /* ---------- Images (Wikimedia Commons thumbnails) ---------- */
    const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/";
    function splitPath(key) {
        const path = IMAGES[key][0];
        const slash = path.lastIndexOf("/");
        return [path.slice(0, slash), encodeURIComponent(path.slice(slash + 1))];
    }
    function imgUrl(key, size) {
        if (!IMAGES[key]) return "";
        const [dir, file] = splitPath(key);
        const want = size === "lg" ? 960 : 500;
        if (IMAGES[key][1] <= want) return COMMONS + dir + "/" + file;      // original is small enough
        return COMMONS + "thumb/" + dir + "/" + file + "/" + want + "px-" + file;
    }
    function imgOriginal(key) { const [dir, file] = splitPath(key); return COMMONS + dir + "/" + file; }
    function commonsPage(key) { return "https://commons.wikimedia.org/wiki/File:" + splitPath(key)[1]; }
    function imgTag(key, alt, size = "sm", eager = false) {
        return `<img src="${imgUrl(key, size)}" data-key="${key}" alt="${escapeHtml(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    }
    // If a resized thumbnail fails, try the original file once; then hide the broken image.
    document.addEventListener("error", e => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.dataset.key) return;
        if (!img.dataset.retried) { img.dataset.retried = "1"; img.src = imgOriginal(img.dataset.key); }
        else img.classList.add("img-failed");
    }, true);   // error events don't bubble, so listen in the capture phase
    $$("img[data-img]").forEach(img => {
        img.dataset.key = img.dataset.img;
        img.src = imgUrl(img.dataset.img, img.dataset.size || "sm");
    });

    /* ---------- Small helpers ---------- */
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function monthRange(months) {
        // [10,11,12,1,2,3] -> "Oct–Mar"; loops twice so runs across Dec→Jan are caught
        const set = new Set(months);
        if (set.size === 12) return "All year";
        const runs = [];
        let start = null;
        for (let i = 1; i <= 24; i++) {
            const m = ((i - 1) % 12) + 1;
            const prev = ((i - 2 + 12) % 12) + 1;
            if (set.has(m) && !set.has(prev) && start === null && i <= 12) start = m;
            if (start !== null && set.has(m) && !set.has((m % 12) + 1)) {
                runs.push(start === m ? MONTHS[m - 1] : MONTHS[start - 1] + "–" + MONTHS[m - 1]);
                start = null;
            }
        }
        return [...new Set(runs)].join(", ");
    }
    function daysText(d) { return d.days[0] === d.days[1] ? `${d.days[0]} days` : `${d.days[0]}–${d.days[1]} days`; }
    function seasonStrip(months, large = false) {
        return `<div class="season ${large ? "season-lg" : ""}" role="img" aria-label="Best months: ${monthRange(months)}">` +
            MONTHS.map((m, i) => `<i class="${months.includes(i + 1) ? "on" : ""} ${i + 1 === NOW_MONTH ? "now" : ""}" title="${m}">${large ? m[0] : ""}</i>`).join("") +
            `</div>`;
    }
    const icons = {
        bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    };
    function toast(msg) {
        const t = $("#toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toast._t);
        toast._t = setTimeout(() => t.classList.remove("show"), 2200);
    }
    async function copyText(text, okMsg) {
        try { await navigator.clipboard.writeText(text); toast(okMsg); }
        catch (e) { toast("Couldn't copy. Copy the address bar instead"); }
    }
    function writeUrl(p) {
        const qs = p.toString();
        try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) { /* file:// */ }
    }

    /* ---------- Shared pieces of markup ---------- */
    function destCard(d, i = 0) {
        return `<article class="dest-card" style="animation-delay:${Math.min(i, 8) * 30}ms">
            <a class="dest-open" href="${placeUrl(d.id)}">
                <div class="dest-photo">${imgTag(d.img, d.alt)}</div>
                <div class="dest-body">
                    <div class="dest-top"><h3 class="dest-name">${d.name}</h3><span class="local">${d.local}</span></div>
                    <p class="dest-state">${d.state} · ${regionLabel[d.region]}</p>
                    <p class="dest-line">${d.line}</p>
                    <div class="dest-meta">${seasonStrip(d.months)}<span class="days">${daysText(d)}</span></div>
                </div>
            </a>
            <button class="save-btn" type="button" data-save="${d.id}" aria-pressed="${isSaved(d.id)}" aria-label="Save ${d.name}">${icons.bookmark}</button>
        </article>`;
    }
    function festItem(f, withLink = true) {
        return `<li class="fest">
            <p class="fest-when">${f.when}</p>
            <div>
                <h4>${f.name}</h4>
                <p class="fest-where">${f.where}</p>
                <p>${f.text}</p>
                ${withLink && f.dest ? `<a class="link-btn" href="${placeUrl(f.dest)}">Plan a trip to ${byId[f.dest].name}</a>` : ""}
            </div>
        </li>`;
    }

    /* ---------- Shortlist (saved in this browser, shared by every page) ---------- */
    const STORE_KEY = "safarnama-saved";
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { saved = []; }
    saved = saved.filter(id => byId[id]);
    function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) { /* private mode: keep in memory */ } }
    function isSaved(id) { return saved.includes(id); }
    function toggleSave(id) {
        if (isSaved(id)) { saved = saved.filter(x => x !== id); toast(`Removed ${byId[id].name}`); }
        else { saved.push(id); toast(`Saved ${byId[id].name}`); }
        persist();
        syncSaved(true);
    }
    function syncSaved(bump) {
        $("#saved-count").textContent = saved.length;
        const btn = $("#saved-btn");
        if (bump) { btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); }  // reflow restarts the animation
        $$("[data-save]").forEach(b => {
            const on = isSaved(b.dataset.save);
            b.setAttribute("aria-pressed", on);
            const label = b.querySelector(".save-label");
            if (label) label.textContent = on ? "Saved" : "Save";
            else b.setAttribute("aria-label", (on ? "Remove " : "Save ") + byId[b.dataset.save].name);
        });
        renderDrawer();
    }
    function shortlistText() {
        return "My India shortlist (from Safarnama):\n" + saved.map((id, i) => {
            const d = byId[id];
            return `${i + 1}. ${d.name}, ${d.state} (best ${monthRange(d.months)}, ${daysText(d)})`;
        }).join("\n");
    }
    function renderDrawer() {
        $("#saved-list").innerHTML = saved.map(id => {
            const d = byId[id];
            return `<li class="saved-item">
                ${imgTag(d.img, d.alt)}
                <a class="name" href="${placeUrl(d.id)}">${d.name}<small>${d.state} · best ${monthRange(d.months)} · ${daysText(d)}</small></a>
                <button class="icon-btn" type="button" data-save="${d.id}" aria-label="Remove ${d.name}">${icons.close}</button>
            </li>`;
        }).join("");
        $("#saved-empty").hidden = saved.length > 0;
        $("#drawer-actions").hidden = saved.length === 0;
        $("#share-wa").href = "https://wa.me/?text=" + encodeURIComponent(shortlistText());
    }
    const drawer = $("#saved-drawer");
    const openDrawer = () => { renderDrawer(); drawer.showModal(); };
    $("#saved-btn").addEventListener("click", openDrawer);
    if ($("#cta-saved")) $("#cta-saved").addEventListener("click", openDrawer);
    drawer.addEventListener("click", e => { if (e.target === drawer || e.target.closest("[data-close]")) drawer.close(); });
    $("#copy-list").addEventListener("click", () => copyText(shortlistText(), "Copied. Paste it anywhere"));
    $("#clear-list").addEventListener("click", () => { saved = []; persist(); syncSaved(true); });
    // one delegated handler for every save button on the page (cards are re-rendered often)
    document.addEventListener("click", e => {
        const save = e.target.closest("[data-save]");
        if (save) { e.preventDefault(); toggleSave(save.dataset.save); }
    });

    /* ---------- Header: sticky state + mobile menu ---------- */
    const header = $(".site-header");
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const menuBtn = $("#menu-btn");
    const navLinks = $("#nav-links");
    function setMenu(open) {
        menuBtn.setAttribute("aria-expanded", open);
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        navLinks.classList.toggle("open", open);
    }
    menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    document.addEventListener("click", e => { if (!e.target.closest(".nav")) setMenu(false); });

    $$("[data-count-dest]").forEach(el => el.textContent = DESTINATIONS.length);

    /* =================== HOME =================== */
    const seasonList = $("#season-list");
    if (seasonList) {
        $("#season-month").textContent = MONTHS_LONG[NOW_MONTH - 1];
        const list = DESTINATIONS.filter(d => d.months.includes(NOW_MONTH));
        const shown = list.slice(0, 6);
        seasonList.innerHTML = shown.map(d =>
            `<a class="pill" href="${placeUrl(d.id)}">${d.name} <small>${regionLabel[d.region]}</small></a>`
        ).join("") + (list.length > shown.length
            ? `<a class="pill pill-more" href="destinations.html?month=${NOW_MONTH}">+${list.length - shown.length} more</a>` : "");
    }

    const route = $("#route");
    if (route) {
        route.innerHTML = CLASSICS.map(c => {
            const d = byId[c.id];
            return `<li class="route-item reveal">
                <a class="route-link" href="${placeUrl(d.id)}">
                    <div class="route-photo">${imgTag(c.img, c.alt, "lg")}<span class="route-leg">${c.leg}</span></div>
                    <div class="route-body">
                        <h3>${d.id === "alappuzha" ? "Kerala backwaters" : d.name} <span class="local">${d.local}</span></h3>
                        <p>${c.text}</p>
                        <p class="route-meta">Best <b>${monthRange(d.months)}</b> · ${daysText(d)} · ${d.state}</p>
                    </div>
                </a>
            </li>`;
        }).join("");
    }

    const tiles = $("#interest-tiles");
    if (tiles) {
        const TILE_IMG = { mountains: "ladakh", beaches: "goa", history: "hampi", food: "charminar", culture: "varanasi",
            nature: "rootbridge", wildlife: "kaziranga", adventure: "rishikesh", relaxation: "backwaters" };
        tiles.innerHTML = INTERESTS.map(i => {
            const n = DESTINATIONS.filter(d => d.tags.includes(i.id)).length;
            return `<a class="tile reveal" href="destinations.html?style=${i.id}">
                ${imgTag(TILE_IMG[i.id], "")}
                <span class="tile-label"><b>${i.label}</b><small>${n} places</small></span>
            </a>`;
        }).join("");
    }

    const homeFests = $("#home-festivals");
    if (homeFests) {
        const list = FESTIVALS.filter(f => f.months.includes(NOW_MONTH)).slice(0, 4);
        $("#home-fest-title").textContent = `What's on in ${MONTHS_LONG[NOW_MONTH - 1]}`;
        homeFests.innerHTML = list.length ? list.map(f => festItem(f)).join("")
            : `<li class="fest"><p class="muted">A quieter month for big festivals. Good for travelling without the crowds.</p></li>`;
    }

    const strip = $("#strip");
    if (strip) {
        strip.innerHTML = POSTCARDS.map(p => `
            <figure class="postcard">
                <div class="pc-photo">${imgTag(p.img, p.alt)}</div>
                <h3>${p.place}</h3>
                <p><span>${p.state}</span><b>${p.months}</b></p>
            </figure>`).join("");
        const stepBy = () => (strip.querySelector(".postcard")?.offsetWidth || 280) + 20;
        $("#strip-prev").addEventListener("click", () => strip.scrollBy({ left: -stepBy() * 2, behavior: "smooth" }));
        $("#strip-next").addEventListener("click", () => strip.scrollBy({ left: stepBy() * 2, behavior: "smooth" }));
    }

    /* =================== PLACES (search + filters) =================== */
    const grid = $("#dest-grid");
    if (grid) {
        const state = { q: "", region: "all", style: "all", month: "any" };
        // filters can come from the URL, e.g. destinations.html?style=beaches&month=12
        const startQ = (params.get("q") || "").trim();
        state.q = startQ.toLowerCase();
        if (regionLabel[params.get("region")]) state.region = params.get("region");
        if (interestLabel[params.get("style")]) state.style = params.get("style");
        const pm = Number(params.get("month"));
        if (pm >= 1 && pm <= 12) state.month = String(pm);

        $("#region-filter").innerHTML = [{ id: "all", label: "All regions" }, ...REGIONS]
            .map(r => `<button type="button" data-region="${r.id}" aria-pressed="false">${r.label}</button>`).join("");
        $("#style-filter").innerHTML = [{ id: "all", label: "Any style" }, ...INTERESTS]
            .map(i => `<button class="chip" type="button" data-style="${i.id}" aria-pressed="false">${i.label}</button>`).join("");
        $("#month-filter").innerHTML = `<option value="any">Any month</option>` +
            MONTHS_LONG.map((m, i) => `<option value="${i + 1}">${m}${i + 1 === NOW_MONTH ? " (now)" : ""}</option>`).join("");
        $("#search").value = startQ;
        $("#month-filter").value = state.month;

        const matches = d => {
            if (state.region !== "all" && d.region !== state.region) return false;
            if (state.style !== "all" && !d.tags.includes(state.style)) return false;
            if (state.month !== "any" && !d.months.includes(Number(state.month))) return false;
            if (state.q) {
                const hay = [d.name, d.place, d.state, d.local, d.line, d.eat, regionLabel[d.region], ...d.tags.map(t => interestLabel[t]), ...d.see].join(" ").toLowerCase();
                return state.q.split(/\s+/).every(w => hay.includes(w));
            }
            return true;
        };
        const render = () => {
            const list = DESTINATIONS.filter(matches);
            grid.innerHTML = list.map(destCard).join("");
            $("#empty").hidden = list.length > 0;
            const filtered = state.q || state.region !== "all" || state.style !== "all" || state.month !== "any";
            $("#result-count").textContent = filtered ? `Showing ${list.length} of ${DESTINATIONS.length} places` : `All ${DESTINATIONS.length} places`;
            $("#reset-filters").hidden = !filtered;
            $$("#region-filter button").forEach(b => b.setAttribute("aria-pressed", b.dataset.region === state.region));
            $$("#style-filter button").forEach(b => b.setAttribute("aria-pressed", b.dataset.style === state.style));
            const p = new URLSearchParams();
            if (state.q) p.set("q", state.q);
            if (state.region !== "all") p.set("region", state.region);
            if (state.style !== "all") p.set("style", state.style);
            if (state.month !== "any") p.set("month", state.month);
            writeUrl(p);                       // the address bar always holds a shareable link
            syncSaved();
        };
        let timer;
        $("#search").addEventListener("input", e => {
            clearTimeout(timer);
            timer = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 120);   // debounce
        });
        $("#region-filter").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { state.region = b.dataset.region; render(); } });
        $("#style-filter").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { state.style = b.dataset.style; render(); } });
        $("#month-filter").addEventListener("change", e => { state.month = e.target.value; render(); });
        $("#reset-filters").addEventListener("click", () => {
            Object.assign(state, { q: "", region: "all", style: "all", month: "any" });
            $("#search").value = ""; $("#month-filter").value = "any"; render();
        });
        render();
    }

    /* =================== PLACE DETAIL (place.html?id=hampi) =================== */
    const placeRoot = $("#place-root");
    if (placeRoot) {
        const d = byId[params.get("id")];
        if (!d) {
            placeRoot.innerHTML = `<section class="page-hero not-found"><div class="container">
                <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="destinations.html">Places</a></nav>
                <h1>We couldn't find that place</h1>
                <p class="page-intro">The link may be old or mistyped. <a href="destinations.html">See all ${DESTINATIONS.length} places</a>.</p>
            </div></section>`;
        } else {
            document.title = `${d.name}, ${d.state} · Safarnama`;
            const idx = DESTINATIONS.indexOf(d);
            const prev = DESTINATIONS[(idx - 1 + DESTINATIONS.length) % DESTINATIONS.length];
            const next = DESTINATIONS[(idx + 1) % DESTINATIONS.length];
            const fests = FESTIVALS.filter(f => f.dest === d.id);
            // related: same region first, then places sharing the most interests
            const related = DESTINATIONS.filter(x => x !== d)
                .map(x => ({ x, s: (x.region === d.region ? 2 : 0) + x.tags.filter(t => d.tags.includes(t)).length }))
                .sort((a, b) => b.s - a.s).slice(0, 3).map(r => r.x);
            const shareText = `${d.name}, ${d.state}: ${d.line} Best ${monthRange(d.months)}, ${daysText(d)}. ${location.href}`;
            placeRoot.innerHTML = `
                <section class="place-hero">
                    ${imgTag(d.img, d.alt, "lg", true)}
                    <div class="container">
                        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="destinations.html">Places</a><span aria-hidden="true">/</span><span aria-current="page">${d.name}</span></nav>
                        <p class="eyebrow">${d.state} · ${regionText(d)}</p>
                        <h1>${d.name} <span class="local">${d.local}</span></h1>
                        <p class="place-line">${d.line}</p>
                    </div>
                </section>
                <section class="section place-body">
                    <div class="container place-grid">
                        <article class="place-main">
                            <p class="lead">${d.about}</p>
                            <div>
                                <h2>Don't miss</h2>
                                <ol class="see-list">${d.see.map(s => `<li>${s}</li>`).join("")}</ol>
                            </div>
                            <div class="info-pair">
                                <div><h3>What to eat</h3><p>${d.eat}</p></div>
                                <div><h3>Getting there</h3><p>${d.getThere}</p></div>
                            </div>
                            <p class="tip"><strong>Good to know:</strong> ${d.tip}</p>
                            ${fests.length ? `<div><h2>Festivals here</h2><ul class="fest-list">${fests.map(f => festItem(f, false)).join("")}</ul></div>` : ""}
                        </article>
                        <aside class="place-aside">
                            <div class="fact-card">
                                <div><h3>Best time</h3><p class="big">${monthRange(d.months)}</p>${seasonStrip(d.months, true)}</div>
                                <div><h3>How long</h3><p class="big">${daysText(d)}</p></div>
                                <div><h3>Good for</h3><div class="tags">${d.tags.map(t => `<a class="tag" href="destinations.html?style=${t}">${interestLabel[t]}</a>`).join("")}</div></div>
                                <div><h3>Where</h3><p>${d.place}, ${d.state}<br><span class="muted">${d.coords[0]}°N, ${d.coords[1]}°E</span></p></div>
                                <div class="fact-actions">
                                    <button class="btn btn-primary" type="button" data-save="${d.id}" aria-pressed="${isSaved(d.id)}"><span class="save-label">${isSaved(d.id) ? "Saved" : "Save"}</span>&nbsp;to shortlist</button>
                                    <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">Share on WhatsApp</a>
                                    <button class="link-btn" type="button" id="copy-place">Copy link to this page</button>
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
                <section class="section related">
                    <div class="container">
                        <div class="section-head"><p class="eyebrow">Keep exploring</p><h2>You might also like</h2></div>
                        <div class="related-grid">${related.map(destCard).join("")}</div>
                        <nav class="pager" aria-label="More places">
                            <a class="prev" href="${placeUrl(prev.id)}"><small>← Previous place</small><b>${prev.name}</b></a>
                            <a class="next" href="${placeUrl(next.id)}"><small>Next place →</small><b>${next.name}</b></a>
                        </nav>
                    </div>
                </section>`;
            $("#copy-place").addEventListener("click", () => copyText(location.href, "Link copied"));
        }
    }

    /* =================== TRIP FINDER =================== */
    const finderOut = $("#finder-results");
    if (finderOut) {
        const DAY_RANGES = { short: [2, 3], week: [4, 7], long: [8, 16] };
        const DAY_WORDS = { short: "a long weekend", week: "about a week", long: "two weeks or more" };
        const finder = { likes: ["mountains", "adventure"], month: NOW_MONTH, days: "week" };
        // shared links: trip-finder.html?like=food,history&month=12&days=short
        if (params.get("like")) {
            const likes = params.get("like").split(",").filter(x => interestLabel[x]).slice(0, 3);
            if (likes.length) finder.likes = likes;
        }
        const pm = Number(params.get("month"));
        if (params.has("month") && pm >= 0 && pm <= 12) finder.month = pm;
        if (DAY_RANGES[params.get("days")]) finder.days = params.get("days");

        $("#finder-interests").innerHTML = INTERESTS.map(i => `<button class="chip" type="button" data-like="${i.id}" aria-pressed="false">${i.label}</button>`).join("");
        $("#finder-month").innerHTML = `<option value="0">I'm flexible</option>` +
            MONTHS_LONG.map((m, i) => `<option value="${i + 1}">${m}${i + 1 === NOW_MONTH ? " (this month)" : ""}</option>`).join("");

        const score = d => {
            const why = [];
            let s = 0;
            const shared = d.tags.filter(t => finder.likes.includes(t));
            if (finder.likes.length && !shared.length) return null;          // shares nothing: leave it out
            s += shared.length * 3;
            if (shared.length) why.push({ text: "Matches " + shared.map(t => interestLabel[t].toLowerCase()).join(" + ") });
            if (finder.month) {
                const m = finder.month, near = [((m + 10) % 12) + 1, (m % 12) + 1];   // month before, month after
                if (d.months.includes(m)) { s += 3; why.push({ text: `${MONTHS_LONG[m - 1]} is a good month (best ${monthRange(d.months)})` }); }
                else if (near.some(x => d.months.includes(x))) { s += 0.5; why.push({ text: `Edge of the season in ${MONTHS_LONG[m - 1]} (best ${monthRange(d.months)})`, warn: true }); }
                else { s -= 4; why.push({ text: `Not ideal in ${MONTHS_LONG[m - 1]}. Best ${monthRange(d.months)}`, warn: true }); }
            }
            const [tMin, tMax] = DAY_RANGES[finder.days];
            if (d.days[0] > tMax) { s -= 3; why.push({ text: `Needs ${daysText(d)}, more than you have`, warn: true }); }
            else if (d.days[1] < tMin) { s += 1; why.push({ text: `Takes ${daysText(d)}, so pair it with somewhere nearby` }); }
            else { s += 2; why.push({ text: `${daysText(d)} fits ${DAY_WORDS[finder.days]}` }); }
            return { d, s, why, shared: shared.length };
        };
        const render = () => {
            $$("#finder-interests .chip").forEach(c => {
                const on = finder.likes.includes(c.dataset.like);
                c.setAttribute("aria-pressed", on);
                c.disabled = !on && finder.likes.length >= 3;
            });
            $("#finder-month").value = finder.month;
            $$("#finder-days button").forEach(b => b.setAttribute("aria-pressed", b.dataset.days === finder.days));
            writeUrl(new URLSearchParams({ like: finder.likes.join(","), month: finder.month, days: finder.days }));

            if (!finder.likes.length) {
                finderOut.innerHTML = `<div class="finder-empty"><p>Pick at least one thing you're in the mood for, and suggestions will show up here.</p></div>`;
                return;
            }
            const ranked = DESTINATIONS.map(score).filter(Boolean).sort((a, b) => b.s - a.s || b.shared - a.shared);
            if (!ranked.length) {
                finderOut.innerHTML = `<div class="finder-empty"><p>Nothing on our list matches that combination. Try a different interest.</p></div>`;
                return;
            }
            const [top, ...rest] = ranked;
            const d = top.d;
            let pair = "";
            if (finder.days === "long") {
                const mate = rest.find(r => r.d.region === d.region && r.s > 0) || rest.find(r => r.s > 0);
                if (mate) pair = `<p class="pair">Got two weeks? Pair it with <a href="${placeUrl(mate.d.id)}">${mate.d.name}</a>, also a good match.</p>`;
            }
            finderOut.innerHTML = `
                ${top.s < 3 ? `<p class="finder-note">Nothing is a perfect fit for that month. These are the closest matches.</p>` : ""}
                <article class="match-top">
                    <div class="match-photo">${imgTag(d.img, d.alt, "lg")}</div>
                    <div class="match-body">
                        <p class="match-label">Best match</p>
                        <h3>${d.name}</h3>
                        <p class="muted">${d.state} · ${d.line}</p>
                        <ul class="why">${top.why.map(w => `<li class="${w.warn ? "warn" : ""}">${w.text}</li>`).join("")}</ul>
                        <div class="match-actions">
                            <a class="btn btn-primary" href="${placeUrl(d.id)}">Open the guide</a>
                            <button class="btn btn-ghost" type="button" data-save="${d.id}" aria-pressed="${isSaved(d.id)}"><span class="save-label">${isSaved(d.id) ? "Saved" : "Save"}</span></button>
                        </div>
                    </div>
                </article>
                ${rest.length ? `<div class="match-rest">${rest.slice(0, 3).map(r => `
                    <a class="match-small" href="${placeUrl(r.d.id)}">
                        ${imgTag(r.d.img, r.d.alt)}
                        <div><strong>${r.d.name}</strong><span>${r.d.state} · best ${monthRange(r.d.months)}</span></div>
                    </a>`).join("")}</div>` : ""}
                ${pair}
                <p class="finder-note"><button class="link-btn" type="button" id="copy-finder" style="color:var(--marigold)">Copy a link to these results</button></p>`;
            $("#copy-finder").addEventListener("click", () => copyText(location.href, "Link copied"));
            syncSaved();
        };
        $("#finder-interests").addEventListener("click", e => {
            const c = e.target.closest("[data-like]");
            if (!c) return;
            const id = c.dataset.like;
            finder.likes = finder.likes.includes(id) ? finder.likes.filter(x => x !== id) : [...finder.likes, id].slice(0, 3);
            render();
        });
        $("#finder-month").addEventListener("change", e => { finder.month = Number(e.target.value); render(); });
        $("#finder-days").addEventListener("click", e => { const b = e.target.closest("[data-days]"); if (b) { finder.days = b.dataset.days; render(); } });
        render();
    }

    /* =================== CULTURE =================== */
    const expGrid = $("#exp-grid");
    if (expGrid) {
        expGrid.innerHTML = EXPERIENCES.map(x => `
            <article class="exp reveal">
                <div class="exp-photo">${imgTag(x.img, x.alt, "lg")}</div>
                <div class="exp-text">
                    <p class="exp-kicker">${x.kicker}</p>
                    <h3>${x.title}</h3>
                    <p>${x.text}</p>
                </div>
            </article>`).join("");
    }

    const monthStrip = $("#month-strip");
    if (monthStrip) {
        let festMonth = NOW_MONTH;
        monthStrip.innerHTML = MONTHS.map((m, i) =>
            `<button type="button" role="tab" data-month="${i + 1}" aria-selected="false" class="${i + 1 === NOW_MONTH ? "is-now" : ""}" aria-label="${MONTHS_LONG[i]}">${m}</button>`
        ).join("");
        const render = () => {
            const list = FESTIVALS.filter(f => f.months.includes(festMonth));
            $$("button", monthStrip).forEach(b => b.setAttribute("aria-selected", Number(b.dataset.month) === festMonth));
            $("#festival-panel").innerHTML = `
                <p class="fest-month">${MONTHS_LONG[festMonth - 1]}${festMonth === NOW_MONTH ? " <small class='muted' style='font-family:var(--body);font-size:1rem'>· this month</small>" : ""}</p>
                ${list.length ? `<ul class="fest-list">${list.map(f => festItem(f)).join("")}</ul>`
                    : `<p class="muted">A quieter month for big festivals. Good for travelling without the crowds.</p>`}`;
        };
        monthStrip.addEventListener("click", e => { const b = e.target.closest("[data-month]"); if (b) { festMonth = Number(b.dataset.month); render(); } });
        monthStrip.addEventListener("keydown", e => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            festMonth = ((festMonth - 1 + (e.key === "ArrowRight" ? 1 : 11)) % 12) + 1;
            render();
            $(`[data-month="${festMonth}"]`, monthStrip).focus();
        });
        render();
    }

    const foodMenu = $("#food-menu");
    if (foodMenu) {
        foodMenu.innerHTML = FOOD.map(g => `
            <div class="menu-group">
                <h4>${g.region}</h4>
                <ul>${g.items.map(([dish, from]) => `<li><span class="dish">${dish}</span><span class="dots"></span><span class="from">${from}</span></li>`).join("")}</ul>
            </div>`).join("");
    }

    /* =================== GALLERY =================== */
    const galleryGrid = $("#gallery-grid");
    if (galleryGrid) {
        galleryGrid.innerHTML = POSTCARDS.map((p, i) => `
            <button class="postcard pc-btn" type="button" data-i="${i}" aria-label="View larger: ${p.place}">
                <div class="pc-photo">${imgTag(p.img, p.alt)}</div>
                <h3>${p.place}</h3>
                <p><span>${p.state}</span><b>${p.months}</b></p>
            </button>`).join("");
        const lb = $("#lightbox");
        let cur = 0;
        const show = (i, focusSel) => {
            cur = (i + POSTCARDS.length) % POSTCARDS.length;
            const p = POSTCARDS[cur];
            $("#lb-content").innerHTML = `${imgTag(p.img, p.alt, "lg", true)}
                <div class="lb-bar">
                    <div><h3>${p.place}</h3><p>${p.state} · best ${p.months} · ${cur + 1} of ${POSTCARDS.length}</p></div>
                    <div class="lb-controls">
                        <button type="button" data-lb="-1" aria-label="Previous photo">${icons.prev}</button>
                        <button type="button" data-lb="1" aria-label="Next photo">${icons.next}</button>
                        <button type="button" data-lb-close aria-label="Close">${icons.close}</button>
                    </div>
                </div>`;
            if (!lb.open) lb.showModal();
            const f = focusSel && $(focusSel, lb);
            if (f) f.focus();
        };
        galleryGrid.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) show(Number(b.dataset.i)); });
        lb.addEventListener("click", e => {
            if (e.target === lb || e.target.closest("[data-lb-close]")) { lb.close(); return; }
            const s = e.target.closest("[data-lb]");
            if (s) show(cur + Number(s.dataset.lb), `[data-lb="${s.dataset.lb}"]`);
        });
        document.addEventListener("keydown", e => {
            if (!lb.open) return;
            if (e.key === "ArrowRight") show(cur + 1);
            if (e.key === "ArrowLeft") show(cur - 1);
        });
    }
    const placePhotos = $("#place-photos");
    if (placePhotos) {
        placePhotos.innerHTML = DESTINATIONS.map(d =>
            `<a class="photo" href="${placeUrl(d.id)}">${imgTag(d.img, d.alt)}<span>${d.name}</span></a>`).join("");
    }

    /* =================== TRAVEL NOTES: when-to-go heatmap =================== */
    const heatmap = $("#heatmap");
    if (heatmap) {
        const shades = ["#ffffff", "#d4e4df", "#8fb9b1", "#3f8580", "#0e5a5a"];
        let html = `<span></span>` + MONTHS.map((m, i) => `<span class="hm-col ${i + 1 === NOW_MONTH ? "now" : ""}">${m[0]}<span class="sr-only">${m}</span></span>`).join("");
        REGIONS.forEach(r => {
            const inRegion = DESTINATIONS.filter(d => d.region === r.id);
            html += `<span class="hm-row">${r.label}</span>`;
            for (let m = 1; m <= 12; m++) {
                const n = inRegion.filter(d => d.months.includes(m)).length;
                const share = inRegion.length ? n / inRegion.length : 0;
                const level = share === 0 ? 0 : share <= .25 ? 1 : share <= .5 ? 2 : share < 1 ? 3 : 4;
                const label = `${r.label}, ${MONTHS_LONG[m - 1]}: ${n} of ${inRegion.length} places in season`;
                html += `<a class="hm-cell ${m === NOW_MONTH ? "now" : ""}" style="background:${shades[level]}" href="destinations.html?region=${r.id}&month=${m}" title="${label}" aria-label="${label}"></a>`;
            }
        });
        heatmap.innerHTML = html;
    }

    /* =================== ABOUT =================== */
    const counts = {
        places: DESTINATIONS.length, regions: REGIONS.length, festivals: FESTIVALS.length,
        dishes: FOOD.reduce((n, g) => n + g.items.length, 0), interests: INTERESTS.length, photos: Object.keys(IMAGES).length,
    };
    $$("[data-count]").forEach(el => { if (counts[el.dataset.count] !== undefined) el.textContent = counts[el.dataset.count]; });
    const credits = $("#credits-list");
    if (credits) {
        credits.innerHTML = Object.keys(IMAGES).map(k => {
            const file = decodeURIComponent(splitPath(k)[1]).replace(/_/g, " ");
            return `<li><a href="${commonsPage(k)}" target="_blank" rel="noopener">${escapeHtml(file)}</a></li>`;
        }).join("");
    }

    /* ---------- Reveal on scroll (skipped when reduced motion is on) ---------- */
    const reveals = $$(".reveal, .section-head, .festival-head, .food-card, .plan-chart, .notes, .note-card, .score-table");
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        reveals.forEach(el => el.classList.add("reveal"));
        const io = new IntersectionObserver(entries => entries.forEach(en => {
            if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        }), { rootMargin: "0px 0px -8% 0px" });
        reveals.forEach(el => io.observe(el));
    } else {
        reveals.forEach(el => el.classList.remove("reveal"));
    }

    syncSaved();
})();
