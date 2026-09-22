#!/usr/bin/env python3

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from safety import available_memory_bytes, env_bool, env_float, env_int, request_limit_error


class SafetyTest(unittest.TestCase):
    def test_environment_values_are_validated(self):
        with patch.dict(os.environ, {"LIMIT": "12", "RATIO": "0.5", "FLAG": "true"}, clear=False):
            self.assertEqual(env_int("LIMIT", 1, 1), 12)
            self.assertEqual(env_float("RATIO", 1.0), 0.5)
            self.assertTrue(env_bool("FLAG", False))
        with patch.dict(os.environ, {"LIMIT": "0", "FLAG": "maybe"}, clear=False):
            with self.assertRaises(RuntimeError):
                env_int("LIMIT", 1, 1)
            with self.assertRaises(RuntimeError):
                env_bool("FLAG", False)

    def test_available_memory_uses_memavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            meminfo = Path(directory) / "meminfo"
            meminfo.write_text("MemTotal: 100 kB\nMemAvailable: 42 kB\n", encoding="utf-8")
            self.assertEqual(available_memory_bytes(meminfo), 42 * 1024)

    def test_request_limits_cover_dimensions_pixels_and_steps(self):
        limits = (1344, 1344, 1048576, 50)
        self.assertIsNone(request_limit_error(1344, 768, 50, *limits))
        self.assertIn("dimensions", request_limit_error(1360, 768, 30, *limits))
        self.assertIn("pixel count", request_limit_error(1344, 1344, 30, *limits))
        self.assertIn("steps", request_limit_error(768, 768, 51, *limits))


if __name__ == "__main__":
    unittest.main()
