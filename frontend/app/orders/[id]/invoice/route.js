import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../lib/server/core';
import { loadOrder } from '../../../../lib/server/orders';
import { generateInvoicePdf } from '../../../../lib/pdf';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.redirect(new URL(`/login?redirect=/orders/${encodeURIComponent(id)}`, request.url));
    }

    const order = await loadOrder(id);
    // Same response for "missing" and "not yours" so order ids can't be probed.
    if (!order || (!user.is_superuser && String(order.user_id) !== String(user.id))) {
      return new NextResponse('Order not found', { status: 404 });
    }

    const pdfBuffer = await generateInvoicePdf(order);
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${order.order_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Invoice Route Handler error:', err);
    return new NextResponse('Could not generate the invoice right now.', { status: 500 });
  }
}
