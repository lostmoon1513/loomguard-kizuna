"""CIEDE2000 against the published Sharma/Wu/Dalal (2005) test pairs, plus WCAG and colour round-trips."""
import numpy as np
import pytest

from app.services import color_science as cs

SHARMA = [  # (Lab1, Lab2, expected dE00)
    ((50.0, 2.6772, -79.7751), (50.0, 0.0, -82.7485), 2.0425),
    ((50.0, 3.1571, -77.2803), (50.0, 0.0, -82.7485), 2.8615),
    ((50.0, 2.8361, -74.0200), (50.0, 0.0, -82.7485), 3.4412),
    ((50.0, -1.3802, -84.2814), (50.0, 0.0, -82.7485), 1.0000),
    ((50.0, -1.1848, -84.8006), (50.0, 0.0, -82.7485), 1.0000),
    ((50.0, -0.9009, -85.5211), (50.0, 0.0, -82.7485), 1.0000),
    ((50.0, 0.0, 0.0), (50.0, -1.0, 2.0), 2.3669),
    ((50.0, -1.0, 2.0), (50.0, 0.0, 0.0), 2.3669),
    ((50.0, 2.5, 0.0), (50.0, 0.0, -2.5), 4.3065),
    ((50.0, 2.5, 0.0), (73.0, 25.0, -18.0), 27.1492),
    ((50.0, 2.5, 0.0), (61.0, -5.0, 29.0), 22.8977),
    ((50.0, 2.5, 0.0), (56.0, -27.0, -3.0), 31.9030),
    ((50.0, 2.5, 0.0), (58.0, 24.0, 15.0), 19.4535),
    ((50.0, 2.5, 0.0), (50.0, 3.1736, 0.5854), 1.0000),
    ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644),
    ((63.0109, -31.0961, -5.8663), (62.8187, -29.7946, -4.0864), 1.2630),
    ((35.0831, -44.1164, 3.7933), (35.0232, -40.0716, 1.5901), 1.8645),
    ((22.7233, 20.0904, -46.6940), (23.0331, 14.9730, -42.5619), 2.0373),
    ((36.4612, 47.8580, 18.3852), (36.2715, 50.5065, 21.2231), 1.4146),
    ((90.8027, -2.0831, 1.4410), (91.1528, -1.6435, 0.0447), 1.4441),
    ((90.9257, -0.5406, -0.9208), (88.6381, -0.8985, -0.7239), 1.5381),
    ((6.7747, -0.2908, -2.4247), (5.8714, -0.0985, -2.2286), 0.6377),
    ((2.0776, 0.0795, -1.1350), (0.9033, -0.0636, -0.5514), 0.9082),
]


@pytest.mark.parametrize("lab1,lab2,expected", SHARMA)
def test_ciede2000_reference_pairs(lab1, lab2, expected):
    assert cs.ciede2000(lab1, lab2) == pytest.approx(expected, abs=1e-4)
    assert cs.ciede2000(lab2, lab1) == pytest.approx(expected, abs=1e-4)


def test_wcag_known_values():
    assert cs.contrast_ratio((0, 0, 0), (255, 255, 255)) == pytest.approx(21.0, abs=1e-6)
    assert cs.contrast_ratio((255, 255, 255), (255, 255, 255)) == pytest.approx(1.0)
    assert cs.contrast_ratio((119, 119, 119), (255, 255, 255)) == pytest.approx(4.48, abs=0.01)  # #777 just fails AA
    assert cs.contrast_ratio((118, 118, 118), (255, 255, 255)) >= 4.5                           # #767676 just passes


def test_required_ratio():
    assert cs.required_ratio(16) == 4.5 and cs.required_ratio(24) == 3.0
    assert cs.required_ratio(19, bold=True) == 3.0 and cs.required_ratio(18, bold=True) == 4.5 and cs.required_ratio(None) == 4.5


def test_lab_roundtrip_and_white():
    lab = cs.rgb_to_lab(np.array([255.0, 255.0, 255.0]))
    assert lab[0] == pytest.approx(100, abs=0.01) and abs(lab[1]) < 0.01 and abs(lab[2]) < 0.01
    for rgb in [(31, 79, 216), (200, 16, 46), (46, 211, 163), (10, 10, 10)]:
        back = cs.lab_to_rgb(cs.rgb_to_lab(np.array(rgb, dtype=float)))
        assert np.allclose(back, rgb, atol=0.5)


def test_hex():
    assert cs.parse_hex("#1f4fd8") == (31, 79, 216) and cs.parse_hex("1F4FD8") == (31, 79, 216)
    assert cs.parse_hex("#12345") is None and cs.parse_hex("") is None and cs.parse_hex(None) is None
    assert cs.to_hex((31.4, 79.6, 300)) == "#1F50FF"


def test_suggest_keeps_hue_and_passes():
    bg = (255, 255, 255)
    fg = (46, 211, 163)  # brand mint on white fails
    assert cs.contrast_ratio(fg, bg) < 4.5
    fix = cs.suggest_passing_colour(fg, bg)
    rgb = cs.parse_hex(fix)
    assert cs.contrast_ratio(rgb, bg) >= 4.5
    assert cs.delta_e_rgb(fg, rgb) < 45  # still the same family of colour, not black
    assert cs.suggest_passing_colour((20, 20, 20), bg) is not None