import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "modal_foodr1", Path(__file__).resolve().parents[1] / "scripts/modal_foodr1.py",
)
trial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trial)


class PhotoValidation(unittest.TestCase):
    def photo(self, image_format="JPEG", size=(120, 80), orientation=None):
        buffer = io.BytesIO()
        image = Image.new("RGB", size)
        exif = image.getexif()
        if orientation:
            exif[274] = orientation
        image.save(buffer, image_format, **({"exif": exif} if image_format == "JPEG" else {}))
        return buffer.getvalue()

    def test_supported_images_and_exif_orientation(self):
        for image_format in ["JPEG", "PNG", "WEBP"]:
            with self.subTest(image_format=image_format):
                result = trial.decode_photo(self.photo(image_format))
                self.assertEqual(result.mode, "RGB")
                self.assertEqual(result.size, (120, 80))
        self.assertEqual(trial.decode_photo(self.photo(orientation=6)).size, (80, 120))

    def test_rejects_bad_input_before_gpu_submission(self):
        for data in [b"", "text", b"broken image", b"x" * (trial.MAX_BYTES + 1), self.photo("GIF")]:
            with self.subTest(kind=type(data).__name__, length=len(data)):
                with self.assertRaises(ValueError):
                    trial.decode_photo(data)

    def test_limits_decoded_pixels_before_loading(self):
        with patch("PIL.Image.open") as opened:
            opened.return_value.__enter__.return_value.format = "JPEG"
            opened.return_value.__enter__.return_value.width = 5000
            opened.return_value.__enter__.return_value.height = 5000
            with self.assertRaisesRegex(ValueError, "20 megapixeles"):
                trial.decode_photo(b"small compressed file")

    def test_large_accepted_photo_is_resized(self):
        self.assertEqual(trial.decode_photo(self.photo(size=(2000, 1000))).size, (1600, 800))


if __name__ == "__main__":
    unittest.main()
