"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import InvoiceDocument from '../../../../components/InvoiceDocument';
import { useAuth } from '../../../../context/AuthContext';
import { getAdminOrder, getOrder, normalizeOrder } from '../../../../lib/api';

export default function InvoicePage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || authLoading) return;
    const loadOrder = user?.is_superuser
      ? getAdminOrder(id)
      : getOrder(id).then(normalizeOrder);

    loadOrder
      .then(setOrder)
      .catch((err) => setError(err.message || 'Invoice unavailable.'));
  }, [authLoading, id, user?.is_superuser]);

  if (authLoading || (!order && !error)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-red-600">{error}</div>;
  }

  return (
    <InvoiceDocument
      order={order}
      backHref={user?.is_superuser ? '/admin/dashboard' : `/orders/${order.id}`}
      backLabel={user?.is_superuser ? 'Admin Dashboard' : 'Order Details'}
    />
  );
}
