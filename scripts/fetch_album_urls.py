#!/usr/bin/env python3
"""Extract lh3.googleusercontent.com image URLs from Google Photos share links."""
from __future__ import annotations

import json
import re
import ssl
import sys
import urllib.request
from pathlib import Path

ALBUMS = [
    ("Camera Vale do Pati 2026 T2", "https://photos.app.goo.gl/fFCnGbNJGS1RJwBGA"),
    ("Camera Vale do Pati 2026 T1", "https://photos.app.goo.gl/Mdp5jFjFEQyvzJVs5"),
    ("Camera Monte Roraima", "https://photos.app.goo.gl/eDjqYmU63nn5QGEb9"),
    ("Camera Vale do Pati Galapagos", "https://photos.app.goo.gl/LDuXa3RVnyi5YLdz6"),
    ("Camera Lencois Maranhenses 2026 T1", "https://photos.app.goo.gl/Fce3Zg3Gj1UagJKT9"),
    ("Drone Chapada Diamantina 2025", "https://photos.app.goo.gl/iWWpXSPRLQWXJbKd9"),
    ("Drone Vale do Pati Galapagos", "https://photos.app.goo.gl/zdwa56fizVwk55hWA"),
    ("Drone Lencois Maranhenses 2025", "https://photos.app.goo.gl/Njwii2XiPKBMZw9N7"),
    ("Drone Vale do Pati 2026 T1", "https://photos.app.goo.gl/uBfq63wjN9tzH2mp8"),
    ("Drone Vale do Pati 2026 T2", "https://photos.app.goo.gl/yuo85saFsohPhNrK6"),
    ("Drone Lencois Maranhenses T2", "https://photos.app.goo.gl/yZ83udzeUSMuibNo6"),
    ("Drone Lencois Maranhenses T1", "https://photos.app.goo.gl/NWXDpwXAp2wkqddM7"),
]

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=CTX, timeout=45) as resp:
        final = resp.geturl()
        html = resp.read().decode("utf-8", errors="ignore")
    return final, html


def extract_urls(html: str) -> list[str]:
    found = re.findall(r"https://lh3\.googleusercontent\.com/[-=\w/_.]+", html)
    # Prefer full-size-ish variants; strip size suffixes like =w128-h128
    cleaned: list[str] = []
    seen: set[str] = set()
    for u in found:
        base = re.sub(r"=w\d+.*$", "", u)
        base = re.sub(r"=s\d+.*$", "", base)
        if base in seen:
            continue
        seen.add(base)
        # Use a reasonable display size for backgrounds
        cleaned.append(f"{base}=w1920-h1080")
    return cleaned


def main() -> int:
    out: dict[str, list[str]] = {}
    flat: list[dict] = []
    for name, url in ALBUMS:
        try:
            final, html = fetch(url)
            urls = extract_urls(html)
            print(f"{name}: {len(urls)} urls final={final[:80]}", file=sys.stderr)
            # Keep a few per album so the slideshow mixes destinations
            pick = urls[:8] if urls else []
            out[name] = pick
            for u in pick:
                flat.append({"album": name, "src": u, "albumUrl": url})
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {name}: {exc}", file=sys.stderr)
            out[name] = []

    root = Path(__file__).resolve().parents[1]
    (root / "assets" / "slideshow").mkdir(parents=True, exist_ok=True)
    data_path = root / "js" / "slideshow-photos.js"
    payload = {
        "albums": out,
        "photos": flat,
    }
    data_path.write_text(
        "window.SDZ_SLIDESHOW_PHOTOS = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {data_path} with {len(flat)} photos", file=sys.stderr)
    return 0 if flat else 1


if __name__ == "__main__":
    raise SystemExit(main())
