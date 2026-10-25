#!/bin/bash
# Editing run.sh while containers were executing it made two of them read the
# wrong byte offset and start a run belonging to another group. This stops each
# container the moment its own list is finished, so a stray cannot start.
declare -A WANT=( [wi_sky]=3 [wi_ibexclk]=3 [wi_ibexres]=3 [wi_rocket]=2 [wi_jpeg]=1 [wi_t1]=4 [wi_t2]=3 [wi_t3]=3 )
while :; do
  left=0
  for c in "${!WANT[@]}"; do
    state=$(docker inspect -f '{{.State.Status}}' $c 2>/dev/null) || continue
    [ "$state" != "running" ] && continue
    left=$((left+1))
    n=$(docker logs $c 2>&1 | grep -c 'rc=')
    if [ "$n" -ge "${WANT[$c]}" ]; then
      echo "$(date +%H:%M:%S) $c finished its ${WANT[$c]} runs, stopping it"
      docker kill $c > /dev/null 2>&1
    fi
  done
  [ "$left" -eq 0 ] && break
  sleep 30
done
echo "ALL GROUPS FINISHED"
