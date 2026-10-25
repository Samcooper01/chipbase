/* Evaluator: clock + input/output delay constraints. Parses the submitted
 * constraint file as text (tolerant of the common syntactic variants) and
 * reduces it to graded metrics. */

/** First numeric token that is not the argument of a skipped flag. */
function firstFloatNotAfterFlag(g, tokens, skipFlags = ["-clock"]) {
  let skipNext = false;
  for (const tok of tokens) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (skipFlags.includes(tok)) {
      skipNext = true;
      continue;
    }
    if (["-max", "-min", "-add_delay"].includes(tok)) continue;
    const value = g.py.parseFloatPy(tok);
    if (value !== null) return value;
  }
  return null;
}

export default async function evaluate(g) {
  const raw = g.read("constraints.sdc");

  // Join backslash line continuations, drop comments.
  const text = raw.replace(/\\\s*\n/g, " ");
  const lines = g.py.splitlines(text)
    .map((ln) => ln.trim())
    .filter((ln) => ln && !ln.startsWith("#"));

  const metrics = {
    clock_period_ns: 0.0,
    clock_port_ok: 0,
    input_delay_ns: 0.0,
    output_delay_ns: 0.0,
    input_excludes_clock: 0,
  };
  const notes = [];

  for (const line of lines) {
    const flat = line.replaceAll("[", " [ ").replaceAll("]", " ] ").replaceAll("{", " ").replaceAll("}", " ");
    const tokens = g.py.splitWords(flat);

    if (line.startsWith("create_clock")) {
      const periodMatch = /-period\s+([\d.]+)/.exec(line);
      if (periodMatch) {
        const period = g.py.parseFloatPy(periodMatch[1]);
        if (period === null) g.fail(`create_clock has a -period that is not a number: ${periodMatch[1]}`);
        metrics.clock_period_ns = period;
      }
      const nameMatch = /-name\s+(\w+)/.exec(line);
      const portsMatch = /get_ports\s+\{?\s*(\w+)/.exec(line);
      const port = portsMatch ? portsMatch[1] : null;
      const name = nameMatch ? nameMatch[1] : port;
      metrics.clock_port_ok = port === "clk" && name === "clk" ? 1 : 0;
      if (port !== "clk") notes.push("create_clock is not attached to the clk port.");
    } else if (line.startsWith("set_input_delay")) {
      const value = firstFloatNotAfterFlag(g, tokens);
      if (value !== null) metrics.input_delay_ns = value;
      const hasClockRef = tokens.includes("-clock");
      if (!hasClockRef) notes.push("set_input_delay has no -clock reference - relative to what?");
      const portsInLine = [...line.matchAll(/get_ports\s+\{?\s*([\w\[\]\* ]+?)\s*\}?\s*\]/g)].map((m) => m[1]);
      if (line.includes("remove_from_collection") && line.includes("clk")) {
        metrics.input_excludes_clock = 1;
      } else if (line.includes("all_inputs")) {
        metrics.input_excludes_clock = 0;
        notes.push(
          "set_input_delay on bare [all_inputs] also constrains the " +
          "clock port as data - the classic gotcha."
        );
      } else if (portsInLine.length) {
        const listed = g.py.splitWords(portsInLine.join(" "));
        metrics.input_excludes_clock = listed.includes("clk") ? 0 : 1;
      }
      if (!hasClockRef) metrics.input_excludes_clock = 0;
    } else if (line.startsWith("set_output_delay")) {
      const value = firstFloatNotAfterFlag(g, tokens);
      if (value !== null) metrics.output_delay_ns = value;
    }
  }

  if (metrics.clock_period_ns === 0.0) notes.push("No create_clock with a -period was found.");
  if (metrics.output_delay_ns === 0.0) notes.push("No set_output_delay was found - outputs are unconstrained.");

  return { metrics, notes };
}
