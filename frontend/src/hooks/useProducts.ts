import { useEffect, useMemo } from 'react';
import { useProductsStore } from '../store/productsStore';

export function useProducts(autoFetch = true) {
  const products = useProductsStore((s) => s.products);
  const loading = useProductsStore((s) => s.loading);
  const error = useProductsStore((s) => s.error);
  const total = useProductsStore((s) => s.total);
  const pages = useProductsStore((s) => s.pages);
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const deleteProduct = useProductsStore((s) => s.deleteProduct);
  const getById = useProductsStore((s) => s.getById);
  const getBySlug = useProductsStore((s) => s.getBySlug);
  const fetchProducts = useProductsStore((s) => s.fetchProducts);
  const fetchFeatured = useProductsStore((s) => s.fetchFeatured);

  // Auto-fetch featured products on first mount if store is empty
  useEffect(() => {
    if (autoFetch && products.length === 0 && !loading) {
      fetchFeatured();
    }
  }, []); // run once on mount

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active),
    [products]
  );

  const featuredProducts = useMemo(() => activeProducts.slice(0, 8), [activeProducts]);

  return {
    products,
    activeProducts,
    featuredProducts,
    loading,
    error,
    total,
    pages,
    addProduct,
    updateProduct,
    deleteProduct,
    getById,
    getBySlug,
    fetchProducts,
    fetchFeatured,
  };
}