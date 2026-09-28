#!/usr/bin/env python3
"""Run the Hermes installer with a bounded timeout and forwarded signals."""

from __future__ import annotations

import os
import signal
import subprocess
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: run-installer-with-timeout.py TIMEOUT COMMAND [ARG ...]", file=sys.stderr)
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
    pgid = process.pid

    def cleanup(signum: int) -> None:
        try:
            os.killpg(pgid, signum)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(pgid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.wait()
        except ProcessLookupError:
            pass

    def forward(signum: int, _frame: object) -> None:
        cleanup(signum)

    signal.signal(signal.SIGINT, forward)
    signal.signal(signal.SIGTERM, forward)
    try:
        return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        cleanup(signal.SIGTERM)
        print(f"Hermes installer exceeded {timeout} seconds.", file=sys.stderr)
        return 124


if __name__ == "__main__":
    raise SystemExit(main())
