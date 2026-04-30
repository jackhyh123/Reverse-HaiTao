#!/bin/zsh

set -e

cd "/Users/heyihui/Documents/Playground/DeepTutor"

if [ -f "$HOME/.zprofile" ]; then
  source "$HOME/.zprofile"
fi

if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc"
fi

PYTHON_BIN=""
for candidate in "$HOME/miniconda3/bin/python3" "$(command -v python3)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    if "$candidate" -c "import uvicorn, fastapi" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  echo "没有找到可用的 Python 运行环境。"
  echo "需要这套环境里包含 uvicorn 和 fastapi。"
  echo ""
  read -k 1 "?按任意键退出..."
  exit 1
fi

for port in 8001 3782; do
  PIDS=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "检测到 $port 端口已被占用，正在清理旧进程..."
    for pid in $PIDS; do
      PGID=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
      if [ -n "$PGID" ]; then
        kill -TERM "-$PGID" >/dev/null 2>&1 || true
      fi
      kill "$pid" >/dev/null 2>&1 || true
    done
    sleep 1
    REMAINING=$(lsof -ti tcp:$port 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
      for pid in $REMAINING; do
        PGID=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
        if [ -n "$PGID" ]; then
          kill -KILL "-$PGID" >/dev/null 2>&1 || true
        fi
        kill -9 "$pid" >/dev/null 2>&1 || true
      done
      sleep 1
    fi
  fi
done

echo "正在清理前端临时缓存..."
rm -rf "web/.next/dev" >/dev/null 2>&1 || true

echo "正在启动 反淘淘金通关系统..."
echo "前端和后端会一起打开。"
echo ""

"$PYTHON_BIN" scripts/start_web.py
