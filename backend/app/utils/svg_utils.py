"""
SVG utility for shape poster generation.

Provides two approaches:
1. ``inject_theme_color`` — reads an existing decorative SVG file and
   recolours the shape fills while preserving white backgrounds, black
   outlines, and near-white fills.
2. ``generate_simple_shape_svg`` — programmatic fallback that produces a
   minimal geometric SVG when no file is available.
"""

import math
import xml.etree.ElementTree as ET
from pathlib import Path

# Fills that must NOT be replaced (backgrounds, outlines, transparent)
_SKIP_FILLS = frozenset({
    "#ffffff", "#f9fafb", "#000000", "white", "none", "",
})

_SVG_NS = "http://www.w3.org/2000/svg"


def inject_theme_color(svg_path: Path, theme_color: str) -> str:
    """Read an SVG file and replace shape fill colours with *theme_color*.

    Only fills that represent the actual shape artwork are changed.
    White backgrounds (``#ffffff``, ``#f9fafb``), black outlines
    (``#000000``), and ``none``/empty fills are left untouched.

    Args:
        svg_path: Absolute path to the ``.svg`` file.
        theme_color: A CSS hex colour string, e.g. ``'#7A9B76'``.

    Returns:
        The modified SVG markup as a string.
    """
    ET.register_namespace("", _SVG_NS)
    tree = ET.parse(svg_path)
    root = tree.getroot()

    for elem in root.iter():
        fill = elem.get("fill")
        if fill is None:
            continue
        if fill.strip().lower() in {s.lower() for s in _SKIP_FILLS}:
            continue
        elem.set("fill", theme_color)

    return ET.tostring(root, encoding="unicode")


def generate_simple_shape_svg(shape_name: str, color: str) -> str:
    """Return a minimal SVG string for a basic geometric shape.

    Args:
        shape_name: Lowercase shape key (e.g. ``'circle'``, ``'star'``).
        color: CSS hex colour for the fill, e.g. ``'#7A9B76'``.

    Returns:
        An ``<svg>`` string suitable for direct injection into a template.
    """
    builder = _SHAPE_BUILDERS.get(shape_name, _SHAPE_BUILDERS["circle"])
    inner = builder(color)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">'
        f'{inner}'
        f'</svg>'
    )


# ── individual shape builders ──────────────────────────────────

def _circle(c: str) -> str:
    return f'<circle cx="200" cy="200" r="170" fill="{c}" />'


def _square(c: str) -> str:
    return f'<rect x="40" y="40" width="320" height="320" fill="{c}" />'


def _rectangle(c: str) -> str:
    return f'<rect x="20" y="80" width="360" height="240" rx="8" fill="{c}" />'


def _triangle(c: str) -> str:
    return f'<polygon points="200,30 370,350 30,350" fill="{c}" />'


def _star(c: str) -> str:
    points = _star_points(200, 200, 170, 75, 5)
    return f'<polygon points="{points}" fill="{c}" />'


def _heart(c: str) -> str:
    return (
        f'<path d="M200,340 '
        f'C120,280 20,220 20,140 '
        f'C20,80 70,30 130,30 '
        f'C160,30 185,50 200,80 '
        f'C215,50 240,30 270,30 '
        f'C330,30 380,80 380,140 '
        f'C380,220 280,280 200,340Z" fill="{c}" />'
    )


def _diamond(c: str) -> str:
    return f'<polygon points="200,20 370,200 200,380 30,200" fill="{c}" />'


def _hexagon(c: str) -> str:
    points = _regular_polygon_points(200, 200, 175, 6, -90)
    return f'<polygon points="{points}" fill="{c}" />'


def _pentagon(c: str) -> str:
    points = _regular_polygon_points(200, 200, 175, 5, -90)
    return f'<polygon points="{points}" fill="{c}" />'


def _octagon(c: str) -> str:
    points = _regular_polygon_points(200, 200, 175, 8, -22.5)
    return f'<polygon points="{points}" fill="{c}" />'


def _trapezium(c: str) -> str:
    return f'<polygon points="100,60 300,60 370,340 30,340" fill="{c}" />'


def _oval(c: str) -> str:
    return f'<ellipse cx="200" cy="200" rx="180" ry="130" fill="{c}" />'


# ── geometry helpers ───────────────────────────────────────────

def _regular_polygon_points(cx: float, cy: float, r: float, n: int, start_angle: float = -90) -> str:
    """Return SVG points string for a regular *n*-sided polygon."""
    pts = []
    for i in range(n):
        angle = math.radians(start_angle + i * 360 / n)
        pts.append(f"{cx + r * math.cos(angle):.1f},{cy + r * math.sin(angle):.1f}")
    return " ".join(pts)


def _star_points(cx: float, cy: float, outer: float, inner: float, tips: int) -> str:
    """Return SVG points string for a star with *tips* points."""
    pts = []
    for i in range(tips * 2):
        r = outer if i % 2 == 0 else inner
        angle = math.radians(-90 + i * 180 / tips)
        pts.append(f"{cx + r * math.cos(angle):.1f},{cy + r * math.sin(angle):.1f}")
    return " ".join(pts)


_SHAPE_BUILDERS: dict[str, callable] = {
    "circle": _circle,
    "square": _square,
    "rectangle": _rectangle,
    "triangle": _triangle,
    "star": _star,
    "heart": _heart,
    "diamond": _diamond,
    "hexagon": _hexagon,
    "pentagon": _pentagon,
    "octagon": _octagon,
    "trapezium": _trapezium,
    "oval": _oval,
}
