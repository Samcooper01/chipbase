## The task

Before trusting any tool, you should be able to time a path with a
pencil. Compute the **setup slack** of this register-to-register path.
All numbers are in **picoseconds**.

| Quantity | Value |
| --- | --- |
| Clock period | 1000 |
| Clock network delay to the **launch** flop | 150 |
| Launch flop clock-to-q delay | 120 |
| Combinational logic delay between the flops | 610 |
| Clock network delay to the **capture** flop | 180 |
| Capture flop setup requirement | 55 |
| Clock uncertainty (setup margin) | 40 |

## How STA (Static Timing Analysis) sees this path

Data leaves the launch flop on one clock edge and must arrive at the
capture flop before the *next* edge, early enough to satisfy the setup
requirement.

**Arrival time** - when the data actually shows up at the capture flop's
data pin, measured from the launching edge at the clock source:

> arrival = launch clock network delay + clock-to-q + combinational delay

**Required time** - the latest the data is allowed to arrive:

> required = clock period + capture clock network delay
> − setup requirement − clock uncertainty

Note the capture clock network delay is *added* to the required time: the
capturing edge also travels through the clock tree, so it arrives at the
flop late - buying the data path extra time. The difference between the
two clock network delays (180 − 150 = 30 here) is the **clock skew**, and
in this direction it *helps* setup.

**Slack:**

> slack = required − arrival

Positive slack: the path meets timing with room to spare. Negative:
you have a violation and a bad day.

> **Hint:** if your answer is off by exactly the skew, the uncertainty, or
> twice one of them, you put a term on the wrong side.
