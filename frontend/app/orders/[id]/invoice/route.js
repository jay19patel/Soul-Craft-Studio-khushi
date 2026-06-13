import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getOrder, getAdminOrder } from '../../../../lib/serverActions';
import { generateInvoicePdf } from '../../../../lib/pdf';
import { normalizeOrder } from '../../../../lib/api';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Fetch order
    let order;
    if (user.is_superuser) {
      order = await getAdminOrder(id);
    } else {
      const rawOrder = await getOrder(id);
      order = normalizeOrder(rawOrder);
      
      // Ensure the order belongs to this user
      if (!order || String(order.user_id) !== String(user.id)) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    if (!order) {
      return new NextResponse('Order not found', { status: 404 });
    }

    // 3. Generate PDF
    const pdfBuffer = await generateInvoicePdf(order);
    
    // 4. Return Direct PDF Response for download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Soul-Craft-Studio-Invoice-${order.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Invoice Route Handler error:', err);
    return new NextResponse(err.message || 'Internal Server Error', { status: 500 });
  }
}
