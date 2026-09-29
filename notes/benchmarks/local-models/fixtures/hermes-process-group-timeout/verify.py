#!/usr/bin/env python3
"""Independently verify installer-helper process-group cleanup.

Usage: python3 verify.py HELPER_PATH

The test creates no files. Every spawned helper and descendant is bounded and
cleaned up by its captured process group, including when an assertion fails.
"""

from __future__ import annotations

import json
import os
import select
import signal
import subprocess
import sys
import time
from pathlib import Path


def _running(pid: int) -> bool:
    result = subprocess.run(
        ["ps", "-o", "stat=", "-p", str(pid)],
        capture_output=True,
        text=True,
        timeout=3,
        check=False,
    )
    state = result.stdout.strip()
    return bool(state) and not state.startswith("Z")


def _read_pid(pipe: object) -> int:
    data = b""
    deadline = time.monotonic() + 5
    while b"\n" not in data:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise AssertionError("descendant PID was not reported within five seconds")
        ready, _, _ = select.select([pipe], [], [], remaining)
        if not ready:
            raise AssertionError("descendant PID was not reported within five seconds")
        chunk = os.read(pipe.fileno(), 64)
        if not chunk:
            raise AssertionError("child exited before reporting descendant PID")
        data += chunk
        if len(data) > 128:
            raise AssertionError("invalid descendant PID output")
    line = data.split(b"\n", 1)[0]
    try:
        pid = int(line)
    except ValueError as exc:
        raise AssertionError(f"invalid descendant PID: {line!r}") from exc
    if pid <= 1:
        raise AssertionError(f"invalid descendant PID: {pid}")
    return pid


def _stop_group(pgid: int | None) -> None:
    if pgid is None or pgid == os.getpgrp():
        return
    try:
        os.killpg(pgid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def _tree_case(helper: Path, event: str) -> dict[str, object]:
    # The descendant ignores both forwarded signals. Its own stdout/stderr
    # cannot hold the verifier's pipes open after the direct child exits.
    grandchild_code = (
        "import signal,time; "
        "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
        "signal.signal(signal.SIGINT, signal.SIG_IGN); "
        "time.sleep(60)"
    )
    child_code = (
        "import subprocess,sys,time; "
        "p=subprocess.Popen([sys.executable,'-c'," + repr(grandchild_code) + "],"
        "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); "
        "time.sleep(0.2); print(p.pid,flush=True); p.wait()"
    )
    timeout = "1" if event == "timeout" else "20"
    process: subprocess.Popen[bytes] | None = None
    child_group: int | None = None
    descendant_pid: int | None = None
    try:
        process = subprocess.Popen(
            [sys.executable, str(helper), timeout, sys.executable, "-c", child_code],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        assert process.stdout is not None
        descendant_pid = _read_pid(process.stdout)
        child_group = os.getpgid(descendant_pid)
        if child_group == os.getpgrp():
            raise AssertionError("descendant joined verifier process group")

        if event == "sigterm":
            os.kill(process.pid, signal.SIGTERM)
        elif event == "sigint":
            os.kill(process.pid, signal.SIGINT)

        try:
            exit_code = process.wait(timeout=9)
        except subprocess.TimeoutExpired as exc:
            raise AssertionError(f"helper did not stop after {event}") from exc
        assert process.stderr is not None
        stderr = process.stderr.read().decode("utf-8", "replace")
        if event == "timeout":
            if exit_code != 124 or "exceeded 1 seconds" not in stderr:
                raise AssertionError(
                    f"timeout contract: exit={exit_code}, diagnostic={stderr[-300:]!r}"
                )
        elif exit_code == 0:
            raise AssertionError(f"helper reported success after external {event}")
        if _running(descendant_pid):
            raise AssertionError(f"descendant {descendant_pid} survived {event}")
        return {"case": event, "passed": True, "helper_exit": exit_code}
    finally:
        _stop_group(child_group)
        if process is not None:
            if process.poll() is None:
                _stop_group(process.pid)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                _stop_group(process.pid)
                process.wait(timeout=3)
            if process.stdout is not None:
                process.stdout.close()
            if process.stderr is not None:
                process.stderr.close()


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify.py HELPER_PATH", file=sys.stderr)
        return 2
    helper = Path(sys.argv[1]).resolve()
    if not helper.is_file():
        print(f"Helper file is missing: {helper}", file=sys.stderr)
        return 2

    cases: list[dict[str, object]] = []
    normal = subprocess.run(
        [
            sys.executable,
            str(helper),
            "5",
            sys.executable,
            "-c",
            "import sys;print('child-out');print('child-err',file=sys.stderr);sys.exit(7)",
        ],
        capture_output=True,
        timeout=8,
        check=False,
    )
    cases.append(
        {
            "case": "normal-exit-and-streams",
            "passed": normal.returncode == 7
            and b"child-out" in normal.stdout
            and b"child-err" in normal.stderr,
            "helper_exit": normal.returncode,
        }
    )
    invalid = subprocess.run(
        [sys.executable, str(helper), "0", sys.executable, "-c", "pass"],
        capture_output=True,
        timeout=3,
        check=False,
    )
    cases.append({"case": "invalid-timeout", "passed": invalid.returncode == 2, "helper_exit": invalid.returncode})
    noninteger = subprocess.run(
        [sys.executable, str(helper), "not-an-integer", sys.executable, "-c", "pass"],
        capture_output=True,
        timeout=3,
        check=False,
    )
    cases.append(
        {
            "case": "noninteger-timeout",
            "passed": noninteger.returncode == 2,
            "helper_exit": noninteger.returncode,
        }
    )

    for event in ("timeout", "sigterm", "sigint"):
        try:
            cases.append(_tree_case(helper, event))
        except (AssertionError, OSError, subprocess.TimeoutExpired) as exc:
            cases.append({"case": event, "passed": False, "error": str(exc)})

    passed = all(case["passed"] for case in cases)
    print(json.dumps({"passed": passed, "cases": cases}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
