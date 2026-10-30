"""Colour maths, all in code (rule N1: measure in code, never in the model).

sRGB <-> CIELAB (D65), CIEDE2000 (Sharma, Wu, Dalal 2005), WCAG 2.1 contrast, and a same-hue colour
adjuster that finds the closest colour to the original that passes a contrast target.
"""
import math
import re
from typing import Optional

import numpy as np

_HEX = re.compile(r"^#?([0-9a-fA-F]{6})$")
_WHITE = np.array([0.95047, 1.0, 1.08883])  # D65
_M = np.array([[0.4124564, 0.3575761, 0.1804375],
               [0.2126729, 0.7151522, 0.0721750],
               [0.0193339, 0.1191920, 0.9503041]])


def parse_hex(value: str) -> Optional[tuple[int, int, int]]:
    m = _HEX.match((value or "").strip())
    if not m:
        return None
    h = m.group(1)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def to_hex(rgb) -> str:
    r, g, b = (int(max(0, min(255, round(float(c))))) for c in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


def _lin(c: np.ndarray) -> np.ndarray:
    c = np.asarray(c, dtype=float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _delin(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255.0


def rgb_to_lab(rgb) -> np.ndarray:
    """rgb: (...,3) array of 0-255 values. Returns (...,3) Lab."""
    xyz = (_lin(rgb) @ _M.T) / _WHITE
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_rgb(lab) -> np.ndarray:
    lab = np.asarray(lab, dtype=float)
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], axis=-1)
    xyz = np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27)) * _WHITE
    return _delin(xyz @ np.linalg.inv(_M).T)


def ciede2000(lab1, lab2, kL: float = 1.0, kC: float = 1.0, kH: float = 1.0) -> float:
    """Colour difference between two Lab colours (Sharma et al. 2005). About 2.3 is a just-noticeable difference."""
    L1, a1, b1 = (float(x) for x in lab1)
    L2, a2, b2 = (float(x) for x in lab2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cbar7 = ((C1 + C2) / 2) ** 7
    G = 0.5 * (1 - math.sqrt(Cbar7 / (Cbar7 + 25.0 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (b1 or a1p) else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (b2 or a2p) else 0.0
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    else:
        dhp = h2p - h1p
        dhp = dhp - 360 if dhp > 180 else dhp + 360 if dhp < -180 else dhp
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    else:
        hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTheta = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25.0 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTheta)) * Rc
    return math.sqrt((dLp / (kL * Sl)) ** 2 + (dCp / (kC * Sc)) ** 2 + (dHp / (kH * Sh)) ** 2
                     + Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)))


def delta_e_rgb(rgb1, rgb2) -> float:
    return ciede2000(rgb_to_lab(np.array(rgb1, dtype=float)), rgb_to_lab(np.array(rgb2, dtype=float)))


# ---------------------------------------------------------------- WCAG 2.1
def luminance(rgb) -> float:
    r, g, b = _lin(np.array(rgb, dtype=float))
    return float(0.2126 * r + 0.7152 * g + 0.0722 * b)


def contrast_ratio(rgb1, rgb2) -> float:
    l1, l2 = luminance(rgb1), luminance(rgb2)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def required_ratio(font_px: Optional[float], bold: bool = False) -> float:
    """WCAG 2.1 AA: 3:1 for large text (24 px, or 18.66 px bold), otherwise 4.5:1."""
    if font_px is not None and (font_px >= 24 or (bold and font_px >= 18.66)):
        return 3.0
    return 4.5


def suggest_passing_colour(fg, bg, target: float = 4.5) -> Optional[str]:
    """Keep the text colour's hue and chroma, move only its lightness until the contrast passes.
    Returns the closest passing colour (smallest lightness change), or None if impossible."""
    fg_lab = rgb_to_lab(np.array(fg, dtype=float))
    best: Optional[tuple[float, str]] = None
    for L in np.arange(0.0, 100.01, 0.5):
        rgb = np.round(lab_to_rgb(np.array([L, fg_lab[1], fg_lab[2]])))
        if contrast_ratio(rgb, bg) >= target:
            d = abs(L - fg_lab[0])
            if best is None or d < best[0]:
                best = (d, to_hex(rgb))
    return best[1] if best else None