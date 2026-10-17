import unittest
from tavi import validate_origin

class OriginTests(unittest.TestCase):
    def test_https(self): self.assertEqual(validate_origin("https://api.example.org"), "https://api.example.org")
    def test_local(self): self.assertEqual(validate_origin("http://localhost:9231"), "http://localhost:9231")
    def test_reject_http(self):
        with self.assertRaises(ValueError): validate_origin("http://remote.example.org")
    def test_reject_userinfo(self):
        with self.assertRaises(ValueError): validate_origin("https://user:password@example.org")
    def test_reject_path(self):
        with self.assertRaises(ValueError): validate_origin("https://example.org/api")

if __name__ == "__main__": unittest.main()
