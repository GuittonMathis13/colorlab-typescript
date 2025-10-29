"use strict";
// ===== Constantes & éléments DOM =====
const MAX_HISTORY_UI = 10;
let previewEl;
let previewBorderEl;
let codeEl;
let newBtn;
let copyBtn;
let pinBtn;
let clearBtn;
let pinsGrid;
let historyGrid;
let statusEl;
let themeBtn;
let badgeEl;
let toastRoot;
// Gradient UI
let gradAEl;
let gradBEl;
let btnAFromCurrent;
let btnBFromCurrent;
let stepsInput;
let stepsValEl;
let gradientCircle;
let gradientSteps;
let chkBorder;
// État gradient simple
let gradA = "#FF0000";
let gradB = "#0000FF";
let gradSteps = 9;
// ===== Utilitaires =====
function isValidHex(input) {
    return /^#[0-9A-Fa-f]{6}$/.test(input);
}
function setStatus(msg) {
    statusEl.textContent = msg;
}
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// ===== Animations =====
function animate(el, keyframes, options) {
    if (prefersReducedMotion)
        return Promise.resolve();
    const a = el.animate(keyframes, options);
    return a.finished.then(() => undefined, () => undefined);
}
function showToast(kind, message) {
    const div = document.createElement("div");
    div.className = "toast";
    div.setAttribute("role", "status");
    const dot = document.createElement("span");
    Object.assign(dot.style, {
        display: "inline-block",
        width: "8px", height: "8px", borderRadius: "999px",
        marginRight: "8px", verticalAlign: "-1px",
        background: kind === "success" ? "var(--toast-success)" :
            kind === "error" ? "var(--toast-error)" :
                "var(--toast-info)"
    });
    div.appendChild(dot);
    div.appendChild(document.createTextNode(message));
    toastRoot.appendChild(div);
    void animate(div, [{ transform: "translateY(8px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
    setTimeout(() => {
        void animate(div, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(8px)", opacity: 0 }], { duration: 140, easing: "cubic-bezier(.4,.0,1,1)" })
            .then(() => div.remove());
    }, 1300);
}
// Ripple
function spawnRipple(container, x, y) {
    if (!container.classList.contains("ripple-wrap"))
        container.classList.add("ripple-wrap");
    const r = document.createElement("span");
    r.className = "ripple";
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    container.appendChild(r);
    setTimeout(() => r.remove(), 500);
}
function rippleCenter(el) {
    const rect = el.getBoundingClientRect();
    spawnRipple(el, rect.width / 2, rect.height / 2);
}
// ===== Preview + Badge WCAG =====
function setPreview(color) {
    previewEl.style.background = color;
    codeEl.textContent = color.toUpperCase();
    const hex = color.toUpperCase();
    const rgbRes = ColorCore.hexToRgb(hex);
    if (!rgbRes.ok) {
        badgeEl.textContent = "Fail";
        return;
    }
    const txt = ColorCore.bestTextOn(hex);
    const contrast = ColorCore.contrast(rgbRes.value, txt === "#000000" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 });
    const level = ColorCore.wcagLevel(hex);
    badgeEl.textContent = `${level} • ${ColorCore.round(contrast, 2)}:1`;
    badgeEl.style.color = txt;
    badgeEl.style.background = txt === "#000000"
        ? "rgba(255,255,255,0.6)"
        : "rgba(0,0,0,0.35)";
    void animate(badgeEl, [
        { transform: "translateY(-6px)", opacity: 0.6 },
        { transform: "translateY(0)", opacity: 1 }
    ], { duration: 120, easing: "cubic-bezier(.2,.8,.2,1)" });
    updatePinButtonState(hex);
}
// ===== Thème (DOM = source de vérité) =====
function getDomTheme() {
    const html = document.documentElement;
    const hasUser = html.hasAttribute("data-user-theme");
    const data = html.getAttribute("data-theme");
    if (!hasUser)
        return "auto";
    return (data === "dark" ? "dark" : "light");
}
function setDomTheme(mode) {
    const html = document.documentElement;
    if (mode === "auto") {
        html.removeAttribute("data-user-theme");
        html.removeAttribute("data-theme");
    }
    else {
        html.setAttribute("data-user-theme", "1");
        html.setAttribute("data-theme", mode === "dark" ? "dark" : "light");
    }
    themeBtn.textContent = mode === "dark" ? "🌞" : (mode === "light" ? "🌓" : "⛅️");
    themeBtn.title = `Thème: ${mode}`;
}
function syncThemeToStore() { Store.setTheme(getDomTheme()); }
function initThemeFromStore() { setDomTheme(Store.load().theme); }
function toggleTheme() {
    void animate(themeBtn, [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }], { duration: 120, easing: "linear" });
    const current = getDomTheme();
    const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
    setDomTheme(next);
    syncThemeToStore();
    showToast("info", `Thème: ${next}`);
}
// ===== Historique / PINS via Store =====
function generateRandomColor() { return ColorCore.randomHex(); }
function updateHistory(color) { Store.pushHistory(color); }
function clearHistory() { Store.clearHistory(); renderHistory(); setStatus("Historique vidé."); showToast("info", "Historique vidé"); }
function getHistory() { return Store.load().history; }
function togglePinCurrent() {
    const hex = (codeEl.textContent ?? "").trim();
    if (!isValidHex(hex)) {
        showToast("error", "Couleur invalide");
        return;
    }
    Store.togglePin(hex);
    renderPins();
    updatePinButtonState(hex);
    showToast("success", Store.isPinned(hex) ? `Épinglé ${hex}` : `Désépinglé ${hex}`);
}
function getPins() { return Store.load().pins; }
function updatePinButtonState(hex) {
    const pinned = Store.isPinned(hex);
    pinBtn.textContent = pinned ? "Désépingler" : "Épingler";
    pinBtn.title = pinned ? "Désépingler la couleur" : "Épingler la couleur";
}
function renderPins() {
    const items = getPins();
    pinsGrid.innerHTML = "";
    items.forEach((hex, i) => {
        const btn = document.createElement("button");
        btn.className = "swatch";
        btn.setAttribute("role", "listitem");
        btn.setAttribute("data-hex", hex);
        btn.style.background = hex;
        btn.addEventListener("click", (ev) => {
            const e = ev;
            const rect = btn.getBoundingClientRect();
            spawnRipple(btn, e.clientX - rect.left, e.clientY - rect.top);
            setPreview(hex);
            setStatus(`Couleur chargée: ${hex}`);
        });
        pinsGrid.appendChild(btn);
        void animate(btn, [{ transform: "translateY(6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 140, delay: i * 20, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
}
function renderHistory() {
    const items = getHistory().slice(0, MAX_HISTORY_UI);
    historyGrid.innerHTML = "";
    items.forEach((hex, i) => {
        const btn = document.createElement("button");
        btn.className = "swatch";
        btn.setAttribute("role", "listitem");
        btn.setAttribute("data-hex", hex);
        btn.style.background = hex;
        btn.addEventListener("click", (ev) => {
            const e = ev;
            const rect = btn.getBoundingClientRect();
            spawnRipple(btn, e.clientX - rect.left, e.clientY - rect.top);
            setPreview(hex);
            setStatus(`Couleur chargée: ${hex}`);
        });
        historyGrid.appendChild(btn);
        void animate(btn, [{ transform: "translateY(6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 140, delay: i * 20, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
}
// ===== Dégradé HSL =====
function setGradSwatch(el, hex) {
    el.style.background = hex;
    el.setAttribute("data-hex", hex);
}
function computeGradient() {
    return ColorCore.interpolateHsl(gradA.toUpperCase(), gradB.toUpperCase(), gradSteps);
}
function renderGradient() {
    // radial (A->B)
    gradientCircle.style.background = `radial-gradient(circle, ${gradA}, ${gradB})`;
    // steps chips
    const steps = computeGradient();
    gradientSteps.innerHTML = "";
    steps.forEach((hx, i) => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.style.background = hx;
        chip.title = hx;
        chip.addEventListener("click", () => { setPreview(hx); setStatus(`Couleur chargée: ${hx}`); });
        gradientSteps.appendChild(chip);
        void animate(chip, [{ transform: "translateY(4px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 120, delay: i * 16, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    // bordure animée (option)
    if (chkBorder.checked) {
        const stops = steps.join(", ");
        previewBorderEl.classList.add("on");
        previewBorderEl.style.background = `conic-gradient(${stops})`;
    }
    else {
        previewBorderEl.classList.remove("on");
        previewBorderEl.style.background = "none";
    }
}
// ===== Actions =====
async function copyColor() {
    const value = codeEl.textContent?.trim() ?? "";
    if (!isValidHex(value)) {
        setStatus("Couleur invalide");
        showToast("error", "Rien à copier");
        return;
    }
    await navigator.clipboard.writeText(value);
    void animate(copyBtn, [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
    setStatus(`Copié: ${value}`);
    showToast("success", `Copié ${value}`);
}
function newColorFlow() {
    const hex = generateRandomColor();
    rippleCenter(newBtn);
    void animate(previewEl, [{ transform: "scale(0.98)", opacity: 0.85 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
    setPreview(hex);
    updateHistory(hex);
    renderHistory();
    setStatus("Nouvelle couleur générée.");
}
// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
    console.log("[ColorLab] build v14");
    previewEl = document.getElementById("color-preview");
    previewBorderEl = document.getElementById("preview-border");
    codeEl = document.getElementById("color-code");
    newBtn = document.getElementById("btn-new");
    copyBtn = document.getElementById("btn-copy");
    pinBtn = document.getElementById("btn-pin");
    clearBtn = document.getElementById("btn-clear");
    pinsGrid = document.getElementById("pins-grid");
    historyGrid = document.getElementById("history-grid");
    statusEl = document.getElementById("status");
    themeBtn = document.getElementById("btn-theme");
    badgeEl = document.getElementById("wcag-badge");
    toastRoot = document.getElementById("toast-root");
    gradAEl = document.getElementById("grad-a");
    gradBEl = document.getElementById("grad-b");
    btnAFromCurrent = document.getElementById("btn-a-from-current");
    btnBFromCurrent = document.getElementById("btn-b-from-current");
    stepsInput = document.getElementById("steps");
    stepsValEl = document.getElementById("steps-val");
    gradientCircle = document.getElementById("gradient-circle");
    gradientSteps = document.getElementById("gradient-steps");
    chkBorder = document.getElementById("chk-border");
    // Thème
    initThemeFromStore();
    themeBtn.addEventListener("click", toggleTheme);
    // Rendu initial
    renderPins();
    renderHistory();
    const initial = getPins()[0] ?? getHistory()[0] ?? "#000000";
    setPreview(initial);
    // Dégradé initial
    gradA = initial;
    gradB = "#0000FF";
    setGradSwatch(gradAEl, gradA);
    setGradSwatch(gradBEl, gradB);
    stepsValEl.textContent = String(gradSteps);
    renderGradient();
    // Events
    newBtn.addEventListener("click", newColorFlow);
    copyBtn.addEventListener("click", () => { void copyColor(); });
    clearBtn.addEventListener("click", clearHistory);
    pinBtn.addEventListener("click", togglePinCurrent);
    btnAFromCurrent.addEventListener("click", () => {
        const cur = (codeEl.textContent ?? "").trim();
        if (!isValidHex(cur))
            return;
        gradA = cur;
        setGradSwatch(gradAEl, gradA);
        renderGradient();
    });
    btnBFromCurrent.addEventListener("click", () => {
        const cur = (codeEl.textContent ?? "").trim();
        if (!isValidHex(cur))
            return;
        gradB = cur;
        setGradSwatch(gradBEl, gradB);
        renderGradient();
    });
    stepsInput.addEventListener("input", () => {
        const v = Math.max(2, Math.min(24, Math.floor(Number(stepsInput.value) || 9)));
        gradSteps = v;
        stepsValEl.textContent = String(v);
        renderGradient();
    });
    chkBorder.addEventListener("change", renderGradient);
    // Raccourcis
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (document.activeElement === document.body || document.activeElement === newBtn)) {
            e.preventDefault();
            newBtn.click();
        }
        else if (e.key.toLowerCase() === "p") {
            e.preventDefault();
            pinBtn.click();
        }
        else if (e.key.toLowerCase() === "c") {
            e.preventDefault();
            copyBtn.click();
        }
        else if (e.key.toLowerCase() === "t") {
            e.preventDefault();
            themeBtn.click();
        }
    });
});
