import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, ZapIcon } from 'lucide-react';

interface SlideImage {
  primary: string;
  local?: string;
  fallback: string;
}

interface Slide {
  id: number;
  bg: string;
  textTheme: 'light' | 'dark';
  badge: string;
  title1: string;
  title2: string;
  subtitle: string;
  cta: string;
  ctaTo: string;
  ctaVariant: 'cta' | 'primary';
  image: SlideImage;
  layout: 'right-image' | 'left-image' | 'center';
  floatingBadges?: { text: string; classes: string }[];
}

const slides: Slide[] = [
  {
    id: 1,
    bg: 'bg-gradient-to-br from-[#0F3460] to-[#2874F0]',
    textTheme: 'light',
    badge: '🔥 LIMITED TIME OFFER',
    title1: 'Up to 40% OFF',
    title2: 'on Smartphones',
    subtitle: 'Samsung  |  Apple  |  OnePlus  |  Realme',
    cta: 'Shop Now',
    ctaTo: '/products?category=Mobiles',
    ctaVariant: 'cta',
    image: {
      primary: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=960&q=70',
      local: '/assets/images/banners/hero-phones.jpg',
      fallback: '/assets/images/banners/hero-phones.svg',
    },
    layout: 'right-image',
    floatingBadges: [
      { text: '⭐ 4.3 · 1,247 reviews', classes: 'bg-white text-ink top-6 -left-4' },
      { text: '₹29,999', classes: 'bg-success text-white bottom-6 -right-2' },
    ],
  },
  {
    id: 2,
    bg: 'bg-bg',
    textTheme: 'dark',
    badge: '💻 NEW ARRIVALS',
    title1: 'Top Laptops',
    title2: 'Starting ₹29,999',
    subtitle: 'Dell  |  HP  |  Lenovo  |  ASUS',
    cta: 'Explore Laptops',
    ctaTo: '/products?category=Laptops',
    ctaVariant: 'primary',
    image: {
      primary: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=960&q=70',
      local: '/assets/images/banners/hero-laptops.jpg',
      fallback: '/assets/images/banners/hero-laptops.svg',
    },
    layout: 'left-image',
  },
  {
    id: 3,
    bg: 'bg-gradient-to-r from-white via-white to-orange-50',
    textTheme: 'dark',
    badge: '⚡ BEST SELLERS',
    title1: 'Accessories Under',
    title2: '₹999',
    subtitle: 'Earbuds  |  Cases  |  Chargers  |  Cables',
    cta: 'Shop Accessories',
    ctaTo: '/products?category=Accessories',
    ctaVariant: 'cta',
    image: {
      primary: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=960&q=70',
      local: '/assets/images/banners/hero-accessories.jpg',
      fallback: '/assets/images/banners/hero-accessories.svg',
    },
    layout: 'center',
  },
];

function HeroImage({
  image,
  alt,
  className,
  loading,
  fetchPriority,
}: {
  image: SlideImage;
  alt: string;
  className: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'auto' | 'low';
}) {
  const [src, setSrc] = useState(image.primary);

  useEffect(() => {
    setSrc(image.primary);
  }, [image.primary]);

  const handleError = () => {
    if (src === image.primary && image.local) {
      setSrc(image.local);
      return;
    }
    if (src !== image.fallback) {
      setSrc(image.fallback);
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={handleError}
      className={className}
    />
  );
}

export function HeroBanner() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);
  const slide = slides[index];
  const isLight = slide.textTheme === 'light';
  const isFirstSlide = slide.id === 1;

  useEffect(() => {
    // Preload the first hero image to reduce time-to-visual.
    const img = new Image();
    img.src = slides[0].image.primary;
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl md:rounded-2xl shadow-card">
      <div className={`relative ${slide.bg}`} style={{ minHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            {/* RIGHT-IMAGE layout */}
            {slide.layout === 'right-image' && (
              <div className="flex flex-col md:grid md:grid-cols-2 md:h-[440px] md:items-center md:gap-6 md:px-12">
                {/* Mobile: stacked layout */}
                <div className={`px-5 pt-6 pb-3 md:p-0 ${isLight ? 'text-white' : 'text-ink'}`}>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold mb-2 ${isLight ? 'bg-cta text-white' : 'bg-primary-50 text-primary'}`}>
                    {slide.badge}
                  </span>
                  <h1 className="font-heading font-extrabold text-2xl sm:text-3xl md:text-6xl leading-tight">
                    {slide.title1}
                  </h1>
                  <h2 className="font-heading font-bold text-lg sm:text-xl md:text-3xl mt-0.5 mb-1.5 md:mt-1 md:mb-3 opacity-95">
                    {slide.title2}
                  </h2>
                  <p className={`text-xs sm:text-sm md:text-base mb-4 md:mb-6 ${isLight ? 'text-blue-100' : 'text-muted'}`}>
                    {slide.subtitle}
                  </p>
                  <Link
                    to={slide.ctaTo}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 md:px-7 md:py-3.5 rounded-xl font-semibold text-sm md:text-base shadow-lg transition-all hover:scale-[1.03] ${
                      slide.ctaVariant === 'cta'
                        ? 'bg-cta text-white hover:bg-cta-dark'
                        : 'bg-primary text-white hover:bg-primary-600'
                    }`}
                  >
                    {slide.cta} →
                  </Link>
                </div>
                {/* Mobile image: small, right-aligned */}
                <div className="flex justify-end items-end px-5 pb-5 md:hidden">
                  <HeroImage
                    image={slide.image}
                    alt={slide.title1}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                    fetchPriority={isFirstSlide ? 'high' : 'auto'}
                    className="h-[110px] object-contain drop-shadow-xl"
                  />
                </div>
                {/* Desktop image */}
                <div className="relative hidden md:flex items-center justify-center h-full">
                  <HeroImage
                    image={slide.image}
                    alt={slide.title1}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                    fetchPriority={isFirstSlide ? 'high' : 'auto'}
                    className="max-h-[360px] object-contain drop-shadow-2xl"
                  />
                  {slide.floatingBadges?.map((b, i) => (
                    <div key={i} className={`absolute ${b.classes} px-3 py-1.5 rounded-full text-xs font-bold shadow-lg`}>
                      {b.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LEFT-IMAGE layout */}
            {slide.layout === 'left-image' && (
              <div className="flex flex-col-reverse md:grid md:grid-cols-5 md:h-[440px] md:items-center md:gap-6 md:px-12">
                <div className="md:col-span-2 hidden md:flex items-center justify-center h-full">
                  <HeroImage
                    image={slide.image}
                    alt={slide.title1}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                    fetchPriority={isFirstSlide ? 'high' : 'auto'}
                    className="max-h-[340px] object-contain drop-shadow-xl"
                  />
                </div>
                <div className="md:col-span-3 text-ink px-5 pt-6 pb-3 md:p-0">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold mb-2 md:mb-4 bg-primary-50 text-primary">
                    {slide.badge}
                  </span>
                  <h1 className="font-heading font-extrabold text-2xl sm:text-3xl md:text-5xl leading-tight">
                    {slide.title1}
                  </h1>
                  <h2 className="font-heading font-bold text-lg sm:text-xl md:text-4xl mt-0.5 mb-1.5 md:mt-1 md:mb-3 text-primary">
                    {slide.title2}
                  </h2>
                  <p className="text-muted text-xs sm:text-sm md:text-base mb-4 md:mb-6">{slide.subtitle}</p>
                  <Link
                    to={slide.ctaTo}
                    className="inline-flex items-center gap-2 px-5 py-2.5 md:px-7 md:py-3.5 rounded-xl font-semibold text-sm md:text-base bg-primary text-white hover:bg-primary-600 shadow-lg transition-all hover:scale-[1.03]"
                  >
                    {slide.cta} →
                  </Link>
                </div>
                {/* Mobile image for left-image */}
                <div className="flex justify-end items-end px-5 pb-5 md:hidden">
                  <HeroImage
                    image={slide.image}
                    alt={slide.title1}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                    fetchPriority={isFirstSlide ? 'high' : 'auto'}
                    className="h-[100px] object-contain drop-shadow-xl"
                  />
                </div>
              </div>
            )}

            {/* CENTER layout */}
            {slide.layout === 'center' && (
              <div className="flex flex-col md:flex-row md:h-[440px] md:items-center md:justify-center md:text-center md:px-12">
                <div className="flex flex-col items-center text-center px-5 pt-6 pb-3 md:p-0 flex-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold mb-2 md:mb-3 bg-cta text-white">
                    <ZapIcon size={12} /> {slide.badge}
                  </span>
                  <h1 className="font-heading font-bold text-2xl sm:text-3xl md:text-5xl text-ink">
                    {slide.title1}
                  </h1>
                  <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-8xl text-cta leading-none mt-0.5 mb-1.5 md:mb-3">
                    {slide.title2}
                  </h1>
                  <p className="text-muted text-xs sm:text-sm md:text-base mb-3 md:mb-5">{slide.subtitle}</p>
                  <Link
                    to={slide.ctaTo}
                    className="inline-flex items-center gap-2 px-5 py-2.5 md:px-7 md:py-3.5 rounded-xl font-semibold text-sm md:text-base bg-cta text-white hover:bg-cta-dark shadow-lg transition-all hover:scale-[1.03]"
                  >
                    {slide.cta} →
                  </Link>
                </div>
                {/* Mobile image for center */}
                <div className="flex justify-center pb-4 md:hidden">
                  <HeroImage
                    image={slide.image}
                    alt={slide.title1}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                    fetchPriority={isFirstSlide ? 'high' : 'auto'}
                    className="h-[90px] object-contain drop-shadow-xl"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Arrows — only on desktop */}
        <button
          onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md items-center justify-center text-ink transition-all z-10"
          aria-label="Previous"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          onClick={() => setIndex((i) => (i + 1) % slides.length)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md items-center justify-center text-ink transition-all z-10"
          aria-label="Next"
        >
          <ChevronRightIcon size={18} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? `w-6 ${isLight ? 'bg-white' : 'bg-primary'}`
                  : `w-1.5 ${isLight ? 'bg-white/50' : 'bg-gray-400'}`
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}