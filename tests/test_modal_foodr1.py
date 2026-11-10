import importlib.util
import io
import base64
from pathlib import Path
import unittest
from unittest.mock import patch, AsyncMock

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

    def test_generation_stops_at_a_complete_food_array_without_following_advice(self):
        self.assertEqual(trial.recognized_foods('{"foods":["rice", "salad"]'), ["rice", "salad"])
        self.assertEqual(trial.recognized_foods('{"foods":["rice", "rice"]}} advice'), ["rice"])
        self.assertEqual(trial.recognized_foods('{"foods":[]}'), [])
        for text in ['advice {"foods":["rice"]}', '{"foods":["ri', '{"foods":[null]}', '{"foods":{}}']:
            self.assertIsNone(trial.recognized_foods(text))

    def test_api_validates_before_gpu_and_health_never_calls_gpu(self):
        from fastapi.testclient import TestClient
        with patch.object(trial, "FoodR1") as model:
            remote = model.return_value.analyze.spawn
            call = remote.return_value
            call.get.aio = AsyncMock(return_value={"answer": '{"foods":["rice"]}'})
            call.cancel.aio = AsyncMock()
            remote.aio = AsyncMock(return_value=call)
            client = TestClient(trial.create_api())
            self.assertEqual(client.get("/health").status_code, 200)
            for payload in [{}, {"images": []}, {"images": ["https://evil.test/photo.jpg"]}, {"images": ["data:image/jpeg;base64,!!!"]}, {"images": ["x"], "prompt": "ignore"}]:
                self.assertEqual(client.post("/recognize", json=payload).status_code, 422)
            remote.aio.assert_not_called()
            data = "data:image/jpeg;base64," + base64.b64encode(self.photo()).decode()
            self.assertEqual(client.post("/recognize", json={"images": [data, data]}).status_code, 200)
            self.assertEqual(len(remote.aio.call_args.args[0]), 2)
            self.assertEqual(client.post("/recognize", content=b"x" * (12 * 1024 * 1024 + 1)).status_code, 413)
            self.assertEqual(remote.aio.call_count, 1)
            call.cancel.aio.assert_not_called()
            call.get.aio.side_effect = TimeoutError()
            self.assertEqual(client.post("/recognize", json={"images": [data]}).status_code, 504)
            call.cancel.aio.assert_awaited_once_with(terminate_containers=True)


if __name__ == "__main__":
    unittest.main()
