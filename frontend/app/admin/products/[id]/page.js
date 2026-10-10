"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProductEditor from '../../../../components/admin/ProductEditor';
import { Spinner } from '../../../../components/admin/ui';
import { getAdminProduct } from '../../../../lib/api';

export default function EditProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminProduct(id).then(setProduct).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="py-20 text-center flex flex-col gap-3">
        <p className="text-slate-600">{error}</p>
        <Link href="/admin/products" className="text-indigo-600 font-bold text-sm">Back to products</Link>
      </div>
    );
  }
  if (!product) return <Spinner />;
  return <ProductEditor key={product.id} product={product} />;
}
