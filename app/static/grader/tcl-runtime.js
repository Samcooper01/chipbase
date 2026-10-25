/* The Tcl (Tool Command Language) runtime for graders: Tcl 8.6 compiled to
 * WebAssembly (built by tools/tclwasm/build.sh). run(files, script) writes the
 * files into a scratch folder, /work, runs the script in a fresh interpreter,
 * and returns { code, result, stdout, stderr }. code is "0" to "4" for the
 * standard Tcl return codes, or "exit" when the script called exit (result
 * is then the exit status). */

import createTcl from "./tcl.js";

export async function loadTcl() {
  const T = await createTcl({
    // the runtime prints nothing itself; a message here is a runtime fault
    print: (line) => console.warn("tcl:", line),
    printErr: (line) => console.warn("tcl:", line),
  });
  const read = (name) => T.ccall(name, "string", [], []);
  return {
    async run(files, script) {
      try {
        T.FS.mkdir("/work");
      } catch (e) {
        // already there from an earlier run
      }
      for (const name of T.FS.readdir("/work")) {
        if (name !== "." && name !== "..") T.FS.unlink("/work/" + name);
      }
      for (const [path, text] of Object.entries(files)) {
        T.FS.writeFile("/work/" + path, text);
      }
      const code = T.ccall("tcl_run", "string", ["string"], [script]);
      return { code, result: read("tcl_result"), stdout: read("tcl_stdout"), stderr: read("tcl_stderr") };
    },
  };
}
