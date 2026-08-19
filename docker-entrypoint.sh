#!/bin/sh
set -eu

heap_mb() {
  max=""
  if [ -r /sys/fs/cgroup/memory.max ]; then
    max=$(cat /sys/fs/cgroup/memory.max)
  elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    max=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
  fi
  if [ -n "${max}" ] && [ "${max}" != "max" ]; then
    mb=$((max / 1024 / 1024))
    if [ "${mb}" -gt 64 ] && [ "${mb}" -lt 65536 ]; then
      heap=$((mb * 78 / 100))
      if [ "${heap}" -lt 192 ]; then heap=192; fi
      if [ "${heap}" -gt 896 ]; then heap=896; fi
      echo "${heap}"
      return
    fi
  fi
  echo "${WORKER_HEAP_MB:-256}"
}

HEAP=$(heap_mb)
export NODE_OPTIONS="--max-old-space-size=${HEAP} ${NODE_OPTIONS:-}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-4}"
export WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-1}"
export SHARP_CONCURRENCY="${SHARP_CONCURRENCY:-2}"
export FRAME_ZIP_PARALLEL="${FRAME_ZIP_PARALLEL:-3}"
export PG_POOL_MAX="${PG_POOL_MAX:-2}"

echo "media-worker heap=${HEAP}mb concurrency=${WORKER_CONCURRENCY} sharp=${SHARP_CONCURRENCY} pg=${PG_POOL_MAX}"
exec node dist/main.js
