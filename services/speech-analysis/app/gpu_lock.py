"""Khoá GPU dùng chung (`GPU.lock`) với vLLM và các việc GPU khác trên cùng máy.

Việc đến sau chờ khoá; quá `wait_sec` thì báo bận (`LockTimeout`) để web rơi về cách cũ thay vì treo học viên.
Dùng flock trên một tệp: nhả tự động khi tiến trình chết, nên không bao giờ kẹt khoá.
"""
from __future__ import annotations

import fcntl
import time
from typing import Optional


class LockTimeout(Exception):
    pass


class GpuLock:
    """Context manager. `path` rỗng/None = không dùng khoá (máy không có GPU dùng chung, hoặc chạy thử)."""

    def __init__(self, path: Optional[str], wait_sec: float, poll_sec: float = 0.1):
        self.path = path or None
        self.wait_sec = wait_sec
        self.poll_sec = poll_sec
        self._fh = None

    def __enter__(self) -> "GpuLock":
        if not self.path:
            return self
        self._fh = open(self.path, "a")
        deadline = time.monotonic() + self.wait_sec
        while True:
            try:
                fcntl.flock(self._fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return self
            except OSError:
                if time.monotonic() >= deadline:
                    self._fh.close()
                    self._fh = None
                    raise LockTimeout()
                time.sleep(self.poll_sec)

    def __exit__(self, *exc) -> None:
        if self._fh is not None:
            try:
                fcntl.flock(self._fh, fcntl.LOCK_UN)
            finally:
                self._fh.close()
                self._fh = None
