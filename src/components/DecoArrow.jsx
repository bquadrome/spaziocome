import { useEffect, useRef } from 'react'

export default function DecoArrow({ src, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.classList.add('is-in')
        io.unobserve(el)
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <span className="deco-arrow" ref={ref} aria-hidden="true">
      {children ?? <img className="deco-arrow-mark" src={src} alt="" width={215} height={215} />}
    </span>
  )
}
