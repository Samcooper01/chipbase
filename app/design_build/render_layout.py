"""Render the real finished layout of one design's run to PNG: every placed
cell at its LEF size, the memory macros, and the routed signal metal, read
from the run's 6_final.def. This is where the design page's layout picture
and the hub card's thumbnail come from.

    python3 app/design_build/render_layout.py <ORFS>/flow riscv32i cal1138_45dac80e \
        app/static/explore/designs/riscv32i-layout.png 900
    python3 app/design_build/render_layout.py <ORFS>/flow riscv32i cal1138_45dac80e \
        app/static/explore/designs/riscv32i-card.png 372 1.6129    # wide, for the card"""
import re, sys, glob
from PIL import Image, ImageDraw

FLOW, design, run, out, px = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
SS = 3                                  # supersample, then shrink for smooth edges

# cell sizes, from every ASAP7 LEF plus the memory's
size = {}
for f in glob.glob(FLOW + "/platforms/asap7/lef/*.lef"):
    cur = None
    for line in open(f, errors="ignore"):
        m = re.match(r"\s*MACRO\s+(\S+)", line)
        if m: cur = m.group(1); continue
        m = re.match(r"\s*SIZE\s+([\d.]+)\s+BY\s+([\d.]+)", line)
        if m and cur and cur not in size: size[cur] = (float(m.group(1)), float(m.group(2)))
width = {}
tech = open(FLOW + "/platforms/asap7/lef/asap7_tech_1x_201209.lef").read()
for m in re.finditer(r"LAYER\s+(M\d)\b(.*?)END\s+\1", tech, re.S):
    w = re.search(r"\bWIDTH\s+([\d.]+)", m.group(2))
    # the layer's own definition comes first; later sections that name the
    # layer again (vias, rules) must not overwrite its width
    if w and m.group(1) not in width: width[m.group(1)] = float(w.group(1))

d = open(f"{FLOW}/results/asap7/{design}/{run}/6_final.def").read()
dbu = int(re.search(r"UNITS DISTANCE MICRONS (\d+)", d).group(1))
x0, y0, x1, y1 = map(int, re.search(r"DIEAREA \( (-?\d+) (-?\d+) \) \( (-?\d+) (-?\d+) \)", d).groups())
W = (x1 - x0) / dbu
S = px * SS / W
img = Image.new("RGBA", (px * SS, px * SS), (238, 241, 244, 255))
dr = ImageDraw.Draw(img, "RGBA")
def X(u): return (u - x0) / dbu * S
def Y(u): return (y1 - u) / dbu * S                 # y up in the layout, down in the image

# the core: the extent of the rows
rows = re.findall(r"^ROW \S+ \S+ (\d+) (\d+) \S+ DO (\d+) BY 1 STEP (\d+)", d, re.M)
cx0 = min(int(r[0]) for r in rows); cy0 = min(int(r[1]) for r in rows)
cx1 = max(int(r[0]) + int(r[2]) * int(r[3]) for r in rows); cy1 = max(int(r[1]) for r in rows) + int(0.27 * dbu)
dr.rectangle([X(cx0), Y(cy1), X(cx1), Y(cy0)], fill=(255, 255, 255, 255), outline=(184, 105, 46, 255), width=SS * 2)

comp = d[d.index("\nCOMPONENTS"):d.index("END COMPONENTS")]
rx = re.compile(r"-\s+(\S+)\s+(\S+)\s+.*?\+\s+(?:PLACED|FIXED)\s+\(\s*(-?\d+)\s+(-?\d+)\s*\)\s+(\S+)")
macros = []
for name, master, x, y, o in rx.findall(comp):
    w, h = size.get(master, (0.054, 0.27))
    if o in ("E", "W", "FE", "FW"): w, h = h, w
    x, y = int(x), int(y)
    box = [X(x), Y(y + h * dbu), X(x + w * dbu), Y(y)]
    if "fakeram" in master: macros.append(box); continue
    if master.startswith(("FILLER", "DECAP")): fill = (226, 232, 240, 255)
    elif master.startswith("TAPCELL"): fill = (154, 214, 205, 255)
    elif master.startswith("DFF") or "DFF" in master: fill = (167, 139, 250, 255)
    else: fill = (148, 163, 184, 255)
    dr.rectangle(box, fill=fill, outline=(255, 255, 255, 160), width=1)
for box in macros:
    dr.rectangle(box, fill=(100, 116, 139, 255), outline=(51, 65, 85, 255), width=SS * 2)

# routed signal metal, lower layers first
colour = {"M1": (37, 99, 235, 60), "M2": (37, 99, 235, 95), "M3": (124, 58, 237, 95),
          "M4": (8, 145, 178, 105), "M5": (217, 119, 6, 105), "M6": (190, 18, 60, 95),
          "M7": (22, 163, 74, 105), "M8": (71, 85, 105, 120), "M9": (15, 23, 42, 120)}
def wires(section):
    segs = []
    for m in re.finditer(r"(?:ROUTED|NEW)\s+(M\d)\s+(?:\d+\s+)?\(\s*(-?\d+)\s+(-?\d+)(?:\s+-?\d+)?\s*\)\s*\(\s*(\S+)\s+(\S+)(?:\s+-?\d+)?\s*\)", section):
        L, xa, ya, xb, yb = m.groups()
        xa, ya = int(xa), int(ya)
        xb = xa if xb == "*" else int(xb); yb = ya if yb == "*" else int(yb)
        segs.append((L, xa, ya, xb, yb))
    return segs
nets = d[d.index("\nNETS"):d.index("END NETS")]
special = d[d.index("\nSPECIALNETS"):d.index("END SPECIALNETS")] if "\nSPECIALNETS" in d else ""
segs = wires(nets)
pg = wires(special)
for L in sorted(colour, key=lambda k: int(k[1:])):
    for s in (x for x in pg if x[0] == L):
        w = max(SS, width.get(L, 0.03) * S * 4)
        dr.line([X(s[1]), Y(s[2]), X(s[3]), Y(s[4])], fill=(colour[L][:3] + (70,)), width=int(w))
    for s in (x for x in segs if x[0] == L):
        w = max(1, width.get(L, 0.02) * S)
        dr.line([X(s[1]), Y(s[2]), X(s[3]), Y(s[4])], fill=colour[L], width=int(round(w)))
img = img.resize((px, px), Image.LANCZOS).convert("RGB")
if len(sys.argv) > 6:                   # a wide frame: width over height
    ratio = float(sys.argv[6])
    frame = Image.new("RGB", (int(round(px * ratio)), px), (238, 241, 244))
    frame.paste(img, ((frame.width - px) // 2, 0))
    img = frame
img.save(out, optimize=True)
print(f"die {W:.2f} um, {len(rx.findall(comp))} components, {len(macros)} macros, {len(segs)} signal segments, {len(pg)} power segments -> {out}")
