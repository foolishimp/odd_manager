#!/usr/bin/env python3
"""Host-side PTY bridge for gterm.

This service owns one PTY-backed interactive shell for one workspace and speaks
newline-delimited JSON over stdin/stdout so the Node API server can broker it
to the browser.
"""

from __future__ import annotations

import argparse
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import fcntl
import threading
from typing import Any


def emit(payload: dict[str, Any], lock: threading.Lock) -> None:
    with lock:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()


def set_winsize(fd: int, cols: int, rows: int) -> None:
    if cols <= 0 or rows <= 0:
        return
    packed = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, packed)


def resolve_shell() -> tuple[str, list[str], str]:
    if os.path.exists("/bin/zsh"):
        return ("/bin/zsh", ["/bin/zsh", "-f", "-i"], "/bin/zsh -f -i")
    return ("/bin/bash", ["/bin/bash", "--noprofile", "--norc", "-i"], "/bin/bash --noprofile --norc -i")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-root", required=True)
    parser.add_argument("--cols", type=int, default=120)
    parser.add_argument("--rows", type=int, default=34)
    args = parser.parse_args()

    workspace_root = os.path.abspath(args.workspace_root)
    write_lock = threading.Lock()
    closed = threading.Event()
    shell_path, shell_argv, shell_label = resolve_shell()

    pid, master_fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(workspace_root)
            os.environ.pop("NO_COLOR", None)
            os.environ["TERM"] = os.environ.get("TERM", "xterm-256color")
            os.environ["COLORTERM"] = os.environ.get("COLORTERM", "truecolor")
            os.environ["CLICOLOR"] = "1"
            os.environ["CLICOLOR_FORCE"] = os.environ.get("CLICOLOR_FORCE", "1")
            os.environ["FORCE_COLOR"] = os.environ.get("FORCE_COLOR", "1")
            os.environ["HISTFILE"] = os.environ.get("HISTFILE", "/tmp/gterm_zsh_history")
            os.environ["PYENV_DISABLE_REHASH"] = "1"
            os.execv(shell_path, shell_argv)
        except Exception as caught:  # pragma: no cover - child process fatal path
            sys.stderr.write(f"gterm child exec failed: {caught}\n")
            sys.stderr.flush()
            os._exit(1)

    set_winsize(master_fd, args.cols, args.rows)
    emit(
        {
            "type": "ready",
            "workspaceRoot": workspace_root,
            "shell": shell_label,
            "pid": pid,
            "backend": "python-pty-service",
        },
        write_lock,
    )

    def reader() -> None:
        while not closed.is_set():
            try:
                ready, _, _ = select.select([master_fd], [], [], 0.2)
            except (OSError, ValueError):
                break
            if master_fd not in ready:
                continue
            try:
                data = os.read(master_fd, 4096)
            except OSError:
                break
            if not data:
                break
            emit({"type": "data", "data": data.decode("utf-8", "ignore")}, write_lock)

    def waiter() -> None:
        try:
            _, status = os.waitpid(pid, 0)
        except ChildProcessError:
            return
        exit_code = os.waitstatus_to_exitcode(status)
        signal_number = os.WTERMSIG(status) if os.WIFSIGNALED(status) else None
        emit({"type": "exit", "exitCode": exit_code, "signal": signal_number}, write_lock)
        closed.set()

    reader_thread = threading.Thread(target=reader, daemon=True)
    waiter_thread = threading.Thread(target=waiter, daemon=True)
    reader_thread.start()
    waiter_thread.start()

    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue

            command_type = payload.get("type")
            if command_type == "input":
                data = payload.get("data", "")
                if isinstance(data, str):
                    try:
                        os.write(master_fd, data.encode("utf-8"))
                    except OSError:
                        closed.set()
                        break
                continue

            if command_type == "resize":
                cols = int(payload.get("cols") or 0)
                rows = int(payload.get("rows") or 0)
                try:
                    set_winsize(master_fd, cols, rows)
                    os.kill(pid, signal.SIGWINCH)
                except OSError:
                    pass
                continue

            if command_type == "close":
                closed.set()
                break
    finally:
        closed.set()
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
