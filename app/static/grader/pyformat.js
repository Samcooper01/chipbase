/* Python-compatible number and string formatting for the browser grader.
 *
 * The evaluators were first written in Python, and their messages quote
 * numbers and strings the way Python prints them: a float always shows a
 * decimal point ("2.0"), small and large floats switch to exponent form at
 * different places than in JavaScript ("1e-05"), exact ties round to even
 * ("2.5" to "2"), and strings are quoted with repr(). These helpers
 * reproduce that, so a message reads the same whichever language produced
 * it. tests/grader/check_grader.mjs checks them against the Python grader's
 * recorded output.
 */

// The value's decimal digits, correctly rounded to 100 significant digits,
// which is exact for every double the graders meet.
function decimalDigits(x) {
  const [mant, exp] = Math.abs(x).toExponential(99).split("e");
  return { digits: mant.replace(".", ""), exp: parseInt(exp, 10) };
}

// Round a digit string to `keep` digits, ties to even, as Python does on the
// exact binary value. Returns the kept digits and whether they carried into
// a new leading digit (999 -> 1000).
function roundDigits(digits, keep) {
  if (keep < 0) return { kept: "", carry: false, zero: true };
  const head = digits.slice(0, keep);
  const rest = digits.slice(keep);
  let up = false;
  if (rest.length) {
    const first = rest.charCodeAt(0) - 48;
    const tail = /[1-9]/.test(rest.slice(1));
    if (first > 5 || (first === 5 && tail)) up = true;
    else if (first === 5 && !tail) {
      const last = head.length ? head.charCodeAt(head.length - 1) - 48 : 0;
      up = last % 2 === 1;
    }
  }
  if (!up) return { kept: head, carry: false, zero: !/[1-9]/.test(head) };
  const arr = head.split("").map(Number);
  let i = arr.length - 1;
  while (i >= 0 && arr[i] === 9) { arr[i] = 0; i--; }
  if (i >= 0) { arr[i] += 1; return { kept: arr.join(""), carry: false, zero: false }; }
  return { kept: "1" + arr.join(""), carry: true, zero: false };
}

/** Python's format(x, ".{d}f"). */
export function fixed(x, d) {
  if (!isFinite(x)) return isNaN(x) ? "nan" : (x < 0 ? "-inf" : "inf");
  const sign = x < 0 || Object.is(x, -0) ? "-" : "";
  if (x === 0) return sign + (d > 0 ? "0." + "0".repeat(d) : "0");
  let { digits, exp } = decimalDigits(x);
  // line the digits up so at least one sits before the decimal point
  let before = exp + 1;
  if (before < 1) {
    digits = "0".repeat(1 - before) + digits;
    before = 1;
  }
  // (a value above 10^100 has more digits than decimalDigits keeps; they
  // print as zeros, which no grader value comes near)
  digits = digits.padEnd(before + d, "0");
  const r = roundDigits(digits, before + d);
  if (r.carry) before += 1;
  const intPart = r.kept.slice(0, before);
  const fracPart = r.kept.slice(before).padEnd(d, "0");
  return sign + (d > 0 ? intPart + "." + fracPart : intPart);
}

/** Python's round(x, d) for d >= 0 (round(x) with d = 0 returns an integer value). */
export function round(x, d = 0) {
  return parseFloat(fixed(x, d));
}

/** Python's format(x, ".{p}g"). */
export function general(x, p) {
  if (!isFinite(x)) return isNaN(x) ? "nan" : (x < 0 ? "-inf" : "inf");
  if (p === 0) p = 1;
  const neg = x < 0 || Object.is(x, -0);
  if (x === 0) return (neg ? "-" : "") + "0";
  const { digits, exp } = decimalDigits(x);
  const r = roundDigits(digits, p);
  const e = exp + (r.carry ? 1 : 0);
  const sig = r.kept.slice(0, p);
  let text;
  if (e >= -4 && e < p) {
    text = fixed(Math.abs(x), Math.max(0, p - 1 - e));
    if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  } else {
    let m = sig.slice(0, 1) + (sig.length > 1 ? "." + sig.slice(1) : "");
    if (m.includes(".")) m = m.replace(/0+$/, "").replace(/\.$/, "");
    text = m + "e" + (e < 0 ? "-" : "+") + String(Math.abs(e)).padStart(2, "0");
  }
  return (neg ? "-" : "") + text;
}

/** Python's repr() of a float: shortest round-trip digits, always a point or exponent. */
export function floatRepr(x) {
  if (!isFinite(x)) return isNaN(x) ? "nan" : (x < 0 ? "-inf" : "inf");
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const neg = x < 0;
  const [mant, expText] = Math.abs(x).toExponential().split("e");
  const digits = mant.replace(".", "");
  const exp = parseInt(expText, 10);
  let text;
  if (exp >= -4 && exp < 16) {
    if (exp < 0) text = "0." + "0".repeat(-exp - 1) + digits;
    else if (digits.length <= exp + 1) text = digits + "0".repeat(exp + 1 - digits.length) + ".0";
    else text = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  } else {
    const m = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    text = m + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  }
  return (neg ? "-" : "") + text;
}

/** Python's float(text), or null where Python would raise ValueError. */
export function parseFloatPy(text) {
  const s = String(text).trim();
  if (/^[+-]?(inf|infinity)$/i.test(s)) return s[0] === "-" ? -Infinity : Infinity;
  if (/^[+-]?nan$/i.test(s)) return NaN;
  const digits = "\\d(?:_?\\d)*";
  const re = new RegExp(`^[+-]?(?:${digits}(?:\\.(?:${digits})?)?|\\.${digits})(?:[eE][+-]?${digits})?$`);
  if (!re.test(s)) return null;
  return parseFloat(s.replace(/_/g, ""));
}

/** Python's repr() of a string. */
export function strRepr(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
    else if (c >= 0x80 && c < 0xa0) out += "\\x" + c.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + quote;
}

/** Python's str.splitlines(). */
export function splitlines(s) {
  const parts = s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** Python's str.split() with no argument. */
export function splitWords(s) {
  const t = s.trim();
  return t ? t.split(/\s+/) : [];
}
