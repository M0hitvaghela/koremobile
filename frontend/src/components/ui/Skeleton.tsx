import React from 'react';
export function Skeleton({ className = '' }: {className?: string;}) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>);

}
export function ProductCardSkeletonGrid({ count = 6 }: {count?: number;}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({
        length: count
      }).map((_, i) =>
      <ProductCardSkeleton key={i} />
      )}
    </div>);

}