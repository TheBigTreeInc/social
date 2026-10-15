#!/usr/bin/env python3
"""LoopRD Social operator-only developer entitlement management.

Run on the LoopRD host against the *component database*, not from clients.
This is deliberately not an HTTP operation. LoopRD admin keys never go to Social.
"""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3
import sys


def set_access(database: Path, username: str, value: bool | None):
    database = database.expanduser().resolve(strict=True)
    if not database.is_file():
        raise ValueError('Expected an existing SQLite Social database file')
    # Open read/write with mode=rw; never create or recreate the component DB.
    with closing(sqlite3.connect(database.as_uri() + '?mode=rw', uri=True, timeout=5)) as db:
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA busy_timeout=5000')
        db.execute('BEGIN IMMEDIATE')
        schema = db.execute('SELECT version FROM _looprd_schema WHERE id=1').fetchone()
        if not schema or schema['version'] < 3:
            raise ValueError('Social schema v3 has not been activated; deploy looprd.yaml first')
        row = db.execute('SELECT id, handle, developerEnabled FROM SocialAccount WHERE handle=?',
                         (username.strip().lower(),)).fetchone()
        if row is None:
            raise ValueError('Registered Social account not found; account must exist first')
        if value is not None:
            db.execute('UPDATE SocialAccount SET developerEnabled=? WHERE id=?',
                       (1 if value else 0, row['id']))
        result = db.execute('SELECT handle, developerEnabled FROM SocialAccount WHERE id=?',
                            (row['id'],)).fetchone()
        db.commit()
        return result['handle'], bool(result['developerEnabled'])


def main(argv=None):
    parser = argparse.ArgumentParser(description='Set a Social account developer permission on the LoopRD host')
    parser.add_argument('--db', type=Path, required=True,
                        help='Path to LoopRD data/databases/looprd-social.sqlite3')
    parser.add_argument('--user', required=True, help='Existing registered Social username')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--enable', action='store_true', help='Grant developer diagnostics')
    action.add_argument('--disable', action='store_true', help='Revoke developer diagnostics')
    action.add_argument('--show', action='store_true', help='Display only this account flag')
    args = parser.parse_args(argv)
    try:
        user, enabled = set_access(args.db, args.user, True if args.enable else False if args.disable else None)
    except (OSError, sqlite3.Error, ValueError) as exc:
        parser.exit(1, f'Access update refused: {exc}\n')
    print(f'Social developer tools: {user}: {"enabled" if enabled else "disabled"}')


if __name__ == '__main__':
    main()
