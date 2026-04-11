# Backbone API Integration Guide for Frontend

This document provides a summary of the improved authentication and order notification APIs for integrating with the Next.js frontend.

## 1. Authentication Flow

### Registration
Consolidated registration email combines welcome and verification.
- **Endpoint**: `POST /api/auth/register`
- **Body**: `{ "email": "user@example.com", "password": "...", "full_name": "..." }`
- **Flow**: User registers -> Receives email with verification link -> Link hits Backend -> Backend redirects to Core Verification Page.

### Password Reset
- **Step 1: Request Reset**
  - **Endpoint**: `POST /api/auth/password-reset/request`
  - **Body**: `{ "email": "user@example.com" }`
  - **Effect**: If the user exists, they receive an email with a link to the Core Reset Confirmation Page.
- **Step 2: Core Reset Confirmation**
  - Served at: `/pages/reset-password/confirm?token=...`
  - This page is handled by Backbone core and allows the user to set a new password.

### Email Verification
- Core Page: `/pages/verify-status?token=...&success=true`
- This page displays the result of the verification process.

## 2. Order Notifications

### Order Placement
When an order is created (via `/api/orders` POST), the system automatically:
1. Logs the event.
2. Generates a PDF invoice.
3. Sends an "Order Confirmation" email to the customer with the invoice attached.

### Status Updates
When an order status is updated (e.g., via Admin panel or API PATCH):
1. The system detects the status change.
2. Sends an "Order Status Updated" email to the customer.

## 3. Template Customization
You can override any of these core templates by creating files in `backend/templates/email/`:
- `welcome_verification.html`
- `order_confirmation.html`
- `order_status_update.html`
- `pdf/invoice.html`

## 4. User Guide
A live user guide is accessible at `/pages/user-guide` on your backend server.
