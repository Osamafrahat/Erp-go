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
  const Wrapper = banner.link_url ? 'a' : 'div'
  const wrapperProps = banner.link_url ? { href: banner.link_url, target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
      <Wrapper
        {...wrapperProps}
        className="block relative min-h-[120px] md:min-h-[160px]"
        style={{
          backgroundColor: banner.background_color || '#3b82f6',
          color: banner.text_color || '#ffffff',
        }}
      >
        <div className="flex items-center">
          {banner.image_url && (
            <div className="w-1/3 md:w-1/4 flex-shrink-0 h-[120px] md:h-[160px] overflow-hidden">
              <img
                src={banner.image_url}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className={`flex-1 p-4 md:p-6 ${banner.image_url ? '' : 'text-center'}`}>
            <h3 className="text-lg md:text-xl font-bold mb-1">{banner.title}</h3>
            {banner.content && (
              <p className="text-sm md:text-base opacity-90 line-clamp-2">{banner.content}</p>
            )}
            {banner.link_url && (
              <span className="inline-block mt-2 text-xs font-semibold opacity-75 underline">
                Learn more →
              </span>
            )}
          </div>
        </div>
      </Wrapper>

      {visibleBanners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {visibleBanners.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/75'}`}
              />
            ))}
          </div>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center text-xs transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
