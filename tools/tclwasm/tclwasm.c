/* Tcl (Tool Command Language) for the browser grader.
 *
 * tcl_run(script) creates a fresh interpreter, runs the script, deletes the
 * interpreter, and returns the outcome: "0" to "4" for the standard Tcl
 * return codes, or "exit" when the script called exit. tcl_result(),
 * tcl_stdout() and tcl_stderr() then return the result (or the exit status)
 * and exactly what the script wrote to each stream. A fresh interpreter per
 * run means one submission can never see state left behind by another.
 *
 * Standard output and standard error are Tcl channels that append to memory
 * buffers, so the grader gets the bytes the script printed with no terminal
 * emulation in between: no carriage returns, no line buffering, and nothing
 * carried over from one run to the next.
 *
 * `exit` is replaced: the real one would end the whole WebAssembly runtime.
 * The replacement records the status and cancels the evaluation with
 * TCL_CANCEL_UNWIND, which `catch` cannot intercept, so a script stops at
 * `exit` exactly as it would in tclsh. */

#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include <tcl.h>

static Tcl_DString out_buf, err_buf, result_buf;
static int exited = 0;
static int exit_status = 0;

/* ---- a write-only channel that appends to a buffer */

static int CaptureClose(ClientData cd, Tcl_Interp *interp) {
    return 0;
}

static int CaptureInput(ClientData cd, char *buf, int n, int *errorCodePtr) {
    *errorCodePtr = EINVAL;
    return -1;
}

static int CaptureOutput(ClientData cd, const char *buf, int n, int *errorCodePtr) {
    Tcl_DStringAppend((Tcl_DString *) cd, buf, n);
    return n;
}

static void CaptureWatch(ClientData cd, int mask) {
}

static int CaptureHandle(ClientData cd, int direction, ClientData *handlePtr) {
    return TCL_ERROR;
}

static Tcl_ChannelType capture_type = {
    "capture", TCL_CHANNEL_VERSION_5, CaptureClose, CaptureInput, CaptureOutput,
    NULL, NULL, NULL, CaptureWatch, CaptureHandle,
    NULL, NULL, NULL, NULL, NULL, NULL
};

static Tcl_Channel open_capture(const char *name, Tcl_DString *buf, int which) {
    Tcl_Channel chan = Tcl_CreateChannel(&capture_type, name, buf, TCL_WRITABLE);
    Tcl_SetChannelOption(NULL, chan, "-translation", "lf");
    Tcl_SetChannelOption(NULL, chan, "-encoding", "utf-8");
    Tcl_SetChannelOption(NULL, chan, "-buffering", "none");
    Tcl_RegisterChannel(NULL, chan);
    Tcl_SetStdChannel(chan, which);
    return chan;
}

/* ---- exit that stops the script without ending the runtime */

static int ExitCmd(ClientData cd, Tcl_Interp *interp, int objc, Tcl_Obj *const objv[]) {
    int status = 0;
    if (objc > 2) {
        Tcl_WrongNumArgs(interp, 1, objv, "?returnCode?");
        return TCL_ERROR;
    }
    if (objc == 2 && Tcl_GetIntFromObj(interp, objv[1], &status) != TCL_OK) {
        return TCL_ERROR;
    }
    exited = 1;
    exit_status = status;
    Tcl_CancelEval(interp, Tcl_NewStringObj("exit", -1), NULL, TCL_CANCEL_UNWIND);
    return TCL_ERROR;
}

int main(void) {
    Tcl_FindExecutable("tclsh");
    /* scripts and sourced files are read as UTF-8, as on a modern Linux tclsh */
    Tcl_SetSystemEncoding(NULL, "utf-8");
    Tcl_DStringInit(&out_buf);
    Tcl_DStringInit(&err_buf);
    Tcl_DStringInit(&result_buf);
    return 0;
}

EMSCRIPTEN_KEEPALIVE const char *tcl_run(const char *script) {
    static char code_text[16];
    Tcl_Channel out_chan, err_chan;
    Tcl_Interp *interp;
    int code;

    Tcl_DStringSetLength(&out_buf, 0);
    Tcl_DStringSetLength(&err_buf, 0);
    Tcl_DStringSetLength(&result_buf, 0);
    exited = 0;
    out_chan = open_capture("stdout", &out_buf, TCL_STDOUT);
    err_chan = open_capture("stderr", &err_buf, TCL_STDERR);

    interp = Tcl_CreateInterp();
    code = Tcl_Init(interp);
    Tcl_CreateObjCommand(interp, "exit", ExitCmd, NULL, NULL);
    if (code == TCL_OK) {
        code = Tcl_Eval(interp, script);
    }
    if (exited) {
        char status_text[16];
        snprintf(code_text, sizeof code_text, "exit");
        snprintf(status_text, sizeof status_text, "%d", exit_status);
        Tcl_DStringAppend(&result_buf, status_text, -1);
    } else {
        snprintf(code_text, sizeof code_text, "%d", code);
        Tcl_DStringAppend(&result_buf, Tcl_GetStringResult(interp), -1);
    }
    Tcl_DeleteInterp(interp);

    Tcl_SetStdChannel(NULL, TCL_STDOUT);
    Tcl_SetStdChannel(NULL, TCL_STDERR);
    Tcl_UnregisterChannel(NULL, out_chan);
    Tcl_UnregisterChannel(NULL, err_chan);
    return code_text;
}

EMSCRIPTEN_KEEPALIVE const char *tcl_result(void) {
    return Tcl_DStringValue(&result_buf);
}

EMSCRIPTEN_KEEPALIVE const char *tcl_stdout(void) {
    return Tcl_DStringValue(&out_buf);
}

EMSCRIPTEN_KEEPALIVE const char *tcl_stderr(void) {
    return Tcl_DStringValue(&err_buf);
}
