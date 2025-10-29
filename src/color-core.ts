/**
 * Noyau couleur typé — aucune dépendance DOM.
 * Exposé en global via namespace ColorCore (module: none).
 */
namespace ColorCore {
  // ==== Types forts ====
  export type Hex = `#${string}`;

  type UInt8 = number;   // 0..255 (validé à l'exécution si besoin)
  type Deg   = number;   // 0..360
  type Percent = number; // 0..100

  export type Rgb = Readonly<{ r: UInt8; g: UInt8; b: UInt8 }>;
  export type Hsl = Readonly<{ h: Deg; s: Percent; l: Percent }>;

  export type Result<T> =
    | { ok: true;  value: T }
    | { ok: false; error: string };

  // ==== Guards ====
  export function isHex(x: string): x is Hex {
    return /^#[0-9A-Fa-f]{6}$/.test(x);
  }

  // ==== Génération ====
  export function randomHex(): Hex {
    const n = Math.floor(Math.random() * 0xffffff);
    const hex = ("#" + n.toString(16).padStart(6, "0")).toUpperCase() as Hex;
    return hex;
  }

  // ==== Conversions ====
  export function hexToRgb(hex: string): Result<Rgb> {
    if (!isHex(hex)) return { ok: false, error: "Format hex invalide" };
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { ok: true, value: { r, g, b } };
  }

  export function rgbToHex(rgb: Rgb): Hex {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(rgb.r).toString(16).padStart(2, "0");
    const g = clamp(rgb.g).toString(16).padStart(2, "0");
    const b = clamp(rgb.b).toString(16).padStart(2, "0");
    return ("#" + r + g + b).toUpperCase() as Hex;
  }

  export function rgbToHsl({ r, g, b }: Rgb): Hsl {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case R: h = ((G - B) / d) % 6; break;
        case G: h = (B - R) / d + 2;   break;
        case B: h = (R - G) / d + 4;   break;
      }
      h *= 60; if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h, s: s * 100, l: l * 100 };
  }

  export function hslToRgb({ h, s, l }: Hsl): Rgb {
    const S = Math.max(0, Math.min(100, s)) / 100;
    const L = Math.max(0, Math.min(100, l)) / 100;
    const C = (1 - Math.abs(2 * L - 1)) * S;
    const Hp = ((h % 360) + 360) % 360 / 60;
    const X = C * (1 - Math.abs((Hp % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= Hp && Hp < 1)      { r1 = C; g1 = X; b1 = 0; }
    else if (1 <= Hp && Hp < 2) { r1 = X; g1 = C; b1 = 0; }
    else if (2 <= Hp && Hp < 3) { r1 = 0; g1 = C; b1 = X; }
    else if (3 <= Hp && Hp < 4) { r1 = 0; g1 = X; b1 = C; }
    else if (4 <= Hp && Hp < 5) { r1 = X; g1 = 0; b1 = C; }
    else                        { r1 = C; g1 = 0; b1 = X; }
    const m = L - C / 2;
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  // ==== Luminance & Contraste (WCAG) ====
  function srgbToLinear(v: number): number {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  export function luminance(rgb: Rgb): number {
    const R = srgbToLinear(rgb.r);
    const G = srgbToLinear(rgb.g);
    const B = srgbToLinear(rgb.b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  export function contrast(a: Rgb, b: Rgb): number {
    const L1 = luminance(a);
    const L2 = luminance(b);
    const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
  }

  export function bestTextOn(bg: Hex): "#000000" | "#FFFFFF" {
    const rgbBg = hexToRgb(bg);
    if (!rgbBg.ok) return "#000000";
    const black: Rgb = { r: 0, g: 0, b: 0 };
    const white: Rgb = { r: 255, g: 255, b: 255 };
    const cBlack = contrast(rgbBg.value, black);
    const cWhite = contrast(rgbBg.value, white);
    return cBlack >= cWhite ? "#000000" : "#FFFFFF";
  }

  export function wcagLevel(bg: Hex): "AAA" | "AA" | "Fail" {
    const rgbBg = hexToRgb(bg);
    if (!rgbBg.ok) return "Fail";
    const txt = bestTextOn(bg) === "#000000" ? { r:0,g:0,b:0 } : { r:255,g:255,b:255 };
    const ratio = contrast(rgbBg.value, txt);
    if (ratio >= 7)   return "AAA";
    if (ratio >= 4.5) return "AA";
    return "Fail";
  }

  export function round(n: number, d = 2): number {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
  }

  // ==== Interpolation HSL (from → to, steps inclusifs) ====
  export function interpolateHsl(from: Hex, to: Hex, steps: number): Hex[] {
    const fr = hexToRgb(from); const tr = hexToRgb(to);
    if (!fr.ok || !tr.ok) return [from, to];
    const fh = rgbToHsl(fr.value); const th = rgbToHsl(tr.value);

    // interpolation angulaire sur h
    const h1 = ((fh.h % 360) + 360) % 360;
    let   h2 = ((th.h % 360) + 360) % 360;
    let dh = h2 - h1;
    if (Math.abs(dh) > 180) {
      if (dh > 0) h2 -= 360;
      else        h2 += 360;
      dh = h2 - h1;
    }

    const clampSteps = Math.max(2, Math.min(64, Math.floor(steps)));
    const out: Hex[] = [];
    for (let i = 0; i < clampSteps; i++) {
      const t = i / (clampSteps - 1);
      const h = h1 + dh * t;
      const s = fh.s + (th.s - fh.s) * t;
      const l = fh.l + (th.l - fh.l) * t;
      const rgb = hslToRgb({ h, s, l });
      out.push(rgbToHex(rgb));
    }
    return out;
  }
}
