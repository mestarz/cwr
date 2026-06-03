#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

BACKEND_HOST="127.0.0.1"
BACKEND_PORT="4174"
BACKEND_PID_FILE="$RUNTIME_DIR/emma-backend.pid"
BACKEND_LOG_FILE="$RUNTIME_DIR/emma-backend.log"

FRONTEND_HOST="0.0.0.0"
FRONTEND_PUBLIC_HOST="127.0.0.1"
FRONTEND_PORT="5173"
FRONTEND_PID_FILE="$RUNTIME_DIR/emma-frontend.pid"
FRONTEND_LOG_FILE="$RUNTIME_DIR/emma-frontend.log"

usage() {
  printf 'Usage: %s [-R|-S]\n' "$0"
  printf '  no args  Start app\n'
  printf '  -R       Restart app\n'
  printf '  -S       Stop app\n'
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
  local file="$1"
  if [[ -f "$file" ]]; then
    tr -d '[:space:]' < "$file"
  fi
}

wait_for_exit() {
  local pid="$1"

  for _ in {1..30}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return
    fi
    sleep 0.2
  done

  printf 'Process %s did not exit after stop signal.\n' "$pid" >&2
}

stop_pid_file() {
  local label="$1"
  local pid_file="$2"
  local pid

  pid="$(read_pid "$pid_file" || true)"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    kill "$pid"
    wait_for_exit "$pid"
    printf '%s stopped.\n' "$label"
  else
    printf '%s is not running.\n' "$label"
  fi

  rm -f "$pid_file"
}

stop_port_processes() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi

  local port_pids
  port_pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null || true)"

  for port_pid in $port_pids; do
    if is_running "$port_pid"; then
      kill "$port_pid"
      wait_for_exit "$port_pid"
    fi
  done
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local label="$3"
  local log_file="$4"

  for _ in {1..50}; do
    if node -e "const net=require('node:net'); const socket=net.createConnection({host: process.argv[1], port: Number(process.argv[2])}, () => { socket.end(); process.exit(0); }); socket.on('error', () => process.exit(1)); socket.setTimeout(500, () => process.exit(1));" "$host" "$port"; then
      return
    fi
    sleep 0.2
  done

  printf '%s failed to become ready. Log:\n' "$label" >&2
  cat "$log_file" >&2
  exit 1
}

start_backend() {
  local pid
  pid="$(read_pid "$BACKEND_PID_FILE" || true)"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    printf 'Emma backend is already running: http://%s:%s (pid %s)\n' "$BACKEND_HOST" "$BACKEND_PORT" "$pid"
    return
  fi

  stop_port_processes "$BACKEND_PORT"

  cd "$ROOT_DIR"
  npm run server:build

  if command -v setsid >/dev/null 2>&1; then
    setsid node dist-server/server/index.js > "$BACKEND_LOG_FILE" 2>&1 < /dev/null &
  else
    nohup node dist-server/server/index.js > "$BACKEND_LOG_FILE" 2>&1 < /dev/null &
  fi
  pid="$!"
  printf '%s\n' "$pid" > "$BACKEND_PID_FILE"

  wait_for_port "$BACKEND_HOST" "$BACKEND_PORT" "Emma backend" "$BACKEND_LOG_FILE"
  printf 'Emma backend started: http://%s:%s (pid %s)\n' "$BACKEND_HOST" "$BACKEND_PORT" "$pid"
}

start_frontend() {
  local pid
  pid="$(read_pid "$FRONTEND_PID_FILE" || true)"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    printf 'Emma frontend is already running: http://%s:%s (pid %s)\n' "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT" "$pid"
    return
  fi

  stop_port_processes "$FRONTEND_PORT"

  cd "$ROOT_DIR"
  if command -v setsid >/dev/null 2>&1; then
    setsid npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" > "$FRONTEND_LOG_FILE" 2>&1 < /dev/null &
  else
    nohup npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" > "$FRONTEND_LOG_FILE" 2>&1 < /dev/null &
  fi
  pid="$!"
  printf '%s\n' "$pid" > "$FRONTEND_PID_FILE"

  wait_for_port "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT" "Emma frontend" "$FRONTEND_LOG_FILE"
  printf 'Emma frontend started: http://%s:%s (pid %s)\n' "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT" "$pid"
}

start_app() {
  mkdir -p "$RUNTIME_DIR"
  start_backend
  start_frontend
  printf 'Open Emma Editor: http://%s:%s\n' "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT"
}

stop_app() {
  stop_pid_file "Emma frontend" "$FRONTEND_PID_FILE"
  stop_pid_file "Emma backend" "$BACKEND_PID_FILE"
  stop_port_processes "$FRONTEND_PORT"
  stop_port_processes "$BACKEND_PORT"
}

case "${1:-}" in
  "")
    start_app
    ;;
  "-R")
    stop_app
    start_app
    ;;
  "-S")
    stop_app
    ;;
  "-h" | "--help")
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
