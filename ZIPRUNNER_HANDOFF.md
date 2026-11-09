# Tavi 0.3.159 — Windows CRLF-safe CI version check

Base: 0.3.158 (GitHub Windows tests failed because Cargo.lock has CRLF after checkout).

Fix the native Cargo.lock client version test to support LF and Windows CRLF without bypassing version consistency checks. Include a regression fixture for both formats, synchronize versioned source and ZipRunner metadata, and keep source-only changes bounded.

The GitHub one-shot Release Tavi workflow remains unchanged and operator-gated. Do not push, tag, publish or release automatically. Preserve local configuration and private data.
