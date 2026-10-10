"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProducts, getCategories, normalizeProduct } from '../../lib/api';
import { Search, X, ChevronDown, Tag, RotateCcw } from 'lucide-react';
import ProductCard from '../../components/ProductCard';

const SHOP_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 450;

// ── Skeleton card shown while loading ─────────────────────────────────────
const SkeletonCard = () => (
  <div className="flex flex-col gap-4 w-full animate-pulse">
    <div className="aspect-square rounded-3xl md:rounded-[32px] bg-slate-100" />
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

  const handleResetAllFilters = () => {
    setSearchInput('');
    updateQuery({
      category_id: null,
      search: null,
      sort: null,
      discount: null,
    }, { replace: true });
  };

  const hasActiveFilters = Boolean(
    (selectedCategory && selectedCategory !== 'all') ||
    search ||
    discountOnly ||
    (sortBy && sortBy !== 'newest')
  );

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

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8 md:py-20">
        {/* Header */}
        <div className="text-center mb-8 md:mb-16 flex flex-col gap-3 md:gap-4">
          <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">
            Discover Our Collection
          </span>
          <h1 className="text-3xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 md:mb-6">
            Soul Craft <span className="text-blue-600">Shop.</span>
          </h1>
          <p className="hidden md:block text-slate-500 max-w-2xl mx-auto text-lg font-sans">
            Explore our complete collection of handcrafted wool art, apparel, and
            decorations. Each piece is made with love and attention to detail.
          </p>
          {!loading && !error && (
            <div className="mt-2 md:mt-8 px-6 py-2 bg-white/50 backdrop-blur-sm rounded-full border border-slate-100 inline-block mx-auto text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Showing {products.length} of {totalCount} Products
            </div>
          )}
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col gap-3 mb-8 md:mb-14">
          <div className="grid grid-cols-2 md:flex md:flex-row items-center gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative col-span-2 flex-grow md:max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full h-12 pl-11 pr-10 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-slate-300 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="relative col-span-1 min-w-[140px] md:min-w-[170px]">
              <select
                value={selectedCategory}
                onChange={(e) => handleSelectCategory(e.target.value)}
                className="w-full h-12 pl-4 pr-10 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-slate-300 transition-all truncate"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative col-span-1 min-w-[140px] md:min-w-[170px]">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full h-12 pl-4 pr-10 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-slate-300 transition-all truncate"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Discounted Only Filter Pill */}
            <button
              type="button"
              onClick={() => handleDiscountToggle(!discountOnly)}
              className={`col-span-2 md:col-span-auto h-12 px-5 rounded-full font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-[0.98] ${
                discountOnly
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 border border-orange-500 ring-2 ring-orange-200'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 shadow-sm'
              }`}
              aria-pressed={discountOnly}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                  discountOnly ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'
                }`}
              >
                <Tag className="w-3 h-3 stroke-[2.5]" />
              </span>
              <span>Discounted Only</span>
              {discountOnly && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="col-span-2 md:col-span-auto h-12 px-4 rounded-full text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 font-bold">{error}</p>
            <button
              onClick={() => fetchProducts(false)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!error && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : products.map((product) => <ProductCard key={product.id} product={product} />)}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
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
