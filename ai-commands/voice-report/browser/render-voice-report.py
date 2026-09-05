#!/usr/bin/env python3
import argparse
import json
import shutil
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    parser.add_argument('--audio-file', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--assets-dir', required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    assets_dir = Path(args.assets_dir)
    output = Path(args.output)
    audio_file = Path(args.audio_file)
    template = (assets_dir / 'template.html').read_text(encoding='utf-8')
    report_json = json.dumps({'text': args.text}, ensure_ascii=False).replace('</', '<\\/')
    page = template.replace('__AUDIO_SRC__', audio_file.name).replace('__REPORT_JSON__', report_json)
    output.write_text(page, encoding='utf-8')
    shutil.copy2(assets_dir / 'voice-report.css', output.parent / 'voice-report.css')
    shutil.copy2(assets_dir / 'voice-report.js', output.parent / 'voice-report.js')


if __name__ == '__main__':
    main()
