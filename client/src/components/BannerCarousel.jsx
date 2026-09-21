import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function BannerCarousel({ banners }) {
  const [current, setCurrent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const visibleBanners = banners?.filter(b => b.is_active) || []

  useEffect(() => {
    if (visibleBanners.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % visibleBanners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [visibleBanners.length])

  const prev = useCallback(() => {
    setCurrent(prev => (prev - 1 + visibleBanners.length) % visibleBanners.length)
  }, [visibleBanners.length])

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % visibleBanners.length)
  }, [visibleBanners.length])

  if (!visibleBanners.length || dismissed) return null

  const banner = visibleBanners[current]
  const hasImage = !!banner.image_url
  const Wrapper = banner.link_url ? 'a' : 'div'
  const wrapperProps = banner.link_url ? { href: banner.link_url, target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-200/50 dark:border-gray-700/50 group">
      <Wrapper
        {...wrapperProps}
        className="block relative"
        style={{
          backgroundColor: hasImage ? (banner.background_color || '#1a1a2e') : (banner.background_color || '#3b82f6'),
          color: banner.text_color || '#ffffff',
        }}
      >
        {hasImage && (
          <>
            <img
              src={banner.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${(banner.background_color || '#000000')}ee 0%, ${(banner.background_color || '#000000')}aa 40%, ${(banner.background_color || '#000000')}55 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        )}

        <div className="relative z-10 p-6 md:p-10" style={{ paddingBottom: visibleBanners.length > 1 ? '3rem' : undefined }}>
          {hasImage && (
            <div className="mb-3">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest bg-white/20 backdrop-blur-sm border border-white/20">
                Featured
              </span>
            </div>
          )}
          <h3 className={`font-extrabold mb-3 leading-tight ${
            hasImage
              ? 'text-2xl md:text-4xl lg:text-5xl drop-shadow-lg'
              : 'text-lg md:text-xl'
          }`} style={{ textShadow: hasImage ? '0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)' : 'none' }}>
            {banner.title}
          </h3>
          {banner.content && (
            <p className={`opacity-95 leading-relaxed ${
              hasImage
                ? 'text-sm md:text-lg drop-shadow-md'
                : 'text-sm md:text-base'
            }`} style={{ textShadow: hasImage ? '0 1px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)' : 'none' }}>
              {banner.content}
            </p>
          )}
          {banner.link_url && (
            <span className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/20 hover:bg-white/30 transition-colors cursor-pointer">
              Learn more
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </Wrapper>

      {visibleBanners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {visibleBanners.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 h-2 bg-white'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/20 z-20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
