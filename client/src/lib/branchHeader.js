// Single in-memory holder for the branch id sent to the API as the
// `x-branch-id` request header (read by the request interceptor in api.js).
//
// This module deliberately imports NOTHING (no axios, no stores) so api.js can
// require it without creating an import cycle: api.js is imported by the
// zustand stores, and branchStore.js is what pushes the selected branch in
// via setBranchHeader().
//
// The selection survives page reloads through localStorage
// ('erp-selected-branch', written by branchStore.setBranch()). It is hydrated
// here at module scope so the very first request of a fresh page load already
// carries the right header, before any store has been created.
const STORAGE_KEY = 'erp-selected-branch'

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return null
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch {
    // Non-browser/test environment or storage disabled: let the server pick
    // the effective branch for us (no header sent).
    return null
  }
}

let current = readPersisted()

export function setBranchHeader(id) {
  if (id == null || id === '') {
    current = null
    return
  }
  const parsed = Number(id)
  current = Number.isFinite(parsed) ? parsed : null
}

export function getBranchHeader() {
  return current
}
