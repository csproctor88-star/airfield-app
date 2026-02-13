// ── Airfield Control Application ──

(function () {
    "use strict";

    // ── Data Store ──
    const STORAGE_KEY = "airfield_data";

    const defaultRunways = [
        { id: "09L-27R", name: "09L / 27R", length: "3,600m", surface: "Asphalt", open: true },
        { id: "09R-27L", name: "09R / 27L", length: "3,200m", surface: "Asphalt", open: true },
        { id: "04-22", name: "04 / 22", length: "2,800m", surface: "Concrete", open: true },
        { id: "15-33", name: "15 / 33", length: "2,100m", surface: "Asphalt", open: false },
    ];

    const defaultFlights = [
        {
            id: "1",
            number: "AF-201",
            type: "arrival",
            location: "Paris CDG",
            aircraft: "Airbus A320",
            time: todayAt(10, 30),
            runway: "09L-27R",
            status: "scheduled",
        },
        {
            id: "2",
            number: "BA-447",
            type: "departure",
            location: "London LHR",
            aircraft: "Boeing 777",
            time: todayAt(11, 15),
            runway: "09R-27L",
            status: "boarding",
        },
        {
            id: "3",
            number: "LH-832",
            type: "arrival",
            location: "Frankfurt FRA",
            aircraft: "Airbus A330",
            time: todayAt(12, 0),
            runway: "04-22",
            status: "in-air",
        },
        {
            id: "4",
            number: "DL-109",
            type: "departure",
            location: "New York JFK",
            aircraft: "Boeing 767",
            time: todayAt(13, 45),
            runway: "09L-27R",
            status: "scheduled",
        },
        {
            id: "5",
            number: "EK-302",
            type: "arrival",
            location: "Dubai DXB",
            aircraft: "Airbus A380",
            time: todayAt(14, 20),
            runway: "09R-27L",
            status: "delayed",
        },
        {
            id: "6",
            number: "QF-011",
            type: "departure",
            location: "Sydney SYD",
            aircraft: "Boeing 787",
            time: todayAt(9, 0),
            runway: "04-22",
            status: "landed",
        },
    ];

    function todayAt(hours, minutes) {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d.toISOString();
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            // ignore
        }
        return { flights: defaultFlights, runways: defaultRunways, activityLog: [] };
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    let state = loadData();

    // ── Utility ──
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function formatTime(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDateTime(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
    }

    function toDatetimeLocal(iso) {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function logActivity(text, color) {
        state.activityLog.unshift({
            text,
            color: color || "blue",
            time: new Date().toISOString(),
        });
        if (state.activityLog.length > 50) state.activityLog.length = 50;
        saveData();
    }

    // ── Clock ──
    function updateClock() {
        const now = new Date();
        const el = $("#clock");
        if (el) {
            el.textContent = now.toLocaleDateString([], {
                weekday: "short", month: "short", day: "numeric",
            }) + "  " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
    }

    // ── Tabs ──
    function initTabs() {
        $$(".tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                $$(".tab").forEach((t) => t.classList.remove("active"));
                $$(".tab-content").forEach((c) => c.classList.remove("active"));
                tab.classList.add("active");
                const target = tab.getAttribute("data-tab");
                $(`#tab-${target}`).classList.add("active");
                if (target === "weather") renderWeather();
            });
        });
    }

    // ── Dashboard ──
    function renderDashboard() {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const todayFlights = state.flights.filter((f) => {
            const t = new Date(f.time);
            return t >= todayStart && t <= todayEnd;
        });

        const activeStatuses = ["boarding", "taxiing", "in-air"];
        const active = todayFlights.filter((f) => activeStatuses.includes(f.status));
        const arrivals = todayFlights.filter((f) => f.type === "arrival");
        const departures = todayFlights.filter((f) => f.type === "departure");
        const openRunways = state.runways.filter((r) => r.open);

        $("#stat-active").textContent = active.length;
        $("#stat-arrivals").textContent = arrivals.length;
        $("#stat-departures").textContent = departures.length;
        $("#stat-runways").textContent = openRunways.length + " / " + state.runways.length;

        // Upcoming flights
        const upcoming = state.flights
            .filter((f) => new Date(f.time) >= now && f.status !== "cancelled")
            .sort((a, b) => new Date(a.time) - new Date(b.time))
            .slice(0, 6);

        const upcomingEl = $("#upcoming-flights");
        if (upcoming.length === 0) {
            upcomingEl.innerHTML = '<div class="empty-state"><p>No upcoming flights</p></div>';
        } else {
            upcomingEl.innerHTML = upcoming.map((f) => `
                <div class="flight-item">
                    <div class="flight-item-left">
                        <span class="flight-item-number">${esc(f.number)}</span>
                        <span class="type-badge type-${f.type}">${f.type === "arrival" ? "ARR" : "DEP"}</span>
                        <span class="flight-item-location">${esc(f.location)}</span>
                    </div>
                    <span class="flight-item-time">${formatTime(f.time)}</span>
                </div>
            `).join("");
        }

        // Activity log
        const activityEl = $("#activity-log");
        if (state.activityLog.length === 0) {
            activityEl.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
        } else {
            activityEl.innerHTML = state.activityLog.slice(0, 10).map((a) => `
                <div class="activity-item">
                    <span class="activity-dot ${a.color}"></span>
                    <span class="activity-text">${esc(a.text)}</span>
                    <span class="activity-time">${formatTime(a.time)}</span>
                </div>
            `).join("");
        }
    }

    function esc(str) {
        const d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
    }

    // ── Flight Board ──
    let currentFilter = "all";
    let searchQuery = "";

    function initFlightBoard() {
        $$(".filter-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                $$(".filter-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                currentFilter = btn.getAttribute("data-filter");
                renderFlightTable();
            });
        });

        $("#flightSearch").addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderFlightTable();
        });
    }

    function renderFlightTable() {
        let flights = [...state.flights].sort((a, b) => new Date(a.time) - new Date(b.time));

        if (currentFilter !== "all") {
            flights = flights.filter((f) => f.type === currentFilter);
        }

        if (searchQuery) {
            flights = flights.filter((f) =>
                f.number.toLowerCase().includes(searchQuery) ||
                f.location.toLowerCase().includes(searchQuery) ||
                f.status.toLowerCase().includes(searchQuery)
            );
        }

        const tbody = $("#flight-table-body");
        const noFlights = $("#no-flights");

        if (flights.length === 0) {
            tbody.innerHTML = "";
            noFlights.style.display = "block";
            return;
        }

        noFlights.style.display = "none";
        tbody.innerHTML = flights.map((f) => {
            const runway = state.runways.find((r) => r.id === f.runway);
            return `
                <tr>
                    <td><strong>${esc(f.number)}</strong>${f.aircraft ? `<br><small style="color:var(--text-muted)">${esc(f.aircraft)}</small>` : ""}</td>
                    <td><span class="type-badge type-${f.type}">${f.type === "arrival" ? "Arrival" : "Departure"}</span></td>
                    <td>${esc(f.location)}</td>
                    <td>${formatDateTime(f.time)}</td>
                    <td>${runway ? esc(runway.name) : "—"}</td>
                    <td><span class="status-badge status-${f.status}">${f.status.replace("-", " ")}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn" onclick="app.editFlight('${f.id}')">Edit</button>
                            <button class="action-btn delete" onclick="app.deleteFlight('${f.id}')">Del</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // ── Runway Management ──
    function renderRunways() {
        const grid = $("#runway-grid");
        grid.innerHTML = state.runways.map((r) => {
            const assignedFlights = state.flights.filter((f) => f.runway === r.id && f.status !== "cancelled");
            return `
                <div class="runway-card ${r.open ? "" : "closed"}">
                    <div class="runway-header">
                        <span class="runway-name">${esc(r.name)}</span>
                        <div class="runway-status-toggle">
                            <span class="toggle-label">${r.open ? "Open" : "Closed"}</span>
                            <button class="toggle ${r.open ? "active" : ""}" onclick="app.toggleRunway('${r.id}')"></button>
                        </div>
                    </div>
                    <div class="runway-visual">
                        <div class="runway-labels">
                            <span>${esc(r.name.split(" / ")[0])}</span>
                            <span>${esc(r.name.split(" / ")[1] || "")}</span>
                        </div>
                        <div class="runway-strip"></div>
                    </div>
                    <div class="runway-info">
                        <div class="runway-info-item">
                            <div class="runway-info-label">Length</div>
                            <div class="runway-info-value">${esc(r.length)}</div>
                        </div>
                        <div class="runway-info-item">
                            <div class="runway-info-label">Surface</div>
                            <div class="runway-info-value">${esc(r.surface)}</div>
                        </div>
                    </div>
                    ${assignedFlights.length > 0 ? `
                        <div class="runway-flights">
                            <div class="runway-flights-title">Assigned Flights (${assignedFlights.length})</div>
                            ${assignedFlights.map((f) => `<span class="runway-flight-tag">${esc(f.number)} - ${formatTime(f.time)}</span>`).join("")}
                        </div>
                    ` : ""}
                </div>
            `;
        }).join("");
    }

    function toggleRunway(id) {
        const rw = state.runways.find((r) => r.id === id);
        if (rw) {
            rw.open = !rw.open;
            logActivity(`Runway ${rw.name} ${rw.open ? "opened" : "closed"}`, rw.open ? "green" : "red");
            saveData();
            renderAll();
        }
    }

    // ── Weather (Simulated) ──
    function renderWeather() {
        const conditions = generateWeather();
        $("#weather-icon").textContent = conditions.icon;
        $("#weather-temp").textContent = conditions.temp + "\u00B0C";
        $("#weather-desc").textContent = conditions.description;
        $("#weather-wind").textContent = conditions.wind + " kt";
        $("#weather-wind-dir").textContent = conditions.windDir + "\u00B0";
        $("#weather-visibility").textContent = conditions.visibility + " km";
        $("#weather-pressure").textContent = conditions.pressure + " hPa";
        $("#weather-humidity").textContent = conditions.humidity + "%";
        $("#weather-ceiling").textContent = conditions.ceiling + " ft";

        const condEl = $("#flight-conditions");
        const noteEl = $("#conditions-note");

        let condClass, condText, note;
        if (conditions.visibility >= 8 && conditions.ceiling >= 3000) {
            condClass = "condition-vfr";
            condText = "VFR - Visual Flight Rules";
            note = "Conditions are clear for visual flight operations. All runways operational.";
        } else if (conditions.visibility >= 5 && conditions.ceiling >= 1000) {
            condClass = "condition-mvfr";
            condText = "MVFR - Marginal Visual Flight Rules";
            note = "Reduced visibility. Pilots should exercise additional caution. IFR-rated pilots preferred.";
        } else if (conditions.visibility >= 1.5 && conditions.ceiling >= 500) {
            condClass = "condition-ifr";
            condText = "IFR - Instrument Flight Rules";
            note = "Instrument conditions prevail. Only IFR-rated pilots and equipped aircraft may operate.";
        } else {
            condClass = "condition-lifr";
            condText = "LIFR - Low IFR";
            note = "Extremely low visibility. Operations may be restricted. Contact ATC for latest advisories.";
        }

        condEl.innerHTML = `<div class="condition-badge ${condClass}">${condText}</div>`;
        noteEl.textContent = note;
    }

    function generateWeather() {
        // Deterministic based on date so it stays consistent during a session
        const seed = new Date().toDateString();
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const rand = (min, max) => {
            hash = (hash * 16807 + 12345) & 0x7fffffff;
            return min + (hash % (max - min + 1));
        };

        const icons = ["\u2600\uFE0F", "\u26C5", "\u2601\uFE0F", "\uD83C\uDF24\uFE0F", "\uD83C\uDF25\uFE0F", "\uD83C\uDF26\uFE0F"];
        const descs = ["Clear skies", "Partly cloudy", "Overcast", "Mostly sunny", "Cloudy with breaks", "Light rain"];
        const idx = rand(0, icons.length - 1);

        return {
            icon: icons[idx],
            description: descs[idx],
            temp: rand(5, 28),
            wind: rand(3, 25),
            windDir: rand(0, 359),
            visibility: rand(3, 15),
            pressure: rand(1005, 1030),
            humidity: rand(30, 85),
            ceiling: rand(800, 5000),
        };
    }

    // ── Modal / Flight CRUD ──
    function openModal(flight) {
        const overlay = $("#modal-overlay");
        const form = $("#flight-form");

        // Populate runway dropdown
        const runwaySelect = $("#flight-runway");
        runwaySelect.innerHTML = '<option value="">Select runway...</option>' +
            state.runways.map((r) => `<option value="${r.id}">${esc(r.name)}${r.open ? "" : " (Closed)"}</option>`).join("");

        if (flight) {
            $("#modal-title").textContent = "Edit Flight";
            $("#flight-id").value = flight.id;
            $("#flight-number").value = flight.number;
            $("#flight-type").value = flight.type;
            $("#flight-location").value = flight.location;
            $("#flight-aircraft").value = flight.aircraft || "";
            $("#flight-time").value = toDatetimeLocal(flight.time);
            $("#flight-runway").value = flight.runway;
            $("#flight-status").value = flight.status;
        } else {
            $("#modal-title").textContent = "Add Flight";
            form.reset();
            $("#flight-id").value = "";
            // Set default time to next hour
            const next = new Date();
            next.setHours(next.getHours() + 1, 0, 0, 0);
            $("#flight-time").value = toDatetimeLocal(next.toISOString());
        }

        overlay.classList.add("open");
    }

    function closeModal() {
        $("#modal-overlay").classList.remove("open");
    }

    function handleFlightSubmit(e) {
        e.preventDefault();
        const id = $("#flight-id").value;
        const flightData = {
            id: id || generateId(),
            number: $("#flight-number").value.trim(),
            type: $("#flight-type").value,
            location: $("#flight-location").value.trim(),
            aircraft: $("#flight-aircraft").value.trim(),
            time: new Date($("#flight-time").value).toISOString(),
            runway: $("#flight-runway").value,
            status: $("#flight-status").value,
        };

        if (id) {
            const idx = state.flights.findIndex((f) => f.id === id);
            if (idx !== -1) {
                state.flights[idx] = flightData;
                logActivity(`Flight ${flightData.number} updated`, "blue");
            }
        } else {
            state.flights.push(flightData);
            logActivity(`Flight ${flightData.number} added`, "green");
        }

        saveData();
        closeModal();
        renderAll();
    }

    function editFlight(id) {
        const flight = state.flights.find((f) => f.id === id);
        if (flight) openModal(flight);
    }

    let pendingDeleteId = null;

    function deleteFlight(id) {
        pendingDeleteId = id;
        const flight = state.flights.find((f) => f.id === id);
        if (flight) {
            $("#confirm-message").textContent = `Delete flight ${flight.number}?`;
            $("#confirm-overlay").classList.add("open");
        }
    }

    function confirmDelete() {
        if (pendingDeleteId) {
            const flight = state.flights.find((f) => f.id === pendingDeleteId);
            state.flights = state.flights.filter((f) => f.id !== pendingDeleteId);
            if (flight) logActivity(`Flight ${flight.number} deleted`, "red");
            pendingDeleteId = null;
            saveData();
            renderAll();
        }
        $("#confirm-overlay").classList.remove("open");
    }

    function cancelConfirm() {
        pendingDeleteId = null;
        $("#confirm-overlay").classList.remove("open");
    }

    // ── Render All ──
    function renderAll() {
        renderDashboard();
        renderFlightTable();
        renderRunways();
    }

    // ── Init ──
    function init() {
        initTabs();
        initFlightBoard();

        // Modal events
        $("#addFlightBtn").addEventListener("click", () => openModal(null));
        $("#modal-close").addEventListener("click", closeModal);
        $("#modal-cancel").addEventListener("click", closeModal);
        $("#flight-form").addEventListener("submit", handleFlightSubmit);
        $("#modal-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Confirm dialog events
        $("#confirm-ok").addEventListener("click", confirmDelete);
        $("#confirm-cancel").addEventListener("click", cancelConfirm);
        $("#confirm-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) cancelConfirm();
        });

        // Clock
        updateClock();
        setInterval(updateClock, 1000);

        // Initial render
        renderAll();
        renderWeather();

        // Log initial startup if fresh
        if (state.activityLog.length === 0) {
            logActivity("Airfield Control system initialized", "green");
            renderDashboard();
        }
    }

    // Expose public API for inline handlers
    window.app = {
        editFlight,
        deleteFlight,
        toggleRunway,
    };

    document.addEventListener("DOMContentLoaded", init);
})();
