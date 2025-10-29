"use strict";
/**
 * Store typé + migration + compat avec anciens clés.
 * Exposé en global via namespace Store (module: none).
 */
var Store;
(function (Store) {
    // ====== Constantes ======
    const STORE_KEY = "colorlab_state";
    const OLD_HISTORY_KEY = "colorlab_history"; // compat
    const OLD_THEME_KEY = "colorlab_theme"; // compat
    // ====== Garde simples ======
    function isTheme(x) {
        return x === "auto" || x === "light" || x === "dark";
    }
    function isStringArray(x) {
        return Array.isArray(x) && x.every(v => typeof v === "string");
    }
    function isSchemaV1(x) {
        return x && x.version === 1 && isStringArray(x.history) && isTheme(x.theme);
    }
    function isSchemaV2(x) {
        return x && x.version === 2 && isStringArray(x.history) && isTheme(x.theme) && isStringArray(x.pins);
    }
    // ====== Migration ======
    function migrateV1toV2(v1) {
        return {
            version: 2,
            history: sanitizeHexList(v1.history),
            theme: v1.theme,
            pins: [],
        };
    }
    // Sanitize: garde uniquement "#RRGGBB" en uppercase
    function sanitizeHexList(arr) {
        return arr
            .filter(h => /^#[0-9A-Fa-f]{6}$/.test(h))
            .map(h => h.toUpperCase());
    }
    // ====== Chargement ======
    function load() {
        // 1) Si nouvel état existe
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (isSchemaV2(parsed))
                    return parsed;
                if (isSchemaV1(parsed))
                    return migrateV1toV2(parsed);
            }
            catch { /* ignore */ }
        }
        // 2) Compat: anciens clés
        const oldHistRaw = localStorage.getItem(OLD_HISTORY_KEY);
        const oldTheme = localStorage.getItem(OLD_THEME_KEY);
        if (oldHistRaw || oldTheme) {
            let history = [];
            try {
                history = sanitizeHexList(JSON.parse(oldHistRaw ?? "[]"));
            }
            catch {
                history = [];
            }
            const theme = isTheme(oldTheme) ? oldTheme : "auto";
            const v2 = { version: 2, history, theme, pins: [] };
            save(v2);
            return v2;
        }
        // 3) Sinon état par défaut
        const fresh = { version: 2, history: [], theme: "auto", pins: [] };
        save(fresh);
        return fresh;
    }
    Store.load = load;
    // ====== Sauvegarde ======
    function save(state) {
        const sanitized = {
            version: 2,
            history: sanitizeHexList(state.history).slice(0, 100), // garde grand historique si besoin
            theme: isTheme(state.theme) ? state.theme : "auto",
            pins: sanitizeHexList(state.pins).slice(0, 100),
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(sanitized));
        // bonus compat (facultatif) : maintenir anciennes clés utiles
        localStorage.setItem(OLD_HISTORY_KEY, JSON.stringify(sanitized.history.slice(0, 10)));
        localStorage.setItem(OLD_THEME_KEY, sanitized.theme);
    }
    Store.save = save;
    // ====== Helpers de maj ======
    function setTheme(mode) {
        const s = load();
        s.theme = mode;
        save(s);
        return s;
    }
    Store.setTheme = setTheme;
    function pushHistory(hex) {
        const s = load();
        const hx = hex.toUpperCase();
        const without = s.history.filter(h => h !== hx);
        s.history = [hx, ...without].slice(0, 50); // on garde plus large, UI en affichera 10
        save(s);
        return s;
    }
    Store.pushHistory = pushHistory;
    function clearHistory() {
        const s = load();
        s.history = [];
        save(s);
        return s;
    }
    Store.clearHistory = clearHistory;
    function togglePin(hex) {
        const s = load();
        const hx = hex.toUpperCase();
        if (s.pins.includes(hx)) {
            s.pins = s.pins.filter(h => h !== hx);
        }
        else {
            s.pins = [hx, ...s.pins].slice(0, 50);
        }
        save(s);
        return s;
    }
    Store.togglePin = togglePin;
    function isPinned(hex) {
        const s = load();
        return s.pins.includes(hex.toUpperCase());
    }
    Store.isPinned = isPinned;
})(Store || (Store = {}));
