"""PDF invoice generation using ReportLab."""
from __future__ import annotations

import logging
from io import BytesIO

logger = logging.getLogger(__name__)


def generate_invoice_pdf(order) -> bytes:
    """Generate a clean A4 PDF invoice for the given order. Returns raw bytes."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buffer = BytesIO()
    W = A4[0] - 40 * mm  # usable width

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )

    def s(name: str, **kw) -> ParagraphStyle:
        return ParagraphStyle(name, **kw)

    brand_s  = s("brand",  fontSize=26, fontName="Helvetica-Bold",  textColor=colors.HexColor("#4f46e5"))
    inv_s    = s("inv",    fontSize=18, fontName="Helvetica-Bold",  textColor=colors.HexColor("#1e293b"), alignment=TA_RIGHT)
    lbl_s    = s("lbl",    fontSize=9,  fontName="Helvetica",       textColor=colors.HexColor("#94a3b8"))
    val_s    = s("val",    fontSize=11, fontName="Helvetica-Bold",  textColor=colors.HexColor("#1e293b"))
    small_s  = s("small",  fontSize=9,  fontName="Helvetica",       textColor=colors.HexColor("#64748b"))
    footer_s = s("footer", fontSize=9,  fontName="Helvetica",       textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER)
    sec_s    = s("sec",    fontSize=9,  fontName="Helvetica-Bold",  textColor=colors.HexColor("#94a3b8"), spaceBefore=8)

    story = []

    # ── Header: brand + invoice number ──
    hdr = Table([[Paragraph("KHUSI", brand_s), Paragraph(f"INVOICE #{order.id}", inv_s)]],
                colWidths=[W * 0.5, W * 0.5])
    hdr.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",  (1, 0), (1,   0), "RIGHT"),
    ]))
    story += [hdr, Spacer(1, 4 * mm),
              HRFlowable(width="100%", thickness=2, color=colors.HexColor("#4f46e5")),
              Spacer(1, 6 * mm)]

    # ── Meta row ──
    pay_color = {"VERIFIED": "#16a34a", "PENDING": "#d97706",
                 "RECEIVED": "#2563eb", "FAILED": "#dc2626",
                 "REJECTED": "#dc2626"}.get(order.payment_status, "#64748b")

    meta = Table([
        [Paragraph("Date",         lbl_s), Paragraph("Order Status",  lbl_s), Paragraph("Payment", lbl_s)],
        [Paragraph(order.created_at.strftime("%B %d, %Y"), val_s),
         Paragraph(order.get_status_display(), val_s),
         Paragraph(order.payment_status,
                   s("ps", fontSize=11, fontName="Helvetica-Bold",
                     textColor=colors.HexColor(pay_color)))],
    ], colWidths=[W * 0.35, W * 0.35, W * 0.30])
    meta.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "LEFT"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [meta, Spacer(1, 6 * mm),
              HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")),
              Spacer(1, 6 * mm)]

    # ── Bill To ──
    customer_name = (
        order.customer_name
        or (order.user.get_full_name() if order.user else "")
        or (order.user.username if order.user else "N/A")
    )
    customer_email = order.customer_email or (order.user.email if order.user else "")
    addr = ", ".join(filter(None, [order.shipping_address, order.city, order.state, order.pincode]))

    story.append(Paragraph("BILL TO", sec_s))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(customer_name, s("cn", fontSize=14, fontName="Helvetica-Bold",
                                             textColor=colors.HexColor("#1e293b"))))
    if customer_email:    story.append(Paragraph(customer_email, small_s))
    if order.customer_phone: story.append(Paragraph(order.customer_phone, small_s))
    if addr:              story.append(Paragraph(addr, small_s))
    story += [Spacer(1, 8 * mm),
              HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")),
              Spacer(1, 6 * mm)]

    # ── Items table ──
    story.append(Paragraph("ORDER ITEMS", sec_s))
    story.append(Spacer(1, 3 * mm))

    rows = [["#", "Product", "Variant", "Qty", "Unit Price", "Total"]]
    for i, item in enumerate(order.items.all(), 1):
        name    = item.variant.product.name if item.variant else "Deleted Product"
        variant = ""
        if item.variant:
            parts = []
            if item.variant.size:  parts.append(f"Size: {item.variant.size}")
            if item.variant.color: parts.append(f"Color: {item.variant.color}")
            variant = ", ".join(parts) or "-"
        unit  = float(item.price)
        total = unit * item.quantity
        rows.append([str(i), name, variant, str(item.quantity),
                     f"\u20b9{unit:,.2f}", f"\u20b9{total:,.2f}"])

    col_w = [W * 0.05, W * 0.30, W * 0.25, W * 0.08, W * 0.16, W * 0.16]
    tbl = Table(rows, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1,  0), colors.HexColor("#f1f5f9")),
        ("TEXTCOLOR",     (0, 0), (-1,  0), colors.HexColor("#64748b")),
        ("FONTNAME",      (0, 0), (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1,  0), 9),
        ("ALIGN",         (0, 0), (-1,  0), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1,  0), 8),
        ("BOTTOMPADDING", (0, 0), (-1,  0), 8),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 10),
        ("ALIGN",         (0, 1), (0,  -1), "CENTER"),
        ("ALIGN",         (3, 1), (3,  -1), "CENTER"),
        ("ALIGN",         (4, 1), (-1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEBELOW",     (0, 0), (-1,  0), 1.5, colors.HexColor("#e2e8f0")),
    ]))
    story += [tbl, Spacer(1, 4 * mm)]

    # ── Total ──
    total_amount = float(order.total_amount)
    tot = Table([["", "TOTAL AMOUNT", f"\u20b9{total_amount:,.2f}"]],
                colWidths=[W * 0.60, W * 0.22, W * 0.18])
    tot.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#ede9fe")),
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 13),
        ("TEXTCOLOR",     (1, 0), (-1, -1), colors.HexColor("#4f46e5")),
        ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story += [tot, Spacer(1, 10 * mm),
              HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")),
              Spacer(1, 4 * mm),
              Paragraph("Thank you for shopping with Khusi! For queries, reply to this email.", footer_s)]

    doc.build(story)
    return buffer.getvalue()
