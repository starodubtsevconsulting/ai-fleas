#!/usr/bin/env python3
"""Run the Hermes installer with a bounded timeout and forwarded signals."""

from __future__ import annotations

import signal
import subprocess
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: run-hermes-installer.py TIMEOUT COMMAND [ARG ...]", file=sys.stderr)
        return 2
    try:
        timeout = int(sys.argv[1])
    except ValueError:
        print("Installer timeout must be an integer.", file=sys.stderr)
        return 2
    if timeout <= 0:
        print("Installer timeout must be positive.", file=sys.stderr)
        return 2

    process = subprocess.Popen(sys.argv[2:], start_new_session=True)

    def forward(signum: int, _frame: object) -> None:
        try:
            process.send_signal(signum)
        except ProcessLookupError:
            pass

    signal.signal(signal.SIGINT, forward)
    signal.signal(signal.SIGTERM, forward)
    try:
        return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        print(f"Hermes installer exceeded {timeout} seconds.", file=sys.stderr)
        return 124


if __name__ == "__main__":
    raise SystemExit(main())
