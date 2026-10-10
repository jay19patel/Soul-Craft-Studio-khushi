"use client";

import React, { useEffect, useState } from 'react';
import { Mail, Trash2, Reply, MessageCircle } from 'lucide-react';
import { getAdminMessages, updateAdminMessage, deleteAdminMessage } from '../../../lib/api';
import { Card, PageHeader, Spinner, EmptyState, Pill, Button, useToast, formatDateTime } from '../../../components/admin/ui';

export default function AdminMessagesPage() {
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [filter, setFilter] = useState('unread');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    getAdminMessages()
      .then((m) => {
        setMessages(m);
        if (!m.some((x) => !x.is_read)) setFilter('all');
      })
      .catch((err) => toast(err.message, 'error'));
  }, [toast]);

  const markRead = async (m, is_read) => {
    try {
      await updateAdminMessage(m.id, { is_read });
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, is_read } : x)));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggle = (m) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.is_read) markRead(m, true);
  };

  const remove = async (m) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteAdminMessage(m.id);
      setMessages((list) => list.filter((x) => x.id !== m.id));
      toast('Message deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!messages) return <Spinner />;
  const unread = messages.filter((m) => !m.is_read).length;
  const visible = filter === 'unread' ? messages.filter((m) => !m.is_read) : messages;

  return (
    <>
      <PageHeader title="Messages" subtitle={`${unread} unread · ${messages.length} total`} />
      <div className="flex gap-2 mb-4">
        {['unread', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-bold border ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            {f === 'unread' ? `Unread (${unread})` : 'All'}
          </button>
        ))}
      </div>
      <Card padded={false}>
        {visible.length === 0 ? (
          <EmptyState title="Inbox zero 🎉" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((m) => (
              <li key={m.id}>
                <button onClick={() => toggle(m)} className="w-full text-left px-4 md:px-6 py-3.5 flex items-start gap-3 hover:bg-slate-50">
                  <Mail className={`w-5 h-5 mt-0.5 shrink-0 ${m.is_read ? 'text-slate-300' : 'text-indigo-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`truncate ${m.is_read ? 'font-semibold text-slate-700' : 'font-black text-slate-900'}`}>{m.name}</span>
                      {!m.is_read && <Pill tone="indigo">New</Pill>}
                    </div>
                    <p className="text-sm text-slate-600 truncate">{m.subject}</p>
                    <p className="text-[11px] text-slate-400">{formatDateTime(m.created_at)}</p>
                  </div>
                </button>
                {openId === m.id && (
                  <div className="px-4 md:px-14 pb-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4">{m.message}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                        <Button size="sm"><Reply className="w-4 h-4" /> Reply by email</Button>
                      </a>
                      <Button size="sm" variant="secondary" onClick={() => markRead(m, false)}>Mark unread</Button>
                      <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(m)}><Trash2 className="w-4 h-4" /> Delete</Button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {m.email}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
