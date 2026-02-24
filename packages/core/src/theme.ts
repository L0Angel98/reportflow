import type { ThemeInput, ThemeTokens } from "./types.js";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_THEME: ThemeTokens = {
  primary: "#0B5FFF",
  primarySoft: "#D9E7FF",
  primaryStrong: "#123A8F",
  accent: "#14B8A6",
  background: "#F3F6FA",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#667085",
  success: "#15803D",
  danger: "#B42318"
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const parseHex = (value: string): { r: number; g: number; b: number } | null => {
  const hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((part) => Number.isNaN(part))) {
      return null;
    }
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((part) => Number.isNaN(part))) {
      return null;
    }
    return { r, g, b };
  }
  return null;
};

const toHexPart = (value: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
};

const rgbToHex = (value: { r: number; g: number; b: number }): string =>
  `#${toHexPart(value.r)}${toHexPart(value.g)}${toHexPart(value.b)}`;

const mixHex = (
  a: string,
  b: string,
  ratio: number,
  fallbackA: string,
  fallbackB: string
): string => {
  const parsedA = parseHex(a) ?? parseHex(fallbackA) ?? { r: 0, g: 0, b: 0 };
  const parsedB = parseHex(b) ?? parseHex(fallbackB) ?? { r: 255, g: 255, b: 255 };
  const t = clamp(ratio);
  return rgbToHex({
    r: parsedA.r * (1 - t) + parsedB.r * t,
    g: parsedA.g * (1 - t) + parsedB.g * t,
    b: parsedA.b * (1 - t) + parsedB.b * t
  });
};

export const resolveTheme = (
  input: ThemeInput | undefined,
  base: ThemeTokens = DEFAULT_THEME
): ThemeTokens => {
  const primary = input?.primary ?? base.primary;
  const primarySoft =
    input?.primarySoft ??
    input?.secondary ??
    mixHex(primary, "#FFFFFF", 0.78, base.primary, "#FFFFFF");
  const primaryStrong =
    input?.primaryStrong ?? mixHex(primary, "#000000", 0.22, base.primary, "#000000");
  const accent =
    input?.accent ?? mixHex(primaryStrong, "#FFFFFF", 0.45, base.primaryStrong, "#FFFFFF");
  const background = input?.background ?? base.background;
  const surface = input?.surface ?? mixHex(background, "#FFFFFF", 0.4, base.background, "#FFFFFF");

  return {
    primary,
    primarySoft,
    primaryStrong,
    accent,
    background,
    surface,
    text: input?.text ?? base.text,
    muted: input?.muted ?? base.muted,
    success: input?.success ?? base.success,
    danger: input?.danger ?? base.danger
  };
};

export const toRgbColor = (value: string, fallback: string = DEFAULT_THEME.text): RGBColor => {
  const parsed = parseHex(value) ?? parseHex(fallback);
  if (!parsed) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: clamp(parsed.r / 255),
    g: clamp(parsed.g / 255),
    b: clamp(parsed.b / 255)
  };
};

export const mixRgb = (a: RGBColor, b: RGBColor, ratio: number): RGBColor => {
  const t = clamp(ratio);
  return {
    r: clamp(a.r * (1 - t) + b.r * t),
    g: clamp(a.g * (1 - t) + b.g * t),
    b: clamp(a.b * (1 - t) + b.b * t)
  };
};

export const rgbFromTheme = (theme: ThemeTokens, key: keyof ThemeTokens): RGBColor =>
  toRgbColor(theme[key], DEFAULT_THEME[key]);
