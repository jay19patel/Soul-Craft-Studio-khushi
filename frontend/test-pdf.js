import { generateInvoicePdf } from './lib/pdf.js';

async function test() {
  console.log('Testing PDF Invoice generation with real fonts...');
  const mockOrder = {
    id: '12345',
    date: '2026-06-13',
    items: [
      { name: 'Test Product 1', quantity: 2, price: 150 },
      { name: 'Test Product 2', quantity: 1, price: 300 }
    ],
    customer_name: 'John Doe',
    shipping_address: '123 Main St, City, Country',
    customer_phone: '9876543210',
    payment_reference: 'UPI12345',
    upi_transaction_id: 'TXN9999',
    total_amount: 600
  };
  try {
    const pdfBuffer = await generateInvoicePdf(mockOrder);
    console.log('PDF generated successfully! Size:', pdfBuffer.length);
    console.log('Is PDF header valid (starts with %PDF):', pdfBuffer.toString('utf8', 0, 4) === '%PDF');
  } catch (err) {
    console.error('PDF generation FAILED with error:');
    console.error(err);
  }
}

test();
