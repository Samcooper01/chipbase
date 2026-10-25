"""A small reader for Liberty timing libraries: enough to pull, for chosen
cells, each pin's capacitance, every timing arc's delay and output-slew
tables, setup and hold tables, leakage, and switching energy.

Liberty is a nest of groups, `name (args) { ... }`, holding simple
attributes, `key : value ;`, and complex ones, `key (values) ;`. The
tokenizer below turns that into nested dicts; nothing here evaluates
expressions or templates beyond what the tables need."""
import gzip, re


def _tokens(text):
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = text.replace("\\\n", " ")
    # a simple attribute may end at the line break instead of a semicolon
    text = re.sub(r"^(\s*[A-Za-z_][\w.]*\s*:\s*[^;{}\n]*?)[ \t]*$", r"\1;", text, flags=re.M)
    for m in re.finditer(r'"(?:[^"\\]|\\.)*"|[{}();:,]|[^\s{}();:,"]+', text):
        yield m.group(0)


def parse(path):
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", errors="ignore") as f:
        toks = list(_tokens(f.read()))
    pos = 0

    def group():
        nonlocal pos
        node = {"attrs": {}, "groups": []}
        while pos < len(toks):
            t = toks[pos]
            if t == "}":
                pos += 1
                return node
            name = t
            pos += 1
            if toks[pos] == ":":                         # simple attribute
                pos += 1
                val = []
                while toks[pos] != ";":
                    val.append(toks[pos])
                    pos += 1
                pos += 1
                node["attrs"][name] = " ".join(val).strip('"')
            elif toks[pos] == "(":                       # group or complex attribute
                pos += 1
                args = []
                while toks[pos] != ")":
                    if toks[pos] != ",":
                        args.append(toks[pos].strip('"'))
                    pos += 1
                pos += 1
                if pos < len(toks) and toks[pos] == "{":
                    pos += 1
                    child = group()
                    child["type"], child["args"] = name, args
                    node["groups"].append(child)
                else:
                    if pos < len(toks) and toks[pos] == ";":
                        pos += 1
                    node["attrs"].setdefault(name, []).append(args)
            else:
                pos += 1
        return node

    top = group()
    return top["groups"][0] if top["groups"] else top


def floats(s):
    return [float(x) for x in re.split(r"[,\s]+", s.strip()) if x]


def table(g):
    """a 1D or 2D lookup table: index_1, index_2 and values, as floats"""
    a = g["attrs"]
    vals = []
    for r in a.get("values", []):
        for item in r:
            vals.append(floats(item))
    i1 = floats(a["index_1"][0][0]) if "index_1" in a else []
    i2 = floats(a["index_2"][0][0]) if "index_2" in a else []
    return {"i1": i1, "i2": i2, "v": vals}
