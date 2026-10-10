"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminActivity } from '../../../lib/api';
import { Card, PageHeader, Spinner, EmptyState, Pagination, Pill, useToast, formatDateTime } from '../../../components/admin/ui';

const PAGE_SIZE = 30;
const FILTERS = [
  ['', 'Everything'],
  ['order', 'Orders & payments'],
  ['product', 'Products'],
  ['settings', 'Settings'],
  ['testimonial', 'Reviews'],
  ['user', 'Customers'],
];

const ENTITY_LINK = {
  order: (id) => `/admin/orders/${id}`,
  product: (id) => `/admin/products/${id}`,
};

export default function AdminActivityPage() {
  const toast = useToast();
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    getAdminActivity({ entity_type: entity, page, page_size: PAGE_SIZE })
      .then(setData)
      .catch((err) => toast(err.message, 'error'));
  }, [entity, page, toast]);

  return (
    <>
      <PageHeader title="Activity log" subtitle="Who changed what, and when — admin actions, payments and automatic system events" />
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => { setEntity(k); setPage(1); }} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${entity === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
        ))}
      </div>
      <Card padded={false}>
        {!data ? <Spinner /> : data.results.length === 0 ? <EmptyState title="No activity yet" /> : (
          <ul className="divide-y divide-slate-100">
            {data.results.map((a) => {
              const link = a.entity_id && ENTITY_LINK[a.entity_type]?.(a.entity_id);
              const who = a.actor?.type === 'admin' ? a.actor.email : a.actor?.type === 'customer' ? 'Customer' : a.actor?.type || 'System';
              return (
                <li key={a.id} className="px-4 md:px-6 py-3 flex items-start gap-3">
                  <Pill tone={a.actor?.type === 'admin' ? 'indigo' : a.actor?.type === 'customer' ? 'blue' : 'slate'}>{who}</Pill>
                  <div className="flex-1 min-w-0">
                    {link ? <Link href={link} className="text-sm text-slate-800 hover:text-indigo-600">{a.message}</Link> : <p className="text-sm text-slate-800">{a.message}</p>}
                    <p className="text-[11px] text-slate-400">{formatDateTime(a.created_at)} · {a.action}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data && (
          <div className="px-4 md:px-6 pb-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>
    </>
  );
}
