"""Download a small, deterministic held-out RGB sample; never calls an LLM.

Install Pillow and imageio-ffmpeg, then run with --count=4 (default).
Nutrition5k: Google Research / authors, CC BY 4.0.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import urllib.request

BASE = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/"
ROOT = Path(__file__).resolve().parent.parent


def download(relative, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        with urllib.request.urlopen(BASE + relative, timeout=90) as response:
            data = response.read(30_000_001)
        if len(data) > 30_000_000:
            raise ValueError("Unexpectedly large source file")
        destination.write_bytes(data)
    return destination.read_bytes()


def prepare(count, out):
    from PIL import Image
    import imageio_ffmpeg

    out = out.resolve()
    if count < 1 or count > 12 or not out.is_relative_to(ROOT / "work"):
        raise ValueError("Use 1–12 cases, in this checkout's work directory")
    manifest_path = out / "cases.json"
    if manifest_path.exists():
        raise ValueError("Manifest already exists; preserve the locked sample or choose a new directory")
    excluded = set()
    for source in (ROOT / "docs").glob("*.json"):
        excluded.update(re.findall(r"dish_\d{10}", source.read_text(encoding="utf-8")))
    splits = []
    source_hashes = {}
    for name in ("rgb_test_ids.txt", "depth_test_ids.txt"):
        relative = "dish_ids/splits/" + name
        data = download(relative, out / "source" / name)
        source_hashes[relative] = hashlib.sha256(data).hexdigest()
        splits.append(set(data.decode().split()))
    # Nutrition5k includes incremental scans of a plate. Exact-ID exclusion alone
    # could retain a later scan of a previously examined meal; exclude nearby scans too.
    allowed = {dish for dish in (splits[0] & splits[1]) - excluded
        if re.fullmatch(r"dish_\d{10}", dish) and all(abs(int(dish[5:]) - int(old[5:])) > 600 for old in excluded)}
    rows = []
    for name in ("dish_metadata_cafe1.csv", "dish_metadata_cafe2.csv"):
        relative = "metadata/" + name
        data = download(relative, out / "source" / name)
        source_hashes[relative] = hashlib.sha256(data).hexdigest()
        for row in csv.reader(io.StringIO(data.decode())):
            if not row or row[0] not in allowed:
                continue
            if (len(row) - 6) % 7 == 0 and 3 <= (len(row) - 6) // 7 <= 8 and 150 <= float(row[2]) <= 1000:
                rows.append(row)
    rows.sort(key=lambda row: hashlib.sha256(("yumetrics-haiku-v1/" + row[0]).encode()).hexdigest())
    selected, signatures = [], set()
    # Spread the first four choices across energy ranges before filling remaining slots.
    for lower, upper in [(0, 300), (300, 500), (500, 800), (800, 1500), (0, 10000)]:
        for row in rows:
            signature = tuple(sorted(row[6::7]))
            if lower <= float(row[1]) < upper and signature not in signatures and row not in selected and all(abs(int(row[0][5:]) - int(old[0][5:])) > 600 for old in selected):
                selected.append(row)
                signatures.add(signature)
                if len(selected) >= count:
                    break
                if upper != 10000:
                    break
        if len(selected) >= count:
            break
    if len(selected) != count:
        raise ValueError("Not enough distinct held-out cases")
    # Lock IDs and targets before downloading images or making any model call.
    out.mkdir(parents=True, exist_ok=True)
    selection = json.dumps({"ids": [row[0] for row in selected], "excluded": sorted(excluded), "exclusionWindowSeconds": 600, "sources": source_hashes}, indent=2)
    selection_path = out / "selection.json"
    if selection_path.exists() and selection_path.read_text(encoding="utf-8") != selection:
        raise ValueError("Locked selection changed; use a new output directory")
    selection_path.write_text(selection, encoding="utf-8")
    cases = []
    for row in selected:
        dish = row[0]
        folder = out / dish
        overhead = folder / "overhead-source.png"
        video = folder / "side-source.h264"
        download(f"imagery/realsense_overhead/{dish}/rgb.png", overhead)
        prefix = f"nutrition5k_dataset/imagery/side_angles/{dish}/"
        with urllib.request.urlopen("https://storage.googleapis.com/storage/v1/b/nutrition5k_dataset/o?prefix=" + prefix + "&maxResults=10", timeout=30) as response:
            videos = sorted(item["name"] for item in json.load(response).get("items", []) if item["name"].endswith(".h264"))
        if not videos:
            raise ValueError(f"No side video for locked case {dish}; do not substitute a different case")
        download(videos[0].removeprefix("nutrition5k_dataset/"), video)
        side = folder / "side-source.jpg"
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y", "-i", str(video), "-frames:v", "1", "-q:v", "2", str(side)], check=True)
        images = []
        for source, target, edge in [(overhead, folder / "overhead.jpg", 1600), (side, folder / "side.jpg", 2048)]:
            with Image.open(source) as image:
                image = image.convert("RGB")
                image.thumbnail((edge, edge))
                image.save(target, quality=92)
            images.append({"file": str(target.relative_to(out)).replace("\\", "/"), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest()})
        item = {"id": dish, "group": "generic", "image": images[0]["file"], "secondImage": images[1]["file"], "notes": "", "context": {},
            "reference": {"measured": True, "method": "weighed_components", "provenance": f"Nutrition5k official dish metadata; weighed components and USDA-derived nutrients; {dish}",
                "edibleWeightG": float(row[2]), "calories": float(row[1]), "fat": float(row[3]), "carbs": float(row[4]), "protein": float(row[5]), "carbohydrateBasis": "total_including_fiber"},
            "expectedFoods": [{"name": row[i+1], "grams": float(row[i+2])} for i in range(6, len(row), 7)], "images": images}
        cases.append(item)
        print(f"Prepared {dish}", flush=True)
    manifest = {"source": "https://github.com/google-research-datasets/Nutrition5k", "license": "CC BY 4.0; Google Research / Nutrition5k authors",
        "selection": "Official RGB/depth test intersection; exclude all prior docs cases and IDs within 600 seconds; selected IDs also separated by >600 seconds; 3–8 ingredients, 150–1000 g; SHA256 order and energy strata; distinct ingredient signatures. Conservative temporal exclusion reduces but cannot prove absence of incremental-plate overlap. Not a representative random population sample.",
        "sourceHashes": source_hashes, "cases": cases}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Locked manifest: {manifest_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=4)
    parser.add_argument("--out", type=Path, default=ROOT / "work" / "nutrition5k-haiku-v2")
    args = parser.parse_args()
    prepare(args.count, args.out)
