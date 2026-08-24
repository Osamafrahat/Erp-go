// Sanitize search input for Supabase .or() filters
// Prevents injection into PostgREST filter syntax
export function sanitizeSearch(search) {
  if (!search || typeof search !== 'string') return ''
  // Remove characters that could manipulate .or() filter syntax
  return search.replace(/[%(),.]/g, '').trim()
}
