#!/usr/bin/env bash
# Builds Tcl (Tool Command Language) 8.6 as WebAssembly for the browser
# grader, into app/static/grader/. Needs Docker; everything else runs in the
# emscripten/emsdk image. Rebuild only when upgrading Tcl or changing
# tclwasm.c: the output is committed, so the site never builds it.
set -euo pipefail
TCL_VERSION=8.6.16
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../app/static/grader"
WORK="${TCLWASM_WORK:-$HOME/tclwasm}"
mkdir -p "$WORK" "$OUT"
cd "$WORK"
if [ ! -d "tcl$TCL_VERSION" ]; then
    curl -fL -o tcl.tgz "https://prdownloads.sourceforge.net/tcl/tcl$TCL_VERSION-src.tar.gz"
    tar xzf tcl.tgz
fi
# the few library scripts Tcl_Init and everyday commands need; clock,
# encodings, time zones and the bundled packages are left out
rm -rf lib && mkdir -p lib/tcl8.6
for f in init.tcl auto.tcl package.tcl tclIndex parray.tcl word.tcl history.tcl tm.tcl; do
    cp "tcl$TCL_VERSION/library/$f" lib/tcl8.6/
done
cp "$HERE/tclwasm.c" .
docker run --rm -u "$(id -u):$(id -g)" -v "$WORK:/src" -w /src emscripten/emsdk:latest bash -c "
  set -e
  cd tcl$TCL_VERSION/unix
  if [ ! -f libtcl8.6.a ]; then
    emconfigure ./configure --disable-threads --disable-shared --disable-load --disable-zipfs > cfg.log
    emmake make -j8 libtcl8.6.a > mk.log
  fi
  cd /src
  emcc -O2 tclwasm.c -Itcl$TCL_VERSION/generic tcl$TCL_VERSION/unix/libtcl8.6.a \
    -o tcl.js \
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createTcl -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 -sEXIT_RUNTIME=0 \
    -sEXPORTED_FUNCTIONS=_main,_tcl_run,_tcl_result,_tcl_stdout,_tcl_stderr -sEXPORTED_RUNTIME_METHODS=ccall,FS \
    --embed-file lib/tcl8.6@/usr/local/lib/tcl8.6
"
cp tcl.js tcl.wasm "$OUT/"
ls -la "$OUT"/tcl.js "$OUT"/tcl.wasm
