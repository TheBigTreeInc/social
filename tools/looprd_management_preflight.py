"""Check LoopRD operator-management references before submitting a specification.

This is a targeted check of the cross-field rule in pac-labs/dapi's
looprd/administration_spec.py:check_management. It is NOT a substitute for
running the exact deployed LoopRD parser and capability validation.
"""
from pathlib import Path
import json
import sys
import yaml


def validate_management_contract(spec):
    management = spec.get('management')
    if not management:
        return
    models = spec.get('models', {})
    resources = spec.get('resources', {})
    managed = management.get('resources', {})
    if not spec.get('database'):
        raise ValueError('management requires component database')
    for resource_name, exposed in managed.items():
        if resource_name not in resources:
            raise ValueError(f'management.{resource_name}: unknown managed resource')
        model = models.get(resources[resource_name].get('model'))
        if not model:
            raise ValueError(f'management.{resource_name}: resource model missing')
        declared = model['fields']
        field_names = exposed.get('fields', {})
        if set(field_names) - set(declared):
            raise ValueError(f'management.{resource_name}: unknown fields {sorted(set(field_names)-set(declared))}')
        if exposed.get('titleField') and exposed['titleField'] not in field_names:
            raise ValueError(f'management.{resource_name}: titleField must be managed')
        for name, policy in field_names.items():
            if policy.get('editable') and (declared[name].get('generated') or declared[name].get('primaryKey')):
                raise ValueError(f'management.{resource_name}.{name}: generated IDs cannot be edited')
    for action_name, action in management.get('actions', {}).items():
        if action.get('resource') not in managed:
            raise ValueError(f'management.actions.{action_name}: unknown managed resource')
        for resource_name, fields in action.get('writes', {}).items():
            if resource_name not in managed:
                raise ValueError(f'management.actions.{action_name}: unknown write resource {resource_name}')
            if not fields or len(fields) != len(set(fields)):
                raise ValueError(f'management.actions.{action_name}: writes must be nonempty and unique')
            missing = set(fields) - set(managed[resource_name].get('fields', {}))
            if missing:
                raise ValueError(f'management.actions.{action_name}: undeclared managed write fields: {sorted(missing)}')
            model = models[resources[resource_name]['model']]
            for field in fields:
                column = model['fields'][field]
                if column.get('generated') or column.get('primaryKey'):
                    raise ValueError(f'management.actions.{action_name}: generated/primaryKey field {field}')


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    root = Path(__file__).resolve().parents[1]
    target = root / 'looprd.yaml' if not argv else Path(argv[0])
    try:
        spec = yaml.safe_load(target.read_text(encoding='utf-8'))
        if not isinstance(spec, dict):
            raise ValueError('LoopRD descriptor is not a mapping')
        validate_management_contract(spec)
        # Server specification revisions are intentionally separate from the
        # Tavi client package version and must agree with the generated YAML.
        if target.resolve() == (root / 'looprd.yaml').resolve():
            server_release = json.loads((root/'server/looprd-release.json').read_text())['release']
            if spec.get('release') != server_release:
                raise ValueError('LoopRD server release stamp mismatch')
    except (ValueError, KeyError, OSError, yaml.YAMLError) as exc:
        print(f'LoopRD management preflight FAILED: {exc}', file=sys.stderr)
        return 1
    print('LoopRD operator management action/write declarations: PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
