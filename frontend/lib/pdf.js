import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generates a stylized e-commerce invoice PDF for an order.
 * @param {Object} order The normalized order object.
 * @returns {Promise<Buffer>} The generated PDF binary buffer.
 */
export async function generateInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    try {
      // Load and register Roboto fonts using raw buffers to bypass dynamic afm bundle issues
      const regularPath = path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf');
      const boldPath = path.join(process.cwd(), 'public/fonts/Roboto-Bold.ttf');
      
      const regularBuffer = fs.readFileSync(regularPath);
      const boldBuffer = fs.readFileSync(boldPath);

      const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      
      doc.registerFont('Roboto', regularBuffer);
      doc.registerFont('Roboto-Bold', boldBuffer);
      
      // Set font to Roboto first and manually add the first page to bypass standard Helvetica lookup
      doc.font('Roboto');
      doc.addPage();
      
      // Draw Header Logo / Title
      doc.fillColor('#c65d30')
         .font('Roboto-Bold')
         .fontSize(26)
         .text('Soul Craft Studio', { align: 'center' });
      
      doc.fillColor('#716b64')
         .font('Roboto')
         .fontSize(8)
         .text('HANDCRAFTED WITH LOVE', { align: 'center' });
      
      doc.moveDown(2);
      
      // Invoice Title
      doc.fillColor('#302d2a')
         .font('Roboto-Bold')
         .fontSize(18)
         .text('Invoice', { align: 'center' });
      
      doc.moveDown(1);
      
      // Metadata Details Grid
      const metaY = doc.y;
      doc.font('Roboto-Bold').fontSize(10);
      doc.fillColor('#302d2a');
      doc.text('Invoice Details', 40, metaY);
      doc.font('Roboto').fontSize(9).fillColor('#716b64');
      doc.text(`Invoice number: SCS-${order.id}`, 40, metaY + 15);
      doc.text(`Invoice date: ${order.date || new Date(order.created_at).toLocaleDateString('en-IN')}`, 40, metaY + 28);
      
      doc.moveDown(3);
      
      // Line Divider
      doc.strokeColor('#e7e2d9').lineWidth(1).moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      
      // Table Header
      const headerY = doc.y;
      doc.font('Roboto-Bold').fontSize(9).fillColor('#716b64');
      doc.text('Description', 40, headerY, { width: 250 });
      doc.text('Qty', 300, headerY, { width: 50, align: 'center' });
      doc.text('Unit Price', 360, headerY, { width: 80, align: 'right' });
      doc.text('Amount', 460, headerY, { width: 90, align: 'right' });
      
      doc.moveDown(0.5);
      doc.strokeColor('#e7e2d9').moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      
      // Table Items
      doc.font('Roboto').fontSize(9).fillColor('#302d2a');
      for (const item of order.items || []) {
        const productName = item.product?.name || item.name || 'Product';
        const quantity = item.quantity || 1;
        const price = Number(item.price || 0);
        const amount = price * quantity;
        
        const currentY = doc.y;
        
        doc.text(productName, 40, currentY, { width: 250 });
        doc.text(String(quantity), 300, currentY, { width: 50, align: 'center' });
        doc.text(`Rs. ${price.toFixed(2)}`, 360, currentY, { width: 80, align: 'right' });
        doc.text(`Rs. ${amount.toFixed(2)}`, 460, currentY, { width: 90, align: 'right' });
        
        doc.moveDown(1.2);
      }
      
      doc.strokeColor('#e7e2d9').moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      
      // Address and Payment Grid
      const gridY = doc.y;
      
      // Left: Shipping
      doc.font('Roboto-Bold').fontSize(10).fillColor('#302d2a');
      doc.text('Shipping Address', 40, gridY);
      doc.font('Roboto').fontSize(9);
      doc.text(order.customer_name || 'Customer Name', 40, gridY + 18, { width: 240 });
      doc.text(order.shipping_address || 'Shipping Address Detail', 40, gridY + 32, { width: 240 });
      if (order.customer_phone) {
        doc.text(`Phone: ${order.customer_phone}`, 40, gridY + 65);
      }
      
      // Right: Payments
      doc.font('Roboto-Bold').fontSize(10);
      doc.text('Payment Information', 300, gridY);
      doc.font('Roboto').fontSize(9).fillColor('#716b64');
      doc.text('Payment reference', 300, gridY + 18);
      doc.font('Roboto-Bold').fillColor('#302d2a').text(order.payment_reference || 'Pending', 300, gridY + 28);
      
      if (order.upi_transaction_id) {
        doc.font('Roboto').fillColor('#716b64').text('UPI transaction ID', 300, gridY + 45);
        doc.font('Roboto-Bold').fillColor('#302d2a').text(order.upi_transaction_id, 300, gridY + 55);
      }
      
      doc.font('Roboto').fillColor('#716b64').text('Total amount', 300, gridY + 75);
      doc.font('Roboto-Bold').fillColor('#c65d30').fontSize(12).text(`Rs. ${Number(order.total_amount).toFixed(2)}`, 300, gridY + 85);
      
      doc.moveDown(8);
      
      // Footer text
      doc.strokeColor('#e7e2d9').lineWidth(0.5).moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.8);
      
      doc.font('Roboto').fontSize(7.5).fillColor('#716b64').text('Thank you for shopping with Soul Craft Studio. Keep this invoice for your records.', { align: 'center' });
      
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
