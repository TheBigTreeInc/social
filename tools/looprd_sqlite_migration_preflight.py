"""Fail-closed SQLite VARCHAR migration check for LoopRD specifications.

pac-labs/dapi's Storage._initialize_transaction requires reflected SQLAlchemy
string lengths to equal model.fields[*].maxLength after migrations. SQLite TEXT
has no declared length, even though it accepts long strings. Validate all
ALTER TABLE ADD COLUMN string declarations before importing to a live server.
This preflight is not a substitute for actual installed-runtime acceptance.
"""
import re
import sys
from pathlib import Path
import yaml

IDENT = r'(?:"[A-Za-z][A-Za-z0-9_]*"|[A-Za-z][A-Za-z0-9_]*)'
ADD_COLUMN = re.compile(
    rf'^\s*ALTER\s+TABLE\s+(?P<table>{IDENT})\s+ADD\s+COLUMN\s+'
    rf'(?P<column>{IDENT})\s+(?P<type>[A-Za-z]+)\s*'
    rf'(?:\(\s*(?P<length>[0-9]+)\s*\))?', re.I)

def validate_sqlite_migration_strings(spec):
    database = spec.get('database') or {}
    if database.get('backend', 'sqlite') != 'sqlite':
        return
    models = spec.get('models') or {}
    for migration in database.get('migrations', []):
        for index, statement in enumerate(migration.get('statements', [])):
            match = ADD_COLUMN.match(statement)
            if match is None:
                continue
            table, column = (match.group(name).strip('"') for name in ('table', 'column'))
            model_field = models.get(table, {}).get('fields', {}).get(column)
            if not model_field or model_field.get('type') != 'string':
                continue
            wanted = model_field.get('maxLength')
            kind = match.group('type').upper()
            length = int(match.group('length')) if match.group('length') else None
            if kind != 'VARCHAR' or length != wanted:
                raise ValueError(
                    f'database.migrations version {migration.get("version")} statement {index}: '
                    f'{table}.{column} must use VARCHAR({wanted}); '
                    f'found {kind}({length})' if length is not None else
                    f'database.migrations version {migration.get("version")} statement {index}: '
                    f'{table}.{column} must use VARCHAR({wanted}); found {kind} without length'
                )

def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    root = Path(__file__).resolve().parents[1]
    path = Path(args[0]) if args else root/'looprd.yaml'
    try:
        spec = yaml.safe_load(path.read_text(encoding='utf-8'))
        if not isinstance(spec, dict):
            raise ValueError('LoopRD specification must be a mapping')
        validate_sqlite_migration_strings(spec)
    except (ValueError, OSError, yaml.YAMLError) as exc:
        print(f'LoopRD SQLite migration preflight FAILED: {exc}', file=sys.stderr)
        return 1
    print('LoopRD SQLite string-column migration lengths: PASS')
    return 0

if __name__ == '__main__':
    sys.exit(main())
