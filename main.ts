// ===== Types =====
type HexColor = string; // "#RRGGBB"
type ThemeMode = "light" | "dark" | "auto";
type ToastKind = "success" | "error" | "info";

// ===== Constantes & éléments DOM =====
const MAX_HISTORY_UI = 10;

let previewEl!: HTMLDivElement;
let previewBorderEl!: HTMLDivElement;
let codeEl!: HTMLDivElement;
let newBtn!: HTMLButtonElement;
let copyBtn!: HTMLButtonElement;
let pinBtn!: HTMLButtonElement;
let clearBtn!: HTMLButtonElement;
let pinsGrid!: HTMLDivElement;
let historyGrid!: HTMLDivElement;
let statusEl!: HTMLDivElement;
let themeBtn!: HTMLButtonElement;
let badgeEl!: HTMLDivElement;
let toastRoot!: HTMLDivElement;

// Gradient UI
let gradAEl!: HTMLButtonElement;
let gradBEl!: HTMLButtonElement;
let btnAFromCurrent!: HTMLButtonElement;
let btnBFromCurrent!: HTMLButtonElement;
let stepsInput!: HTMLInputElement;
let stepsValEl!: HTMLDivElement;
let gradientCircle!: HTMLDivElement;
let gradientSteps!: HTMLDivElement;
let chkBorder!: HTMLInputElement;

// État gradient simple
let gradA: HexColor = "#FF0000";
let gradB: HexColor = "#0000FF";
let gradSteps = 9;

// ===== Utilitaires =====
function isValidHex(input: string): input is HexColor {
  return /^#[0-9A-Fa-f]{6}$/.test(input);
}
function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ===== Animations =====
function animate(
  el: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
): Promise<void> {
  if (prefersReducedMotion) return Promise.resolve();
  const a = (el as HTMLElement).animate(keyframes, options);
  return a.finished.then(() => undefined, () => undefined);
}

function showToast(kind: ToastKind, message: string): void {
  const div = document.createElement("div");
  div.className = "toast";
  div.setAttribute("role", "status");

  const dot = document.createElement("span");
  Object.assign(dot.style, {
    display: "inline-block",
    width: "8px", height: "8px", borderRadius: "999px",
    marginRight: "8px", verticalAlign: "-1px",
    background: kind === "success" ? "var(--toast-success)" :
               kind === "error"   ? "var(--toast-error)"   :
                                    "var(--toast-info)"
  } as CSSStyleDeclaration);

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
function spawnRipple(container: HTMLElement, x: number, y: number): void {
  if (!container.classList.contains("ripple-wrap")) container.classList.add("ripple-wrap");
  const r = document.createElement("span");
  r.className = "ripple";
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  container.appendChild(r);
  setTimeout(() => r.remove(), 500);
}
function rippleCenter(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  spawnRipple(el, rect.width / 2, rect.height / 2);
}

// ===== Preview + Badge WCAG =====
function setPreview(color: HexColor): void {
  previewEl.style.background = color;
  codeEl.textContent = color.toUpperCase();

  const hex = color.toUpperCase() as ColorCore.Hex;
  const rgbRes = ColorCore.hexToRgb(hex);
  if (!rgbRes.ok) { badgeEl.textContent = "Fail"; return; }

  const txt = ColorCore.bestTextOn(hex);
  const contrast = ColorCore.contrast(
    rgbRes.value,
    txt === "#000000" ? { r:0,g:0,b:0 } : { r:255,g:255,b:255 }
  );
  const level = ColorCore.wcagLevel(hex);
  badgeEl.textContent = `${level} • ${ColorCore.round(contrast, 2)}:1`;
  badgeEl.style.color = txt;
  badgeEl.style.background = txt === "#000000"
    ? "rgba(255,255,255,0.6)"
    : "rgba(0,0,0,0.35)";

  void animate(badgeEl, [
    { transform: "translateY(-6px)", opacity: 0.6 },
    { transform: "translateY(0)",    opacity: 1 }
  ], { duration: 120, easing: "cubic-bezier(.2,.8,.2,1)" });

  updatePinButtonState(hex);
}

// ===== Thème (DOM = source de vérité) =====
function getDomTheme(): ThemeMode {
  const html = document.documentElement;
  const hasUser = html.hasAttribute("data-user-theme");
  const data = html.getAttribute("data-theme");
  if (!hasUser) return "auto";
  return (data === "dark" ? "dark" : "light");
}
function setDomTheme(mode: ThemeMode): void {
  const html = document.documentElement;
  if (mode === "auto") { html.removeAttribute("data-user-theme"); html.removeAttribute("data-theme"); }
  else { html.setAttribute("data-user-theme", "1"); html.setAttribute("data-theme", mode === "dark" ? "dark" : "light"); }
  themeBtn.textContent = mode === "dark" ? "🌞" : (mode === "light" ? "🌓" : "⛅️");
  themeBtn.title = `Thème: ${mode}`;
}
function syncThemeToStore(): void { Store.setTheme(getDomTheme()); }
function initThemeFromStore(): void { setDomTheme(Store.load().theme); }
function toggleTheme(): void {
  void animate(themeBtn, [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }], { duration: 120, easing: "linear" });
  const current = getDomTheme();
  const next: ThemeMode = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
  setDomTheme(next); syncThemeToStore(); showToast("info", `Thème: ${next}`);
}

// ===== Historique / PINS via Store =====
function generateRandomColor(): string { return ColorCore.randomHex(); }
function updateHistory(color: string): void { Store.pushHistory(color); }
function clearHistory(): void { Store.clearHistory(); renderHistory(); setStatus("Historique vidé."); showToast("info", "Historique vidé"); }
function getHistory(): HexColor[] { return Store.load().history; }

function togglePinCurrent(): void {
  const hex = (codeEl.textContent ?? "").trim();
  if (!isValidHex(hex)) { showToast("error", "Couleur invalide"); return; }
  Store.togglePin(hex); renderPins(); updatePinButtonState(hex);
  showToast("success", Store.isPinned(hex) ? `Épinglé ${hex}` : `Désépinglé ${hex}`);
}
function getPins(): HexColor[] { return Store.load().pins; }
function updatePinButtonState(hex: string): void {
  const pinned = Store.isPinned(hex);
  pinBtn.textContent = pinned ? "Désépingler" : "Épingler";
  pinBtn.title = pinned ? "Désépingler la couleur" : "Épingler la couleur";
}

function renderPins(): void {
  const items = getPins();
  pinsGrid.innerHTML = "";
  items.forEach((hex, i) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.setAttribute("role", "listitem");
    btn.setAttribute("data-hex", hex);
    btn.style.background = hex;
    btn.addEventListener("click", (ev) => {
      const e = ev as MouseEvent; const rect = btn.getBoundingClientRect();
      spawnRipple(btn, e.clientX - rect.left, e.clientY - rect.top);
      setPreview(hex); setStatus(`Couleur chargée: ${hex}`);
    });
    pinsGrid.appendChild(btn);
    void animate(btn, [{ transform: "translateY(6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 140, delay: i * 20, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
}

function renderHistory(): void {
  const items = getHistory().slice(0, MAX_HISTORY_UI);
  historyGrid.innerHTML = "";
  items.forEach((hex, i) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.setAttribute("role", "listitem");
    btn.setAttribute("data-hex", hex);
    btn.style.background = hex;
    btn.addEventListener("click", (ev) => {
      const e = ev as MouseEvent; const rect = btn.getBoundingClientRect();
      spawnRipple(btn, e.clientX - rect.left, e.clientY - rect.top);
      setPreview(hex); setStatus(`Couleur chargée: ${hex}`);
    });
    historyGrid.appendChild(btn);
    void animate(btn, [{ transform: "translateY(6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 140, delay: i * 20, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
}

// ===== Dégradé HSL =====
function setGradSwatch(el: HTMLButtonElement, hex: HexColor): void {
  el.style.background = hex; el.setAttribute("data-hex", hex);
}
function computeGradient(): string[] {
  return ColorCore.interpolateHsl(gradA.toUpperCase() as ColorCore.Hex, gradB.toUpperCase() as ColorCore.Hex, gradSteps);
}
function renderGradient(): void {
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
  } else {
    previewBorderEl.classList.remove("on");
    previewBorderEl.style.background = "none";
  }
}

// ===== Actions =====
async function copyColor(): Promise<void> {
  const value = codeEl.textContent?.trim() ?? "";
  if (!isValidHex(value)) { setStatus("Couleur invalide"); showToast("error", "Rien à copier"); return; }
  await navigator.clipboard.writeText(value);
  void animate(copyBtn, [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
  setStatus(`Copié: ${value}`); showToast("success", `Copié ${value}`);
}

function newColorFlow(): void {
  const hex = generateRandomColor();
  rippleCenter(newBtn);
  void animate(previewEl, [{ transform: "scale(0.98)", opacity: 0.85 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
  setPreview(hex); updateHistory(hex); renderHistory(); setStatus("Nouvelle couleur générée.");
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("[ColorLab] build v14");

  previewEl = document.getElementById("color-preview") as HTMLDivElement;
  previewBorderEl = document.getElementById("preview-border") as HTMLDivElement;
  codeEl = document.getElementById("color-code") as HTMLDivElement;
  newBtn = document.getElementById("btn-new") as HTMLButtonElement;
  copyBtn = document.getElementById("btn-copy") as HTMLButtonElement;
  pinBtn = document.getElementById("btn-pin") as HTMLButtonElement;
  clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
  pinsGrid = document.getElementById("pins-grid") as HTMLDivElement;
  historyGrid = document.getElementById("history-grid") as HTMLDivElement;
  statusEl = document.getElementById("status") as HTMLDivElement;
  themeBtn = document.getElementById("btn-theme") as HTMLButtonElement;
  badgeEl = document.getElementById("wcag-badge") as HTMLDivElement;
  toastRoot = document.getElementById("toast-root") as HTMLDivElement;

  gradAEl = document.getElementById("grad-a") as HTMLButtonElement;
  gradBEl = document.getElementById("grad-b") as HTMLButtonElement;
  btnAFromCurrent = document.getElementById("btn-a-from-current") as HTMLButtonElement;
  btnBFromCurrent = document.getElementById("btn-b-from-current") as HTMLButtonElement;
  stepsInput = document.getElementById("steps") as HTMLInputElement;
  stepsValEl = document.getElementById("steps-val") as HTMLDivElement;
  gradientCircle = document.getElementById("gradient-circle") as HTMLDivElement;
  gradientSteps = document.getElementById("gradient-steps") as HTMLDivElement;
  chkBorder = document.getElementById("chk-border") as HTMLInputElement;

  // Thème
  initThemeFromStore();
  themeBtn.addEventListener("click", toggleTheme);

  // Rendu initial
  renderPins(); renderHistory();
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
    if (!isValidHex(cur)) return;
    gradA = cur; setGradSwatch(gradAEl, gradA); renderGradient();
  });
  btnBFromCurrent.addEventListener("click", () => {
    const cur = (codeEl.textContent ?? "").trim();
    if (!isValidHex(cur)) return;
    gradB = cur; setGradSwatch(gradBEl, gradB); renderGradient();
  });

  stepsInput.addEventListener("input", () => {
    const v = Math.max(2, Math.min(24, Math.floor(Number(stepsInput.value) || 9)));
    gradSteps = v; stepsValEl.textContent = String(v); renderGradient();
  });
  chkBorder.addEventListener("change", renderGradient);

  // Raccourcis
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && (document.activeElement === document.body || document.activeElement === newBtn)) {
      e.preventDefault(); newBtn.click();
    } else if (e.key.toLowerCase() === "p") {
      e.preventDefault(); pinBtn.click();
    } else if (e.key.toLowerCase() === "c") {
      e.preventDefault(); copyBtn.click();
    } else if (e.key.toLowerCase() === "t") {
      e.preventDefault(); themeBtn.click();
    }
  });
});
