# Advanced E-commerce API Documentation

Base URL: `http://localhost:8000/api/`

## 1. Categories API

Endpoint: `/api/categories/`
Methods: `GET`

### List Categories
Returns a list of all top-level categories and their children.
**Method:** `GET`
**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic items",
    "parent": null,
    "children": [
      {
        "id": 2,
        "name": "Mobile Phones",
        "slug": "mobile-phones",
        "description": "Smartphones",
        "parent": 1,
        "children": [],
        "created_at": "2026-05-23T12:00:00Z",
        "updated_at": "2026-05-23T12:00:00Z"
      }
    ],
    "created_at": "2026-05-23T12:00:00Z",
    "updated_at": "2026-05-23T12:00:00Z"
  }
]
```

## 2. Products API

Endpoint: `/api/products/`
Methods: `GET`

### List Products
Returns all active products with their images, variants, and categories.
**Method:** `GET`
**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "iPhone 15",
    "slug": "iphone-15",
    "description": "Apple iPhone 15",
    "base_price": "799.00",
    "is_active": true,
    "category": {
      "id": 2,
      "name": "Mobile Phones",
      "slug": "mobile-phones",
      "description": "Smartphones",
      "parent": 1,
      "children": [],
      "created_at": "2026-05-23T12:00:00Z",
      "updated_at": "2026-05-23T12:00:00Z"
    },
    "images": [
      {
        "id": 1,
        "image_url": "https://example.com/iphone.jpg",
        "is_primary": true
      }
    ],
    "variants": [
      {
        "id": 1,
        "sku": "IP15-BLK-128",
        "size": "128GB",
        "color": "Black",
        "price_override": null,
        "stock": 50
      }
    ],
    "created_at": "2026-05-23T12:00:00Z",
    "updated_at": "2026-05-23T12:00:00Z"
  }
]
```

## 3. Cart API

Endpoint: `/api/carts/`
Methods: `GET`, `POST`, `PUT`, `DELETE`

### Create a Cart
Create an empty cart for a session or user.
**Method:** `POST`
**Request Body:**
```json
{
  "user": null,
  "session_id": "sess_12345"
}
```
**Response:** `201 Created`
```json
{
  "id": 1,
  "user": null,
  "session_id": "sess_12345",
  "items": [],
  "created_at": "2026-05-23T12:00:00Z",
  "updated_at": "2026-05-23T12:00:00Z"
}
```

### Add Item to Cart
Add a product variant to the cart.
**Endpoint:** `/api/carts/{id}/add_item/`
**Method:** `POST`
**Request Body:**
```json
{
  "variant_id": 1,
  "quantity": 2
}
```
**Response:** `201 Created`
```json
{
  "id": 1,
  "variant": {
    "id": 1,
    "sku": "IP15-BLK-128",
    "size": "128GB",
    "color": "Black",
    "price_override": null,
    "stock": 50
  },
  "quantity": 2
}
```

### Checkout Cart to Order
**Endpoint:** `/api/carts/{id}/checkout/`
**Method:** `POST`
*Note: Requires Authentication.*
**Request Body:**
```json
{
  "shipping_address": "123 Main St, NY, USA"
}
```
**Response:** `201 Created`
```json
{
  "id": 1,
  "user": 1,
  "status": "PENDING",
  "total_amount": "1598.00",
  "shipping_address": "123 Main St, NY, USA",
  "items": [
    {
      "id": 1,
      "variant": {
        "id": 1,
        "sku": "IP15-BLK-128"
      },
      "quantity": 2,
      "price": "799.00"
    }
  ],
  "created_at": "2026-05-23T12:00:00Z",
  "updated_at": "2026-05-23T12:00:00Z"
}
```

## 4. Orders API

Endpoint: `/api/orders/`
Methods: `GET`
*Note: Requires Authentication.*

*(Orders are now created exclusively through the Cart checkout endpoint above. This endpoint is read-only.)*

### Get Order Details
**Method:** `GET` `/api/orders/{id}/`
**Response:** `200 OK`
```json
{
  "id": 1,
  "user": 1,
  "status": "PENDING",
  "total_amount": "1598.00",
  "shipping_address": "123 Main St, NY, USA",
  "items": [
    {
      "id": 1,
      "variant": {
        "id": 1,
        "sku": "IP15-BLK-128",
        "size": "128GB",
        "color": "Black",
        "price_override": null,
        "stock": 50
      },
      "quantity": 2,
      "price": "799.00"
    }
  ],
  "created_at": "2026-05-23T12:00:00Z",
  "updated_at": "2026-05-23T12:00:00Z"
}
```
