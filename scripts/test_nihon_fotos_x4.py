"""Nihon fotos x4: el archivo completo de cada foto nueva mide lo que declara la metadata (≤1200 px)."""
import json
import sys
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nihon_fotos_x4  # noqa: E402

ROOT = nihon_fotos_x4.ROOT


class NihonFotosX4AssetSizeTests(unittest.TestCase):
    def test_x4_full_files_are_1200px_and_match_metadata(self):
        images = json.loads((ROOT / "data/visual/photography-metadata.json").read_text(encoding="utf-8"))["images"]
        titles = nihon_fotos_x4.x4_titles()
        x4 = [r for r in images if r["originalTitle"] in titles]
        self.assertEqual(len(x4), len(titles))
        for record in x4:
            with Image.open(ROOT / "app/public" / record["assetPath"]) as image:
                self.assertEqual(image.size, (record["assetWidth"], record["assetHeight"]), record["assetPath"])
                self.assertLessEqual(max(image.size), 1200, record["assetPath"])

    def test_old_records_do_not_declare_asset_size(self):
        images = json.loads((ROOT / "data/visual/photography-metadata.json").read_text(encoding="utf-8"))["images"]
        for record in nihon_fotos_x4.pre_x4(images):
            self.assertNotIn("assetWidth", record, record["assetPath"])


if __name__ == "__main__":
    unittest.main()
