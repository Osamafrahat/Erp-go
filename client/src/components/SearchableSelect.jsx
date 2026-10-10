import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

export default function SearchableSelect({ options = [], value, onChange, placeholder, labelKey = 'label', valueKey = 'value', renderOption, disabled }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const { t } = useAppStore()

  const selected = options.find(o => String(o[valueKey]) === String(value))

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(o => String(o[labelKey] ?? '').toLowerCase().includes(q))
  }, [options, search, labelKey])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setHighlightIndex(0)
  }, [search])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const handleSelect = (option) => {
    onChange(option[valueKey])
    setOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault()
      handleSelect(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => { if (!disabled) setOpen(!open) }}
className={`w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-surface text-sm text-left transition
${disabled ?'opacity-50 cursor-not-allowed':'cursor-pointer border-secondary'}
${open ?'border-accent ring-1 ring-primary-500':''}
${selected ?'text-foreground':'text-muted'}`}
      >
        <span className="truncate">
          {selected ? (renderOption ? renderOption(selected) : selected[labelKey]) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
<div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
<div className="p-2 border-b border-border">
            <div className="relative">
<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"/>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
className="w-full pl-8 pr-7 py-1.5 border border-border rounded-md bg-surface-secondary text-foreground text-sm focus:outline-none ring-focus"
              />
              {search && (
<button type="button"onClick={()=>setSearch('')}className="absolute right-2 top-1/2 -translate-y-1/2 text-muted text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
<div className="px-3 py-2 text-sm text-muted">{t('common.noResults')||'No results found'}</div>
            ) : (
              filtered.map((option, i) => (
                <button
                  key={option[valueKey]}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-start px-3 py-2 text-sm transition
                    ${String(option[valueKey]) === String(value)
?'bg-accent-soft text-accent-soft-foreground'
                      : i === highlightIndex
?'bg-surface-tertiary text-foreground'
:'text-foreground bg-surface-hover'}`}
                >
                  {renderOption ? renderOption(option) : option[labelKey]}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
