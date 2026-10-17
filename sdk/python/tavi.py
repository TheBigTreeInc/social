"""Dependency-free Tavi Social API client for Python 3.10+."""
import json
import urllib.request
import urllib.error
from urllib.parse import urlsplit

GUEST = "tavi_guest_v1"

def validate_origin(origin):
    u = urlsplit(origin)
    if u.username or u.password or u.query or u.fragment or u.path not in ("", "/") or not u.hostname:
        raise ValueError("Expected server origin only")
    if u.scheme != "https" and not (u.scheme == "http" and u.hostname in ("localhost", "127.0.0.1", "::1", "10.0.2.2")):
        raise ValueError("Remote servers require HTTPS")
    return origin.rstrip("/")

class TaviError(Exception):
    pass

class Tavi:
    def __init__(self, origin, token=GUEST):
        self.origin = validate_origin(origin)
        self.token = token

    def command(self, op, **fields):
        body = json.dumps({"op": op, **fields, **({"token": self.token} if self.token != GUEST else {})}).encode()
        req = urllib.request.Request(self.origin + "/looprd/looprd-social/v1/social", data=body,
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + self.token}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            raise TaviError("Tavi request failed: HTTP " + str(exc.code)) from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise TaviError(str(result.get("error", "Invalid Tavi response")) if isinstance(result, dict) else "Invalid Tavi response")
        return result

    def login(self, username, password):
        result = self.command("login", username=username, password=password)
        self.token = result["token"]
        return result

    def register(self, username, password):
        result = self.command("register", username=username, password=password)
        self.token = result["token"]
        return result

    def me(self): return self.command("me")
    def contacts(self): return self.command("contact_list")
    def request_contact(self, username): return self.command("contact_request", username=username)
    def accept_contact(self, peer): return self.command("contact_accept", peer=peer)
    def conversations(self): return self.command("dm_conversations")
    def direct_feed(self, peer): return self.command("dm_feed", peer=peer)
    def direct_send(self, peer, text): return self.command("dm_send", peer=peer, text=text)
    def feed(self): return self.command("chat_feed")
    def send(self, text): return self.command("chat_send", text=text)
    def logout(self): return self.command("logout")
