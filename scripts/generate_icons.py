#!/usr/bin/env python3
"""Generate the extension icon PNGs (16/48/128 px) without external deps.

Draws a flat calendar glyph: rounded blue tile, white date area with a
highlighted "today" dot, and two binder rings. Run from the repo root:

    python3 scripts/generate_icons.py
"""
import os
import struct
import zlib

BLUE = (37, 99, 235, 255)        # #2563eb
DARK_BLUE = (29, 78, 216, 255)   # #1d4ed8
WHITE = (226, 232, 240, 255)     # light slate so the body reads on white toolbars
RED = (239, 68, 68, 255)         # #ef4444
TRANSPARENT = (0, 0, 0, 0)


def write_png(path, size, pixels):
    raw = b''.join(
        b'\x00' + b''.join(struct.pack('4B', *pixels[y][x]) for x in range(size))
        for y in range(size)
    )

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    corners = [(x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)]
    for cx, cy in corners:
        if ((x < cx and y < cy and (cx, cy) == corners[0])
                or (x > cx and y < cy and (cx, cy) == corners[1])
                or (x < cx and y > cy and (cx, cy) == corners[2])
                or (x > cx and y > cy and (cx, cy) == corners[3])):
            if (x - cx) ** 2 + (y - cy) ** 2 > r ** 2:
                return False
    return True


def draw_icon(size):
    px = [[TRANSPARENT for _ in range(size)] for _ in range(size)]
    m = max(1, round(size * 0.06))            # outer margin
    body_top = round(size * 0.16)
    header_bottom = round(size * 0.40)
    radius = max(1, round(size * 0.12))
    ring_r = max(1, round(size * 0.05))

    for y in range(size):
        for x in range(size):
            if in_rounded_rect(x, y, m, body_top, size - 1 - m, size - 1 - m, radius):
                px[y][x] = DARK_BLUE if y <= header_bottom else WHITE

    # Binder rings poking above the body.
    for cx in (round(size * 0.32), round(size * 0.68)):
        cy = body_top
        for y in range(size):
            for x in range(size):
                if (x - cx) ** 2 + (y - cy) ** 2 <= ring_r ** 2:
                    px[y][x] = BLUE

    # Date grid: 3x2 dots, one highlighted.
    dot = max(1, round(size * 0.07))
    grid_y = [round(size * 0.55), round(size * 0.75)]
    grid_x = [round(size * 0.30), round(size * 0.50), round(size * 0.70)]
    for gi, gy in enumerate(grid_y):
        for gj, gx in enumerate(grid_x):
            color = RED if (gi == 1 and gj == 1) else BLUE
            for y in range(gy - dot, gy + dot + 1):
                for x in range(gx - dot, gx + dot + 1):
                    if 0 <= x < size and 0 <= y < size and px[y][x] == WHITE:
                        if (x - gx) ** 2 + (y - gy) ** 2 <= dot ** 2:
                            px[y][x] = color
    return px


def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'extension', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 48, 128):
        path = os.path.join(out_dir, f'icon{size}.png')
        write_png(path, size, draw_icon(size))
        print(f'wrote {path}')


if __name__ == '__main__':
    main()
