// A sandbox can only survive a render when its reviewed installed release is identical.
// Do not derive identity from unapproved repository metadata alone.
export function extensionFrameIdentity(id, entry, store, source) {
  if (!id || !entry?.manifest || !store?.enabled(id)) return null;
  const installedSource = store.source(id);
  if (!installedSource || installedSource !== source) return null;
  const version = store.version(id);
  if (!version || version !== entry.manifest.version) return null;
  const revision = store.revision?.(id) ?? null;
  const entrypoint = store.entrypoint?.(id) ?? null;
  const reviewedRevision = entry.release?.revision ?? entry.remote?.release?.revision ?? null;
  const reviewedEntrypoint = entry.remote?.entrypoint ?? null;
  if (reviewedRevision && revision && revision !== reviewedRevision) return null;
  if (reviewedEntrypoint && entrypoint && reviewedEntrypoint !== entrypoint) return null;
  return JSON.stringify([id, installedSource, version, revision, entrypoint, reviewedEntrypoint]);
}
