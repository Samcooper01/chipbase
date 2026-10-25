# Clock tree recipe.
# TODO: a small buffer driving 32 loads per stage is far too sloppy  - 
# watch the skew and insertion delay when you run this.

set clock_buffer BUF_X2
set max_fanout   32
