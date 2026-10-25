"""Measure click targets for spot items from the rendered maps.

Every target in the drill is found here, from the pixels, not placed by eye.
Usage: python3 measure.py <image.webp> <predicate> [min_pixels]
The predicate names a colour test defined in TESTS below.
"""
import sys
from PIL import Image

TESTS = {
    # bright saturated red: the resizer's rebuffer cells
    "red":    lambda r, g, b: r > 60 and g < 50 and b < 60,
    # olive yellow: the resizer's port buffers
    "yellow": lambda r, g, b: r > 100 and g > 100 and abs(r - g) < 45 and b < min(r, g) * 0.6,
    # the pink power straps
    "pink":   lambda r, g, b: r > 170 and b > 90 and g < r * 0.7 and b < r * 0.9,
    # deep red congestion tiles
    "hot":    lambda r, g, b: 90 < r < 200 and g < 70 and b < 70,
    # cool teal / green congestion tiles
    "cool":   lambda r, g, b: b > 90 and g > 90 and r < 90,
    # the mid green of a tile with little demand
    "green":  lambda r, g, b: g > 130 and r < 115 and b < 100,
}


def clusters(im, test, min_px):
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    out = []
    for x in range(w):
        for y in range(h):
            if seen[x][y]:
                continue
            r, g, b = px[x, y][:3]
            if not test(r, g, b):
                seen[x][y] = True
                continue
            stack, box, n = [(x, y)], [x, y, x, y], 0
            seen[x][y] = True
            while stack:
                cx, cy = stack.pop()
                n += 1
                box[0] = min(box[0], cx); box[1] = min(box[1], cy)
                box[2] = max(box[2], cx); box[3] = max(box[3], cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny]:
                            rr, gg, bb = px[nx, ny][:3]
                            if test(rr, gg, bb):
                                seen[nx][ny] = True
                                stack.append((nx, ny))
                            else:
                                seen[nx][ny] = True
            if n >= min_px:
                out.append((n, box))
    out.sort(reverse=True)
    return out, (w, h)


def main():
    path, name = sys.argv[1], sys.argv[2]
    min_px = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    im = Image.open(path).convert("RGB")
    found, (w, h) = clusters(im, TESTS[name], min_px)
    print("%s  %s  %d clusters of at least %d pixels" % (path, name, len(found), min_px))
    for n, (x0, y0, x1, y1) in found[:20]:
        print("  - {x: %.3f, y: %.3f, w: %.3f, h: %.3f}   # %d px" % (
            x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h, n))


if __name__ == "__main__":
    main()
