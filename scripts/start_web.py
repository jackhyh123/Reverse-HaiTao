#!/usr/bin/env python
"""DeepTutor Web Launcher — starts backend + frontend from the active .env."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import threading
import time

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _load_runtime_deps():
    from _cli_kit import accent, banner, bold, dim, log_error, log_info, log_success, warn

    from deeptutor.services.config import get_env_store

    return accent, banner, bold, dim, log_error, log_info, log_success, warn, get_env_store


accent, banner, bold, dim, log_error, log_info, log_success, warn, get_env_store = (
    _load_runtime_deps()
)


# ---------------------------------------------------------------------------
# Process management (unchanged logic)
# ---------------------------------------------------------------------------


def _stream_output(prefix: str, process: subprocess.Popen[str]) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        print(f"  {dim(prefix)}  {line.rstrip()}", flush=True)


def _terminate(process: subprocess.Popen[str] | None, name: str) -> None:
    if process is None or process.poll() is not None:
        return
    log_info(f"Stopping {name} (PID {process.pid})")
    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
            try:
                process.wait(timeout=5)
                return
            except subprocess.TimeoutExpired:
                process.kill()
        else:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            try:
                process.wait(timeout=5)
                return
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
    except Exception:
        process.kill()


def _free_port(port: int) -> None:
    """Terminate stale local processes that keep the dev ports busy."""

    try:
        result = subprocess.run(
            ["lsof", "-ti", f"tcp:{port}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return

    pids = [int(pid) for pid in result.stdout.split() if pid.strip().isdigit()]
    if not pids:
        return

    log_info(f"Port {port} is busy; stopping stale process(es) ...")
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(0.8)

    for pid in pids:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _spawn(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    name: str,
) -> subprocess.Popen[str]:
    kwargs: dict[str, object] = {
        "cwd": str(cwd),
        "env": env,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "bufsize": 1,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    else:
        kwargs["start_new_session"] = True

    process = subprocess.Popen(command, **kwargs)  # type: ignore[arg-type]
    thread = threading.Thread(target=_stream_output, args=(name, process), daemon=True)
    thread.start()
    return process


def _find_backend_python() -> str:
    """Prefer a Python runtime that can actually run the FastAPI backend."""

    candidates = [
        os.environ.get("DEEPTUTOR_PYTHON", ""),
        sys.executable,
        str(PROJECT_ROOT / ".venv" / "bin" / "python"),
        str(PROJECT_ROOT / "venv" / "bin" / "python"),
        str(Path.home() / "miniconda3" / "bin" / "python"),
        str(Path.home() / "anaconda3" / "bin" / "python"),
        shutil.which("python3") or "",
        shutil.which("python") or "",
    ]

    seen: set[str] = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        path = Path(candidate)
        if not path.exists():
            continue
        probe = subprocess.run(
            [candidate, "-c", "import uvicorn, fastapi"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        if probe.returncode == 0:
            return candidate

    log_error("No Python runtime with uvicorn and fastapi was found.")
    log_info("Install backend dependencies or set DEEPTUTOR_PYTHON to the right Python path.")
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    summary = get_env_store().as_summary()
    backend_port = summary.backend_port
    frontend_port = summary.frontend_port

    npm = shutil.which("npm")
    if not npm:
        log_error("npm not found. Run `python scripts/start_tour.py` first.")
        raise SystemExit(1)

    # Banner
    banner(
        "DeepTutor",
        [
            f"Backend   http://localhost:{backend_port}",
            f"Frontend  http://localhost:{frontend_port}",
        ],
    )

    api_base = (
        os.environ.get("NEXT_PUBLIC_API_BASE_EXTERNAL")
        or os.environ.get("NEXT_PUBLIC_API_BASE")
        or f"http://localhost:{backend_port}"
    )

    _free_port(backend_port)
    _free_port(frontend_port)

    # Write web/.env.local so the frontend picks up the correct backend port
    # even when started independently (e.g. `npm run dev` without this launcher).
    env_local_path = PROJECT_ROOT / "web" / ".env.local"
    env_local_path.write_text(
        f"# Auto-generated by start_web.py — do not edit manually\n"
        f"NEXT_PUBLIC_API_BASE={api_base}\n"
    )

    backend_env = os.environ.copy()
    backend_env["PYTHONUNBUFFERED"] = "1"

    frontend_env = os.environ.copy()
    frontend_env["NEXT_PUBLIC_API_BASE"] = api_base

    # Next dev cache can occasionally keep a stale Turbopack process in a
    # half-ready state after forced restarts. Clearing only the dev cache keeps
    # the launcher friendly for non-technical use without touching dependencies.
    shutil.rmtree(PROJECT_ROOT / "web" / ".next" / "dev", ignore_errors=True)

    backend_python = _find_backend_python()
    backend_cmd = [backend_python, "-m", "deeptutor.api.run_server"]
    frontend_cmd = [npm, "run", "dev", "--", "--port", str(frontend_port)]

    log_info("Starting backend ...")
    backend = _spawn(backend_cmd, cwd=PROJECT_ROOT, env=backend_env, name="backend")
    time.sleep(1.5)

    log_info("Starting frontend ...")
    frontend = _spawn(frontend_cmd, cwd=PROJECT_ROOT / "web", env=frontend_env, name="frontend")

    log_success(f"Open {bold(f'http://localhost:{frontend_port}')} in your browser.")
    print()

    try:
        while True:
            if backend.poll() is not None:
                log_error(f"Backend exited with code {backend.returncode}")
                raise SystemExit(1)
            if frontend.poll() is not None:
                log_error(f"Frontend exited with code {frontend.returncode}")
                raise SystemExit(1)
            time.sleep(1)
    except KeyboardInterrupt:
        print()
        log_info("Shutting down ...")
    finally:
        _terminate(frontend, "frontend")
        _terminate(backend, "backend")


if __name__ == "__main__":
    main()
