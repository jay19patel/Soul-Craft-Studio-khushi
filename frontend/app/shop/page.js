"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProducts, getCategories, normalizeProduct } from '../../lib/api';
import { Search, X } from 'lucide-react';

const SHOP_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 450;
const FILTER_CONTROL_CLASS = 'bg-white border border-slate-100 rounded-full py-3 text-sm text-slate-600 shadow-sm focus:ring-2 focus:ring-orange-400 outline-none transition-shadow';

// ── Skeleton card shown while loading ─────────────────────────────────────
const SkeletonCard = () => (
  <div className="flex flex-col gap-6 w-full animate-pulse">
    <div className="aspect-square rounded-[32px] bg-slate-100" />
    <div className="flex flex-col gap-2 px-1">
      <div className="h-4 bg-slate-100 rounded-full w-3/4" />
      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
    </div>
  </div>
);

// ── Main content ────────────────────────────────────────────────────────────
const ShopPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get('category_id') || 'all';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const discountOnly = searchParams.get('discount') === 'true';

  const [searchInput, setSearchInput] = useState(search);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Load categories once
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Keep the search input in sync when the URL changes from elsewhere
  // (e.g. browser back/forward, or clearing filters).
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Merges the given updates into the current URL query string.
  // Passing `null`/`''`/`'all'`/`false` for a key removes it from the URL.
  const updateQuery = useCallback((updates, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all' || value === false) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const qs = next.toString();
    const url = `/shop${qs ? `?${qs}` : ''}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [router, searchParams]);

  const handleSelectCategory = (categoryId) => {
    updateQuery({ category_id: categoryId });
  };

  const handleSearchChange = (value) => {
    setSearchInput(value);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateQuery({ search: null }, { replace: true });
  };

  const handleSortChange = (value) => {
    updateQuery({ sort: value === 'newest' ? null : value });
  };

  const handleDiscountToggle = (checked) => {
    updateQuery({ discount: checked ? 'true' : null });
  };

  // Debounce typing in the search box before it hits the URL/server.
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      updateQuery({ search: searchInput.trim() || null }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Re-fetch products locally or from server
  const fetchProducts = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setPage(1); // Reset to first page on filter change
    }
    setError(null);

    try {
      const params = { page: isLoadMore ? page + 1 : 1, page_size: SHOP_PAGE_SIZE };
      if (selectedCategory !== 'all') params.category_id = selectedCategory;
      if (search) params.search = search;
      if (sortBy !== 'newest') params.sort_by = sortBy;
      if (discountOnly) params.discount_only = true;

      const data = await getProducts(params);
      const newProducts = (data?.results ?? []).map(normalizeProduct);

      if (isLoadMore) {
        setProducts(prev => [...prev, ...newProducts]);
        setPage(prev => prev + 1);
      } else {
        setProducts(newProducts);
        setPage(1);
      }
      setTotalCount(data?.total ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load products.');
      if (!isLoadMore) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, search, sortBy, discountOnly, page]);

  // Initial load and whenever a filter changes
  useEffect(() => {
    fetchProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, search, sortBy, discountOnly]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-16 flex flex-col gap-4">
          <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">
            Discover Our Collection
          </span>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-6">
            Soul Craft <span className="text-blue-600">Shop.</span>
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-sans">
            Explore our complete collection of handcrafted wool art, apparel, and
            decorations. Each piece is made with love and attention to detail.
          </p>
          {!loading && !error && (
            <div className="mt-8 px-6 py-2 bg-white/50 backdrop-blur-sm rounded-full border border-slate-100 inline-block mx-auto text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Showing {products.length} of {totalCount} Products
            </div>
          )}
        </div>

        {/* Filters Toolbar — search, category, sort & discount, all in one consistent style */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-16 px-4">
          <div className="relative flex-grow md:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or description..."
              className={`w-full pl-10 pr-10 ${FILTER_CONTROL_CLASS}`}
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-600 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => handleSelectCategory(e.target.value)}
            className={`px-5 font-bold cursor-pointer ${FILTER_CONTROL_CLASS}`}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className={`px-5 font-bold cursor-pointer ${FILTER_CONTROL_CLASS}`}
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>

          <label className={`flex items-center gap-2 px-5 font-bold cursor-pointer whitespace-nowrap ${FILTER_CONTROL_CLASS}`}>
            <input
              type="checkbox"
              checked={discountOnly}
              onChange={(e) => handleDiscountToggle(e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
            />
            Discounted Only
          </label>
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 font-bold">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : products.map((product) => (
                  <div key={product.id} className="group flex flex-col gap-6 w-full">
                    {/* Image */}
                    <Link
                      href={`/shop/${product.id}`}
                      className="block aspect-square relative rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500"
                    >
                      {product.tag && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                          {product.tag}
                        </div>
                      )}
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex flex-col gap-2 px-1">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight group-hover:text-orange-500 transition-colors truncate pr-2">
                          <Link href={`/shop/${product.id}`}>{product.name}</Link>
                        </h3>
                        <div className="flex flex-col items-end">
                          {product.discount > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs line-through text-slate-400 font-sans leading-none">
                                ₹{product.priceValue}
                              </span>
                              <span className="text-base font-black text-orange-600 font-sans whitespace-nowrap mt-1">
                                ₹{Math.round(product.priceValue * (1 - product.discount / 100))}
                              </span>
                            </div>
                          ) : (
                            <span className="text-base font-black text-slate-700 font-sans whitespace-nowrap">
                              {product.priceDisplay}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
                        </span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          {categories.find((c) => c.id === product.category_id)?.name?.split(' ')[0] ?? ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}

        {/* Load More */}
        {!loading && !error && products.length < totalCount && (
          <div className="mt-20 flex justify-center">
            <button
              onClick={() => fetchProducts(true)}
              disabled={loadingMore}
              className="px-12 py-4 bg-white border-2 border-slate-200 text-blue-950 rounded-full text-sm font-black uppercase tracking-widest hover:bg-slate-50 hover:border-blue-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg shadow-slate-100 group"
            >
              {loadingMore ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading More...
                </>
              ) : (
                <>
                  Load More Designs
                  <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500">
              {search
                ? <>We couldn&apos;t find any products matching &ldquo;{search}&rdquo;.</>
                : "We couldn't find any products matching these filters."}
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

const ShopPageFallback = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col">
    <Navbar />
    <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </main>
    <Footer />
  </div>
);

const ShopPage = () => (
  <Suspense fallback={<ShopPageFallback />}>
    <ShopPageContent />
  </Suspense>
);

export default ShopPage;
