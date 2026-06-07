"""PDF invoice generation using ReportLab."""
from __future__ import annotations

from decimal import Decimal
from io import BytesIO
from pathlib import Path


def generate_invoice_pdf(order) -> bytes:
    """Generate an email-safe invoice PDF mirroring the customer invoice view."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image
    from reportlab.platypus import (
        HRFlowable,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = BytesIO()
    usable_width = A4[0] - (40 * mm)
    ink = colors.HexColor("#302d2a")
    muted = colors.HexColor("#716b64")
    border = colors.HexColor("#e7e2d9")
    paper = colors.HexColor("#faf9f6")
    accent = colors.HexColor("#c65d30")

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=17 * mm,
        bottomMargin=17 * mm,
    )

    def style(name: str, **kwargs) -> ParagraphStyle:
        return ParagraphStyle(name, **kwargs)

    brand = style(
        "brand", fontName="Times-Bold", fontSize=28, leading=34, textColor=accent, alignment=TA_CENTER
    )
    tagline = style("tagline", fontName="Helvetica", fontSize=8, textColor=muted, alignment=TA_CENTER, leading=12)
    title = style("title", fontName="Helvetica-Bold", fontSize=22, textColor=ink, alignment=TA_CENTER, leading=28)
    heading = style("heading", fontName="Helvetica-Bold", fontSize=12, textColor=ink, leading=15)
    label = style("label", fontName="Helvetica", fontSize=9, textColor=muted, leading=13)
    value = style("value", fontName="Helvetica-Bold", fontSize=9.5, textColor=ink, leading=13)
    value_right = style("value_right", parent=value, alignment=TA_RIGHT)
    body = style("body", fontName="Helvetica", fontSize=9, textColor=ink, leading=13)
    body_right = style("body_right", parent=body, alignment=TA_RIGHT)
    footer = style("footer", fontName="Helvetica", fontSize=8, textColor=muted, alignment=TA_CENTER, leading=12)

    customer_name = (
        order.customer_name
        or (order.user.get_full_name() if order.user else "")
        or (order.user.username if order.user else "Customer")
    )
    customer_email = order.customer_email or (order.user.email if order.user else "")
    destination = order.shipping_address or ", ".join(
        part for part in [order.city, order.state, order.pincode] if part
    )

    story = []
    logo_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "logo.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=18 * mm, height=18 * mm)
        logo.hAlign = "CENTER"
        story.extend([logo, Spacer(1, 3 * mm)])

    story.extend([
        Paragraph("Soul Craft Studio", brand),
        Spacer(1, 2 * mm),
        Paragraph("HANDCRAFTED WITH LOVE", tagline),
        Spacer(1, 8 * mm),
        Paragraph("Invoice", title),
        Spacer(1, 8 * mm),
    ])

    summary = Table(
        [
            [Paragraph("Invoice number", label), Paragraph("Invoice date", label)],
            [
                Paragraph(f"SCS-{order.id}", value),
                Paragraph(order.created_at.strftime("%d %b %Y"), value),
            ],
        ],
        colWidths=[usable_width / 2] * 2,
    )
    summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), paper),
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, 0), 11),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 13),
    ]))
    story += [summary, Spacer(1, 9 * mm), Paragraph("Order details", heading), Spacer(1, 4 * mm)]

    item_rows = [[
        Paragraph("Description", label),
        Paragraph("Qty", label),
        Paragraph("Unit price", label),
        Paragraph("Amount", label),
    ]]
    for item in order.items.select_related("variant__product").all():
        product_name = item.variant.product.name if item.variant else "Product"
        variant_parts = []
        if item.variant and item.variant.size:
            variant_parts.append(item.variant.size)
        if item.variant and item.variant.color:
            variant_parts.append(item.variant.color)
        detail = product_name
        if variant_parts:
            detail += "<br/><font color='#716b64' size='8'>" + " / ".join(variant_parts) + "</font>"
        amount = item.price * item.quantity
        item_rows.append([
            Paragraph(detail, body),
            Paragraph(str(item.quantity), body),
            Paragraph(f"Rs. {item.price:,.2f}", body_right),
            Paragraph(f"Rs. {amount:,.2f}", value_right),
        ])

    items = Table(item_rows, colWidths=[usable_width * .49, usable_width * .11, usable_width * .19, usable_width * .21])
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), paper),
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story += [items, Spacer(1, 5 * mm)]

    total_amount = Decimal(str(order.total_amount))
    story += [Spacer(1, 4 * mm)]

    contact_rows = [
        [Paragraph("Shipping address", heading), Paragraph("Payment details", heading)],
        [Paragraph(customer_name, value), Paragraph("Payment reference", label)],
        [Paragraph(destination or "Not provided", body), Paragraph(
            order.payment_reference or "Not provided", value
        )],
        [Paragraph(customer_email, body), Paragraph("UPI transaction ID", label)],
        [
            Paragraph(order.customer_phone, body) if order.customer_phone else "",
            Paragraph(order.upi_transaction_id or "Not provided", value),
        ],
        ["", Paragraph("Total amount", label)],
        ["", Paragraph(f"Rs. {total_amount:,.2f}", value)],
    ]
    contact = Table(contact_rows, colWidths=[usable_width * .55, usable_width * .45])
    contact.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("BACKGROUND", (0, 0), (-1, 0), paper),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story += [
        contact,
        Spacer(1, 12 * mm),
        HRFlowable(width="100%", thickness=0.7, color=border),
        Spacer(1, 5 * mm),
        Paragraph("Thank you for shopping with Soul Craft Studio. Keep this invoice for your records.", footer),
    ]

    doc.build(story)
    return buffer.getvalue()
