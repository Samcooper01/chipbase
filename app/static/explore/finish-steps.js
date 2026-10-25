/* The finishing worked example: the same design, tile4m, picked up
   signed off from the timing example and taken the last distance to a
   file a foundry can build.

   Everything so far has worked on abstracts: a cell was a box with pins,
   because that is all placement, routing and timing needed to know. The
   foundry needs the opposite, every polygon on every layer, so this stage
   fills the empty metal, re-times the block with that metal in place,
   swaps every abstract for its real layout, and then proves two things
   about the result: that every shape obeys the process's rules (design
   rule checking), and that the shapes still form the circuit synthesis
   wrote (layout versus schematic).

   It follows the open flow's own finishing scripts: density_fill.tcl,
   final_report.tcl, the KLayout def2stream.py merge, and the KLayout
   design rule and layout-versus-schematic decks. */

var FinishSteps = (function () {
  "use strict";

  var FS = FloorplanSteps, RT = RoutingSteps, TM = TimingSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks;

  var OPT = {
    top: "tile4m",
    showLayer: "metal3",                 /* the layer the fill figures draw */
    fillLayers: ["metal2", "metal3", "metal4", "metal5", "metal6"],
    minDensity: 0.20,                    /* this process's density rule, per window */
    maxDensity: 0.80,
    windowUm: 20,
    keepout: 0.5,                        /* fill.json space_to_non_fill: clearance to real metal */
    keepoutTight: 0.25,                  /* the what-if in step 3 */
    fillSpace: 0.3,                      /* fill.json space_to_fill: between two fill shapes */
    fillSizes: [2.0, 1.0, 0.5, 0.3],     /* fill.json widths: the largest that fits goes in first */
    avgFillArea: 3.0,                    /* square micrometers a shape, mostly the 2 micrometer squares */
    avgSegment: 6,                       /* micrometers of wire between gaps, for counting fill areas */
    floating: 0.5,                       /* floating fill couples about half as hard as a tied neighbour */
    driveKohm: 1.0,                      /* a mid-sized driver in this library */
  };

  /* GDSII layer numbers, the stream's names for the layers. These are the
     open 45 nanometer process's, which this example's generic library is
     modelled on. */
  var GDS = {
    active: 1, pwell: 2, nwell: 3, nimplant: 4, pimplant: 5, poly: 9, contact: 10,
    metal1: 11, via1: 12, metal2: 13, via2: 14, metal3: 15, via3: 16,
    metal4: 17, via4: 18, metal5: 19, via5: 20, metal6: 21,
  };

  /* ----- one real cell -----
     NAND2_X1 from the Nangate Open Cell Library, the 45 nanometer library
     the open flow ships, read polygon by polygon out of its GDSII file
     (micrometers, origin at the cell's lower left, y up). The abstract is
     the same cell's LEF: only the outline and the metal1 pin shapes. */
  var NAND2 = {
    w: 0.57, h: 1.4,
    layers: {
      nwell: [[[-0.115, 0.59], [0.685, 0.59], [0.685, 1.515], [-0.115, 1.515]]],
      pwell: [[[-0.115, -0.115], [0.685, -0.115], [0.685, 0.59], [-0.115, 0.59]]],
      pimplant: [[[-0.025, 0.59], [0.595, 0.59], [0.595, 1.425], [-0.025, 1.425]]],
      nimplant: [[[-0.025, -0.025], [0.595, -0.025], [0.595, 0.59], [-0.025, 0.59]]],
      active: [[[0.055, 0.09], [0.505, 0.09], [0.505, 0.505], [0.055, 0.505]],
               [[0.055, 0.68], [0.505, 0.68], [0.505, 1.31], [0.055, 1.31]]],
      poly: [[[0.16, 0.04], [0.16, 0.555], [0.115, 0.555], [0.115, 0.63], [0.16, 0.63], [0.16, 1.36],
              [0.21, 1.36], [0.21, 0.04]],
             [[0.35, 0.04], [0.35, 1.36], [0.4, 1.36], [0.4, 0.63], [0.455, 0.63], [0.455, 0.555],
              [0.4, 0.555], [0.4, 0.04]]],
      contact: [[0.06, 0.185], [0.06, 0.325], [0.06, 1.01], [0.06, 1.15], [0.12, 0.56], [0.25, 1.01],
                [0.25, 1.15], [0.385, 0.56], [0.435, 0.185], [0.435, 0.325], [0.435, 1.01],
                [0.435, 1.15]].map(function (p) {
                  return [[p[0], p[1]], [p[0] + 0.065, p[1]], [p[0] + 0.065, p[1] + 0.065], [p[0], p[1] + 0.065]];
                }),
      metal1: [
        [[0.43, 0.15], [0.43, 0.355], [0.25, 0.355], [0.25, 1.25], [0.32, 1.25], [0.32, 0.425], [0.5, 0.425], [0.5, 0.15]],
        [[0, -0.085], [0, 0.085], [0.055, 0.085], [0.055, 0.425], [0.125, 0.425], [0.125, 0.085], [0.57, 0.085], [0.57, -0.085]],
        [[0.055, 0.975], [0.055, 1.315], [0, 1.315], [0, 1.485], [0.57, 1.485], [0.57, 1.315], [0.5, 1.315],
         [0.5, 0.975], [0.43, 0.975], [0.43, 1.315], [0.125, 1.315], [0.125, 0.975]],
        [[0.06, 0.525], [0.185, 0.525], [0.185, 0.7], [0.06, 0.7]],
        [[0.385, 0.525], [0.51, 0.525], [0.51, 0.7], [0.385, 0.7]],
      ],
    },
    /* the order the stream lays them down in the figure: bottom of the
       process first, the way the wafer is built */
    order: ["nwell", "pwell", "pimplant", "nimplant", "active", "poly", "contact", "metal1"],
    pins: [
      { name: "A2", x: 0.1225, y: 0.6125 }, { name: "A1", x: 0.4475, y: 0.6125 },
      { name: "ZN", x: 0.285, y: 0.80 }, { name: "VDD", x: 0.285, y: 1.40 }, { name: "VSS", x: 0.285, y: 0.0 },
    ],
    /* the LEF abstract: the pin shapes, and nothing else */
    lefPins: {
      A1: [[0.385, 0.525, 0.51, 0.7]], A2: [[0.06, 0.525, 0.185, 0.7]],
      ZN: [[0.25, 0.355, 0.5, 0.425], [0.43, 0.15, 0.5, 0.425], [0.25, 0.355, 0.32, 1.25]],
      VDD: [[0, 1.315, 0.57, 1.485], [0.43, 0.975, 0.5, 1.485], [0.055, 0.975, 0.125, 1.485]],
      VSS: [[0, -0.085, 0.57, 0.085], [0.055, -0.085, 0.125, 0.425]],
    },
    /* the four transistors, where poly crosses active: gate rectangle,
       the net on each side, and the width and length the polygons give */
    devices: [
      { id: "M_i_1", type: "NMOS_VTL", g: "A2", l: "VSS", r: "net_0", box: [0.16, 0.09, 0.21, 0.505] },
      { id: "M_i_0", type: "NMOS_VTL", g: "A1", l: "net_0", r: "ZN", box: [0.35, 0.09, 0.40, 0.505] },
      { id: "M_i_3", type: "PMOS_VTL", g: "A2", l: "VDD", r: "ZN", box: [0.16, 0.68, 0.21, 1.31] },
      { id: "M_i_2", type: "PMOS_VTL", g: "A1", l: "ZN", r: "VDD", box: [0.35, 0.68, 0.40, 1.31] },
    ],
    /* the cell's entry in the library's CDL netlist, verbatim */
    cdl: [
      ".SUBCKT NAND2_X1 A1 A2 ZN VDD VSS",
      "*.PININFO A1:I A2:I ZN:O VDD:P VSS:G",
      "*.EQN ZN=!(A1 * A2)",
      "M_i_1 net_0 A2 VSS VSS NMOS_VTL W=0.415000U L=0.050000U",
      "M_i_0 ZN A1 net_0 VSS NMOS_VTL W=0.415000U L=0.050000U",
      "M_i_3 ZN A2 VDD VDD PMOS_VTL W=0.630000U L=0.050000U",
      "M_i_2 VDD A1 ZN VDD PMOS_VTL W=0.630000U L=0.050000U",
      ".ENDS",
    ],
  };

  /* Seven more cells from the same library layout file, polygon by polygon
     (micrometers, origin at each cell's lower left, y up). Widths are the
     cells' LEF sizes. */
  var LIB = {
    TAPCELL_X1: { w: 0.19, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.305,1.515],[0.305,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.305,0.59],[0.305,-0.115]]],
      active: [[[0.04,0.09],[0.04,0.505],[0.145,0.505],[0.145,0.09]],[[0.04,0.68],[0.04,1.31],[0.145,1.31],[0.145,0.68]]],
      contact: [[[0.06,0.185],[0.06,0.25],[0.125,0.25],[0.125,0.185]],[[0.06,0.325],[0.06,0.39],[0.125,0.39],[0.125,0.325]],[[0.06,1.01],[0.06,1.075],[0.125,1.075],[0.125,1.01]],[[0.06,1.15],[0.06,1.215],[0.125,1.215],[0.125,1.15]]],
      metal1: [[[0,-0.085],[0,0.085],[0.06,0.085],[0.06,0.425],[0.13,0.425],[0.13,0.085],[0.19,0.085],[0.19,-0.085]],[[0.06,0.975],[0.06,1.315],[0,1.315],[0,1.485],[0.19,1.485],[0.19,1.315],[0.13,1.315],[0.13,0.975]]] } },
    INV_X1: { w: 0.38, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.495,1.515],[0.495,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.495,0.59],[0.495,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.405,0.59],[0.405,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.405,1.425],[0.405,0.59]]],
      active: [[[0.04,0.09],[0.04,0.505],[0.3,0.505],[0.3,0.09]],[[0.04,0.68],[0.04,1.31],[0.3,1.31],[0.3,0.68]]],
      poly: [[[0.145,0.04],[0.145,0.555],[0.095,0.555],[0.095,0.63],[0.145,0.63],[0.145,1.36],[0.195,1.36],[0.195,0.04]]],
      contact: [[[0.045,0.185],[0.045,0.25],[0.11,0.25],[0.11,0.185]],[[0.045,0.325],[0.045,0.39],[0.11,0.39],[0.11,0.325]],[[0.045,1.01],[0.045,1.075],[0.11,1.075],[0.11,1.01]],[[0.045,1.15],[0.045,1.215],[0.11,1.215],[0.11,1.15]],[[0.1,0.56],[0.1,0.625],[0.165,0.625],[0.165,0.56]],[[0.23,0.185],[0.23,0.25],[0.295,0.25],[0.295,0.185]],[[0.23,0.325],[0.23,0.39],[0.295,0.39],[0.295,0.325]],[[0.23,1.01],[0.23,1.075],[0.295,1.075],[0.295,1.01]],[[0.23,1.15],[0.23,1.215],[0.295,1.215],[0.295,1.15]]],
      metal1: [[[0,-0.085],[0,0.085],[0.04,0.085],[0.04,0.425],[0.11,0.425],[0.11,0.085],[0.38,0.085],[0.38,-0.085]],[[0.04,0.975],[0.04,1.315],[0,1.315],[0,1.485],[0.38,1.485],[0.38,1.315],[0.11,1.315],[0.11,0.975]],[[0.06,0.525],[0.06,0.7],[0.165,0.7],[0.165,0.525]],[[0.23,0.15],[0.23,1.25],[0.325,1.25],[0.325,0.15]]] } },
    NAND2_X1: { w: 0.57, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.685,1.515],[0.685,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.685,0.59],[0.685,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.595,0.59],[0.595,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.595,1.425],[0.595,0.59]]],
      active: [[[0.055,0.09],[0.055,0.505],[0.505,0.505],[0.505,0.09]],[[0.055,0.68],[0.055,1.31],[0.505,1.31],[0.505,0.68]]],
      poly: [[[0.16,0.04],[0.16,0.555],[0.115,0.555],[0.115,0.63],[0.16,0.63],[0.16,1.36],[0.21,1.36],[0.21,0.04]],[[0.35,0.04],[0.35,1.36],[0.4,1.36],[0.4,0.63],[0.455,0.63],[0.455,0.555],[0.4,0.555],[0.4,0.04]]],
      contact: [[[0.06,0.185],[0.06,0.25],[0.125,0.25],[0.125,0.185]],[[0.06,0.325],[0.06,0.39],[0.125,0.39],[0.125,0.325]],[[0.06,1.01],[0.06,1.075],[0.125,1.075],[0.125,1.01]],[[0.06,1.15],[0.06,1.215],[0.125,1.215],[0.125,1.15]],[[0.12,0.56],[0.12,0.625],[0.185,0.625],[0.185,0.56]],[[0.25,1.01],[0.25,1.075],[0.315,1.075],[0.315,1.01]],[[0.25,1.15],[0.25,1.215],[0.315,1.215],[0.315,1.15]],[[0.385,0.56],[0.385,0.625],[0.45,0.625],[0.45,0.56]],[[0.435,0.185],[0.435,0.25],[0.5,0.25],[0.5,0.185]],[[0.435,0.325],[0.435,0.39],[0.5,0.39],[0.5,0.325]],[[0.435,1.01],[0.435,1.075],[0.5,1.075],[0.5,1.01]],[[0.435,1.15],[0.435,1.215],[0.5,1.215],[0.5,1.15]]],
      metal1: [[[0.43,0.15],[0.43,0.355],[0.25,0.355],[0.25,1.25],[0.32,1.25],[0.32,0.425],[0.5,0.425],[0.5,0.15]],[[0,-0.085],[0,0.085],[0.055,0.085],[0.055,0.425],[0.125,0.425],[0.125,0.085],[0.57,0.085],[0.57,-0.085]],[[0.055,0.975],[0.055,1.315],[0,1.315],[0,1.485],[0.57,1.485],[0.57,1.315],[0.5,1.315],[0.5,0.975],[0.43,0.975],[0.43,1.315],[0.125,1.315],[0.125,0.975]],[[0.06,0.525],[0.06,0.7],[0.185,0.7],[0.185,0.525]],[[0.385,0.525],[0.385,0.7],[0.51,0.7],[0.51,0.525]]] } },
    NOR2_X1: { w: 0.57, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.685,1.515],[0.685,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.685,0.59],[0.685,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.595,0.59],[0.595,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.595,1.425],[0.595,0.59]]],
      active: [[[0.055,0.09],[0.055,0.505],[0.505,0.505],[0.505,0.09]],[[0.055,0.68],[0.055,1.31],[0.505,1.31],[0.505,0.68]]],
      poly: [[[0.16,0.04],[0.16,0.555],[0.115,0.555],[0.115,0.63],[0.16,0.63],[0.16,1.36],[0.21,1.36],[0.21,0.04]],[[0.35,0.04],[0.35,1.36],[0.4,1.36],[0.4,0.63],[0.455,0.63],[0.455,0.555],[0.4,0.555],[0.4,0.04]]],
      contact: [[[0.06,0.185],[0.06,0.25],[0.125,0.25],[0.125,0.185]],[[0.06,0.325],[0.06,0.39],[0.125,0.39],[0.125,0.325]],[[0.06,1.01],[0.06,1.075],[0.125,1.075],[0.125,1.01]],[[0.06,1.15],[0.06,1.215],[0.125,1.215],[0.125,1.15]],[[0.12,0.56],[0.12,0.625],[0.185,0.625],[0.185,0.56]],[[0.25,0.185],[0.25,0.25],[0.315,0.25],[0.315,0.185]],[[0.25,0.325],[0.25,0.39],[0.315,0.39],[0.315,0.325]],[[0.385,0.56],[0.385,0.625],[0.45,0.625],[0.45,0.56]],[[0.435,0.185],[0.435,0.25],[0.5,0.25],[0.5,0.185]],[[0.435,0.325],[0.435,0.39],[0.5,0.39],[0.5,0.325]],[[0.435,1.01],[0.435,1.075],[0.5,1.075],[0.5,1.01]],[[0.435,1.15],[0.435,1.215],[0.5,1.215],[0.5,1.15]]],
      metal1: [[[0.25,0.15],[0.25,1.045],[0.43,1.045],[0.43,1.25],[0.5,1.25],[0.5,0.975],[0.32,0.975],[0.32,0.15]],[[0,-0.085],[0,0.085],[0.055,0.085],[0.055,0.425],[0.125,0.425],[0.125,0.085],[0.43,0.085],[0.43,0.425],[0.5,0.425],[0.5,0.085],[0.57,0.085],[0.57,-0.085]],[[0.055,0.975],[0.055,1.315],[0,1.315],[0,1.485],[0.57,1.485],[0.57,1.315],[0.125,1.315],[0.125,0.975]],[[0.06,0.525],[0.06,0.7],[0.185,0.7],[0.185,0.525]],[[0.385,0.525],[0.385,0.7],[0.51,0.7],[0.51,0.525]]] } },
    BUF_X1: { w: 0.57, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.685,1.515],[0.685,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.685,0.59],[0.685,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.595,0.59],[0.595,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.595,1.425],[0.595,0.59]]],
      active: [[[0.04,0.09],[0.04,0.3],[0.265,0.3],[0.265,0.505],[0.49,0.505],[0.49,0.09]],[[0.265,0.68],[0.265,0.995],[0.04,0.995],[0.04,1.31],[0.49,1.31],[0.49,0.68]]],
      poly: [[[0.145,0.04],[0.145,0.555],[0.12,0.555],[0.12,0.63],[0.145,0.63],[0.145,1.36],[0.195,1.36],[0.195,0.04]],[[0.335,0.04],[0.335,0.555],[0.285,0.555],[0.285,0.63],[0.335,0.63],[0.335,1.36],[0.385,1.36],[0.385,0.04]]],
      contact: [[[0.045,0.225],[0.045,0.29],[0.11,0.29],[0.11,0.225]],[[0.045,1],[0.045,1.065],[0.11,1.065],[0.11,1]],[[0.045,1.14],[0.045,1.205],[0.11,1.205],[0.11,1.14]],[[0.125,0.56],[0.125,0.625],[0.19,0.625],[0.19,0.56]],[[0.23,0.225],[0.23,0.29],[0.295,0.29],[0.295,0.225]],[[0.23,1],[0.23,1.065],[0.295,1.065],[0.295,1]],[[0.23,1.14],[0.23,1.205],[0.295,1.205],[0.295,1.14]],[[0.29,0.56],[0.29,0.625],[0.355,0.625],[0.355,0.56]],[[0.42,0.225],[0.42,0.29],[0.485,0.29],[0.485,0.225]],[[0.42,0.365],[0.42,0.43],[0.485,0.43],[0.485,0.365]],[[0.42,1],[0.42,1.065],[0.485,1.065],[0.485,1]],[[0.42,1.14],[0.42,1.205],[0.485,1.205],[0.485,1.14]]],
      metal1: [[[0.045,0.19],[0.045,0.46],[0.285,0.46],[0.285,0.83],[0.045,0.83],[0.045,1.24],[0.115,1.24],[0.115,0.9],[0.355,0.9],[0.355,0.39],[0.115,0.39],[0.115,0.19]],[[0,-0.085],[0,0.085],[0.225,0.085],[0.225,0.325],[0.295,0.325],[0.295,0.085],[0.57,0.085],[0.57,-0.085]],[[0.225,0.965],[0.225,1.315],[0,1.315],[0,1.485],[0.57,1.485],[0.57,1.315],[0.295,1.315],[0.295,0.965]],[[0.06,0.525],[0.06,0.7],[0.19,0.7],[0.19,0.525]],[[0.42,0.19],[0.42,1.24],[0.51,1.24],[0.51,0.19]]] } },
    AOI21_X1: { w: 0.76, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.875,1.515],[0.875,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.875,0.59],[0.875,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.785,0.59],[0.785,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.785,1.425],[0.785,0.59]]],
      active: [[[0.08,0.09],[0.08,0.505],[0.72,0.505],[0.72,0.09]],[[0.08,0.68],[0.08,1.31],[0.72,1.31],[0.72,0.68]]],
      poly: [[[0.565,0.04],[0.565,1.36],[0.615,1.36],[0.615,0.63],[0.645,0.63],[0.645,0.555],[0.615,0.555],[0.615,0.04]],[[0.185,0.04],[0.185,0.555],[0.13,0.555],[0.13,0.63],[0.185,0.63],[0.185,1.36],[0.235,1.36],[0.235,0.04]],[[0.375,0.04],[0.375,1.36],[0.425,1.36],[0.425,0.63],[0.47,0.63],[0.47,0.555],[0.425,0.555],[0.425,0.04]]],
      contact: [[[0.085,0.185],[0.085,0.25],[0.15,0.25],[0.15,0.185]],[[0.085,0.325],[0.085,0.39],[0.15,0.39],[0.15,0.325]],[[0.085,0.94],[0.085,1.005],[0.15,1.005],[0.15,0.94]],[[0.085,1.08],[0.085,1.145],[0.15,1.145],[0.15,1.08]],[[0.135,0.56],[0.135,0.625],[0.2,0.625],[0.2,0.56]],[[0.27,0.875],[0.27,0.94],[0.335,0.94],[0.335,0.875]],[[0.27,1.015],[0.27,1.08],[0.335,1.08],[0.335,1.015]],[[0.4,0.56],[0.4,0.625],[0.465,0.625],[0.465,0.56]],[[0.46,0.185],[0.46,0.25],[0.525,0.25],[0.525,0.185]],[[0.46,0.325],[0.46,0.39],[0.525,0.39],[0.525,0.325]],[[0.46,0.94],[0.46,1.005],[0.525,1.005],[0.525,0.94]],[[0.46,1.08],[0.46,1.145],[0.525,1.145],[0.525,1.08]],[[0.575,0.56],[0.575,0.625],[0.64,0.625],[0.64,0.56]],[[0.65,0.115],[0.65,0.18],[0.715,0.18],[0.715,0.115]],[[0.65,0.255],[0.65,0.32],[0.715,0.32],[0.715,0.255]],[[0.65,0.94],[0.65,1.005],[0.715,1.005],[0.715,0.94]],[[0.65,1.08],[0.65,1.145],[0.715,1.145],[0.715,1.08]]],
      metal1: [[[0.44,0.15],[0.44,0.355],[0.265,0.355],[0.265,1.115],[0.335,1.115],[0.335,0.425],[0.525,0.425],[0.525,0.15]],[[0.085,0.905],[0.085,1.25],[0.525,1.25],[0.525,0.905],[0.455,0.905],[0.455,1.18],[0.155,1.18],[0.155,0.905]],[[0,-0.085],[0,0.085],[0.08,0.085],[0.08,0.425],[0.15,0.425],[0.15,0.085],[0.645,0.085],[0.645,0.355],[0.715,0.355],[0.715,0.085],[0.76,0.085],[0.76,-0.085]],[[0.645,0.905],[0.645,1.315],[0,1.315],[0,1.485],[0.76,1.485],[0.76,1.315],[0.715,1.315],[0.715,0.905]],[[0.06,0.525],[0.06,0.7],[0.2,0.7],[0.2,0.525]],[[0.4,0.525],[0.4,0.7],[0.51,0.7],[0.51,0.525]],[[0.575,0.525],[0.575,0.7],[0.7,0.7],[0.7,0.525]]] } },
    FILLCELL_X1: { w: 0.19, layers: {
      nwell: [[[-0.115,0.59],[-0.115,1.515],[0.305,1.515],[0.305,0.59]]],
      pwell: [[[-0.115,-0.115],[-0.115,0.59],[0.305,0.59],[0.305,-0.115]]],
      nimplant: [[[-0.025,-0.025],[-0.025,0.59],[0.215,0.59],[0.215,-0.025]]],
      pimplant: [[[-0.025,0.59],[-0.025,1.425],[0.215,1.425],[0.215,0.59]]],
      metal1: [[[0,-0.085],[0,0.085],[0.19,0.085],[0.19,-0.085]],[[0,1.315],[0,1.485],[0.19,1.485],[0.19,1.315]]] } },
  };

  /* transistors per cell, from the same CDL, for the cell types the
     synthesis example's statistics name; the rest are counted at the
     average of those */
  var DEVICES = { NAND2_X1: 4, INV_X1: 2, BUF_X1: 4, AOI21_X1: 6, OAI21_X1: 6, NAND3_X1: 6,
                  DFF_X1: 28, DFFR_X1: 32, CLKBUF_X2: 6, CLKBUF_X3: 8 };
  var SYNTH_COUNTS = { AOI21_X1: 5142, BUF_X1: 2310, INV_X1: 6884, NAND2_X1: 9903, NAND3_X1: 4127, OAI21_X1: 5510 };

  var _M = null;
  function core() { return FS.theModel(); }

  /* how much of a window fill can still use: every stretch of real metal
     takes its own width plus the keepout on both sides out of play */
  function freeShare(d, width, keep) {
    return Math.exp(-(d / width) * (width + 2 * keep));
  }

  function model() {
    if (_M) return _M;
    var R = RT.model(), T = TM.model(), z = R.z, ms = R.ms, fm = core();
    var die = R.fc.die, fin = R.iters[8];
    var bw = die.bw * z.coreW / die.w, bh = die.bh * z.coreH / die.h;

    /* ----- the windows -----
       The density rule is evaluated on the router's own 25 by 25 bins,
       20.35 micrometers across, which is close enough to the rule's 20
       micrometer window to stand for it. A window whose middle is inside
       a memory is the memory's business: its metal is its maker's, and
       they checked it. */
    var wins = [];
    for (var b = 0; b < fin.ratio.length; b++) {
      var bx = (b % die.nx) * bw, by = ((b / die.nx) | 0) * bh;
      var cx = bx + bw / 2, cy = by + bh / 2;
      var mac = ms.some(function (m) { return cx > m.x && cx < m.x + m.w && cy > m.y && cy < m.y + m.h; });
      wins.push({ b: b, x: bx, y: by, w: bw, h: bh, mac: mac, r: fin.ratio[b] });
    }
    var open = wins.filter(function (w) { return !w.mac; });
    var meanRatio = open.reduce(function (a, w) { return a + w.r; }, 0) / open.length;

    /* ----- density, layer by layer, from the metal that was drawn -----
       Each layer's routed length times its width, plus the power stripes
       on the layers that carry them, over the area that layer covers
       (the memories own metal1 to metal4). */
    var P = FS.PDN, pdn = fm.pdn;
    function stripeArea(name) {
      if (name === "metal4") {
        var n4 = pdn.m4.VDD.length + pdn.m4.VSS.length;
        var cut = ms.reduce(function (a, m) { return a + m.h; }, 0) / ms.length / z.coreH;
        return n4 * P.stripeWidth * z.coreH * (1 - cut / 2);
      }
      if (name === "metal5") return (pdn.m5.VDD.length + pdn.m5.VSS.length) * P.stripeWidth * z.coreW;
      return 0;
    }
    var coreArea = z.coreW * z.coreH, macroArea = ms.reduce(function (a, m) { return a + m.w * m.h; }, 0);
    var layers = OPT.fillLayers.map(function (name) {
      var L = FS.LAYER_BY[name], rl = R.layers.filter(function (l) { return l.name === name; })[0];
      var owned = name === "metal2" || name === "metal3" || name === "metal4";
      var area = coreArea - (owned ? macroArea : 0);
      var d = (rl.demand * L.width + stripeArea(name)) / area;
      return {
        name: name, gds: GDS[name], width: L.width, demand: rl.demand, usage: rl.demand / rl.supply,
        before: d, area: area, areas: Math.round(rl.demand / OPT.avgSegment),
      };
    });
    var show = layers.filter(function (l) { return l.name === OPT.showLayer; })[0];

    /* the shown layer, window by window: the routed metal follows the
       router's own congestion map, scaled so the windows average exactly
       the layer's real density */
    var Ls = FS.LAYER_BY[OPT.showLayer];
    open.forEach(function (w) { w.d = show.before * w.r / meanRatio; });

    /* fill one typical window for real, and take the coverage from it:
       what share of the room left after the keepouts the shapes cover */
    /* the window the figure enlarges: on the bottom row of the core,
       halfway between the two lower memories, where the placement example
       left the cells sparsest away from the corners */
    var low = ms.filter(function (m) { return m.y + m.h / 2 > z.coreH / 2; })
      .sort(function (p, q) { return p.x - q.x; });
    var midX = (low[0].x + low[0].w + low[low.length - 1].x) / 2;
    var pick = wins[(die.ny - 1) * die.nx + Math.floor(midX / bw)];
    var pg = PlacementSteps.grid(), pmod = PlacementSteps.model();
    var cellShare = PlacementSteps.densityOf(pg, pmod.gpr)[pick.b];
    var zoom = zoomScene(pick, cellShare);
    var cover = zoom.cover;
    /* and the room the keepouts leave, scaled so a window like the one
       that was packed comes out exactly as the packing did */
    var roomCal = (zoom.freeArea / (zoom.um * zoom.um)) / freeShare(zoom.before, Ls.width, OPT.keepout);
    function room(d, width) { return Math.min(1, roomCal * freeShare(d, width, OPT.keepout)); }
    open.forEach(function (w) { w.a = w.d + cover * room(w.d, Ls.width); });
    layers.forEach(function (l) {
      l.after = l.before + cover * room(l.before, l.width);
      l.fillArea = (l.after - l.before) * l.area;
      l.shapes = Math.round(l.fillArea / OPT.avgFillArea);
    });
    var failBefore = open.filter(function (w) { return w.d < OPT.minDensity; }).length;
    var failAfter = open.filter(function (w) { return w.a < OPT.minDensity || w.a > OPT.maxDensity; }).length;
    function span(key) {
      var v = open.map(function (w) { return w[key]; });
      return { lo: Math.min.apply(null, v), hi: Math.max.apply(null, v) };
    }

    /* cumulative fill counts, the way the tool reports them */
    var total = 0;
    layers.forEach(function (l) { total += l.shapes; l.total = total; });

    /* ----- what the fill does to the timing -----
       Fill goes where the wires are not, so a wire that had empty space
       beside it now has floating metal a keepout away. That adds coupling:
       the timing example's own coupling share, scaled by how much further
       away the fill sits than a neighbouring wire at minimum spacing, by
       how weakly floating metal couples, and by how much room there was
       for fill along the path. The worst path runs through the hub in the
       middle of the block, so it sees the middle windows' density. */
    var mid = open.filter(function (w) {
      return Math.abs(w.x + bw / 2 - z.coreW / 2) < 2.5 * bw && Math.abs(w.y + bh / 2 - z.coreH / 2) < 2.5 * bh;
    });
    var midD = mid.reduce(function (a, w) { return a + w.d; }, 0) / mid.length;
    var sMin = (Ls.dir === "horizontal" ? Ls.yp : Ls.xp) - Ls.width;
    var cPerUm = FS.wireRC(OPT.showLayer).c;
    var share = TM.OPT.couplingShare;
    function fillHit(keep) {
      var perUm = cPerUm * share * Math.min(1, sMin / keep) * OPT.floating * freeShare(midD, Ls.width, keep);
      var nets = TM.DATA.filter(function (s) { return s.len > 0; }).map(function (s) {
        var dc = s.len * perUm;
        return { net: s.net, cell: s.cell, len: s.len, d: s.d, dc: dc, dd: OPT.driveKohm * dc };
      });
      var dd = nets.reduce(function (a, n) { return a + n.dd; }, 0);
      return { perUm: perUm, nets: nets, exact: dd, delay: Math.round(dd) };
    }
    var hit = fillHit(OPT.keepout), hitTight = fillHit(OPT.keepoutTight);
    var slack = T.slack - hit.delay, slackTight = T.slack - hitTight.delay;
    /* design-wide: every signal net gains the same kind of capacitance */
    var addedC = T.wireC * share * Math.min(1, sMin / OPT.keepout) * OPT.floating *
                 open.reduce(function (a, w) { return a + freeShare(w.d, Ls.width, OPT.keepout); }, 0) / open.length;

    /* ----- what the stream and the checks count ----- */
    var sd = SYNTH_COUNTS, named = 0, namedDev = 0;
    Object.keys(sd).forEach(function (k) { named += sd[k]; namedDev += sd[k] * DEVICES[k]; });
    var avgComb = namedDev / named;
    var syn = SynthesisLike(R);
    var flopDev = syn.dff * DEVICES.DFF_X1 + syn.dffr * DEVICES.DFFR_X1 + syn.dffe * (DEVICES.DFF_X1 + 12);
    var otherComb = Math.max(0, syn.comb - named);
    var added = R.insts - syn.cells;                 /* buffers the later stages inserted */
    var devices = Math.round(namedDev + otherComb * avgComb + flopDev + added * 6);

    _M = {
      R: R, T: T, z: z, ms: ms, wins: wins, open: open, bw: bw, bh: bh,
      layers: layers, show: show, zoom: zoom, cover: cover, failBefore: failBefore, failAfter: failAfter,
      spanBefore: span("d"), spanAfter: span("a"), fills: total,
      midD: midD, hit: hit, hitTight: hitTight, slack: slack, slackTight: slackTight,
      holdSlack: T.holdSlack, addedC: addedC,
      devices: devices, insts: R.insts, nets: R.nets,
      drc: drcRules(),
    };
    _M.ir = irModel(_M);
    return _M;
  }

  /* the synthesis example's register split, without loading that
     example: 12% of the cells are flip-flops, split 32 / 61 / 7 */
  function SynthesisLike(R) {
    var cells = core().z.fg.cells, flops = Math.round(cells * 0.12);
    return {
      cells: cells, comb: cells - flops,
      dff: Math.round(flops * 0.32), dffr: Math.round(flops * 0.61), dffe: Math.round(flops * 0.07),
    };
  }

  /* ----- the rule deck -----
     The open flow's 45 nanometer KLayout deck, cut to this process's six
     metal layers, with the density rules this process adds (the open deck
     has none; a foundry's always does). Counts are rules per group. */
  function drcRules() {
    var groups = [
      { k: "WELL", n: 4, what: "well overlap, spacing, width" },
      { k: "VT", n: 2, what: "threshold-adjust layers inside a well" },
      { k: "POLY", n: 4, what: "gate width, poly spacing, poly to active" },
      { k: "ACTIVE", n: 4, what: "diffusion width, spacing, well enclosure" },
      { k: "IMPLANT", n: 5, what: "implant spacing to the channel and contacts" },
      { k: "CONTACT", n: 6, what: "contact size, spacing, enclosure" },
      { k: "METAL1 to METAL3", n: 30, what: "width, spacing, wide-metal spacing, via enclosure, antenna" },
      { k: "METAL4 to METAL6", n: 18, what: "width, spacing, wide-metal spacing, antenna" },
      { k: "VIA1 to VIA5", n: 20, what: "via size, spacing, and landing on both metals" },
      { k: "DENSITY", n: 10, what: "minimum and maximum density, metal2 to metal6" },
    ];
    var total = groups.reduce(function (a, g) { return a + g.n; }, 0);
    return { groups: groups, total: total };
  }

  /* ================= drawing ================= */

  function rnd(seed) { return function () { var x = Math.sin(seed++ * 17.137) * 24634.6345; return x - Math.floor(x); }; }
  function pts(poly, X, Y) {
    return poly.map(function (p) { return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join(" ");
  }

  /* ----- one window, filled the way density_fill fills it -----
     The window is a real one: on the bottom edge of the core, between the
     two lower memories, where the placement left the cells sparse. Its
     rows hold logic cells in the share the placement example's density
     map gives that spot, a tap cell where the tap column crosses it, and
     filler cells in every gap, as the routing example left them. Over the
     cells runs metal3 at that window's density. Fill then works on metal3
     alone: every wire takes a keepout band out of play, and the shapes go
     in largest first, each a fill spacing from the last. The packing is
     computed here, on a 50 nanometer grid, and it is also where the
     model's fill coverage comes from. */
  var ZW = { px: 15, g: 0.05 };
  var SITES = [3, 3, 4, 4, 5, 6, 8, 10, 12];      /* cell widths, in sites */

  function zoomScene(win, cellShare) {
    var um = win.w, L = FS.LAYER_BY[OPT.showLayer], pitch = L.dir === "horizontal" ? L.yp : L.xp;
    var r = rnd(9), n = Math.round(um / ZW.g);

    /* the rows under the metal: logic, taps and fillers */
    var rowH = FS.ROW_H, site = FS.SITE_W, tap = FS.TAP;
    var cells = [], k0 = Math.floor(win.y / rowH), k1 = Math.ceil((win.y + um) / rowH);
    for (var k = k0; k < k1; k++) {
      var y = k * rowH - win.y;
      /* taps sit every tap distance across the core, whatever the window */
      var taps = [];
      for (var tx = Math.ceil(win.x / tap.dist) * tap.dist; tx < win.x + um; tx += tap.dist) taps.push(tx - win.x);
      var x = 0;
      var edges = taps.concat([um]);
      edges.forEach(function (stop) {
        while (x < stop - 0.01) {
          var w = Math.min(SITES[Math.floor(r() * SITES.length)] * site, stop - x);
          cells.push({ x: x, y: y, w: w, h: rowH, t: r() < cellShare ? "cell" : "filler" });
          x += w;
        }
        if (stop < um) { cells.push({ x: stop, y: y, w: tap.tapW, h: rowH, t: "tap" }); x = stop + tap.tapW; }
      });
    }

    /* metal3 over them, on its tracks, at this window's density */
    var wires = [], metal = 0, want = win.d * um * um;
    var tracks = Math.floor(um / pitch), guard = 0;
    while (metal < want && guard++ < 400) {
      var t = Math.floor(r() * tracks), wy = (t + 0.5) * pitch - L.width / 2;
      var x0 = r() * (um - 3), len = 2 + r() * 9, x1 = Math.min(um, x0 + len);
      if (wires.some(function (w) { return w.y === wy && x0 < w.x1 + 1 && x1 > w.x0 - 1; })) continue;
      wires.push({ x0: x0, x1: x1, y: wy, h: L.width });
      metal += (x1 - x0) * L.width;
    }

    /* the grid: 1 where fill may not go */
    var occ = new Uint8Array(n * n);
    function mark(ax0, ay0, ax1, ay1) {
      var i0 = Math.max(0, Math.floor(ax0 / ZW.g)), i1 = Math.min(n, Math.ceil(ax1 / ZW.g));
      var j0 = Math.max(0, Math.floor(ay0 / ZW.g)), j1 = Math.min(n, Math.ceil(ay1 / ZW.g));
      for (var j = j0; j < j1; j++) for (var i = i0; i < i1; i++) occ[j * n + i] = 1;
    }
    wires.forEach(function (w) { mark(w.x0 - OPT.keepout, w.y - OPT.keepout, w.x1 + OPT.keepout, w.y + w.h + OPT.keepout); });
    var freeCells = 0;
    for (var q = 0; q < occ.length; q++) if (!occ[q]) freeCells++;
    var freeArea = freeCells * ZW.g * ZW.g;
    var fills = [];
    OPT.fillSizes.forEach(function (s) {
      var kk = Math.round(s / ZW.g), sp = Math.round(OPT.fillSpace / ZW.g);
      /* a summed-area table of what is blocked, rebuilt once per size */
      var I = new Int32Array((n + 1) * (n + 1));
      for (var j = 0; j < n; j++) {
        var row = 0;
        for (var i = 0; i < n; i++) { row += occ[j * n + i]; I[(j + 1) * (n + 1) + i + 1] = I[j * (n + 1) + i + 1] + row; }
      }
      function blocked(i, j) {
        return I[(j + kk) * (n + 1) + i + kk] - I[j * (n + 1) + i + kk] - I[(j + kk) * (n + 1) + i] + I[j * (n + 1) + i];
      }
      var placed = [];
      for (var j = 0; j + kk <= n; j++) {
        for (var i = 0; i + kk <= n; i++) {
          if (blocked(i, j)) continue;
          /* only squares placed in the last few rows can be in the way,
             and they are at the end of the list, which is in scan order */
          var clash = false;
          for (var p = placed.length - 1; p >= 0; p--) {
            var pp = placed[p];
            if (pp.j + kk + sp <= j) break;
            if (i < pp.i + kk + sp && i + kk + sp > pp.i) { clash = true; break; }
          }
          if (clash) continue;
          placed.push({ i: i, j: j });
          i += kk + sp - 1;
        }
      }
      placed.forEach(function (pp) {
        fills.push({ x: pp.i * ZW.g, y: pp.j * ZW.g, s: s });
        mark((pp.i - sp) * ZW.g, (pp.j - sp) * ZW.g, (pp.i + kk + sp) * ZW.g, (pp.j + kk + sp) * ZW.g);
      });
    });
    var fillArea = fills.reduce(function (a, f) { return a + f.s * f.s; }, 0);
    var logic = cells.filter(function (c) { return c.t === "cell"; }).reduce(function (a, c) { return a + c.w * c.h; }, 0);
    return { um: um, win: win, cells: cells, wires: wires, fills: fills, metal: metal, freeArea: freeArea,
             fillArea: fillArea, before: metal / (um * um), after: (metal + fillArea) / (um * um),
             cover: fillArea / freeArea, cellShare: cellShare, logicShare: logic / (um * um) };
  }

  /* the block with nothing but its cells, the window marked on it, and
     the window itself enlarged beside it */
  var WF = { die: 300, ox: 16, oy: 50, gap: 64, key: 200 };

  function windowFigure(M) {
    var sc = M.zoom, z = M.z, P = ZW.px, mg = FS.SIZING.margin;
    var s = WF.die / z.dieW, o = [];
    var ex = WF.ox + WF.die + WF.gap, ey = WF.oy, E = sc.um * P;
    var W = ex + E + WF.key, H = WF.oy + Math.max(WF.die, E) + 30;
    function OX(x) { return WF.ox + (mg + x) * s; }
    function OY(y) { return WF.oy + (mg + y) * s; }
    function X(x) { return ex + x * P; }
    function Y(y) { return ey + y * P; }
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-zoom" role="img" aria-label="The block with ' +
           "only its cells showing, one sparse window on it marked, and that window enlarged, where metal fill " +
           'is added on metal3 above the cells">');
    o.push('<text class="ff3-cap" x="' + WF.ox + '" y="20">the block, cells only</text>');
    o.push('<text class="ff3-cap" x="' + ex + '" y="20">that window, ' + f1(sc.um) + " µm across</text>");
    o.push('<text class="ff3-cap fn-zsay" id="fn-zsay" x="' + ex + '" y="38">press play</text>');

    /* the overview: die, core, memories, and the placement example's cells */
    o.push(overviewMarkup(M, WF.ox, WF.oy, WF.die).svg);
    var w = sc.win, mx0 = OX(w.x), my0 = OY(w.y), mx1 = OX(w.x + w.w), my1 = OY(w.y + w.h);
    o.push('<rect class="fn-mark" x="' + mx0.toFixed(1) + '" y="' + my0.toFixed(1) + '" width="' + (mx1 - mx0).toFixed(1) +
           '" height="' + (my1 - my0).toFixed(1) + '"/>');
    /* the callout, from the mark to the enlargement */
    o.push('<line class="fn-callout" x1="' + mx1.toFixed(1) + '" y1="' + my0.toFixed(1) + '" x2="' + X(0) + '" y2="' + Y(0) + '"/>');
    o.push('<line class="fn-callout" x1="' + mx1.toFixed(1) + '" y1="' + my1.toFixed(1) + '" x2="' + X(0) + '" y2="' + Y(sc.um) + '"/>');

    /* the enlargement */
    o.push('<clipPath id="fn-zclip"><rect x="' + X(0) + '" y="' + Y(0) + '" width="' + E + '" height="' + E + '"/></clipPath>');
    o.push('<rect class="fn-zwin" x="' + X(0) + '" y="' + Y(0) + '" width="' + E + '" height="' + E + '"/>');
    o.push('<g clip-path="url(#fn-zclip)" id="fn-zlayer">');
    o.push('<g id="fn-zcells">');
    sc.cells.forEach(function (c) {
      o.push('<rect class="fn-' + c.t + '" x="' + (X(c.x) + 0.4).toFixed(1) + '" y="' + (Y(c.y) + 0.4).toFixed(1) +
             '" width="' + Math.max(0.5, c.w * P - 0.8).toFixed(1) + '" height="' + (c.h * P - 0.8).toFixed(1) + '"/>');
    });
    o.push("</g>");
    sc.wires.forEach(function (wr) {
      o.push('<rect class="fn-keep" x="' + X(wr.x0 - OPT.keepout).toFixed(1) + '" y="' + Y(wr.y - OPT.keepout).toFixed(1) +
             '" width="' + ((wr.x1 - wr.x0 + 2 * OPT.keepout) * P).toFixed(1) + '" height="' +
             ((wr.h + 2 * OPT.keepout) * P).toFixed(1) + '" style="display:none"/>');
    });
    sc.fills.forEach(function (f) {
      o.push('<rect class="fn-fill" data-s="' + f.s + '" x="' + X(f.x).toFixed(1) + '" y="' + Y(f.y).toFixed(1) +
             '" width="' + (f.s * P).toFixed(1) + '" height="' + (f.s * P).toFixed(1) + '" style="display:none"/>');
    });
    sc.wires.forEach(function (wr) {
      o.push('<rect class="fn-wire" x="' + X(wr.x0).toFixed(1) + '" y="' + Y(wr.y).toFixed(1) + '" width="' +
             ((wr.x1 - wr.x0) * P).toFixed(1) + '" height="' + Math.max(1.5, wr.h * P).toFixed(1) + '" style="display:none"/>');
    });
    o.push("</g>");

    /* the key, down the right-hand side */
    var kx = X(sc.um) + 22, ky = Y(0) + 6;
    [["fn-cell", "logic cells"], ["fn-tap", "tap cell"], ["fn-filler", "filler cells"],
     ["fn-wire", "metal3 routing"], ["fn-keep", "keepout, " + OPT.keepout + " µm"],
     ["fn-fill", "metal fill squares"]].forEach(function (kv, i) {
      o.push('<rect class="' + kv[0] + '" x="' + kx + '" y="' + (ky + i * 22) + '" width="14" height="10"/>');
      o.push('<text class="fn-key" x="' + (kx + 20) + '" y="' + (ky + i * 22 + 9) + '">' + kv[1] + "</text>");
    });
    o.push('<text class="fn-key" x="' + (kx + 20) + '" y="' + (ky + 6 * 22 + 5) + '">' + OPT.fillSizes.join(", ") + " µm</text>");
    o.push('<text class="fn-key fn-kbold" id="fn-zden" x="' + kx + '" y="' + (ky + 8 * 22) + '"></text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout"><span>logic cells in this window <b>' + Math.round(sc.logicShare * 100) + "%</b></span>" +
      '<span>metal3 density <b id="fn-zdread">' + f1(sc.before * 100) + "%</b></span>" +
      '<button class="ff-reset" type="button" id="fn-zreplay">replay</button></div>';
  }

  /* the placement example's own cells, at its final frame */
  function PL_cells() {
    var pm = PlacementSteps.model();
    return PlacementSteps.cellLayer(pm, pm.frames.length - 1).core;
  }

  function zoomAnimate(M) {
    var root = document.getElementById("flow-fig-2");
    if (!root) return;
    var sc = M.zoom, say = document.getElementById("fn-zsay"), den = document.getElementById("fn-zdread");
    var cellsG = document.getElementById("fn-zcells"), replay = document.getElementById("fn-zreplay");
    /* only the enlargement animates: the key uses the same classes */
    var layer = document.getElementById("fn-zlayer");
    if (!layer) return;
    var keeps = layer.querySelectorAll(".fn-keep"), wires = layer.querySelectorAll(".fn-wire"), timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      keeps.forEach(function (k) { k.style.display = "none"; });
      wires.forEach(function (w) { w.style.display = "none"; });
      layer.querySelectorAll(".fn-fill").forEach(function (f) { f.style.display = "none"; });
      if (cellsG) cellsG.classList.remove("fn-under");
      if (den) den.textContent = f1(sc.before * 100) + "%";
      if (say) say.textContent = "sparse logic; filler cells take the rest of every row";
      later(1400, function () {
        if (cellsG) cellsG.classList.add("fn-under");
        wires.forEach(function (w) { w.style.display = ""; });
        if (say) say.textContent = "fill goes on metal3, above the cells: only these wires are in its way";
      });
      later(2800, function () {
        keeps.forEach(function (k) { k.style.display = ""; });
        if (say) say.textContent = "each wire takes a keepout band out of play";
      });
      var area = sc.metal;
      OPT.fillSizes.forEach(function (s, i) {
        later(4000 + i * 1100, function () {
          var shown = layer.querySelectorAll('.fn-fill[data-s="' + s + '"]');
          shown.forEach(function (f) { f.style.display = ""; area += s * s; });
          if (say) say.textContent = shown.length + " squares of " + s + " µm go in wherever they fit";
          if (den) den.textContent = f1(100 * area / (sc.um * sc.um)) + "%";
        });
      });
      later(4000 + OPT.fillSizes.length * 1100 + 300, function () {
        if (say) say.textContent = "metal3 here: " + f1(sc.before * 100) + "% before, " + f1(sc.after * 100) +
          "% after, over the " + Math.round(OPT.minDensity * 100) + "% minimum";
      });
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- what the fill cost the worst path, stage by stage -----
     Each stage of the timing example's worst path, with its delay before
     fill (as the timing example reported it) and after (plus the delay of
     driving the capacitance the fill added beside its net). The changes
     are under a picosecond each, far too small to see on bars drawn from
     zero, so the numbers are printed and the slack they add up to is
     drawn on its own axis, step by step. */
  var PF = { W: 680, top: 52, rowH: 19, cx: [12, 318, 400, 470, 540] };

  function pathFigure(M) {
    var nets = M.hit.nets, o = [], c = PF.cx;
    var tabH = PF.top + nets.length * PF.rowH + 3 * PF.rowH + 14;
    /* the waterfall under it */
    var wTop = tabH + 44, wH = 150, wX0 = 70, step = (PF.W - wX0 - 90) / (nets.length + 1);
    var sHi = M.T.slack + 1.5, sLo = M.T.slack - M.hit.exact - 1.5;
    function SY(v) { return wTop + (sHi - v) / (sHi - sLo) * wH; }
    var H = wTop + wH + 40;
    o.push('<svg viewBox="0 0 ' + PF.W + " " + H + '" class="ff3-svg fn-path" role="img" aria-label="Each stage of ' +
           'the worst path with its delay before and after fill, and the setup slack falling stage by stage">');
    o.push('<text class="ff3-cap fn-psay" id="fn-psay" x="12" y="20">press play</text>');
    [["stage: the gate driving the net", c[0], "start"], ["wire", c[1], "end"], ["before", c[2], "end"],
     ["after", c[3], "end"], ["change", c[4] + 44, "end"]].forEach(function (h) {
      o.push('<text class="fn-phead" x="' + h[1] + '" y="' + (PF.top - 10) + '" text-anchor="' + h[2] + '">' + h[0] + "</text>");
    });
    var maxDd = Math.max.apply(null, nets.map(function (n) { return n.dd; }));
    nets.forEach(function (n, i) {
      var y = PF.top + i * PF.rowH + 13;
      o.push('<g class="fn-prow" data-i="' + i + '">' +
        '<text class="fn-pcell" x="' + c[0] + '" y="' + y + '">' + esc(n.cell) + "</text>" +
        '<text class="fn-pnum fn-pmuted" x="' + c[1] + '" y="' + y + '">' + n.len + " µm</text>" +
        '<text class="fn-pnum" x="' + c[2] + '" y="' + y + '">' + f1(n.d) + "</text>" +
        '<text class="fn-pnum fn-pafter" data-v="' + f1(n.d + n.dd) + '" x="' + c[3] + '" y="' + y + '">·</text>' +
        '<text class="fn-pnum fn-pdelta" x="' + (c[4] + 44) + '" y="' + y + '" style="visibility:hidden">+' + f1(n.dd) + "</text>" +
        '<rect class="fn-hbar fn-pbar" x="' + (c[4] + 52) + '" y="' + (y - 9) + '" width="' + (n.dd / maxDd * 70).toFixed(1) +
        '" height="10" style="visibility:hidden"/></g>');
    });
    /* the totals the report ends with */
    var ty = PF.top + nets.length * PF.rowH + 20;
    o.push('<line class="fn-prule" x1="12" y1="' + (ty - 14) + '" x2="' + (PF.W - 12) + '" y2="' + (ty - 14) + '"/>');
    [["data arrival at the flip-flop", M.T.arrival, M.T.arrival + M.hit.exact, "arr"],
     ["data required", M.T.required, M.T.required, "req"],
     ["setup slack", M.T.slack, M.T.slack - M.hit.exact, "slk"]].forEach(function (r, k) {
      var y = ty + k * PF.rowH;
      o.push('<text class="fn-pcell fn-ptot" x="' + c[0] + '" y="' + y + '">' + r[0] + "</text>");
      o.push('<text class="fn-pnum fn-ptot" x="' + c[2] + '" y="' + y + '">' + f1(r[1]) + "</text>");
      o.push('<text class="fn-pnum fn-ptot fn-pafter" data-v="' + f1(r[2]) + '" data-tot="1" x="' + c[3] + '" y="' + y + '">·</text>');
      var dv = r[2] - r[1];
      o.push('<text class="fn-pnum fn-ptot fn-pdelta" data-tot="1" x="' + (c[4] + 44) + '" y="' + y +
             '" style="visibility:hidden">' + (Math.abs(dv) < 0.05 ? "0.0" : (dv > 0 ? "+" : "") + f1(dv)) + "</text>");
    });

    /* the waterfall: slack before fill, each stage's bite, slack after */
    o.push('<text class="ff3-cap" x="12" y="' + (wTop - 18) + '">the setup slack, stage by stage, in picoseconds (the axis starts at ' +
           f1(sLo) + ", not zero)</text>");
    [Math.ceil(sLo), Math.round((sLo + sHi) / 2), Math.floor(sHi)].forEach(function (v) {
      o.push('<line class="fn-wgrid" x1="' + wX0 + '" y1="' + SY(v).toFixed(1) + '" x2="' + (PF.W - 20) + '" y2="' + SY(v).toFixed(1) + '"/>');
      o.push('<text class="fn-wtick" x="' + (wX0 - 8) + '" y="' + (SY(v) + 4).toFixed(1) + '">' + v + "</text>");
    });
    var run = M.T.slack, bw = step * 0.7;
    o.push('<rect class="fn-wbefore" x="' + wX0 + '" y="' + SY(run).toFixed(1) + '" width="' + bw.toFixed(1) +
           '" height="' + (SY(sLo) - SY(run)).toFixed(1) + '"/>');
    o.push('<text class="fn-wlab" x="' + (wX0 + bw / 2).toFixed(1) + '" y="' + (SY(sLo) + 14).toFixed(1) + '">before</text>');
    nets.forEach(function (n, i) {
      var x = wX0 + (i + 1) * step, y0 = SY(run), y1 = SY(run - n.dd);
      o.push('<rect class="fn-wbite" data-i="' + i + '" x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + bw.toFixed(1) +
             '" height="' + Math.max(0.8, y1 - y0).toFixed(1) + '" style="visibility:hidden"/>');
      run -= n.dd;
    });
    var ax = wX0 + (nets.length + 1) * step;
    o.push('<rect class="fn-wafter" id="fn-wafter" x="' + ax.toFixed(1) + '" y="' + SY(run).toFixed(1) + '" width="' + bw.toFixed(1) +
           '" height="' + (SY(sLo) - SY(run)).toFixed(1) + '" style="visibility:hidden"/>');
    o.push('<text class="fn-wlab" x="' + (ax + bw / 2).toFixed(1) + '" y="' + (SY(sLo) + 14).toFixed(1) + '">after</text>');
    o.push('<text class="fn-wlab" x="' + ((wX0 + step + ax) / 2).toFixed(1) + '" y="' + (SY(sLo) + 14).toFixed(1) +
           '">what each stage lost</text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout"><span>setup slack <b id="fn-pslack">' + f1(M.T.slack) + " ps</b></span>" +
      "<span>with the keepout halved it would end at <b>" + f1(M.T.slack - M.hitTight.exact) + " ps</b></span>" +
      '<button class="ff-reset" type="button" id="fn-preplay">replay</button></div>';
  }

  function pathAnimate(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var nets = M.hit.nets, say = document.getElementById("fn-psay"), sl = document.getElementById("fn-pslack");
    var replay = document.getElementById("fn-preplay"), timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      root.querySelectorAll(".fn-pafter").forEach(function (t) { t.textContent = "·"; });
      root.querySelectorAll(".fn-pdelta, .fn-pbar, .fn-wbite, #fn-wafter").forEach(function (e) { e.style.visibility = "hidden"; });
      root.querySelectorAll(".fn-prow").forEach(function (r) { r.classList.remove("fn-pon"); });
      if (sl) sl.textContent = f1(M.T.slack) + " ps";
      if (say) say.textContent = "the worst path, stage by stage: each net now has fill beside it";
      var run = M.T.slack;
      nets.forEach(function (n, i) {
        later(700 + i * 420, function () {
          var row = root.querySelector('.fn-prow[data-i="' + i + '"]');
          root.querySelectorAll(".fn-prow").forEach(function (r) { r.classList.remove("fn-pon"); });
          row.classList.add("fn-pon");
          var a = row.querySelector(".fn-pafter");
          a.textContent = a.getAttribute("data-v");
          row.querySelectorAll(".fn-pdelta, .fn-pbar").forEach(function (e) { e.style.visibility = ""; });
          var bite = root.querySelector('.fn-wbite[data-i="' + i + '"]');
          if (bite) bite.style.visibility = "";
          run -= n.dd;
          if (sl) sl.textContent = f1(run) + " ps";
          if (say) say.textContent = n.len + " µm of wire, +" + f1(n.dd) + " ps";
        });
      });
      later(700 + nets.length * 420 + 300, function () {
        root.querySelectorAll(".fn-prow").forEach(function (r) { r.classList.remove("fn-pon"); });
        root.querySelectorAll('.fn-pafter[data-tot="1"]').forEach(function (t) { t.textContent = t.getAttribute("data-v"); });
        root.querySelectorAll('.fn-pdelta[data-tot="1"]').forEach(function (e) { e.style.visibility = ""; });
        var wa = document.getElementById("fn-wafter");
        if (wa) wa.style.visibility = "";
        if (say) say.textContent = "arrival later by " + f1(M.hit.exact) + " ps, required unchanged: slack " +
          f1(M.T.slack) + " to " + f1(M.T.slack - M.hit.exact);
      });
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- the real cell, drawn from its polygons -----
     X and Y map cell micrometers (y up) to the page; `only` limits the
     layers, `attr` tags each layer so an animation can find it. */
  var CELL_BOX = { x0: -0.115, y0: -0.115, x1: 0.685, y1: 1.515 };

  function cellMarkup(X, Y, only, tag, layers) {
    var o = [], src = layers || NAND2.layers;
    NAND2.order.forEach(function (name) {
      if (only && only.indexOf(name) < 0) return;
      o.push('<g class="fn-l fn-l-' + name + '"' + (tag ? ' data-layer="' + name + '"' : "") + ">");
      src[name].forEach(function (poly) {
        o.push('<polygon points="' + pts(poly, X, Y) + '"/>');
      });
      o.push("</g>");
    });
    return o.join("");
  }
  function lefCount() {
    return Object.keys(NAND2.lefPins).reduce(function (a, k) { return a + NAND2.lefPins[k].length; }, 0);
  }
  function polygonCount() {
    return NAND2.order.reduce(function (a, k) { return a + NAND2.layers[k].length; }, 0);
  }

  var CF = { S: 190, top: 58, gap: 70 };

  function cellFigure() {
    var S = CF.S, bw = (CELL_BOX.x1 - CELL_BOX.x0) * S, bh = (CELL_BOX.y1 - CELL_BOX.y0) * S;
    var lx = 30, rx = lx + bw + CF.gap, kx = rx + bw + 40;
    var W = kx + 200, H = CF.top + bh + 36, o = [];
    function Xa(x) { return lx + (x - CELL_BOX.x0) * S; }
    function Xb(x) { return rx + (x - CELL_BOX.x0) * S; }
    function Y(y) { return CF.top + (CELL_BOX.y1 - y) * S; }
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-cell" role="img" aria-label="The cell NAND2_X1 ' +
           'twice: as the abstract placement and routing used, and as the layout that goes to the foundry">');
    o.push('<text class="ff3-cap" x="' + lx + '" y="22">NAND2_X1 as the router saw it</text>');
    o.push('<text class="ff3-cap" x="' + rx + '" y="22">and as the foundry will</text>');
    o.push('<text class="ff3-cap fn-csay" id="fn-csay" x="' + rx + '" y="40">press play</text>');
    /* left: the LEF abstract, outline and pins only */
    o.push('<rect class="fn-outline" x="' + Xa(0) + '" y="' + Y(NAND2.h) + '" width="' + NAND2.w * S + '" height="' + NAND2.h * S + '"/>');
    Object.keys(NAND2.lefPins).forEach(function (pin) {
      NAND2.lefPins[pin].forEach(function (r) {
        o.push('<rect class="fn-lefpin" x="' + Xa(r[0]).toFixed(1) + '" y="' + Y(r[3]).toFixed(1) + '" width="' +
               ((r[2] - r[0]) * S).toFixed(1) + '" height="' + ((r[3] - r[1]) * S).toFixed(1) + '"/>');
      });
    });
    NAND2.pins.forEach(function (p) {
      o.push('<text class="fn-pinlab" x="' + Xa(p.x).toFixed(1) + '" y="' + (Y(p.y) + 4).toFixed(1) + '">' + p.name + "</text>");
    });
    /* right: every layer, revealed bottom of the process first */
    o.push('<rect class="fn-outline" x="' + Xb(0) + '" y="' + Y(NAND2.h) + '" width="' + NAND2.w * S + '" height="' + NAND2.h * S + '"/>');
    o.push(cellMarkup(Xb, Y, null, true));
    /* the key: each layer with its stream number */
    NAND2.order.forEach(function (name, i) {
      var y = CF.top + 6 + i * 26;
      o.push('<g class="fn-l fn-l-' + name + '"><rect x="' + kx + '" y="' + y + '" width="18" height="12"/></g>');
      o.push('<text class="fn-key" x="' + (kx + 26) + '" y="' + (y + 10) + '">' + name + "  " + GDS[name] + "/0</text>");
    });
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout"><span>shapes in the abstract <b>' + lefCount() + '</b> on 1 layer</span><span>in the layout <b id="fn-cpolys">0</b> on <b id="fn-clayers">0</b> layers</span>' +
      '<button class="ff-reset" type="button" id="fn-creplay">replay</button></div>';
  }

  function cellAnimate() {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var groups = [].slice.call(root.querySelectorAll("g[data-layer]"));
    var say = document.getElementById("fn-csay"), np = document.getElementById("fn-cpolys");
    var nl = document.getElementById("fn-clayers"), replay = document.getElementById("fn-creplay");
    var timers = [];
    var WHAT = {
      nwell: "the well the p-type transistors sit in", pwell: "and the n-type ones",
      pimplant: "the doping that makes p-type diffusion", nimplant: "and n-type",
      active: "the diffusion itself, where the transistors are", poly: "the gates: poly crossing diffusion",
      contact: "contacts, from diffusion and poly up to metal", metal1: "metal1, the only layer the router knew",
    };
    function play() {
      timers.forEach(clearTimeout); timers = [];
      groups.forEach(function (g) { g.style.opacity = "0"; });
      if (np) np.textContent = "0";
      if (nl) nl.textContent = "0";
      var polys = 0;
      groups.forEach(function (g, i) {
        timers.push(setTimeout(function () {
          var name = g.getAttribute("data-layer");
          g.style.opacity = "1";
          polys += NAND2.layers[name].length;
          if (np) np.textContent = String(polys);
          if (nl) nl.textContent = String(i + 1);
          if (say) say.textContent = "layer " + GDS[name] + ": " + WHAT[name];
        }, 500 + i * 800));
      });
      timers.push(setTimeout(function () {
        if (say) say.textContent = "the same cell: " + polygonCount() + " polygons on " + NAND2.order.length +
          " layers, where the router saw " + lefCount() + " rectangles on one";
      }, 500 + groups.length * 800 + 400));
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- the die, a stretch of real rows, and the same stretch in depth -----
     Two rows of real library cells, 2.85 micrometers long, in the busy
     middle of the core. The upper row is flipped, as every other row is, so
     the two share their power rail and their n-well. Every shape in them is
     the library's own. Above them run two metal2 wires, with the vias that
     land them on two input pins: those are drawn for illustration, to show
     where the router's layers begin. */
  var REGION = {
    rows: [
      ["TAPCELL_X1", "INV_X1", "NAND2_X1", "NOR2_X1", "FILLCELL_X1", "BUF_X1", "INV_X1"],
      ["AOI21_X1", "NAND2_X1", "FILLCELL_X1", "FILLCELL_X1", "NOR2_X1", "BUF_X1"],
    ],
    /* metal2 wires, vertical, each landing on a pin through a via1 */
    wires: [{ row: 0, cell: 2, x: 0.4475, y: 0.6125 }, { row: 1, cell: 4, x: 0.1225, y: 0.6125 }],
  };
  /* heights, in micrometers, bottom of the process first. The order is the
     process's; the thicknesses are illustrative. */
  var STACK = [
    { k: "well", z0: -0.25, z1: -0.05, what: "the wells: n-type under the p-type transistors, p-type under the n-type" },
    { k: "active", z0: -0.05, z1: 0, what: "diffusion, where the transistors are" },
    { k: "poly", z0: 0, z1: 0.1, what: "poly: a gate wherever it crosses diffusion" },
    { k: "contact", z0: 0, z1: 0.37, what: "contacts, from diffusion and poly up to metal1" },
    { k: "metal1", z0: 0.37, z1: 0.5, what: "metal1: the cells' own wiring, rails and pins" },
    { k: "via1", z0: 0.5, z1: 0.64, what: "via1, from a pin up to the router's first layer" },
    { k: "metal2", z0: 0.64, z1: 0.78, what: "metal2, where the routing starts" },
  ];
  var ZX = 2;                                   /* heights drawn doubled, to be told apart */

  /* every shape in the region, in region micrometers, by layer */
  function regionShapes() {
    var rowH = FS.ROW_H, out = [], cells = [];
    var width = REGION.rows[0].reduce(function (a, c) { return a + LIB[c].w; }, 0);
    REGION.rows.forEach(function (row, r) {
      var flip = r % 2 === 1, x0 = 0;
      function tf(p) { return [x0 + p[0], flip ? (r + 1) * rowH - p[1] : r * rowH + p[1]]; }
      row.forEach(function (name) {
        var c = LIB[name];
        ["active", "poly", "contact", "metal1"].forEach(function (layer) {
          (c.layers[layer] || []).forEach(function (poly) { out.push({ layer: layer, poly: poly.map(tf) }); });
        });
        cells.push({ name: name, x: x0, y: r * rowH, w: c.w, h: rowH });
        x0 += c.w;
      });
      /* the wells and implants run the length of the row, as they do once
         the cells abut */
      [["nwell", 0.59, 1.515], ["pwell", -0.115, 0.59], ["pimplant", 0.59, 1.425], ["nimplant", -0.025, 0.59]]
        .forEach(function (b) {
          var ya = flip ? (r + 1) * rowH - b[2] : r * rowH + b[1];
          var yb = flip ? (r + 1) * rowH - b[1] : r * rowH + b[2];
          var xa = b[0].indexOf("well") > 0 ? -0.115 : -0.025, xb = width - xa;
          out.push({ layer: b[0], poly: [[xa, ya], [xb, ya], [xb, yb], [xa, yb]] });
        });
    });
    /* the illustrative routing: a via on each pin, and a wire up the region */
    REGION.wires.forEach(function (wr) {
      var c = cells.filter(function (q) { return q.y === wr.row * rowH; })[wr.cell];
      var x = c.x + wr.x, flip = wr.row % 2 === 1;
      var y = flip ? (wr.row + 1) * rowH - wr.y : wr.row * rowH + wr.y;
      out.push({ layer: "via1", poly: [[x - 0.035, y - 0.035], [x + 0.035, y - 0.035], [x + 0.035, y + 0.035], [x - 0.035, y + 0.035]] });
      out.push({ layer: "metal2", poly: [[x - 0.035, y - 0.07], [x + 0.035, y - 0.07], [x + 0.035, 2 * rowH], [x - 0.035, 2 * rowH]] });
    });
    return { shapes: out, cells: cells, w: width, h: REGION.rows.length * rowH };
  }

  /* the block from the earlier figures: die, core, memories, cells */
  function overviewMarkup(M, ox, oy, size) {
    var z = M.z, mg = FS.SIZING.margin, s = size / z.dieW, o = [];
    function OX(x) { return ox + (mg + x) * s; }
    function OY(y) { return oy + (mg + y) * s; }
    o.push('<rect class="fn-ovdie" x="' + ox + '" y="' + oy + '" width="' + (z.dieW * s).toFixed(1) +
           '" height="' + (z.dieH * s).toFixed(1) + '"/>');
    o.push('<rect class="fn-coreline" x="' + OX(0) + '" y="' + OY(0) + '" width="' + (z.coreW * s).toFixed(1) +
           '" height="' + (z.coreH * s).toFixed(1) + '"/>');
    o.push('<g transform="translate(' + OX(0).toFixed(2) + "," + OY(0).toFixed(2) + ") scale(" + s.toFixed(4) + ')">' +
           PL_cells() + "</g>");
    M.ms.forEach(function (m) {
      o.push('<rect class="fn-ovmac" x="' + OX(m.x).toFixed(1) + '" y="' + OY(m.y).toFixed(1) + '" width="' +
             (m.w * s).toFixed(1) + '" height="' + (m.h * s).toFixed(1) + '"/>');
    });
    return { svg: o.join(""), OX: OX, OY: OY, s: s };
  }

  var DV = { die: 250, ox: 16, oy: 44, px: 105, gap: 70 };

  function depthPlanFigure(M) {
    var R = regionShapes(), z = M.z, o = [];
    var ov = overviewMarkup(M, DV.ox, DV.oy, DV.die);
    var px0 = DV.ox + DV.die + DV.gap, py0 = DV.oy + 10, P = DV.px;
    var W = px0 + R.w * P + 24, H = DV.oy + Math.max(DV.die, R.h * P + 20) + 40;
    function X(x) { return px0 + x * P; }
    function Y(y) { return py0 + (R.h - y) * P; }
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-depth" role="img" aria-label="The die from the ' +
           'earlier figures with a spot marked in its middle, and the real layout of two rows of cells at that spot">');
    o.push('<text class="ff3-cap" x="' + DV.ox + '" y="22">the block</text>');
    o.push('<text class="ff3-cap" x="' + px0 + '" y="22">two rows at the marked spot, ' + f2(R.w) + " by " + f1(R.h) + " µm</text>");
    o.push(ov.svg);
    /* the spot: far smaller than a pixel at this scale, so it is ringed */
    var cx = ov.OX(z.coreW / 2), cy = ov.OY(z.coreH / 2);
    o.push('<circle class="fn-spot" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="7"/>');
    o.push('<line class="fn-callout" x1="' + (cx + 5).toFixed(1) + '" y1="' + (cy - 5).toFixed(1) + '" x2="' + X(0) + '" y2="' + Y(R.h) + '"/>');
    o.push('<line class="fn-callout" x1="' + (cx + 5).toFixed(1) + '" y1="' + (cy + 5).toFixed(1) + '" x2="' + X(0) + '" y2="' + Y(0) + '"/>');
    o.push('<clipPath id="fn-dclip"><rect x="' + X(-0.12) + '" y="' + Y(R.h + 0.12) + '" width="' + ((R.w + 0.24) * P) +
           '" height="' + ((R.h + 0.24) * P) + '"/></clipPath><g clip-path="url(#fn-dclip)">');
    ["nwell", "pwell", "pimplant", "nimplant", "active", "poly", "contact", "metal1", "via1", "metal2"].forEach(function (layer) {
      o.push('<g class="fn-l fn-l-' + layer + '">');
      R.shapes.forEach(function (sh) {
        if (sh.layer === layer) o.push('<polygon points="' + pts(sh.poly, X, Y) + '"/>');
      });
      o.push("</g>");
    });
    o.push("</g>");
    R.cells.forEach(function (c) {
      o.push('<rect class="fn-cellbox" x="' + X(c.x).toFixed(1) + '" y="' + Y(c.y + c.h).toFixed(1) + '" width="' +
             (c.w * P).toFixed(1) + '" height="' + (c.h * P).toFixed(1) + '"><title>' + c.name + "</title></rect>");
    });
    o.push("</svg>");
    return o.join("");
  }

  /* ----- the same stretch in depth -----
     Turned 45 degrees and seen from above at 40, each shape extruded from
     its layer's bottom to its top. Layers are drawn bottom first, and within
     a layer the farthest shapes first, so nearer ones cover them; only the
     sides that face the viewer are drawn. */
  var ISO = { S: 128, elev: 40 * Math.PI / 180, pad: 30 };

  function depthIsoFigure() {
    var R = regionShapes(), o = [], c = Math.SQRT1_2;
    var sE = Math.sin(ISO.elev), cE = Math.cos(ISO.elev);
    function proj(x, y, zz) {
      return [(x - y) * c, (x + y) * c * sE + zz * ZX * cE];
    }
    /* find the extent to place it */
    var zTop = STACK[STACK.length - 1].z1, zBot = STACK[0].z0, corners = [];
    [[-0.12, -0.12], [R.w + 0.12, -0.12], [-0.12, R.h + 0.12], [R.w + 0.12, R.h + 0.12]].forEach(function (p) {
      corners.push(proj(p[0], p[1], zBot), proj(p[0], p[1], zTop));
    });
    var aMin = Math.min.apply(null, corners.map(function (p) { return p[0]; }));
    var aMax = Math.max.apply(null, corners.map(function (p) { return p[0]; }));
    var bMin = Math.min.apply(null, corners.map(function (p) { return p[1]; }));
    var bMax = Math.max.apply(null, corners.map(function (p) { return p[1]; }));
    var S = ISO.S, W = (aMax - aMin) * S + ISO.pad * 2 + 250, H = (bMax - bMin) * S + ISO.pad * 2 + 40;
    function SX(p) { return ISO.pad + (p[0] - aMin) * S; }
    function SY(p) { return ISO.pad + 36 + (bMax - p[1]) * S; }
    function pt(x, y, zz) { var p = proj(x, y, zz); return SX(p).toFixed(1) + "," + SY(p).toFixed(1); }

    o.push('<svg viewBox="0 0 ' + W.toFixed(0) + " " + H.toFixed(0) + '" class="ff3-svg fn-iso" role="img" aria-label="The ' +
           'same two rows of cells seen from a 45 degree angle, each layer extruded so the stack of the process shows">');
    o.push('<text class="ff3-cap" x="' + ISO.pad + '" y="20">the same two rows, turned 45° and seen from above</text>');
    o.push('<text class="ff3-cap fn-isay" id="fn-isay" x="' + ISO.pad + '" y="38">press play</text>');
    STACK.forEach(function (st, li) {
      var layers = st.k === "well" ? ["pwell", "nwell"] : [st.k];
      var prisms = R.shapes.filter(function (sh) { return layers.indexOf(sh.layer) >= 0; }).map(function (sh) {
        var cx = 0, cy = 0;
        sh.poly.forEach(function (p) { cx += p[0]; cy += p[1]; });
        return { sh: sh, depth: (cx + cy) / sh.poly.length };
      }).sort(function (a, b) { return b.depth - a.depth; });
      o.push('<g class="fn-slab" data-li="' + li + '">');
      prisms.forEach(function (pr) {
        var poly = pr.sh.poly, cls = "fn-3-" + pr.sh.layer;
        /* which way round the polygon goes decides which side is out */
        var area = 0;
        for (var i = 0; i < poly.length; i++) {
          var p = poly[i], q = poly[(i + 1) % poly.length];
          area += p[0] * q[1] - q[0] * p[1];
        }
        var sgn = area > 0 ? 1 : -1;
        for (var e = 0; e < poly.length; e++) {
          var a = poly[e], b = poly[(e + 1) % poly.length];
          var nx = sgn * (b[1] - a[1]), ny = -sgn * (b[0] - a[0]);
          if (nx + ny >= 0) continue;                    /* facing away */
          o.push('<polygon class="' + cls + (nx < 0 ? " fn-3l" : " fn-3f") + '" points="' +
                 pt(a[0], a[1], st.z0) + " " + pt(b[0], b[1], st.z0) + " " + pt(b[0], b[1], st.z1) + " " +
                 pt(a[0], a[1], st.z1) + '"/>');
        }
        o.push('<polygon class="' + cls + ' fn-3t" points="' + poly.map(function (p) { return pt(p[0], p[1], st.z1); }).join(" ") + '"/>');
      });
      o.push("</g>");
    });
    /* the key, down the right-hand side */
    var kx = W - 240, ky = 70;
    STACK.slice().reverse().forEach(function (st, i) {
      var k = st.k === "well" ? "nwell" : st.k;
      o.push('<rect class="fn-3-' + k + ' fn-3t" x="' + kx + '" y="' + (ky + i * 26) + '" width="16" height="12"/>');
      o.push('<text class="fn-key" x="' + (kx + 24) + '" y="' + (ky + i * 26 + 10) + '">' +
             (st.k === "well" ? "wells" : st.k) + "</text>");
    });
    o.push('<text class="fn-key fn-kmuted" x="' + kx + '" y="' + (ky + STACK.length * 26 + 14) + '">heights doubled; order real,</text>');
    o.push('<text class="fn-key fn-kmuted" x="' + kx + '" y="' + (ky + STACK.length * 26 + 30) + '">thicknesses illustrative</text>');
    o.push("</svg>");
    return o.join("") + '<div class="gp-readout"><span>layers <b id="fn-ilayers">0</b> of ' + STACK.length +
      '</span><button class="ff-reset" type="button" id="fn-ireplay">replay</button></div>';
  }

  function depthAnimate() {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var slabs = [].slice.call(root.querySelectorAll(".fn-slab")), say = document.getElementById("fn-isay");
    var cnt = document.getElementById("fn-ilayers"), replay = document.getElementById("fn-ireplay"), timers = [];
    function play() {
      timers.forEach(clearTimeout); timers = [];
      slabs.forEach(function (s) { s.classList.add("fn-slab-off"); });
      if (cnt) cnt.textContent = "0";
      slabs.forEach(function (s, i) {
        timers.push(setTimeout(function () {
          s.classList.remove("fn-slab-off");
          if (cnt) cnt.textContent = String(i + 1);
          if (say) say.textContent = STACK[i].what;
        }, 600 + i * 1500));
      });
      timers.push(setTimeout(function () {
        if (say) say.textContent = "the transistors at the bottom, the wiring stacked above them";
      }, 600 + slabs.length * 1500 + 400));
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- the power grid, solved for its voltage drop -----
     The grid the floorplan example built: vertical metal4 stripes and
     horizontal metal5 stripes every 40 micrometers per net, joined by via
     stacks where they cross, and cut wherever a metal4 stripe would run over
     a memory (the memories own metal1 to metal4). The supply comes in from
     the ring: every metal5 stripe ends on the ring's metal6 sides, which are
     held at the supply, as analyze_power_grid -source_type FULL does with the
     top layer. Each crossing draws the current of the cells around it, in
     the proportions of the placement example's density map, adding up to
     the design's power divided by the supply. Then the node voltages are
     solved by relaxation, the way a resistive network is solved: each node
     repeatedly moved to the value its neighbours, its own current, and any
     source say it must have, until nothing moves. What this leaves out is
     the last hop, down the via stack to the metal1 rails and along them to
     each cell, which in a real grid adds a little more. */
  var IR = { viaOhm: 0.5, budget: 0.05, snaps: [0, 2, 6, 15, 40, 100] };

  function irSolve(net, V, I) {
    var fm = core(), z = fm.z, ms = fm.ms, P = FS.PDN, pdn = fm.pdn;
    var L4 = FS.LAYER_BY.metal4, L5 = FS.LAYER_BY.metal5;
    var xs = pdn.m4[net].map(function (x) { return x + P.stripeWidth / 2; });
    var ys = pdn.m5[net].map(function (y) { return y + P.stripeWidth / 2; });
    var nx = xs.length, ny = ys.length, n = nx * ny;
    function onMacro(x0, y0, x1, y1) {
      return ms.some(function (m) { return x0 < m.x + m.w && x1 > m.x && y0 < m.y + m.h && y1 > m.y; });
    }
    /* the current each crossing draws: the cells in its tile */
    var pg = PlacementSteps.grid(), dens = PlacementSteps.densityOf(pg, PlacementSteps.model().gpr);
    var cur = new Float64Array(n), tiles = [], tot = 0;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var x0 = i ? (xs[i - 1] + xs[i]) / 2 : 0, x1 = i < nx - 1 ? (xs[i] + xs[i + 1]) / 2 : z.coreW;
      var y0 = j ? (ys[j - 1] + ys[j]) / 2 : 0, y1 = j < ny - 1 ? (ys[j] + ys[j + 1]) / 2 : z.coreH;
      var a = 0;
      for (var b = 0; b < dens.length; b++) {
        var bx = (b % pg.nx) * pg.bw, by = ((b / pg.nx) | 0) * pg.bh;
        var ox = Math.max(0, Math.min(x1, bx + pg.bw) - Math.max(x0, bx));
        var oy = Math.max(0, Math.min(y1, by + pg.bh) - Math.max(y0, by));
        a += ox * oy * dens[b];
      }
      cur[j * nx + i] = a; tot += a;
      tiles.push({ x0: x0, y0: y0, x1: x1, y1: y1, x: xs[i], y: ys[j] });
    }
    for (var k = 0; k < n; k++) cur[k] *= I / tot;
    /* the stripes between crossings, and the ring at each stripe's ends */
    function ohm(len, L) { return L.rSheet * len / P.stripeWidth; }
    var nb = [];
    for (k = 0; k < n; k++) nb.push([]);
    var cutSegs = [];
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      k = j * nx + i;
      if (i < nx - 1) {
        var gh = 1 / (ohm(xs[i + 1] - xs[i], L5) + 2 * IR.viaOhm);
        nb[k].push([k + 1, gh]); nb[k + 1].push([k, gh]);
      }
      if (j < ny - 1) {
        if (onMacro(xs[i] - P.stripeWidth / 2, ys[j], xs[i] + P.stripeWidth / 2, ys[j + 1])) {
          cutSegs.push([i, j]);
        } else {
          var gv = 1 / (ohm(ys[j + 1] - ys[j], L4) + 2 * IR.viaOhm);
          nb[k].push([k + nx, gv]); nb[k + nx].push([k, gv]);
        }
      }
    }
    /* the ring. Its left and right sides are metal6, the top layer, so
       they are the supply, and every metal5 stripe lands on them. Its top
       and bottom are metal5, a resistive run back to those sides at the
       corners; they are modelled as a chain of nodes, one where each
       metal4 stripe lands, unless a memory is in the stripe's way. */
    var tot2 = n + 2 * nx, src = new Float64Array(tot2);
    while (nb.length < tot2) nb.push([]);
    function ringOhm(len) { return FS.LAYER_BY.metal5.rSheet * len / P.ringWidth; }
    for (j = 0; j < ny; j++) {
      src[j * nx] += 1 / (ohm(xs[0] + P.ringOffset, L5) + IR.viaOhm);
      src[j * nx + nx - 1] += 1 / (ohm(z.coreW - xs[nx - 1] + P.ringOffset, L5) + IR.viaOhm);
    }
    [[0, n, -P.ringOffset, 0], [ny - 1, n + nx, z.coreH + P.ringOffset, z.coreH]].forEach(function (side) {
      var row = side[0], base = side[1], ry = side[2], edge = side[3];
      for (var i2 = 0; i2 < nx; i2++) {
        var r = base + i2;
        if (i2 < nx - 1) {
          var gr = 1 / ringOhm(xs[i2 + 1] - xs[i2]);
          nb[r].push([r + 1, gr]); nb[r + 1].push([r, gr]);
        }
        /* the stripe's run from its last crossing out to the ring */
        var ya = Math.min(ys[row], ry), yb = Math.max(ys[row], ry);
        if (!onMacro(xs[i2] - P.stripeWidth / 2, ya, xs[i2] + P.stripeWidth / 2, yb)) {
          var gs = 1 / (ohm(Math.abs(ys[row] - edge) + P.ringOffset, L4) + IR.viaOhm);
          var k2 = row * nx + i2;
          nb[k2].push([r, gs]); nb[r].push([k2, gs]);
        }
      }
      src[base] += 1 / (ringOhm(xs[0] + P.ringOffset) + IR.viaOhm);
      src[base + nx - 1] += 1 / (ringOhm(z.coreW - xs[nx - 1] + P.ringOffset) + IR.viaOhm);
    });
    /* relax: VDD falls from the supply, VSS rises from zero, the same
       equations with the current's sign turned round */
    var sign = V > 0 ? -1 : 1, v = new Float64Array(tot2).fill(V), snaps = [], it, delta = 1;
    for (it = 0; it < 5000 && delta > 1e-10; it++) {
      if (IR.snaps.indexOf(it) >= 0) snaps.push({ it: it, v: Array.prototype.slice.call(v, 0, n) });
      delta = 0;
      for (k = 0; k < tot2; k++) {
        var num = src[k] * V + sign * (k < n ? cur[k] : 0), den = src[k];
        nb[k].forEach(function (e) { num += e[1] * v[e[0]]; den += e[1]; });
        var nv = num / den;
        delta = Math.max(delta, Math.abs(nv - v[k]));
        v[k] = nv;
      }
    }
    snaps.push({ it: it, v: Array.prototype.slice.call(v, 0, n) });
    var drops = Array.prototype.slice.call(v, 0, n).map(function (x) { return Math.abs(V - x); });
    var worst = Math.max.apply(null, drops), avg = drops.reduce(function (a, d) { return a + d; }, 0) / n;
    var wk = drops.indexOf(worst);
    return { net: net, V: V, xs: xs, ys: ys, nx: nx, ny: ny, tiles: tiles, v: v, drops: drops, snaps: snaps,
             iters: it, worst: worst, avg: avg, worstAt: tiles[wk], cut: cutSegs, nodes: n };
  }

  function irModel(M) {
    var T = M.T, V = TM.OPT.vdd;
    /* power, re-reported with the fill's capacitance in: only the switching
       part moves, in proportion to the capacitance that was added */
    var p = T.power, sw = p.switching * (T.totalC + M.addedC) / T.totalC;
    var total = p.total - p.switching + sw;
    var I = total / V;
    return { V: V, power: { internal: p.internal, switching: sw, clock: p.clock, leakage: p.leakage, total: total },
             I: I, vdd: irSolve("VDD", V, I), vss: irSolve("VSS", 0, I) };
  }

  /* green at no drop, through amber, to red at the budget */
  function dropColor(d, V) {
    var t = Math.max(0, Math.min(1, d / (IR.budget * V)));
    var a = t < 0.5 ? [22, 163, 74] : [217, 119, 6], b = t < 0.5 ? [217, 119, 6] : [220, 38, 38];
    var u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    return "rgb(" + a.map(function (c, i) { return Math.round(c + (b[i] - c) * u); }).join(",") + ")";
  }

  function irFigure(M) {
    var R = M.ir.vdd, z = M.z, mg = FS.SIZING.margin, S = 440 / z.dieW, ox = 24, oy = 50, o = [];
    function X(x) { return ox + (mg + x) * S; }
    function Y(y) { return oy + (mg + y) * S; }
    var W = ox + z.dieW * S + 210, H = oy + z.dieH * S + 30;
    o.push('<svg viewBox="0 0 ' + W.toFixed(0) + " " + H.toFixed(0) + '" class="ff3-svg fn-ir" role="img" aria-label="The ' +
           'block with its VDD power grid, each region coloured by how far the supply has dropped there">');
    o.push('<text class="ff3-cap" x="' + ox + '" y="20">the VDD grid, coloured by the drop at each crossing</text>');
    o.push('<text class="ff3-cap fn-irsay" id="fn-irsay" x="' + ox + '" y="38">press play</text>');
    o.push('<rect class="fn-ovdie" x="' + ox + '" y="' + oy + '" width="' + (z.dieW * S).toFixed(1) + '" height="' + (z.dieH * S).toFixed(1) + '"/>');
    R.tiles.forEach(function (t, k) {
      o.push('<rect class="fn-irt" data-k="' + k + '" x="' + X(t.x0).toFixed(1) + '" y="' + Y(t.y0).toFixed(1) + '" width="' +
             ((t.x1 - t.x0) * S + 0.4).toFixed(1) + '" height="' + ((t.y1 - t.y0) * S + 0.4).toFixed(1) + '" fill="' +
             dropColor(0, R.V) + '"/>');
    });
    M.ms.forEach(function (m) {
      o.push('<rect class="fn-ovmac" x="' + X(m.x).toFixed(1) + '" y="' + Y(m.y).toFixed(1) + '" width="' +
             (m.w * S).toFixed(1) + '" height="' + (m.h * S).toFixed(1) + '"/>');
    });
    /* the ring, and the stripes: metal5 across, metal4 up, gaps where cut */
    var P = FS.PDN, rg = P.ringOffset + P.ringWidth / 2;
    o.push('<rect class="fn-irring" x="' + X(-rg).toFixed(1) + '" y="' + Y(-rg).toFixed(1) + '" width="' + ((z.coreW + 2 * rg) * S).toFixed(1) +
           '" height="' + ((z.coreH + 2 * rg) * S).toFixed(1) + '"/>');
    R.ys.forEach(function (y) {
      o.push('<line class="fn-irm5" x1="' + X(-rg).toFixed(1) + '" y1="' + Y(y).toFixed(1) + '" x2="' + X(z.coreW + rg).toFixed(1) + '" y2="' + Y(y).toFixed(1) + '"/>');
    });
    var cut = {};
    R.cut.forEach(function (c) { cut[c[0] + "," + c[1]] = 1; });
    R.xs.forEach(function (x, i) {
      for (var j = 0; j < R.ny - 1; j++) {
        if (cut[i + "," + j]) continue;
        o.push('<line class="fn-irm4" x1="' + X(x).toFixed(1) + '" y1="' + Y(R.ys[j]).toFixed(1) + '" x2="' + X(x).toFixed(1) + '" y2="' + Y(R.ys[j + 1]).toFixed(1) + '"/>');
      }
    });
    var wa = R.worstAt;
    o.push('<circle class="fn-irworst" id="fn-irworst" cx="' + X(wa.x).toFixed(1) + '" cy="' + Y(wa.y).toFixed(1) + '" r="9" style="display:none"/>');
    /* the scale */
    var kx = ox + z.dieW * S + 30, ky = oy + 10;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f, i) {
      o.push('<rect x="' + kx + '" y="' + (ky + i * 24) + '" width="18" height="16" fill="' + dropColor(f * IR.budget * R.V, R.V) + '"/>');
      o.push('<text class="fn-key" x="' + (kx + 26) + '" y="' + (ky + i * 24 + 12) + '">' + f1(f * IR.budget * R.V * 1000) + " mV" +
             (f === 1 ? ", the budget" : "") + "</text>");
    });
    [["fn-irm5", "metal5 stripes"], ["fn-irm4", "metal4 stripes"], ["fn-irring", "the ring, fed at its sides"]].forEach(function (kv, i) {
      var y = ky + 140 + i * 22;
      o.push('<line class="' + kv[0] + '" x1="' + kx + '" y1="' + (y + 6) + '" x2="' + (kx + 18) + '" y2="' + (y + 6) + '"/>');
      o.push('<text class="fn-key" x="' + (kx + 26) + '" y="' + (y + 10) + '">' + kv[1] + "</text>");
    });
    o.push("</svg>");
    return o.join("") + '<div class="gp-readout"><span>solver pass <b id="fn-irit">0</b></span>' +
      '<span>worst drop <b id="fn-irw">0.0 mV</b></span><span>of the supply <b id="fn-irp">0.00%</b></span>' +
      '<button class="ff-reset" type="button" id="fn-irreplay">replay</button></div>';
  }

  function irAnimate(M) {
    var root = document.getElementById("flow-fig-4");
    if (!root) return;
    var R = M.ir.vdd, tiles = [].slice.call(root.querySelectorAll(".fn-irt"));
    var say = document.getElementById("fn-irsay"), itEl = document.getElementById("fn-irit");
    var wEl = document.getElementById("fn-irw"), pEl = document.getElementById("fn-irp");
    var worstEl = document.getElementById("fn-irworst"), replay = document.getElementById("fn-irreplay"), timers = [];
    function show(snap) {
      var worst = 0;
      tiles.forEach(function (t, k) {
        var d = Math.abs(R.V - snap.v[k]);
        worst = Math.max(worst, d);
        t.setAttribute("fill", dropColor(d, R.V));
      });
      if (itEl) itEl.textContent = String(snap.it);
      if (wEl) wEl.textContent = f1(worst * 1000) + " mV";
      if (pEl) pEl.textContent = f2(100 * worst / R.V) + "%";
    }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      if (worstEl) worstEl.style.display = "none";
      show(R.snaps[0]);
      if (say) say.textContent = "every node starts at the full " + f1(R.V) + " V, before any current is drawn";
      R.snaps.forEach(function (sn, i) {
        if (!i) return;
        timers.push(setTimeout(function () {
          show(sn);
          if (say) say.textContent = i < R.snaps.length - 1
            ? "the solver lets each node settle against its neighbours, pass after pass"
            : "settled: the drop is worst in the middle, farthest from the ring";
          if (i === R.snaps.length - 1 && worstEl) worstEl.style.display = "";
        }, 900 + i * 1300));
      });
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- design rules, measured on the same cell -----
     Each ruler is a real rule from the open 45 nanometer deck, measured on
     the real polygons. The values are computed from the geometry above,
     not typed in. */
  function drcChecks() {
    var L = NAND2.layers;
    function bbox(poly) {
      var xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
      return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    }
    var gate = [0.16, 0.21], c0 = bbox(L.contact[0]), a2 = bbox(L.metal1[3]), vssTab = [0.055, 0.125];
    var zn = 0.25;
    return [
      { rule: "POLY.1", what: "width of a gate", min: 0.050, got: gate[1] - gate[0], x0: gate[0], x1: gate[1], y: 0.30 },
      { rule: "CONTACT.1", what: "size of a contact", min: 0.065, got: c0[2] - c0[0], x0: c0[0], x1: c0[2], y: (c0[1] + c0[3]) / 2, exact: true },
      { rule: "METAL1.1", what: "width of metal1", min: 0.065, got: vssTab[1] - vssTab[0], x0: vssTab[0], x1: vssTab[1], y: 0.40 },
      { rule: "METAL1.2", what: "space between metal1", min: 0.065, got: zn - a2[2], x0: a2[2], x1: zn, y: 0.66 },
    ];
  }

  function drcFigure() {
    var S = 230, bw = (CELL_BOX.x1 - CELL_BOX.x0) * S, bh = (CELL_BOX.y1 - CELL_BOX.y0) * S;
    var ox = 30, top = 50, W = ox + bw + 330, H = top + bh + 24, o = [];
    function X(x) { return ox + (x - CELL_BOX.x0) * S; }
    function Y(y) { return top + (CELL_BOX.y1 - y) * S; }
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-drc" role="img" aria-label="Four design rules ' +
           'measured on the cell NAND2_X1, each passing at or just above its minimum">');
    o.push('<text class="ff3-cap fn-rsay" id="fn-rsay" x="' + ox + '" y="22">press play</text>');
    o.push(cellMarkup(X, Y, null, false));
    /* each label sits level with its ruler where it can, pushed down just
       enough to clear the one above it */
    var list = drcChecks(), order = list.map(function (c, i) { return i; })
      .sort(function (a, b) { return list[b].y - list[a].y; });
    var labelY = {}, prev = -Infinity;
    order.forEach(function (i) { var want = Math.max(Y(list[i].y) - 6, prev + 50); labelY[i] = want; prev = want; });
    list.forEach(function (c, i) {
      var y = Y(c.y), lx = ox + bw + 30, ly = labelY[i];
      o.push('<g class="fn-rule" data-i="' + i + '" style="display:none">' +
             '<line class="fn-ruler" x1="' + X(c.x0).toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + X(c.x1).toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
             '<line class="fn-ruler" x1="' + X(c.x0).toFixed(1) + '" y1="' + (y - 7).toFixed(1) + '" x2="' + X(c.x0).toFixed(1) + '" y2="' + (y + 7).toFixed(1) + '"/>' +
             '<line class="fn-ruler" x1="' + X(c.x1).toFixed(1) + '" y1="' + (y - 7).toFixed(1) + '" x2="' + X(c.x1).toFixed(1) + '" y2="' + (y + 7).toFixed(1) + '"/>' +
             '<line class="fn-lead" x1="' + X(c.x1).toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (lx - 6) + '" y2="' + (ly - 4) + '"/>' +
             '<text class="fn-rname" x="' + lx + '" y="' + ly + '">' + c.rule + "  " + c.what + "</text>" +
             '<text class="fn-rval" x="' + lx + '" y="' + (ly + 17) + '">measured ' + Math.round(c.got * 1000) +
             " nm, " + (c.exact ? "must be exactly " : "minimum ") + Math.round(c.min * 1000) + " nm  ✓</text></g>");
    });
    o.push("</svg>");
    return o.join("") + '<div class="gp-readout"><span>rules passed on this cell <b id="fn-rpass">0</b> of ' +
      drcChecks().length + '</span><button class="ff-reset" type="button" id="fn-rreplay">replay</button></div>';
  }

  function drcAnimate() {
    var root = document.getElementById("flow-fig-6");
    if (!root) return;
    var rules = [].slice.call(root.querySelectorAll(".fn-rule")), list = drcChecks();
    var say = document.getElementById("fn-rsay"), pass = document.getElementById("fn-rpass");
    var replay = document.getElementById("fn-rreplay"), timers = [];
    function play() {
      timers.forEach(clearTimeout); timers = [];
      rules.forEach(function (r) { r.style.display = "none"; });
      if (pass) pass.textContent = "0";
      rules.forEach(function (r, i) {
        timers.push(setTimeout(function () {
          r.style.display = "";
          if (pass) pass.textContent = String(i + 1);
          var c = list[i], over = Math.round((c.got - c.min) * 1000);
          if (say) say.textContent = c.rule + ": " + (over === 0 ? "drawn at exactly the limit" : over + " nm to spare");
        }, 1000 + i * 2800));
      });
      timers.push(setTimeout(function () {
        if (say) say.textContent = "the cell is drawn at the limits, which is why only the real polygons can be checked";
      }, 1000 + rules.length * 2800 + 600));
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- what a failure looks like -----
     This block passes, so its report is empty. These panels show what the
     deck would flag. Three are the real NAND2_X1 with one shape moved or
     narrowed on purpose, so exactly one real rule breaks; the fourth is
     not made up at all: it is the window from step 2 as it was before fill,
     and the deck flags it, and every metal3 window like it, if step 2 is
     skipped. Measurements are computed from the edited geometry. */
  function editedNand(edit) {
    var L = {};
    Object.keys(NAND2.layers).forEach(function (k) {
      L[k] = NAND2.layers[k].map(function (poly) { return poly.map(function (p) { return [p[0], p[1]]; }); });
    });
    edit(L);
    return L;
  }
  function shiftX(poly, dx) { poly.forEach(function (p) { p[0] = +(p[0] + dx).toFixed(4); }); }

  function drcFails(M) {
    return [
      {
        rule: "METAL1.2", what: "metal1 too close", min: 65,
        /* the A2 pin pad, nudged 20 nm towards the output */
        layers: editedNand(function (L) { shiftX(L.metal1[3], 0.02); shiftX(L.contact[4], 0.02); }),
        crop: [0.02, 0.42, 0.56, 0.86], got: Math.round((0.25 - (0.185 + 0.02)) * 1000),
        mark: [0.205, 0.525, 0.25, 0.7],
        note: "the A2 pin moved 20 nm right",
      },
      {
        rule: "POLY.1", what: "gate too narrow", min: 50,
        /* the A2 gate, 5 nm off each side of its long run */
        layers: editedNand(function (L) {
          L.poly[0].forEach(function (p) { if (p[0] === 0.16) p[0] = 0.165; else if (p[0] === 0.21) p[0] = 0.205; });
        }),
        crop: [0.02, 0.02, 0.56, 0.56], got: Math.round((0.205 - 0.165) * 1000),
        mark: [0.165, 0.04, 0.205, 0.555],
        note: "the A2 gate drawn 40 nm wide",
      },
      {
        rule: "CONTACT.4", what: "contact near an edge", min: 5,
        /* the diffusion's left edge pulled in 3 nm, towards the ground
           contact: moving the contact instead would also push it out of
           its metal, and break two more rules */
        layers: editedNand(function (L) {
          L.active[0].forEach(function (p) { if (p[0] === 0.055) p[0] = 0.058; });
        }),
        crop: [0.0, 0.13, 0.2, 0.3], got: Math.round((0.06 - 0.058) * 1000),
        mark: [0.058, 0.185, 0.06, 0.25],
        note: "the diffusion edge pulled in 3 nm",
      },
    ];
  }

  function drcFailFigure(M) {
    var PW = 300, PH = 250, gx = 30, gy = 62, o = [];
    var W = 2 * PW + gx + 24, H = 2 * (PH + gy) + 20;
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-fails" role="img" aria-label="Four design rule ' +
           "violations as a rule checker marks them: three on the cell NAND2_X1 with one shape edited, and one " +
           'metal density window before fill">');
    o.push('<defs><pattern id="fn-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
           '<rect width="6" height="6" fill="rgba(220,38,38,0.18)"/><line x1="0" y1="0" x2="0" y2="6" stroke="#dc2626" stroke-width="2"/></pattern></defs>');
    function panel(i, title, sub) {
      var px = 12 + (i % 2) * (PW + gx), py = 12 + Math.floor(i / 2) * (PH + gy);
      o.push('<text class="fn-fname" x="' + px + '" y="' + (py + 14) + '">' + title + "</text>");
      o.push('<text class="fn-fsub" x="' + px + '" y="' + (py + 32) + '">' + sub + "</text>");
      return { x: px, y: py + 42 };
    }
    drcFails(M).forEach(function (f, i) {
      var c = f.crop, s = Math.min(PW / (c[2] - c[0]), (PH - 20) / (c[3] - c[1]));
      var at = panel(i, f.rule + ": " + f.what,
                     "measured " + f.got + " nm, required " + (f.rule === "CONTACT.4" ? "at least " : "") + f.min + " nm  ✗");
      function X(x) { return at.x + (x - c[0]) * s; }
      function Y(y) { return at.y + (c[3] - y) * s; }
      var id = "fn-fclip" + i;
      o.push('<clipPath id="' + id + '"><rect x="' + at.x + '" y="' + at.y + '" width="' + ((c[2] - c[0]) * s).toFixed(1) +
             '" height="' + ((c[3] - c[1]) * s).toFixed(1) + '"/></clipPath>');
      o.push('<rect class="fn-fbox" x="' + at.x + '" y="' + at.y + '" width="' + ((c[2] - c[0]) * s).toFixed(1) +
             '" height="' + ((c[3] - c[1]) * s).toFixed(1) + '"/>');
      o.push('<g clip-path="url(#' + id + ')">' + cellMarkup(X, Y, null, false, f.layers));
      var m = f.mark;
      o.push('<rect class="fn-viol" x="' + (X(m[0]) - 2).toFixed(1) + '" y="' + (Y(m[3]) - 2).toFixed(1) + '" width="' +
             ((m[2] - m[0]) * s + 4).toFixed(1) + '" height="' + ((m[3] - m[1]) * s + 4).toFixed(1) + '"/></g>');
      o.push('<text class="fn-fnote" x="' + at.x + '" y="' + (at.y + (c[3] - c[1]) * s + 16).toFixed(1) + '">edited on purpose: ' +
             f.note + "</text>");
    });
    /* the fourth: a real one, the step 2 window with no fill */
    var sc = M.zoom, at = panel(3, "METAL3.D1: window too empty", "measured " + f1(sc.before * 100) +
                                "% metal3, required at least " + Math.round(OPT.minDensity * 100) + "%  ✗");
    var s = Math.min(PW, PH - 20) / sc.um;
    function X4(x) { return at.x + x * s; }
    function Y4(y) { return at.y + y * s; }
    o.push('<rect class="fn-zwin" x="' + at.x + '" y="' + at.y + '" width="' + (sc.um * s).toFixed(1) + '" height="' + (sc.um * s).toFixed(1) + '"/>');
    sc.wires.forEach(function (wr) {
      o.push('<rect class="fn-wire" x="' + X4(wr.x0).toFixed(1) + '" y="' + Y4(wr.y).toFixed(1) + '" width="' +
             ((wr.x1 - wr.x0) * s).toFixed(1) + '" height="' + Math.max(1.2, wr.h * s).toFixed(1) + '"/>');
    });
    o.push('<rect class="fn-viol fn-viol-win" x="' + at.x + '" y="' + at.y + '" width="' + (sc.um * s).toFixed(1) + '" height="' + (sc.um * s).toFixed(1) + '"/>');
    o.push('<text class="fn-fnote fn-freal" x="' + at.x + '" y="' + (at.y + sc.um * s + 16).toFixed(1) + '">' +
           "not edited: step 2's window, before fill</text>");
    o.push("</svg>");
    return o.join("");
  }

  /* ----- layout versus schematic, on the same cell -----
     A transistor is wherever poly crosses diffusion: its width is the
     diffusion's height there, its length the poly's width, and its source
     and drain are the diffusion on either side. Those are extracted here
     from the device boxes and compared, field by field, with the cell's
     CDL. */
  function extracted() {
    return NAND2.devices.map(function (d) {
      var b = d.box;
      return { id: d.id, type: d.type, g: d.g, sd: [d.l, d.r], w: +(b[3] - b[1]).toFixed(3), l: +(b[2] - b[0]).toFixed(3), box: b };
    });
  }
  function cdlDevice(line) {
    var f = line.split(/\s+/);
    return { id: f[0], d: f[1], g: f[2], s: f[3], type: f[5],
             w: parseFloat(f[6].slice(2)), l: parseFloat(f[7].slice(2)) };
  }
  function lvsMatch() {
    var ref = NAND2.cdl.filter(function (l) { return /^M/.test(l); }).map(cdlDevice);
    /* the extractor does not know the netlist's device names: a match is a
       device of the same type, on the same gate net, between the same two
       nets (either way round), with the same width and length */
    return extracted().map(function (e) {
      var r = ref.filter(function (x) {
        var sdOk = (x.d === e.sd[0] && x.s === e.sd[1]) || (x.d === e.sd[1] && x.s === e.sd[0]);
        return x.type === e.type && x.g === e.g && sdOk &&
               Math.abs(x.w - e.w) < 1e-6 && Math.abs(x.l - e.l) < 1e-6;
      })[0];
      return { e: e, r: r || { id: "?" }, ok: !!r };
    });
  }

  /* ----- the schematic the comparison builds -----
     Where each extracted transistor goes in the drawing: the classic NAND,
     the two p-type in parallel under the supply, the two n-type in series
     above ground. A slot is chosen by what the extractor found (the
     transistor's type and the nets on its ends), never by its name, so the
     drawing is built from the layout and then checked against the netlist.
     Coordinates are within the schematic panel. */
  var SCH = {
    VDD: 62, VSS: 346, ZN: 166, net0: 256,
    slots: [
      { type: "PMOS_VTL", nets: ["VDD", "ZN"], gate: "A2", x: 170, yc: 114 },
      { type: "PMOS_VTL", nets: ["VDD", "ZN"], gate: "A1", x: 320, yc: 114 },
      { type: "NMOS_VTL", nets: ["ZN", "net_0"], gate: "A1", x: 245, yc: 211 },
      { type: "NMOS_VTL", nets: ["net_0", "VSS"], gate: "A2", x: 245, yc: 301 },
    ],
  };
  function slotFor(e) {
    return SCH.slots.filter(function (s) {
      return s.type === e.type && s.gate === e.g && s.nets.indexOf(e.sd[0]) >= 0 && s.nets.indexOf(e.sd[1]) >= 0;
    })[0];
  }
  /* the y each net sits at, for the leads to run to */
  function netY(n) { return n === "VDD" ? SCH.VDD : n === "VSS" ? SCH.VSS : n === "ZN" ? SCH.ZN : SCH.net0; }

  function transistor(s, e, m, ox, oy) {
    var x = ox + s.x, yc = oy + s.yc, h = 22, o = [];
    var top = s.nets[0], bot = s.nets[1];
    /* the channel, the gate plate beside it, and the gate lead */
    o.push('<line class="fn-sch-ch" x1="' + x + '" y1="' + (yc - h) + '" x2="' + x + '" y2="' + (yc + h) + '"/>');
    o.push('<line class="fn-sch-g" x1="' + (x - 9) + '" y1="' + (yc - h + 5) + '" x2="' + (x - 9) + '" y2="' + (yc + h - 5) + '"/>');
    var p = s.type === "PMOS_VTL";
    if (p) o.push('<circle class="fn-sch-bub" cx="' + (x - 14) + '" cy="' + yc + '" r="4.5"/>');
    o.push('<line class="fn-sch-w" x1="' + (x - (p ? 18.5 : 9)) + '" y1="' + yc + '" x2="' + (x - 40) + '" y2="' + yc + '"/>');
    o.push('<text class="fn-sch-in" x="' + (x - 44) + '" y="' + (yc + 4) + '">' + s.gate + "</text>");
    /* the leads to the nets above and below */
    o.push('<line class="fn-sch-w" x1="' + x + '" y1="' + (yc - h) + '" x2="' + x + '" y2="' + (oy + netY(top)) + '"/>');
    o.push('<line class="fn-sch-w" x1="' + x + '" y1="' + (yc + h) + '" x2="' + x + '" y2="' + (oy + netY(bot)) + '"/>');
    /* a p-type's drain joins the output where the n-type stack meets it,
       so each brings its own stretch of that wire, and a dot where it tees */
    if (p) {
      var node = ox + SCH.slots[2].x, zy = oy + SCH.ZN;
      o.push('<line class="fn-sch-w" x1="' + x + '" y1="' + zy + '" x2="' + node + '" y2="' + zy + '"/>');
      if (x > node) o.push('<circle class="fn-sch-dot" cx="' + x + '" cy="' + zy + '" r="3.5"/>');
    }
    /* what it is: the netlist's name for it once matched, and its size */
    o.push('<text class="fn-sch-id" x="' + (x + 8) + '" y="' + (yc - 4) + '">' + (m.ok ? m.r.id : "?") + "</text>");
    o.push('<text class="fn-sch-sz" x="' + (x + 8) + '" y="' + (yc + 11) + '">W ' + e.w.toFixed(3) + " L " + e.l.toFixed(3) + "</text>");
    return o.join("");
  }

  function lvsFigure() {
    var S = 260, bw = (CELL_BOX.x1 - CELL_BOX.x0) * S, bh = (CELL_BOX.y1 - CELL_BOX.y0) * S;
    var ox = 24, top = 52, sx = ox + bw + 50, sy = top - 10, W = sx + 470, o = [];
    var cdlY = sy + SCH.VSS + 46, H = Math.max(top + bh + 24, cdlY + NAND2.cdl.length * 19 + 36);
    function X(x) { return ox + (x - CELL_BOX.x0) * S; }
    function Y(y) { return top + (CELL_BOX.y1 - y) * S; }
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-lvs" role="img" aria-label="The four transistors ' +
           'of NAND2_X1 extracted from its polygons and built one by one into a schematic, then matched to the ' +
           'lines of its CDL netlist">');
    o.push('<text class="ff3-cap fn-lsay" id="fn-lsay" x="' + ox + '" y="22">press play</text>');
    o.push('<text class="ff3-cap" x="' + ox + '" y="' + (top - 8) + '">the layout</text>');
    o.push('<g class="fn-muted">' + cellMarkup(X, Y, ["active", "poly", "contact", "metal1"], false) + "</g>");
    [["VSS", 0.105, 0.30], ["net_0", 0.28, 0.30], ["ZN", 0.455, 0.30],
     ["VDD", 0.105, 0.90], ["ZN", 0.28, 0.90], ["VDD", 0.455, 0.90]].forEach(function (n) {
      o.push('<text class="fn-net" x="' + X(n[1]).toFixed(1) + '" y="' + Y(n[2]).toFixed(1) + '">' + n[0] + "</text>");
    });
    var ms = lvsMatch();
    ms.forEach(function (m, i) {
      var b = m.e.box;
      o.push('<rect class="fn-dev" data-i="' + i + '" x="' + X(b[0]).toFixed(1) + '" y="' + Y(b[3]).toFixed(1) +
             '" width="' + ((b[2] - b[0]) * S).toFixed(1) + '" height="' + ((b[3] - b[1]) * S).toFixed(1) + '"/>');
    });

    /* the schematic, built as the transistors are found */
    o.push('<text class="ff3-cap" x="' + sx + '" y="' + (top - 8) + '">the circuit it extracts</text>');
    var railX0 = sx + 120, railX1 = sx + 360;
    o.push('<g class="fn-sch-net" data-net="VDD" style="opacity:0"><line class="fn-sch-rail" x1="' + railX0 + '" y1="' + (sy + SCH.VDD) +
           '" x2="' + railX1 + '" y2="' + (sy + SCH.VDD) + '"/><text class="fn-sch-pin" x="' + (railX1 + 8) + '" y="' + (sy + SCH.VDD + 4) + '">VDD</text></g>');
    o.push('<g class="fn-sch-net" data-net="VSS" style="opacity:0"><line class="fn-sch-rail" x1="' + railX0 + '" y1="' + (sy + SCH.VSS) +
           '" x2="' + railX1 + '" y2="' + (sy + SCH.VSS) + '"/><text class="fn-sch-pin" x="' + (railX1 + 8) + '" y="' + (sy + SCH.VSS + 4) + '">VSS</text></g>');
    o.push('<g class="fn-sch-net" data-net="ZN" style="opacity:0"><line class="fn-sch-w" x1="' + (sx + SCH.slots[2].x) + '" y1="' + (sy + SCH.ZN) +
           '" x2="' + (sx + 400) + '" y2="' + (sy + SCH.ZN) + '"/><circle class="fn-sch-dot" cx="' + (sx + SCH.slots[2].x) + '" cy="' + (sy + SCH.ZN) +
           '" r="3.5"/><circle class="fn-sch-dot" cx="' + (sx + 400) + '" cy="' + (sy + SCH.ZN) + '" r="3.5"/>' +
           '<text class="fn-sch-pin" x="' + (sx + 408) + '" y="' + (sy + SCH.ZN + 4) + '">ZN</text></g>');
    o.push('<g class="fn-sch-net" data-net="net_0" style="opacity:0"><circle class="fn-sch-dot" cx="' + (sx + SCH.slots[2].x) + '" cy="' + (sy + SCH.net0) +
           '" r="3.5"/><text class="fn-sch-in" x="' + (sx + SCH.slots[2].x - 8) + '" y="' + (sy + SCH.net0 + 4) + '">net_0</text></g>');
    ms.forEach(function (m, i) {
      var s = slotFor(m.e);
      if (!s) return;
      o.push('<g class="fn-sch-dev" data-i="' + i + '" style="opacity:0">' + transistor(s, m.e, m, sx, sy) + "</g>");
    });

    /* the netlist it is checked against, as the library ships it */
    o.push('<text class="fn-cdlhead" x="' + sx + '" y="' + (cdlY - 4) + '">checked against stdcells.cdl</text>');
    var devIndex = {};
    ms.forEach(function (m, i) { devIndex[m.r.id] = i; });
    NAND2.cdl.forEach(function (line, k) {
      var id = line.split(/\s+/)[0], di = devIndex[id];
      o.push('<text class="fn-cdl' + (di !== undefined ? " fn-cdl-dev" : "") + '"' +
             (di !== undefined ? ' data-i="' + di + '"' : "") + ' x="' + sx + '" y="' + (cdlY + 16 + k * 19) + '">' +
             esc(line) + "</text>");
    });
    o.push("</svg>");
    return o.join("") + '<div class="gp-readout"><span>transistors found and matched <b id="fn-lmatch">0</b> of ' +
      NAND2.devices.length + '</span><button class="ff-reset" type="button" id="fn-lreplay">replay</button></div>' +
      '<div class="ff3-legend"><span><i class="pl-sw fn-sw-dev"></i>a transistor: poly crossing diffusion</span>' +
      "<span>the words on the diffusion are the nets each region is wired to through its contacts; the one " +
      "region wired to nothing but the two transistors is the cell's inside net, which the CDL calls net_0</span></div>";
  }

  function lvsAnimate() {
    var root = document.getElementById("flow-fig-7");
    if (!root) return;
    var ms = lvsMatch(), say = document.getElementById("fn-lsay");
    var cnt = document.getElementById("fn-lmatch"), replay = document.getElementById("fn-lreplay"), timers = [];
    function each(sel, fn) { root.querySelectorAll(sel).forEach(fn); }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      each(".fn-dev, .fn-cdl", function (el) { el.classList.remove("fn-hot", "fn-done"); });
      each(".fn-sch-dev, .fn-sch-net", function (el) { el.style.opacity = "0"; });
      if (cnt) cnt.textContent = "0";
      if (say) say.textContent = "the extractor walks the layout, looking for poly over diffusion";
      var matched = 0;
      ms.forEach(function (m, i) {
        timers.push(setTimeout(function () {
          each(".fn-hot", function (el) { el.classList.remove("fn-hot"); el.classList.add("fn-done"); });
          each('[data-i="' + i + '"]', function (el) { el.classList.add("fn-hot"); });
          /* the transistor goes into the drawing, with the nets it touches */
          var g = root.querySelector('.fn-sch-dev[data-i="' + i + '"]');
          if (g) g.style.opacity = "1";
          m.e.sd.forEach(function (n) {
            var net = root.querySelector('.fn-sch-net[data-net="' + n + '"]');
            if (net) net.style.opacity = "1";
          });
          if (m.ok) matched++;
          if (cnt) cnt.textContent = String(matched);
          if (say) say.textContent = (m.e.type === "NMOS_VTL" ? "an n-type" : "a p-type") + " transistor, gate " +
            m.e.g + ", between " + m.e.sd[0] + " and " + m.e.sd[1] + (m.ok ? ": matches " + m.r.id : ": no match");
        }, 900 + i * 2200));
      });
      timers.push(setTimeout(function () {
        each(".fn-hot", function (el) { el.classList.remove("fn-hot"); el.classList.add("fn-done"); });
        if (say) say.textContent = matched === ms.length
          ? "the circuit built from the layout is a NAND2, and it is the netlist's NAND2_X1, device for device"
          : "a mismatch";
      }, 900 + ms.length * 2200 + 400));
    }
    if (replay && !replay.dataset.wired) { replay.dataset.wired = "1"; replay.addEventListener("click", play); }
    play();
  }

  /* ----- the whole chain, one number from each stage ----- */
  function chainFigure(M) {
    var cm = M.R.cts, z = M.z;
    var st = [
      ["Synthesis", "synthesis", fmt(z.fg.cells), ["cells", "mapped"]],
      ["Floorplan", "floorplan", f1(z.dieW) + " µm", ["square die", "4 memories"]],
      ["Placement", "placement", fmt(z.rows), ["rows", "every cell legal"]],
      ["Clock tree", "cts", fmt(cm.buffers), ["clock buffers", "for " + fmt(cm.flops) + " flops"]],
      ["Routing", "routing", Math.round(M.R.wire.total / 1000) + " mm", ["of wire", "0 violations"]],
      ["Timing", "timing", "+" + M.T.slack + " ps", ["setup slack", "extracted"]],
      ["Finishing", "finish", "+" + M.slack + " ps", ["with fill", "0 rule errors", "matches netlist"]],
    ];
    var bw = 96, gap = 14, x0 = 12, top = 30, h = 118, W = x0 * 2 + st.length * bw + (st.length - 1) * gap, H = top + h + 40, o = [];
    o.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg fn-chain" role="img" aria-label="The seven worked ' +
           'examples in order, with the number each one handed to the next">');
    o.push('<text class="ff3-cap" x="' + x0 + '" y="18">one block, seven stages, one number each</text>');
    st.forEach(function (s, i) {
      var x = x0 + i * (bw + gap), last = i === st.length - 1;
      o.push('<a href="/explore/examples/' + s[1] + '"><g class="fn-link' + (last ? " fn-here" : "") + '">' +
             '<rect class="fn-stage" x="' + x + '" y="' + top + '" width="' + bw + '" height="' + h + '" rx="5"/>' +
             '<text class="fn-sname" x="' + (x + bw / 2) + '" y="' + (top + 22) + '">' + (i + 1) + " · " + s[0] + "</text>" +
             '<text class="fn-sbig" x="' + (x + bw / 2) + '" y="' + (top + 56) + '">' + s[2] + "</text>" +
             s[3].map(function (t, k) {
               return '<text class="fn-ssmall" x="' + (x + bw / 2) + '" y="' + (top + 78 + k * 14) + '">' + t + "</text>";
             }).join("") +
             "</g></a>");
      if (!last) o.push('<path class="fn-arrow" d="M' + (x + bw + 2) + "," + (top + h / 2) + " l" + (gap - 5) + ",0 m-4,-4 l4,4 l-4,4\"/>");
    });
    o.push('<text class="fn-chainend" x="' + x0 + '" y="' + (top + h + 28) + '">and out of the last one: tile4m.gds</text>');
    o.push("</svg>");
    return o.join("");
  }

  /* a file excerpt, with a bar naming the file and saying what it is */
  function code(lines, file, what) {
    return (file ? '<div class="fn-codefile"><code>' + esc(file) + "</code><span>" + what + "</span></div>" : "") +
      '<pre class="sy-code' + (file ? " fn-coded" : "") + '">' + lines.map(function (l) {
      return /^\s*(#|\/\/)/.test(l) ? '<span class="sy-comment">' + esc(l) + "</span>" : esc(l);
    }).join("\n") + "</pre>";
  }

  /* the numbers the timing example printed when it wrote the files out,
     computed the same way so the two pages agree */
  function areaLine(M) {
    var cellArea = M.z.fg.cellArea + 10215 + M.T.cts.area;
    var util = 100 * cellArea / (M.z.coreArea - M.z.fg.macroArea);
    return { area: cellArea, util: util };
  }

  /* a stand-in checksum: 32 hexadecimal digits that depend on the run */
  function digest(text) {
    var out = "", h = 0x811c9dc5;
    for (var r = 0; r < 4; r++) {
      for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i) + r; h = Math.imul(h, 0x01000193) >>> 0; }
      out += ("00000000" + h.toString(16)).slice(-8);
    }
    return out;
  }

  var TECH_LAYERS = ["metal1", "via1", "metal2", "via2", "metal3", "via3", "metal4", "via4", "metal5", "via5", "metal6"];
  var KLAYOUT_STREAM = 'klayout -zz -rd design_name=tile4m -rd in_def=tile4m_final.def ' +
    '-rd in_files="stdcells.gds mem_wide.gds mem_square.gds" -rd seal_file="" -rd out_file=tile4m.gds ' +
    '-rd tech_file=process.lyt -rd layer_map="" -r def2stream.py';
  var KLAYOUT_DRC = "klayout -zz -rd in_gds=tile4m.gds -rd report_file=tile4m_drc.lyrdb -r process.lydrc";
  var KLAYOUT_LVS = "klayout -b -rd in_gds=tile4m.gds -rd cdl_file=tile4m_lvs.cdl -rd report_file=tile4m.lvsdb -r process.lylvs";

  var STEPS = [];

  STEPS.push({
    n: 1, title: "Pick up the signed-off block", button: "Open the block", againLabel: "Open again",
    line: "Open the database the timing example wrote, and see what is still missing.",
    intro:
      "<p>The timing example ended with a block that meets its clock and a database on disk. It is not " +
      "yet something a foundry can build, and the reason is the thing every stage so far has quietly " +
      "relied on: <strong>abstracts</strong>. Placement, routing and timing never needed to know what is " +
      "inside a cell, only its outline, where its pins are, and how fast it is. So the whole design, " +
      "as it stands, is fifty thousand references to boxes, plus the metal that joins them.</p>" +
      "<p>A mask needs every polygon on every layer. This stage gets there in five moves, the same five " +
      "the open flow's own finishing scripts make: fill the empty metal so the wafer can be polished " +
      "flat, re-time the block with that metal in place, check that its power grid holds the supply up " +
      "under load, swap every abstract for the cell's real layout, and then prove two separate things " +
      "about the result. Design rule checking asks whether every " +
      "shape can be manufactured. Layout versus schematic asks whether the shapes are still the circuit " +
      "synthesis wrote. A block can pass either one and fail the other.</p>",
    command:
      "# the design as the timing example left it: placed, routed, signed off\n" +
      "read_db tile4m_final.odb\n" +
      "read_sdc tile4m.sdc\n" +
      "\n" +
      "# what is in it, before anything is added\n" +
      "report_design_area\n" +
      "report_cell_usage",
    commandNote:
      "Nothing here changes the design. The point of opening it again is to start from exactly the " +
      "file the previous stage signed off, rather than from anything held in memory: every stage of a " +
      "real flow is its own run that reads what the last one wrote.",
    run: function () {
      var M = model(), a = areaLine(M);
      return {
        log: [
          { k: "cmd", t: "read_db tile4m_final.odb" },
          { k: "cmd", t: "read_sdc tile4m.sdc" },
          { k: "cmd", t: "report_design_area" },
          { k: "out", t: "  Design area " + Math.round(a.area) + " um^2 " + Math.round(a.util) + "% utilization." },
          { k: "cmd", t: "report_cell_usage" },
          { k: "out", t: "  " + fmt(M.insts) + " instances, plus " + fmt(Math.round(M.insts * 0.32)) +
                         " fillers and 1128 taps" },
          { k: "ok", t: "The block is open. Every cell in it is still an abstract." },
        ],
        figure: '<p class="ff3-figtext">The block as the timing example signed it off: the four memories, ' +
          "the signal metal, the clock tree on the upper layers, the power grid over everything. Every " +
          "shape here is real metal. What is missing is everything <em>under</em> it: inside each of the " +
          "cells the metal lands on, there is nothing yet but a name.</p>" + RT.finishedFigure(M.R),
        report: "<h3>What arrives, and what the foundry needs</h3>" + table([
          ["Placement and routing", "done: every cell on a legal site, every net in real metal"],
          ["Timing", "signed off at " + M.T.slack + " picoseconds of setup slack, on extracted parasitics"],
          ["The cells", "abstracts: an outline and its pins, from the library's LEF (Library Exchange Format) file"],
          ["The memories", "abstracts too, from the memory compiler's LEF (Library Exchange Format) files"],
          ["Metal density", "whatever the router left, which is not what the rules require"],
          ["Proof it can be built", "not yet: the foundry's rules have not been run on real shapes"],
          ["Proof it is the right circuit", "not yet: nothing has compared the shapes to the netlist"],
        ]) + checks([
          ["Nothing in this stage changes the logic.",
           "Fill is floating metal connected to nothing, the stream swaps views of the same cells, and the " +
           "two checks only read. If a check fails, the fix goes back into an earlier stage."],
          ["The router was right to use abstracts.",
           "A full layout of every cell would have made placement and routing far slower and told them " +
           "nothing they needed. The price is that the abstracts must be checked against the real cells " +
           "once, at the end, which is what this stage does."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Fill the empty metal", button: "Insert the fill", againLabel: "Fill again",
    line: "Add floating metal until every window of every layer is dense enough to polish flat.",
    intro: function () {
      var M = model(), s = M.show;
      return "<p>Each metal layer is made by laying down copper over the whole wafer and polishing the " +
        "excess away until only the wires are left. Polishing is only flat if the metal underneath is " +
        "even: where a region is almost empty the polish dishes into it, and where it is crowded it " +
        "leaves the surface high. So the process sets a <strong>density rule</strong>: in every window of " +
        OPT.windowUm + " micrometers, at least " + Math.round(OPT.minDensity * 100) + "% and at most " +
        Math.round(OPT.maxDensity * 100) + "% of each layer must be metal.</p>" +
        "<p>The routing does not come close. Metal3 carries " + fmt(Math.round(s.demand)) + " micrometers of " +
        "wire, " + Math.round(s.usage * 100) + "% of its tracks, and at " + s.width + " micrometers wide " +
        "that covers " + f1(s.before * 100) + "% of the area. Every window on the layer is under the " +
        "minimum. The fix is <strong>fill</strong>: squares of metal connected to nothing, placed in the " +
        "gaps, kept a set distance from every real wire so they cannot short to one.</p>";
    },
    command:
      "# the clock is real by now, so say so before anything reads the timing\n" +
      "set_propagated_clock [all_clocks]\n" +
      "\n" +
      "# floating metal wherever the rules allow: which layers, which shapes,\n" +
      "# and how far from real metal all come from the rules file\n" +
      "density_fill -rules fill.json",
    commandNote:
      "The open flow runs this step only when <code>USE_FILL</code> is set, and leaves it off by default, " +
      "because a block that will sit inside a bigger chip is usually filled along with the rest of that " +
      "chip at the end. This example takes the block to tapeout on its own, so it fills. Without " +
      "<code>-area</code>, the tool fills the core. It never looks at timing: the only thing keeping fill " +
      "away from a wire is the keepout in the rules file, which is why step 3 exists.",
    reference: function () {
      return "<h3>The rules file, for one layer</h3>" +
        "<p>The shape of this file is the open flow's own (its 130 nanometer platform's " +
        '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/fill.json">fill.json</a>' +
        "); the numbers are this process's. Metal2, metal4, metal5 and metal6 have entries of the same " +
        "shape, and metal1 has none, because the cells' own rails and pins already make it dense.</p>" +
        code([
          "{",
          '  "layers": {',
          '    "metal3": {',
          '      "layer": ' + GDS.metal3 + ",",
          '      "name": "metal3",',
          '      "dir": "H",',
          '      "datatype": 0,',
          '      "space_to_outline": 1.0,',
          '      "non-opc": {',
          '        "datatype": 0,',
          '        "width": [' + OPT.fillSizes.join(", ") + "],",
          '        "height": [' + OPT.fillSizes.join(", ") + "],",
          '        "space_to_fill": ' + OPT.fillSpace + ",",
          '        "space_to_non_fill": ' + OPT.keepout,
          "      }",
          "    }",
          "  }",
          "}",
        ], "fill.json", "the fill rules density_fill reads, the metal3 entry") +
        "<p><code>width</code> and <code>height</code> are the shapes to try, largest first. " +
        "<code>space_to_fill</code> is the gap between two fill shapes, and <code>space_to_non_fill</code> " +
        "is the keepout from real metal: the one number here that decides what fill does to timing.</p>";
    },
    run: function () {
      var M = model(), log = [
        { k: "cmd", t: "set_propagated_clock [all_clocks]" },
        { k: "cmd", t: "density_fill -rules fill.json" },
      ];
      TECH_LAYERS.forEach(function (name) {
        var l = M.layers.filter(function (x) { return x.name === name; })[0];
        if (!l) { log.push({ k: "out", t: "  [WARNING FIN-0010] Skipping layer " + name + "." }); return; }
        log.push({ k: "out", t: "  [INFO FIN-0003] Filling layer " + name + "." });
        log.push({ k: "out", t: "  [INFO FIN-0009] Filling " + fmt(l.areas) + " areas with non-OPC fill." });
        log.push({ k: "out", t: "  [INFO FIN-0004] Total fills: " + l.total + "." });
      });
      log.push({ k: "ok", t: "Every window of every filled layer is between " + Math.round(OPT.minDensity * 100) +
                 "% and " + Math.round(OPT.maxDensity * 100) + "% metal." });
      return {
        log: log,
        figure: '<p class="ff3-figtext">On the left, the block with nothing but its cells: no routing. As in ' +
          "the placement example, each dot is a sample, one for about every " +
          Math.round(M.z.fg.cells / PlacementSteps.model().cells.length) + " real cells, so a sparse spot shows " +
          "few or none. The box marks one window on the bottom edge, between the two lower memories, where " +
          "placement left the cells sparse. On the right, that window enlarged. Only " + Math.round(M.zoom.logicShare * 100) +
          "% of it is logic; a tap cell sits where the tap column crosses it, and the rest of every row is " +
          "<strong>filler cells</strong>, which the routing example added so the rows are continuous.</p>" +
          '<p class="ff3-figtext">Press play. Metal fill is a different thing from filler cells: it does not ' +
          "go between the cells, it goes on the metal layers above them. So what appears first is the metal3 " +
          "routing that crosses this window, the only thing the fill has to stay away from. Each wire takes " +
          "a keepout band, " + OPT.keepout + " micrometers either side; then squares go in, the largest that " +
          "fits first, each " + OPT.fillSpace + " micrometers from the next. The cells underneath neither " +
          "block the fill nor are touched by it. The packing is computed, not drawn.</p>" + windowFigure(M) +
          '<p class="ff3-figtext">The same thing happens in every window of every filled layer. On metal3, ' +
          "all " + M.open.length + " windows outside the memories start below the " +
          Math.round(OPT.minDensity * 100) + "% minimum, between " + f1(M.spanBefore.lo * 100) + "% and " +
          f1(M.spanBefore.hi * 100) + "%, and end between " + f1(M.spanAfter.lo * 100) + "% and " +
          f1(M.spanAfter.hi * 100) + "%. The windows inside the memories are left alone: that metal is the " +
          "memory compiler's, and it met the rule when the memory was made.</p>",
        after: function () { zoomAnimate(M); },
        report: "<h3>Fill, layer by layer</h3>" + table([["Layer", "Density before, after, and fill shapes added"]].concat(
          M.layers.map(function (l) {
            return ["<code>" + l.name + "</code>", f1(l.before * 100) + "% to " + f1(l.after * 100) + "%, " +
              fmt(l.shapes) + " shapes"];
          }))) + checks([
          ["Fill is connected to nothing.",
           "It floats. It carries no signal and no power, and it never appears in the netlist. It is " +
           "there only for the polishing."],
          ["The emptiest windows end up the densest.",
           "Before fill, metal3's windows ran from " + f1(M.spanBefore.lo * 100) + "% to " +
           f1(M.spanBefore.hi * 100) + "%; after, from " + f1(M.spanAfter.lo * 100) + "% to " +
           f1(M.spanAfter.hi * 100) + "%, and the order flipped: a window the router left empty had the " +
           "most room, so it took the most fill. This tool fills every gap it is allowed to rather than " +
           "aiming at a density. That is enough to pass the rule, but production fill usually aims at a " +
           "target per window instead, which evens the layer out as well as legalizing it."],
          ["Fill is metal beside wires.",
           "Every square sits a keepout away from some wire, and a wire with metal beside it has more " +
           "capacitance than one without. The timing was signed off without it. The next step asks what " +
           "it cost."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Re-time with the fill in place", button: "Extract and re-time", againLabel: "Re-time again",
    line: "Extract the parasitics again, fill included, and check the block still meets its clock.",
    intro:
      "<p>A wire that had empty space beside it now has a square of floating metal a keepout away. That " +
      "adds coupling capacitance, and more capacitance is more delay. How much depends on how close the " +
      "fill is allowed to come, and on how much empty space there was beside the wire to begin with.</p>" +
      "<p>This is why the open flow's own finishing script runs its one extraction <em>after</em> fill " +
      "rather than before it: the numbers a block is signed off on should be the numbers of the metal " +
      "that will actually be made. The timing example extracted a stage early, to show sign-off on its " +
      "own; this step puts it back in the open flow's order and asks the question again.</p>",
    command:
      "# the fill is metal like any other, so extract again from the shapes as they\n" +
      "# now are: in the open flow, this is where the one extraction happens\n" +
      "define_process_corner -ext_model_index 0 X\n" +
      "extract_parasitics -ext_model_file rcx_patterns.rules\n" +
      "write_spef tile4m.spef\n" +
      "read_spef tile4m.spef\n" +
      "\n" +
      "# and ask the only question again, for both checks\n" +
      "report_worst_slack -max -digits 3\n" +
      "report_worst_slack -min -digits 3",
    commandNote:
      "The extractor needs nothing new to see the fill: the fill shapes are in the database now, so they " +
      "are simply part of the geometry it measures. <code>-max</code> is the setup check and " +
      "<code>-min</code> the hold check; <code>-digits 3</code> prints to the picosecond, because the " +
      "change is small.",
    run: function () {
      var M = model(), T = M.T;
      return {
        log: [
          { k: "cmd", t: "define_process_corner -ext_model_index 0 X" },
          { k: "out", t: "  [INFO RCX-0431] Defined process_corner X with ext_model_index 0" },
          { k: "cmd", t: "extract_parasitics -ext_model_file rcx_patterns.rules" },
          { k: "out", t: "  [INFO RCX-0043] Reading extraction model file rcx_patterns.rules ..." },
          { k: "out", t: "  [INFO RCX-0007] Extracting parasitics of " + fmt(M.nets) + " nets ..." },
          { k: "out", t: "  [INFO RCX-0016] Final " + fmt(M.nets) + " rc segments" },
          { k: "cmd", t: "write_spef tile4m.spef" },
          { k: "out", t: "  " + f1((T.totalC + M.addedC) / 1000) + " pF of capacitance in total, " +
                         f1(M.addedC / 1000) + " pF more than before fill" },
          { k: "cmd", t: "read_spef tile4m.spef" },
          { k: "cmd", t: "report_worst_slack -max -digits 3" },
          { k: "out", t: "  worst slack max " + (M.slack / 1000).toFixed(3) },
          { k: "cmd", t: "report_worst_slack -min -digits 3" },
          { k: "out", t: "  worst slack min " + (M.holdSlack / 1000).toFixed(3) },
          { k: "ok", t: "Still met, with fill: setup by " + M.slack + " picoseconds, hold by " + M.holdSlack + "." },
        ],
        figure: '<p class="ff3-figtext">The worst path from the timing example, stage by stage. The ' +
          "<em>before</em> column is each stage's delay exactly as the timing example reported it. The " +
          "<em>after</em> column adds what the fill beside that stage's net costs: the net's extra " +
          "capacitance times the resistance of the gate driving it. Play it and the path is re-timed one " +
          "stage at a time. Every stage got slower, the long nets the most, because they have the most " +
          "edge for fill to sit beside; none by more than a picosecond, because the path runs through the " +
          "busy middle of the block, where the keepouts left the fill the least room.</p>" +
          '<p class="ff3-figtext">The changes are too small to see as bars drawn from zero, so the chart ' +
          "underneath draws only the slack, on an axis that starts just below where it ends, and shows " +
          "what each stage took from it.</p>" + pathFigure(M),
        after: function () { pathAnimate(M); },
        report: "<h3>What the fill cost</h3>" + table([
          ["Setup slack", T.slack + " picoseconds before fill, " + M.slack + " after: the fill added " +
            M.hit.delay + " picoseconds to the worst path"],
          ["Hold slack", M.holdSlack + " picoseconds, unchanged: the hold path is two flip-flops side by " +
            "side with almost no wire between them, so there is nothing for fill to sit beside"],
          ["The keepout, halved", "at " + OPT.keepoutTight + " micrometers the fill would add " +
            M.hitTight.delay + " picoseconds and leave " + M.slackTight + ""],
          ["Capacitance added", f1(M.addedC / 1000) + " picofarads across the design, " +
            f1(100 * M.addedC / T.totalC) + "% of the total, so power barely moves"],
        ]) + checks([
          ["The keepout is a timing knob.",
           "Closer fill is better for polishing and worse for timing. The rules file sets one keepout for " +
           "every wire; production flows go further, keeping fill away from nets that are known to be " +
           "critical, or placing fill with the timing in view."],
          ["The clock moved too, and it mostly cancelled.",
           "The clock tree's wires also gained a little capacitance, but both ends of a path hang off the " +
           "same tree, which gained almost the same on every branch, so the skew between them barely " +
           "changed. A lopsided tree would not have been so lucky."],
          ["Why the order matters.",
           "Had the block been signed off with a " + T.slack + " picosecond margin and then filled without " +
           "re-timing, the margin actually shipped would have been " + M.slack + ". On a tighter block, " +
           "that is the difference between working silicon and a failing path."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 4, title: "Check the power and the voltage drop", button: "Solve the power grid", againLabel: "Solve again",
    line: "Report what the block draws, then solve the power grid for how far the supply sags inside it.",
    intro: function () {
      var M = model();
      return "<p>Every cell draws its current through the power grid the floorplan example built: stripes of " +
        "metal4 and metal5 every 40 micrometers, fed from the ring around the core. That metal has " +
        "resistance, so the current flowing through it costs voltage. A cell in the middle of the block, " +
        "farthest from the ring, does not see the full " + f1(M.ir.V) + " volts, and a cell that sees " +
        "less is slower than the library says it is.</p>" +
        "<p>So this stage checks two things the timing never looked at. First, how much power the block " +
        "draws now that its final parasitics are known. Second, the <strong>voltage drop</strong>, also " +
        "called IR drop because it is current times resistance: the grid is turned into a network of " +
        "resistors, every cell becomes a small current draw on it, and the network is solved for the " +
        "voltage at every point. The open flow's own finishing script does exactly this, right after the " +
        "extraction in step 3, with <code>analyze_power_grid</code>.</p>";
    },
    command:
      "# what the block draws, from the parasitics extracted with the fill in place\n" +
      "report_power\n" +
      "\n" +
      "# hold each grid at its supply, then solve it: VDD for how far it falls,\n" +
      "# VSS for how far ground rises\n" +
      "set_pdnsim_net_voltage -net VDD -voltage 0.7\n" +
      "analyze_power_grid -net VDD -source_type FULL -error_file VDD.rpt\n" +
      "set_pdnsim_net_voltage -net VSS -voltage 0\n" +
      "analyze_power_grid -net VSS -source_type FULL -error_file VSS.rpt",
    commandNote:
      "<code>-source_type FULL</code> says where the supply comes in: every point of the grid's top layer, " +
      "which here is the ring. The tool's default instead assumes the chip is mounted upside down on a " +
      "grid of solder bumps, 140 micrometers apart, feeding the top layer from above, which is how a whole " +
      "chip is powered. A block like this one is fed by the chip around it, through its ring, so the ring " +
      "is the supply. The error files list any part of the grid that is not connected at all.",
    run: function () {
      var M = model(), ir = M.ir, p = ir.power;
      function e(x) { return x.toExponential(2).replace(/e([+-])(\d)$/, "e$10$2"); }
      function report(R) {
        var ground = R.V === 0, worstV = ground ? R.worst : R.V - R.worst, avgV = ground ? R.avg : R.V - R.avg;
        return [
          { k: "out", t: "  [INFO PSM-0071] Using all nodes on metal6 as sources." },
          { k: "out", t: "  ########## IR report #################" },
          { k: "out", t: "  Net              : " + R.net },
          { k: "out", t: "  Corner           : default" },
          { k: "out", t: "  Total power      : " + e(p.total) + " W" },
          { k: "out", t: "  Supply voltage   : " + e(R.V) + " V" },
          { k: "out", t: "  Worstcase voltage: " + e(worstV) + " V" },
          { k: "out", t: "  Average voltage  : " + e(avgV) + " V" },
          { k: "out", t: "  Average IR drop  : " + e(R.avg) + " V" },
          { k: "out", t: "  Worstcase IR drop: " + e(R.worst) + " V" },
          { k: "out", t: "  Percentage drop  : " + f2(100 * R.worst / ir.V) + " %" },
          { k: "out", t: "  ######################################" },
        ];
      }
      var log = [
        { k: "cmd", t: "report_power" },
        /* the same breakdown the timing example printed, with the new switching */
        { k: "out", t: "  Group          Internal  Switching    Leakage      Total" },
        { k: "out", t: "  Clock          " + f1(p.clock * 550).padStart(8) + f1(p.clock * 450).padStart(11) +
                       "     0.00" + f1(p.clock * 1000).padStart(11) },
        { k: "out", t: "  Combinational  " + f1(p.internal * 400).padStart(8) + f1(p.switching * 600).padStart(11) +
                       f1(p.leakage * 700).padStart(11) +
                       f1((p.internal * 0.4 + p.switching * 0.6 + p.leakage * 0.7) * 1000).padStart(11) },
        { k: "out", t: "  Sequential     " + f1(p.internal * 600).padStart(8) + f1(p.switching * 400).padStart(11) +
                       f1(p.leakage * 300).padStart(11) +
                       f1((p.internal * 0.6 + p.switching * 0.4 + p.leakage * 0.3) * 1000).padStart(11) },
        { k: "out", t: "  Total          " + f1(p.total * 1000).padStart(41) + " mW" },
        { k: "cmd", t: "set_pdnsim_net_voltage -net VDD -voltage 0.7" },
        { k: "cmd", t: "analyze_power_grid -net VDD -source_type FULL -error_file VDD.rpt" },
      ].concat(report(ir.vdd)).concat([
        { k: "cmd", t: "set_pdnsim_net_voltage -net VSS -voltage 0" },
        { k: "cmd", t: "analyze_power_grid -net VSS -source_type FULL -error_file VSS.rpt" },
      ]).concat(report(ir.vss)).concat([
        { k: "ok", t: "The worst drop is " + f1(ir.vdd.worst * 1000) + " millivolts, " + f2(100 * ir.vdd.worst / ir.V) +
                    "% of the supply, inside a " + Math.round(IR.budget * 100) + "% budget." },
      ]);
      var cutCount = ir.vdd.cut.length;
      return {
        log: log,
        figure: '<p class="ff3-figtext">The block with its VDD grid drawn over it: the metal5 stripes across, ' +
          "the metal4 stripes up, broken wherever they would cross a memory, and the ring around them all, " +
          "held at the supply on its two metal6 sides. " +
          "Each coloured square is the part of the core one crossing feeds, and it draws the current of the " +
          "cells in it, " + f1(ir.I * 1000) + " milliamps in all: the power above divided by the supply. " +
          "Press play and the grid is solved the way a network of resistors is: every node starts at the full " +
          "supply, then each is moved, pass after pass, to the voltage its neighbours and its own current say " +
          "it must have, until nothing moves. The drop settles worst in the middle, the farthest point from " +
          "the ring, and heaviest where the hub's cells are packed.</p>" + irFigure(M),
        after: function () { irAnimate(M); },
        report: "<h3>Power and voltage drop</h3>" + table([
          ["Power", f1(p.total * 1000) + " milliwatts, " + Math.round(100 * p.clock / p.total) + "% of it the clock; " +
            "the fill added about " + f2(1000 * (p.total - M.T.power.total)) + " milliwatts, through the switching it slowed"],
          ["Current", f1(ir.I * 1000) + " milliamps from a " + f1(ir.V) + " volt supply"],
          ["VDD drop", "worst " + f1(ir.vdd.worst * 1000) + " millivolts (" + f2(100 * ir.vdd.worst / ir.V) +
            "%), average " + f1(ir.vdd.avg * 1000)],
          ["VSS rise", "worst " + f1(ir.vss.worst * 1000) + " millivolts, average " + f1(ir.vss.avg * 1000) +
            ": ground carries the same current back"],
          ["The grid", ir.vdd.nodes + " crossings per net, " + cutCount + " metal4 segments cut where they would " +
            "cross a memory"],
        ]) + checks([
          ["The budget is a design choice.",
           "A common static budget is around " + Math.round(IR.budget * 100) + "% of the supply. What matters " +
           "is that the timing assumed it: the timing in step 3 used the library at the full " + f1(ir.V) +
           " volts, so every cell was assumed to see the whole supply. Production sign-off either uses a " +
           "library characterised at a voltage that already has the budget taken off, or re-times every cell " +
           "at the voltage this analysis found for it."],
          ["Both nets count.",
           "A cell sees the difference between its VDD and its VSS, so a " + f1(ir.vdd.worst * 1000) +
           " millivolt fall on one and a " + f1(ir.vss.worst * 1000) + " millivolt rise on the other can add " +
           "up, where the worst points of the two grids fall close together."],
          ["This is the static half.",
           "It uses the average current. When a whole region switches on the same clock edge the current " +
           "spikes, and the drop in that instant is larger; dynamic analysis, which simulates those spikes, " +
           "is a separate and much more expensive check."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "Stream out the real layout", button: "Write the layout", againLabel: "Write again",
    line: "Write the design out, then swap every abstract for its real cell and write one stream file.",
    intro:
      "<p>The database is written out as it now stands, fill and all. Then a layout tool takes over: " +
      "<a href=\"https://www.klayout.de/\">KLayout</a>, in the open flow. It reads the layout file, where " +
      "every cell is still a reference to an abstract, and throws each abstract away. In its place it " +
      "loads the real cell from the library's stream file, which holds every polygon of every cell the " +
      "library has, and does the same for the memories from the memory compiler's files. The result is " +
      "one stream file, <code>tile4m.gds</code>: the whole block, down to the last contact.</p>" +
      "<p>That swap is the moment the abstracts have to be honest. If a cell's abstract put a pin where " +
      "the real cell has none, or a cell in the design has no real layout at all, this is where it " +
      "shows.</p>",
    command:
      "# write the finished database out, fill included\n" +
      "write_def tile4m_final.def\n" +
      "write_verilog tile4m_final.v -remove_cells [find_physical_only_masters]\n" +
      "write_db tile4m_final.odb\n" +
      "\n" +
      "# then, outside OpenROAD: read that layout, drop every abstract, and merge in\n" +
      "# the real cells from the library's and the memories' stream files\n" +
      KLAYOUT_STREAM,
    commandNote:
      "Every <code>-rd</code> sets a variable the merge script reads, and it expects all of them: " +
      "<code>seal_file</code> is empty because a block has no seal ring (a chip gets one, a ring of metal " +
      "around its edge), and <code>layer_map</code> is empty because the technology file already says which " +
      "stream layer each process layer goes to. The script is the open flow's own " +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/util/def2stream.py">def2stream.py</a>.',
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "write_def tile4m_final.def" },
          { k: "cmd", t: "write_verilog tile4m_final.v -remove_cells [find_physical_only_masters]" },
          { k: "cmd", t: "write_db tile4m_final.odb" },
          { k: "cmd", t: KLAYOUT_STREAM },
          { k: "out", t: "  [INFO] Reporting cells prior to loading DEF ..." },
          { k: "out", t: "  \tstdcells.gds" },
          { k: "out", t: "  \tmem_wide.gds" },
          { k: "out", t: "  \tmem_square.gds" },
          { k: "out", t: "  [INFO] All LEF cells have matching GDS/OAS cells" },
          { k: "out", t: "  [INFO] No orphan cells in the final layout" },
          { k: "ok", t: "tile4m.gds is written: every cell is its real layout now." },
        ],
        figure: '<p class="ff3-figtext">Where this happens, first. On the left, the block from the earlier ' +
          "figures; the ring marks a spot in the busy middle of the core, far smaller than a pixel at this " +
          "scale. On the right, the real layout there after the merge: two rows of cells from the library, " +
          "the upper row flipped so the two share a power rail. From the left of the lower row: a tap cell, " +
          "an inverter, a NAND2, a NOR2, a filler, a buffer and another inverter; above them an AOI21, a " +
          "NAND2, two fillers, a NOR2 and a buffer.</p>" + depthPlanFigure(M) +
          '<p class="ff3-figtext">The same two rows turned 45 degrees and seen from above, with each layer ' +
          "built up from its real outline. Play it and the process stacks up in the order the wafer is made: " +
          "the wells in the silicon, diffusion at its surface, poly gates on top, contacts rising to metal1, " +
          "and above that the first via and the first routing layer. The two metal2 wires and their vias are " +
          "drawn for illustration, to show where the router's layers begin; every shape below them is the " +
          "library's own.</p>" + depthIsoFigure() +
          '<p class="ff3-figtext">One cell, <code>NAND2_X1</code>, both ways. On the left is its ' +
          "abstract, all that placement and routing ever saw: an outline and five pins on metal1. On the " +
          "right is what the merge puts in its place, read polygon by polygon from the cell library the " +
          'open flow ships for its 45 nanometer process (<a href="https://github.com/The-OpenROAD-Project/' +
          'OpenROAD-flow-scripts/tree/master/flow/platforms/nangate45">the Nangate Open Cell Library</a>, ' +
          "which this example's generic library is modelled on). Play it and the layers go down in the " +
          "order the wafer is built, each with its number in the stream.</p>" + cellFigure(),
        after: function () { depthAnimate(); cellAnimate(); },
        report: "<h3>What is in the stream file</h3>" + table([
          ["Top cell", "<code>tile4m</code>, holding every placed instance and all of the routing"],
          ["Standard cells", "each master stored once, and referenced by every instance of it: " +
            fmt(M.insts) + " instances, plus the fillers and taps"],
          ["The memories", "the compiler's own layouts for <code>mem_wide</code> and <code>mem_square</code>"],
          ["The fill", "kept as its own cell, <code>tile4m_DEF_FILL</code>, which is how the merge names it: " +
            fmt(M.fills) + " shapes"],
          ["Layers", "every one the process has, from the wells up to metal6: the abstracts only ever had " +
            "the metal layers"],
        ]) + checks([
          ["The two checks the merge makes are the important part.",
           "<em>All LEF (Library Exchange Format) cells have matching cells</em>: nothing in the design is " +
           "left as an empty box. " +
           "<em>No orphan cells</em>: nothing in the library files crept in that the design does not use. " +
           "The open flow does let named cells stay empty, for memories that were only ever modelled, and " +
           "says so in its log; this block has none."],
          ["The netlist leaves without the physical-only cells.",
           "<code>-remove_cells</code> drops the fillers, taps and diodes from the Verilog, because they " +
           "connect nothing logical. They stay in the layout, where they are needed."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Check every design rule", button: "Run the rule deck", againLabel: "Run again",
    line: "Run the process's full rule deck on the real polygons, inside the cells as well as between them.",
    intro: function () {
      var M = model();
      return "<p>The router obeyed design rules too, but only the ones about metal and vias, and only " +
        "the versions in its technology file. The <strong>rule deck</strong> is the process's own " +
        "statement of what can be manufactured: " + M.drc.total + " rules here, from how far apart two " +
        "wells must be to how dense each metal layer is, run on every polygon in the stream, including " +
        "every one inside every cell.</p>" +
        "<p>The deck here is the open flow's 45 nanometer KLayout deck, cut to this process's six metal " +
        "layers, with the density rules added that step 2 was filling for (the open deck has none; a " +
        "foundry's always does). The figure runs four of its rules on the cell from the last step, " +
        "because that is where the surprise is: the cell's designer drew right at the limits.</p>";
    },
    command:
      "# every rule in the process's deck, on the real polygons\n" +
      KLAYOUT_DRC + "\n" +
      "\n" +
      "# the open flow counts the violations the simple way\n" +
      'grep -c "<value>" tile4m_drc.lyrdb',
    commandNote:
      "The report is a KLayout marker database, one marker per violation, each with the rule it broke " +
      "and where. The open flow counts them by counting the <code>&lt;value&gt;</code> entries, which its " +
      "own makefile calls a hacky way of getting the count; it works because each marker has exactly one.",
    reference: function () {
      return "<h3>A few lines of the deck</h3>" +
        "<p>This is <code>process.lydrc</code>, the file the command above hands to KLayout with " +
        "<code>-r</code>. A deck is a script in KLayout's own language, built on Ruby: it reads layers " +
        "out of the stream file by their numbers, then runs one check per line and names what it " +
        "reports. The first four rules are verbatim from the open 45 nanometer deck, and they are the four the " +
        "figure measures. The last two are the density rules this process adds.</p>" +
        code([
          "source($in_gds)",
          'report("process DRC runset", $report_file)',
          "deep",
          "threads(4)",
          "",
          "poly   = polygons(" + GDS.poly + ", 0)",
          "cont   = polygons(" + GDS.contact + ", 0)",
          "metal1 = polygons(" + GDS.metal1 + ", 0)",
          "metal3 = polygons(" + GDS.metal3 + ", 0)",
          "",
          'poly.width(50.nm, euclidian).output("POLY.1", "POLY.1 : Minimum width of poly : 50nm")',
          'cont.width(65.nm).output("CONTACT.1", "CONTACT.1 : Minimum/Maximum width of contact : 65nm")',
          'metal1.width(65.nm, euclidian).output("METAL1.1", "METAL1.1 : Minimum width of metal1 : 65nm")',
          'metal1.space(65.nm, euclidian).output("METAL1.2", "METAL1.2 : Minimum spacing of metal1 : 65nm")',
          "",
          "# the density rules this process adds",
          'metal3.with_density(0.0, 0.2, tile_size(20.um)).output("METAL3.D1", "METAL3.D1 : Minimum density : 20%")',
          'metal3.with_density(0.8, 1.0, tile_size(20.um)).output("METAL3.D2", "METAL3.D2 : Maximum density : 80%")',
        ], "process.lydrc", "the design rule deck KLayout runs in this step, an excerpt");
    },
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: KLAYOUT_DRC },
          { k: "out", t: "  process DRC runset: " + M.drc.total + " rules, hierarchical, 4 threads" },
          { k: "out", t: "  report written to tile4m_drc.lyrdb" },
          { k: "cmd", t: 'grep -c "<value>" tile4m_drc.lyrdb' },
          { k: "out", t: "  0" },
          { k: "ok", t: "No design rule is broken: 0 violations of " + M.drc.total + " rules." },
        ],
        figure: '<p class="ff3-figtext">Four rules, measured on <code>NAND2_X1</code>. The gate is exactly ' +
          "as narrow as the process allows. The contact must be exactly one size. The gap between the A2 " +
          "pin and the output is exactly the minimum spacing, and the ground rail's tab is five nanometers " +
          "over the minimum width. That is normal: a cell is drawn as small as the rules allow, because " +
          "every cell in the design is paid for in area. It is also why the router's simplified rules " +
          "could never stand in for this check.</p>" + drcFigure() +
          '<p class="ff3-figtext">And what failing looks like. This block passes, so its report is empty; ' +
          "these four panels show what the deck would flag instead, each violation marked the way a rule " +
          "checker marks it, with the region that breaks the rule hatched in red. The first three are the " +
          "same real cell with one shape moved or narrowed on purpose, so that exactly one rule breaks: a pin " +
          "20 nanometers too close to the output, a gate 10 nanometers too narrow, and a diffusion edge 3 " +
          "nanometers too close to its contact. Each is invisible at any normal zoom, and each would be a chip that " +
          "does not work. The fourth is not edited at all: it is the window from step 2 as it stood before " +
          "fill, and it is what the deck reports on every one of the " + M.failBefore + " metal3 windows if " +
          "fill is skipped.</p>" + drcFailFigure(M),
        after: function () { drcAnimate(); },
        report: "<h3>The deck, by group</h3>" + table([["Group", "Rules, and what they cover"]].concat(
          M.drc.groups.map(function (g) { return [g.k, g.n + ": " + g.what]; }))) + checks([
          ["The router's rules are a subset of these.",
           "The router checked metal and via spacing as its technology file describes them. The deck " +
           "also checks the wells, diffusion, poly and contacts inside every cell, the wide-metal rules " +
           "that depend on a wire's width and length together, and density. Most of those the router " +
           "never saw."],
          ["Zero here is earned upstream.",
           "The cells were already clean when the library was made, the memories when they were " +
           "compiled, the routing when its own violations reached zero, the antennas when the routing " +
           "example repaired them, and the density when step 2 filled it. This check finds nothing because " +
           "every stage did its part, and it would find the one that did not."],
          ["A foundry's deck is much bigger.",
           "Thousands of rules rather than about a hundred, run in a commercial checker, with rules this " +
           "one has no concept of: patterns that print badly, layers split across two masks, and " +
           "recommended rules that are not required but improve yield."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Compare the layout to the netlist", button: "Run the comparison", againLabel: "Compare again",
    line: "Extract a circuit from the polygons and prove it is the same circuit synthesis wrote.",
    intro:
      "<p>Design rule checking cannot see a wrong connection. Two wires that touch where they should not " +
      "are, geometrically, just one legal shape. So the last check reads the layout the other way: it " +
      "<strong>extracts a circuit from the polygons</strong>, recognising a transistor wherever poly " +
      "crosses diffusion and following the metal and contacts to see what connects to what, and then " +
      "compares that circuit with the netlist, transistor by transistor and net by net.</p>" +
      "<p>The netlist side has to be at the same level, so it is written as a CDL (Circuit Description " +
      "Language) file: the design's instances, plus every library cell's own transistors from the " +
      "library's CDL (Circuit Description Language) file. The memories are compared as boxes, by their " +
      "pins: their insides were verified by the compiler that made them.</p>",
    command:
      "# in OpenROAD: the design's netlist, in the form this check reads\n" +
      "write_cdl -masters stdcells.cdl tile4m.cdl\n" +
      "\n" +
      "# the design plus every cell's own transistors, in one file\n" +
      "cat tile4m.cdl stdcells.cdl mem_wide.cdl mem_square.cdl > tile4m_lvs.cdl\n" +
      "\n" +
      "# extract a circuit from the polygons, and compare the two\n" +
      KLAYOUT_LVS,
    commandNote:
      "This is the open flow's own sequence: its <code>cdl.tcl</code> writes the design with " +
      "<code>write_cdl</code>, its makefile concatenates the cell library's netlist on, and KLayout runs " +
      "the process's comparison deck. <code>-b</code> runs KLayout in batch mode, with no window.",
    reference: function () {
      return "<h3>How the deck finds a transistor</h3>" +
        "<p>This is <code>process.lylvs</code>, the file the command above hands to KLayout with " +
        "<code>-r</code>: the layout versus schematic deck. Like the rule deck in step 6, it is a script " +
        "in KLayout's own language, built on Ruby. Read from the top, it opens the stream file and the " +
        "netlist, names each layer by its number in the stream, works out where the transistors are (a " +
        "gate is poly over diffusion of one type, and the diffusion either side is its source and drain), " +
        "says which layers touch which, and then compares the circuit it built with the netlist. It is cut " +
        "down for reading: every command in it is one KLayout has, but a full deck also carries every " +
        "layer up to metal6 and the checks on the wells.</p>" +
        code([
          "source($in_gds)",
          "schematic($cdl_file)",
          "deep",
          "",
          "nwell = input(" + GDS.nwell + ", 0)",
          "pwell = input(" + GDS.pwell + ", 0)",
          "active = input(" + GDS.active + ", 0)",
          "pimp = input(" + GDS.pimplant + ", 0)",
          "nimp = input(" + GDS.nimplant + ", 0)",
          "poly = input(" + GDS.poly + ", 0)",
          "contact = input(" + GDS.contact + ", 0)",
          "metal1 = input(" + GDS.metal1 + ", 0)",
          "",
          "# a gate is poly over diffusion; the diffusion either side is source and drain",
          "pgate = active & pimp & poly",
          "ngate = active & nimp & poly",
          "psd = (active & pimp) - pgate",
          "nsd = (active & nimp) - ngate",
          'extract_devices(mos4("PMOS_VTL"), { "SD" => psd, "G" => pgate, "tG" => poly, "W" => nwell })',
          'extract_devices(mos4("NMOS_VTL"), { "SD" => nsd, "G" => ngate, "tG" => poly, "W" => pwell })',
          "",
          "# what touches what",
          "connect(psd, contact)",
          "connect(nsd, contact)",
          "connect(poly, contact)",
          "connect(contact, metal1)",
          "# ... and so on up the stack, metal1 to via1 to metal2",
          "",
          "# the memories are compared by their pins only",
          'blank_circuit("mem_*")',
          "compare",
        ], "process.lylvs", "the layout versus schematic deck KLayout runs in this step, an excerpt");
    },
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "write_cdl -masters stdcells.cdl tile4m.cdl" },
          { k: "cmd", t: "cat tile4m.cdl stdcells.cdl mem_wide.cdl mem_square.cdl > tile4m_lvs.cdl" },
          { k: "cmd", t: KLAYOUT_LVS },
          { k: "out", t: "  extracting devices: " + fmt(M.devices) + " transistors" },
          { k: "out", t: "  comparing tile4m: " + fmt(M.insts) + " instances, " + fmt(M.nets) + " nets, " +
                         M.z.fg.portBits + " pins" },
          { k: "out", t: "  mem_wide, mem_square: compared by pins" },
          { k: "out", t: "  netlists match" },
          { k: "ok", t: "The layout and the netlist are the same circuit." },
        ],
        figure: '<p class="ff3-figtext">The comparison, on the same cell. Each highlighted rectangle is a ' +
          "transistor the deck found: poly crossing diffusion. Its width is the diffusion's height " +
          "there, its length the poly's width, and its two ends are whatever the diffusion either side " +
          "is wired to. Play it and the deck builds the circuit as it goes: each transistor it finds is " +
          "drawn into a schematic, wired to the nets its ends touch, until the schematic is a whole NAND " +
          "gate, the two p-type transistors side by side under the supply and the two n-type stacked above " +
          "ground. Each is placed by what was found, never by a name, and then matched against a line of " +
          "the cell's netlist, shown underneath exactly as the library ships it. The sizes are measured from " +
          "the polygons, and they agree to the nanometer.</p>" + lvsFigure(),
        after: function () { lvsAnimate(); },
        report: "<h3>What was compared</h3>" + table([
          ["Transistors", fmt(M.devices) + ", each matched by type, width, length, and the nets on its " +
            "three terminals"],
          ["Instances and nets", fmt(M.insts) + " instances and " + fmt(M.nets) + " nets at the top " +
            "level, every one accounted for"],
          ["Pins", M.z.fg.portBits + " signal pins, with the names the netlist gives them"],
          ["The memories", "compared by their pins, as black boxes"],
        ]) + checks([
          ["This is the check that catches a short.",
           "Two nets merged by a sliver of metal, a missing via that splits a net in two, a pin wired to " +
           "the wrong input: each is a legal shape and a wrong circuit. Only a comparison against the " +
           "netlist can see them."],
          ["It also closes the loop to synthesis.",
           "The netlist this compared against is the one synthesis wrote, carried through every stage. A " +
           "match means nothing in floorplanning, placement, the clock tree, routing, or fill changed what " +
           "the circuit does, and that is the promise the whole flow makes."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 8, title: "Tape out", button: "Tape out", againLabel: "Again",
    line: "Hand over one file, with the evidence that it is right.",
    intro:
      "<p>Taping out used to mean exactly that: writing the design to magnetic tape and sending it to " +
      "the mask shop. The medium changed and the name did not. What leaves is the stream file, with a " +
      "checksum so that the other end can prove the file that arrived is the file that was sent, and " +
      "the reports that show the checks passed.</p>" +
      "<p>From here the foundry takes over: it prepares the mask data, corrects the shapes for how " +
      "light actually prints at this scale, makes the masks, and runs the wafers. None of that changes " +
      "the design, and none of it is in an open flow.</p>",
    command:
      "# a checksum travels with the file, so the foundry can prove it arrived intact\n" +
      "md5sum tile4m.gds > tile4m.gds.md5",
    commandNote:
      "<code>md5sum</code> computes the file's MD5 (Message Digest 5) fingerprint. It is not a security " +
      "measure here, just a way to be certain that megabytes of layout were not changed on the way.",
    run: function () {
      var M = model(), a = areaLine(M);
      var sum = digest("tile4m" + M.insts + M.nets + M.fills + M.slack);
      return {
        log: [
          { k: "cmd", t: "md5sum tile4m.gds > tile4m.gds.md5" },
          { k: "out", t: "  " + sum + "  tile4m.gds" },
          { k: "ok", t: "Taped out. tile4m.gds is the chip." },
        ],
        figure: '<p class="ff3-figtext">The whole run, one number from each stage, each handed to the ' +
          "next. Every box links back to its example.</p>" + chainFigure(M),
        report: "<h3>What leaves</h3>" + table([
          ["<code>tile4m.gds</code>", "the layout: every polygon of every cell, the routing, and the fill"],
          ["<code>tile4m.gds.md5</code>", "its checksum, <code>" + sum + "</code>"],
          ["<code>tile4m_drc.lyrdb</code>", "the rule check: 0 violations of " + M.drc.total + " rules"],
          ["<code>tile4m.lvsdb</code>", "the comparison: the layout is the netlist"],
          ["Timing", "setup met by " + M.slack + " picoseconds and hold by " + M.holdSlack +
            ", extracted with the fill in place"],
          ["Area", fmt(Math.round(a.area)) + " square micrometers of cells in a " + f1(M.z.dieW) + " by " +
            f1(M.z.dieH) + " micrometer die"],
        ]) + checks([
          ["This was one block.",
           "A real chip is many blocks like this one, placed into a top level with its own floorplan, " +
           "power grid and routing, a ring of input and output cells, and a seal ring, then filled, " +
           "checked and compared again as a whole. Everything here happens again, one level up."],
          ["The flow is complete.",
           'This block started as Verilog in the <a href="/explore/examples/synthesis">synthesis example</a>. ' +
           "It is now a file a foundry can build from."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "finish",
    steps: STEPS,
    finishedTitle: "Taped out.",
    finishedNote: "The block is a layout that meets its clock, obeys every rule, and is the circuit " +
      "synthesis wrote. Every stage of the flow has been walked: " +
      '<a href="/explore/examples/synthesis">synthesis</a>, ' +
      '<a href="/explore/examples/floorplan">floorplan</a>, ' +
      '<a href="/explore/examples/placement">placement</a>, ' +
      '<a href="/explore/examples/cts">clock tree</a>, ' +
      '<a href="/explore/examples/routing">routing</a>, ' +
      '<a href="/explore/examples/timing">timing</a>, and finishing.',
    epilogue:
      "<h3>How this differs from a production tapeout</h3>" +
      "<p>The sequence is the real one: fill, re-time, stream, check the rules, compare to the netlist. " +
      "What production adds is scale and paranoia:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>The foundry's own decks.</strong> Rule checking and comparison run with the foundry's " +
      "decks in a commercial checker, and a tapeout is only accepted with those results attached. The " +
      "open decks used here are a teaching subset of the same idea.</li>" +
      "<li><strong>More checks than two.</strong> Electrical rule checks (a gate left floating, a well " +
      "with no tie), antenna rules re-run on the final layout, and checks for patterns that print badly " +
      "even though they obey every rule.</li>" +
      "<li><strong>Fill done by the rules, often by the foundry.</strong> Fill is frequently inserted with " +
      "the foundry's own fill deck, sometimes at the foundry, with timing-aware keepouts around critical " +
      "nets, and then extracted and re-timed exactly as step 3 did.</li>" +
      "<li><strong>Waivers.</strong> A real run rarely ends at zero. It ends with a list of violations, " +
      "each either fixed or formally waived with a reason the foundry agrees to, and that negotiation is " +
      "often the last week of a schedule.</li></ul>",
    footNote: 'The block arrived from the <a href="/explore/examples/timing">timing example</a>, and this ' +
      'is the last stage. Back to <a href="/sandboxes">the whole walkthrough</a>.',
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, STEPS: STEPS, NAND2: NAND2, GDS: GDS, cellMarkup: cellMarkup,
           CELL_BOX: CELL_BOX };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FinishSteps;
