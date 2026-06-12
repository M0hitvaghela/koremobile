import React from 'react';
import { StarIcon } from 'lucide-react';
interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  reviewCount?: number;
}
const sizeMap = {
  sm: 12,
  md: 14,
  lg: 18
};
export function StarRating({
  rating,
  size = 'sm',
  showNumber = false,
  reviewCount
}: StarRatingProps) {
  const px = sizeMap[size];
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({
          length: 5
        }).map((_, i) => {
          const filled = i < full;
          const half = i === full && hasHalf;
          return (
            <span
              key={i}
              className="relative inline-block"
              style={{
                width: px,
                height: px
              }}>
              
              <StarIcon
                size={px}
                className="text-gray-300"
                fill="currentColor" />
              
              {(filled || half) &&
              <span
                className="absolute inset-0 overflow-hidden"
                style={{
                  width: half ? '50%' : '100%'
                }}>
                
                  <StarIcon
                  size={px}
                  className="text-amber-400"
                  fill="currentColor" />
                
                </span>
              }
            </span>);

        })}
      </div>
      {showNumber &&
      <span className="text-xs font-semibold text-ink">
          {rating.toFixed(1)}
        </span>
      }
      {reviewCount !== undefined &&
      <span className="text-xs text-muted">
          ({reviewCount.toLocaleString('en-IN')})
        </span>
      }
    </div>);

}