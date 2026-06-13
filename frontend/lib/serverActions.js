"use server";

import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from './db';
import { verifyPassword, hashPassword, signToken, verifyToken } from './auth';
import { uploadFile } from './upload';
import { sendWelcomeEmail, sendOrderConfirmationEmail, sendOrderStatusEmail, sendPaymentStatusEmail } from './email';

// ── Common Helpers ──

async function setAuthCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

async function deleteAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}

function getFormattedDate(date = new Date()) {
  return date.toISOString();
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Returns a query object for MongoDB matching _id as string or ObjectId.
 */
function getQueryById(id) {
  if (!id) return { _id: null };
  const idStr = String(id);
  try {
    return { $or: [{ _id: idStr }, { _id: new ObjectId(idStr) }] };
  } catch (e) {
    return { _id: idStr };
  }
}

/**
 * Helper to resolve authenticated user from cookies in MongoDB context.
 */
export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  
  const db = await getDb();
  const user = await db.collection('users').findOne(getQueryById(payload.id));
  
  if (!user || !user.is_active) return null;
  
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    full_name: user.first_name,
    is_superuser: !!user.is_superuser
  };
}

// ── CATALOG FUNCTIONS ──

export async function getCategories() {
  const db = await getDb();
  const categories = await db.collection('categories').find().toArray();
  
  const categoryMap = {};
  categories.forEach(c => {
    const idStr = c._id.toString();
    categoryMap[idStr] = {
      id: idStr,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parent: c.parent_id ? String(c.parent_id) : null,
      image_url: c.image_url,
      created_at: c.created_at,
      updated_at: c.updated_at,
      children: []
    };
  });
  
  const rootCategories = [];
  Object.values(categoryMap).forEach(c => {
    if (c.parent === null || c.parent === undefined || c.parent === '') {
      rootCategories.push(c);
    } else if (categoryMap[c.parent]) {
      categoryMap[c.parent].children.push(c);
    }
  });
  
  return { results: rootCategories };
}

export async function createAdminCategory(categoryData) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const now = getFormattedDate();
  
  let c = categoryData;
  let uploadedImage = null;
  
  if (categoryData instanceof FormData) {
    c = {
      name: categoryData.get('name'),
      slug: categoryData.get('slug'),
      description: categoryData.get('description') || ''
    };
    
    // Handle image file upload if present
    const imageFile = categoryData.get('image');
    if (imageFile && typeof imageFile === 'object' && imageFile.name) {
      try {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = path.extname(imageFile.name) || '.jpeg';
        const filename = `categories/${crypto.randomUUID()}${ext}`;
        const imageUrl = await uploadFile(buffer, filename, imageFile.type || 'image/jpeg');
        uploadedImage = imageUrl;
      } catch (err) {
        console.error('Failed to upload category image:', err);
      }
    }
  }
  
  const lastCat = await db.collection('categories').find().sort({ _id: -1 }).limit(1).toArray();
  let nextId = "1";
  if (lastCat.length > 0) {
    const lastIdVal = parseInt(lastCat[0]._id);
    if (!isNaN(lastIdVal)) {
      nextId = String(lastIdVal + 1);
    } else {
      nextId = crypto.randomUUID();
    }
  }

  const newCategory = {
    _id: nextId,
    name: c.name,
    slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    description: c.description || '',
    image_url: uploadedImage || null,
    created_at: now,
    updated_at: now
  };
  
  await db.collection('categories').insertOne(newCategory);
  return { id: nextId, ...newCategory };
}

export async function updateAdminCategory(id, categoryData) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const now = getFormattedDate();
  
  let c = categoryData;
  let uploadedImage = null;
  
  if (categoryData instanceof FormData) {
    c = {
      name: categoryData.get('name') || undefined,
      slug: categoryData.get('slug') || undefined,
      description: categoryData.get('description') || undefined
    };
    
    // Handle image file upload if present
    const imageFile = categoryData.get('image');
    if (imageFile && typeof imageFile === 'object' && imageFile.name) {
      try {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = path.extname(imageFile.name) || '.jpeg';
        const filename = `categories/${crypto.randomUUID()}${ext}`;
        const imageUrl = await uploadFile(buffer, filename, imageFile.type || 'image/jpeg');
        uploadedImage = imageUrl;
      } catch (err) {
        console.error('Failed to upload category image:', err);
      }
    }
  }
  
  const updates = {};
  if (c.name !== undefined) updates.name = c.name;
  if (c.slug !== undefined) updates.slug = c.slug;
  if (c.description !== undefined) updates.description = c.description;
  if (uploadedImage !== null) updates.image_url = uploadedImage;
  updates.updated_at = now;
  
  await db.collection('categories').updateOne(getQueryById(id), { $set: updates });
  
  const updated = await db.collection('categories').findOne(getQueryById(id));
  return { id: updated._id.toString(), ...updated };
}

export async function deleteAdminCategory(id) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  
  // Update any products referencing this category to prevent orphans (default to category_id "1")
  await db.collection('products').updateMany(
    { category_id: String(id) },
    { $set: { category_id: "1" } }
  );
  
  await db.collection('categories').deleteOne(getQueryById(id));
  return { success: true };
}

export async function getTestimonials() {
  const db = await getDb();
  const testimonials = await db.collection('testimonials').find({ is_active: true }).toArray();
  return {
    results: testimonials.map(t => ({
      ...t,
      id: t._id.toString()
    }))
  };
}

export async function getProducts(params = {}) {
  const db = await getDb();
  const query = { is_active: true };
  
  // Support both params.category and params.category_id
  const targetCategory = params.category_id || params.category;
  if (targetCategory && targetCategory !== 'all') {
    // Find category by ID or slug
    const cat = await db.collection('categories').findOne({
      $or: [{ _id: String(targetCategory) }, { slug: String(targetCategory) }]
    });
    if (cat) {
      query.category_id = cat._id.toString();
    } else {
      query.category_id = String(targetCategory);
    }
  }
  
  if (params.search) {
    query.$or = [
      { name: { $regex: params.search, $options: 'i' } },
      { description: { $regex: params.search, $options: 'i' } }
    ];
  }
  
  const products = await db.collection('products').find(query).sort({ created_at: -1 }).toArray();
  
  const enrichedProducts = [];
  for (const p of products) {
    const cat = await db.collection('categories').findOne(getQueryById(p.category_id));
    
    // Sum variant stock to compute overall stock
    const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
    
    const primaryImageObj = (p.images || []).find(img => img.is_primary) || (p.images || [])[0] || null;
    const primary_image = primaryImageObj ? primaryImageObj.image_url : null;
    
    enrichedProducts.push({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      description: p.description,
      base_price: String(p.base_price),
      price_value: Number(p.base_price),
      discount: Number(p.discount || 0),
      is_active: !!p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      stock: totalStock,
      category: cat ? {
        id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug
      } : null,
      category_id: p.category_id,
      primary_image,
      image_url: primary_image,
      gallery_images: (p.images || []).map(img => img.image_url),
      images: (p.images || []).map(img => ({
        id: String(img.id),
        image_url: img.image_url,
        is_primary: !!img.is_primary
      })),
      variants: (p.variants || []).map(v => ({
        id: String(v.id),
        sku: v.sku,
        size: v.size,
        color: v.color,
        price_override: v.price_override ? String(v.price_override) : null,
        stock: v.stock
      }))
    });
  }
  
  // Exclude out-of-stock products unless specifically requested (e.g. by admin)
  let finalProducts = enrichedProducts;
  if (!params.include_out_of_stock) {
    finalProducts = enrichedProducts.filter(p => p.stock > 0);
  }
  
  return { results: finalProducts };
}

export async function getProduct(id) {
  const db = await getDb();
  const p = await db.collection('products').findOne(getQueryById(id));
  if (!p) return null;
  
  const cat = await db.collection('categories').findOne(getQueryById(p.category_id));
  const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
  const primaryImageObj = (p.images || []).find(img => img.is_primary) || (p.images || [])[0] || null;
  const primary_image = primaryImageObj ? primaryImageObj.image_url : null;
  
  return {
    id: p._id.toString(),
    name: p.name,
    slug: p.slug,
    description: p.description,
    base_price: String(p.base_price),
    price_value: Number(p.base_price),
    discount: Number(p.discount || 0),
    is_active: !!p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
    stock: totalStock,
    category: cat ? {
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug
    } : null,
    category_id: p.category_id,
    primary_image,
    image_url: primary_image,
    gallery_images: (p.images || []).map(img => img.image_url),
    images: (p.images || []).map(img => ({
      id: String(img.id),
      image_url: img.image_url,
      is_primary: !!img.is_primary
    })),
    variants: (p.variants || []).map(v => ({
      id: String(v.id),
      sku: v.sku,
      size: v.size,
      color: v.color,
      price_override: v.price_override ? String(v.price_override) : null,
      stock: v.stock
    }))
  };
}

// ── AUTH FUNCTIONS ──

export async function register(data) {
  const db = await getDb();
  const email = data.email?.trim().toLowerCase();
  const password = data.password;
  const name = data.full_name || '';
  
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  
  const existing = await db.collection('users').findOne({ username: email });
  if (existing) {
    throw new Error('An account with this email already exists.');
  }
  
  const hashedPassword = hashPassword(password);
  const now = getFormattedDate();
  
  const result = await db.collection('users').insertOne({
    password: hashedPassword,
    last_login: null,
    is_superuser: false,
    username: email,
    last_name: '',
    email: email,
    is_staff: false,
    is_active: true,
    date_joined: now,
    first_name: name
  });
  
  const userId = result.insertedId.toString();
  const token = signToken({ id: userId, email });
  
  await setAuthCookie(token);
  
  // Welcome Email in background
  sendWelcomeEmail({ id: userId, email, username: email, full_name: name })
    .catch(err => console.error('Background Welcome Email failed:', err));
  
  return {
    user: { id: userId, email, full_name: name },
    access_token: token,
    access: token,
    refresh: token
  };
}

export async function login(email, password) {
  const db = await getDb();
  const cleanEmail = email?.trim().toLowerCase();
  
  // Check if we should seed the default admin from env
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envAdminPassword = process.env.ADMIN_PASSWORD;
  
  if (envAdminEmail && envAdminPassword && cleanEmail === envAdminEmail) {
    if (password === envAdminPassword) {
      let adminUser = await db.collection('users').findOne({ username: envAdminEmail });
      const now = getFormattedDate();
      const hashedEnvPass = hashPassword(envAdminPassword);
      
      if (!adminUser) {
        console.log('Seeding default admin user from env:', envAdminEmail);
        await db.collection('users').insertOne({
          password: hashedEnvPass,
          last_login: now,
          is_superuser: true,
          username: envAdminEmail,
          last_name: '',
          email: envAdminEmail,
          is_staff: true,
          is_active: true,
          date_joined: now,
          first_name: 'Admin'
        });
      } else if (!adminUser.is_superuser || !verifyPassword(password, adminUser.password)) {
        console.log('Updating existing admin user to match env settings.');
        await db.collection('users').updateOne(
          { _id: adminUser._id },
          { $set: { password: hashedEnvPass, is_superuser: true, is_staff: true, is_active: true } }
        );
      }
    }
  }
  
  const user = await db.collection('users').findOne({ username: cleanEmail });
  if (!user || !verifyPassword(password, user.password)) {
    throw new Error('Invalid credentials.');
  }
  
  if (!user.is_active) {
    throw new Error('Account is disabled.');
  }
  
  const now = getFormattedDate();
  await db.collection('users').updateOne({ _id: user._id }, { $set: { last_login: now } });
  
  const userId = user._id.toString();
  const token = signToken({ id: userId, email: user.email });
  await setAuthCookie(token);
  
  return {
    user: {
      id: userId,
      email: user.email,
      full_name: user.first_name,
      is_superuser: !!user.is_superuser
    },
    token: token,
    access: token,
    refresh: token
  };
}

export async function googleLogin(access_token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!res.ok) {
      throw new Error('Google OAuth verification failed.');
    }
    
    const googleUser = await res.json();
    const email = googleUser.email?.trim().toLowerCase();
    const name = googleUser.name || googleUser.given_name || '';
    
    if (!email) {
      throw new Error('Google account email not found.');
    }
    
    const db = await getDb();
    let user = await db.collection('users').findOne({ username: email });
    let isNewUser = false;
    
    if (!user) {
      isNewUser = true;
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = hashPassword(randomPassword);
      const now = getFormattedDate();
      
      const result = await db.collection('users').insertOne({
        password: hashedPassword,
        last_login: null,
        is_superuser: false,
        username: email,
        last_name: '',
        email: email,
        is_staff: false,
        is_active: true,
        date_joined: now,
        first_name: name
      });
      user = { _id: result.insertedId, email, first_name: name, is_superuser: false };
    }
    
    const userId = user._id.toString();
    const token = signToken({ id: userId, email: user.email });
    await setAuthCookie(token);
    
    if (isNewUser) {
      sendWelcomeEmail({ id: userId, email, username: email, full_name: name })
        .catch(err => console.error('Background Welcome Email failed:', err));
    }
    
    return {
      key: token,
      access_token: token,
      user: {
        id: userId,
        email: user.email,
        full_name: user.first_name,
        is_superuser: !!user.is_superuser
      }
    };
  } catch (error) {
    throw new Error(error.message || 'Google Login failed.');
  }
}

export async function getMe() {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  return user;
}

export async function updateProfile(data) {
  const currentUser = await getAuthenticatedUser();
  if (!currentUser) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const { full_name, password } = data;
  const updates = {};
  
  if (full_name) updates.first_name = full_name;
  if (password) updates.password = hashPassword(password);
  
  if (Object.keys(updates).length > 0) {
    await db.collection('users').updateOne(getQueryById(currentUser.id), { $set: updates });
  }
  
  const updated = await db.collection('users').findOne(getQueryById(currentUser.id));
  return {
    id: updated._id.toString(),
    email: updated.email,
    full_name: updated.first_name,
    is_superuser: !!updated.is_superuser
  };
}

export async function logout() {
  await deleteAuthCookie();
  return { detail: 'Successfully logged out.' };
}

// ── CART FUNCTIONS ──

export async function fetchActiveCart() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  
  const db = await getDb();
  let cart = await db.collection('carts').findOne({ user_id: user.id });
  
  if (!cart) {
    const now = getFormattedDate();
    const result = await db.collection('carts').insertOne({
      session_id: null,
      created_at: now,
      updated_at: now,
      user_id: user.id,
      items: []
    });
    cart = { _id: result.insertedId, user_id: user.id, items: [] };
  }
  
  const mappedItems = [];
  for (const item of cart.items || []) {
    const p = await db.collection('products').findOne(getQueryById(item.product_id));
    if (p) {
      const variant = (p.variants || []).find(v => String(v.id) === String(item.variant_id)) || (p.variants || [])[0];
      if (variant) {
        // Calculate discounted price:
        const originalPrice = variant.price_override || p.base_price;
        const discount = p.discount || 0;
        const effectivePrice = Math.round(originalPrice * (1 - discount / 100));
        
        const imgObj = (p.images || []).find(img => img.is_primary) || (p.images || [])[0] || null;
        
        mappedItems.push({
          id: String(item.id || item.variant_id), // line-item ID fallback
          quantity: item.quantity,
          price: String(effectivePrice),
          variant: {
            id: String(variant.id),
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            price_override: variant.price_override ? String(variant.price_override) : null,
            stock: variant.stock
          },
          product: {
            id: p._id.toString(),
            name: p.name,
            price_value: effectivePrice,
            image_url: imgObj ? imgObj.image_url : null
          }
        });
      }
    }
  }
  
  return {
    id: cart._id.toString(),
    user: cart.user_id,
    items: mappedItems
  };
}

export async function createCart(payload = {}) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const now = getFormattedDate();
  
  const result = await db.collection('carts').insertOne({
    session_id: null,
    created_at: now,
    updated_at: now,
    user_id: user.id,
    items: []
  });
    
  return {
    id: result.insertedId.toString(),
    user: user.id,
    items: []
  };
}

export async function updateCart(cartId, payload) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const cart = await db.collection('carts').findOne({
    $and: [
      getQueryById(cartId),
      { user_id: user.id }
    ]
  });
  if (!cart) throw new Error('Cart not found');
  
  const updatedItems = [];
  for (const item of payload.items || []) {
    const productId = item.product;
    const quantity = item.quantity || 1;
    
    const product = await db.collection('products').findOne(getQueryById(productId));
    if (product && product.variants && product.variants.length > 0) {
      const variant = product.variants[0];
      updatedItems.push({
        id: crypto.randomUUID(),
        quantity,
        variant_id: String(variant.id),
        product_id: product._id.toString()
      });
    }
  }
  
  const now = getFormattedDate();
  await db.collection('carts').updateOne(
    { _id: cart._id },
    { $set: { items: updatedItems, updated_at: now } }
  );
  
  return fetchActiveCart();
}

// ── ADDRESS & CONTACT FUNCTIONS ──

export async function getAddresses() {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const addresses = await db.collection('addresses').find({ user_id: user.id }).toArray();
  return addresses.map(addr => ({ ...addr, id: addr._id.toString() }));
}

export async function addAddress(payload) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const is_default = payload.is_default ? true : false;
  const now = getFormattedDate();
  
  if (is_default) {
    await db.collection('addresses').updateMany({ user_id: user.id }, { $set: { is_default: false } });
  }
  
  const result = await db.collection('addresses').insertOne({
    full_name: payload.full_name,
    address_line: payload.address_line,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    is_default: is_default,
    created_at: now,
    user_id: user.id
  });
  
  return { id: result.insertedId.toString(), ...payload, is_default };
}

export async function setDefaultAddress(id) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const addr = await db.collection('addresses').findOne({ _id: id, user_id: user.id });
  if (!addr) throw new Error('Address not found');
  
  await db.collection('addresses').updateMany({ user_id: user.id }, { $set: { is_default: false } });
  await db.collection('addresses').updateOne({ _id: id }, { $set: { is_default: true } });
  
  return { success: true };
}

export async function getContacts() {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const contacts = await db.collection('contacts').find({ user_id: user.id }).toArray();
  return contacts.map(c => ({ ...c, id: c._id.toString() }));
}

export async function addContact(payload) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const is_default = payload.is_default ? true : false;
  const now = getFormattedDate();
  
  if (is_default) {
    await db.collection('contacts').updateMany({ user_id: user.id }, { $set: { is_default: false } });
  }
  
  const result = await db.collection('contacts').insertOne({
    phone_number: payload.phone_number,
    is_default: is_default,
    created_at: now,
    user_id: user.id
  });
  
  return { id: result.insertedId.toString(), ...payload, is_default };
}

export async function setDefaultContact(id) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthenticated');
  
  const db = await getDb();
  const contact = await db.collection('contacts').findOne({ _id: id, user_id: user.id });
  if (!contact) throw new Error('Contact not found');
  
  await db.collection('contacts').updateMany({ user_id: user.id }, { $set: { is_default: false } });
  await db.collection('contacts').updateOne({ _id: id }, { $set: { is_default: true } });
  
  return { success: true };
}

// ── ORDERS & CHECKOUT FUNCTIONS ──

export async function createOrder(payload) {
  const user = await getAuthenticatedUser();
  const db = await getDb();
  const now = getFormattedDate();
  
  const orderId = crypto.randomUUID();
  const payment_reference = `PAY-SCS-${Math.floor(100000 + Math.random() * 900000)}`;
  
  const upi_transaction_id = payload.upi_transaction_id || payload.payment_id || null;
  const screenshot_id = payload.screenshot_id || null;
  
  const orderItems = [];
  const items = payload.items || [];
  for (const item of items) {
    const p = await db.collection('products').findOne(getQueryById(item.product_id));
    if (p && p.variants && p.variants.length > 0) {
      const variant = p.variants[0];
      orderItems.push({
        id: crypto.randomUUID(),
        quantity: item.quantity || 1,
        price: Number(item.price || variant.price_override || p.base_price),
        variant_id: String(variant.id),
        product_id: p._id.toString()
      });
      
      // Reduce stock of variant in MongoDB!
      const newStock = Math.max(0, (variant.stock || 0) - (item.quantity || 1));
      await db.collection('products').updateOne(
        { _id: p._id, "variants.id": variant.id },
        { $set: { "variants.$.stock": newStock } }
      );
    }
  }
  
  const orderDoc = {
    _id: orderId,
    status: payload.status || 'PENDING',
    total_amount: Number(payload.total_amount || 0),
    shipping_address: payload.shipping_address || '',
    created_at: now,
    updated_at: now,
    user_id: user ? user.id : null,
    city: payload.city || null,
    customer_email: payload.customer_email || (user ? user.email : null),
    customer_name: payload.customer_name || (user ? user.full_name : null),
    customer_phone: payload.customer_phone || null,
    pincode: payload.pincode || null,
    screenshot_id: screenshot_id,
    state: payload.state || null,
    payment_status: payload.payment_status || 'PENDING',
    upi_transaction_id: upi_transaction_id,
    payment_reference: payment_reference,
    cancelled_at: null,
    delivered_at: null,
    payment_verified_at: null,
    processing_at: null,
    shipped_at: null,
    items: orderItems
  };
  
  await db.collection('orders').insertOne(orderDoc);
  
  // Clear cart
  if (user) {
    await db.collection('carts').updateOne({ user_id: user.id }, { $set: { items: [], updated_at: now } });
  }
  
  // Create payment record
  if (upi_transaction_id || screenshot_id) {
    await db.collection('payments').insertOne({
      _id: crypto.randomUUID(),
      amount: Number(payload.total_amount || 0),
      screenshot_url: screenshot_id,
      status: upi_transaction_id ? 'VERIFIED' : 'PENDING',
      submitted_at: now,
      received_at: upi_transaction_id ? now : null,
      confirmed_at: now,
      created_at: now,
      order_id: orderId,
      user_id: user ? user.id : null,
      payment_reference: payment_reference,
      upi_transaction_id: upi_transaction_id
    });
  }
  
  // Send email confirmation in the background with PDF attachment
  const customerEmail = payload.customer_email || (user ? user.email : null);
  if (customerEmail) {
    const emailOrderData = {
      id: orderId,
      customer_name: payload.customer_name || (user ? user.full_name : 'Customer'),
      customer_email: customerEmail,
      customer_phone: payload.customer_phone || null,
      shipping_address: payload.shipping_address || '',
      total_amount: Number(payload.total_amount || 0),
      payment_reference: payment_reference,
      upi_transaction_id: upi_transaction_id,
      created_at: now,
      user_id: user ? user.id : null,
      items: orderItems.map(item => ({
        name: items.find(i => String(i.product_id) === String(item.product_id))?.name || 'Product',
        quantity: item.quantity,
        price: item.price
      }))
    };
    sendOrderConfirmationEmail(emailOrderData)
      .catch(err => console.error('Background Order Confirmation Email failed:', err));
  }
  
  return getOrder(orderId);
}

export async function getOrder(id) {
  const db = await getDb();
  const order = await db.collection('orders').findOne(getQueryById(id));
  if (!order) return null;
  
  const items = [];
  for (const item of order.items || []) {
    const p = await db.collection('products').findOne(getQueryById(item.product_id));
    if (p) {
      const variant = (p.variants || []).find(v => String(v.id) === String(item.variant_id)) || (p.variants || [])[0];
      const primaryImageObj = (p.images || []).find(img => img.is_primary) || (p.images || [])[0] || null;
      const imageUrl = primaryImageObj ? primaryImageObj.image_url : null;
      
      items.push({
        id: item.id,
        quantity: item.quantity,
        price: String(item.price),
        image: imageUrl,
        variant: variant ? {
          id: String(variant.id),
          sku: variant.sku,
          size: variant.size,
          color: variant.color
        } : null,
        product: {
          id: p._id.toString(),
          name: p.name,
          primary_image: imageUrl
        }
      });
    }
  }
  
  return {
    id: order._id.toString(),
    status: order.status,
    total_amount: String(order.total_amount),
    shipping_address: order.shipping_address,
    created_at: order.created_at,
    updated_at: order.updated_at,
    city: order.city,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    pincode: order.pincode,
    screenshot_id: order.screenshot_id,
    state: order.state,
    payment_status: order.payment_status,
    payment_reference: order.payment_reference,
    upi_transaction_id: order.upi_transaction_id,
    cancelled_at: order.cancelled_at,
    delivered_at: order.delivered_at,
    payment_verified_at: order.payment_verified_at,
    processing_at: order.processing_at,
    shipped_at: order.shipped_at,
    items
  };
}

export async function getMyOrders(params = {}) {
  const user = await getAuthenticatedUser();
  if (!user) return [];
  
  const db = await getDb();
  const orders = await db.collection('orders').find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  
  const results = [];
  for (const o of orders) {
    const orderDetails = await getOrder(o._id.toString());
    if (orderDetails) results.push(orderDetails);
  }
  return results;
}

export async function getOrders(email = null, params = {}) {
  const user = await getAuthenticatedUser();
  if (!user) return [];
  
  const db = await getDb();
  const query = {};
  
  if (!user.is_superuser) {
    query.user_id = user.id;
  } else if (email) {
    query.customer_email = email;
  }
  
  const orders = await db.collection('orders').find(query).sort({ created_at: -1 }).toArray();
  
  const results = [];
  for (const o of orders) {
    const orderDetails = await getOrder(o._id.toString());
    if (orderDetails) results.push(orderDetails);
  }
  return { results };
}

// ── PAYMENTS ──

export async function getPayments(params = {}) {
  const user = await getAuthenticatedUser();
  if (!user) return [];
  
  const db = await getDb();
  const query = {};
  if (!user.is_superuser) {
    query.user_id = user.id;
  }
  
  const payments = await db.collection('payments').find(query).sort({ created_at: -1 }).toArray();
  return {
    results: payments.map(p => ({
      ...p,
      id: p._id.toString()
    }))
  };
}

// ── SCREENSHOT UPLOAD ──

export async function uploadScreenshot(formData) {
  const file = formData.get('file');
  if (!file) throw new Error('No file uploaded.');
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const ext = path.extname(file.name) || '.jpeg';
  const filename = `screenshots/${crypto.randomUUID()}${ext}`;
  
  // uploadFile returns GCS public URL if config exists, or local /media/... path
  const publicUrl = await uploadFile(buffer, filename, file.type || 'image/jpeg');
  
  return { id: publicUrl, url: publicUrl };
}

// ── MESSAGING ──

export async function submitContactMessage(messageData) {
  const db = await getDb();
  const now = getFormattedDate();
  
  const result = await db.collection('contactmessages').insertOne({
    name: messageData.name,
    email: messageData.email,
    subject: messageData.subject,
    message: messageData.message,
    is_read: false,
    created_at: now
  });
  
  return { id: result.insertedId.toString(), ...messageData, is_read: false, created_at: now };
}

// ── ADMIN FUNCTIONS ──

export async function getAdminStats(range = '7d') {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  
  // Total Revenue
  const revOrders = await db.collection('orders').find({ status: { $ne: 'CANCELLED' } }).toArray();
  const totalRevenue = revOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  
  // Total Orders
  const totalOrders = await db.collection('orders').countDocuments();
  
  // Pending Orders (status is PENDING or PROCESSING)
  const pendingOrders = await db.collection('orders').countDocuments({ status: { $in: ['PENDING', 'PROCESSING'] } });
  
  // Active Products
  const totalProducts = await db.collection('products').countDocuments();
  
  // Messages stats
  const totalMessages = await db.collection('contactmessages').countDocuments();
  const unreadMessages = await db.collection('contactmessages').countDocuments({ is_read: false });
  const readMessages = totalMessages - unreadMessages;

  // Active Carts (non-empty carts)
  const activeCartsCount = await db.collection('carts').countDocuments({ "items.0": { $exists: true } });

  // Sales and Profit over selected range
  const dailyStats = [];
  const now = new Date();
  
  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0,0,0,0);
      const startStr = d.toISOString();
      const dEnd = new Date(d);
      dEnd.setHours(23,59,59,999);
      const endStr = dEnd.toISOString();
      
      const dayOrders = await db.collection('orders').find({
        created_at: { $gte: startStr, $lte: endStr },
        status: { $ne: 'CANCELLED' }
      }).toArray();
      
      const daySales = dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const dayCount = dayOrders.length;
      
      dailyStats.push({
        label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        sales: daySales,
        orders: dayCount
      });
    }
  } else if (range === '1m') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0,0,0,0);
      const startStr = d.toISOString();
      const dEnd = new Date(d);
      dEnd.setHours(23,59,59,999);
      const endStr = dEnd.toISOString();
      
      const dayOrders = await db.collection('orders').find({
        created_at: { $gte: startStr, $lte: endStr },
        status: { $ne: 'CANCELLED' }
      }).toArray();
      
      const daySales = dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const dayCount = dayOrders.length;
      
      dailyStats.push({
        label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        sales: daySales,
        orders: dayCount
      });
    }
  } else if (range === '1y') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      d.setDate(1);
      d.setHours(0,0,0,0);
      const startStr = d.toISOString();
      
      const dEnd = new Date(d);
      dEnd.setMonth(dEnd.getMonth() + 1);
      dEnd.setDate(0); // last day of month
      dEnd.setHours(23,59,59,999);
      const endStr = dEnd.toISOString();
      
      const monthOrders = await db.collection('orders').find({
        created_at: { $gte: startStr, $lte: endStr },
        status: { $ne: 'CANCELLED' }
      }).toArray();
      
      const monthSales = monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const monthCount = monthOrders.length;
      
      dailyStats.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        sales: monthSales,
        orders: monthCount
      });
    }
  } else if (range === 'all') {
    const allOrders = await db.collection('orders').find({ status: { $ne: 'CANCELLED' } }).sort({ created_at: 1 }).toArray();
    const groups = {};
    for (const o of allOrders) {
      if (!o.created_at) continue;
      const date = new Date(o.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!groups[key]) {
        groups[key] = { sales: 0, orders: 0, time: date.getTime() };
      }
      groups[key].sales += (o.total_amount || 0);
      groups[key].orders += 1;
    }
    
    const sortedKeys = Object.keys(groups).sort((a, b) => groups[a].time - groups[b].time);
    for (const key of sortedKeys) {
      dailyStats.push({
        label: key,
        sales: groups[key].sales,
        orders: groups[key].orders
      });
    }
    
    if (dailyStats.length === 0) {
      dailyStats.push({ label: 'No Data', sales: 0, orders: 0 });
    }
  }

  return {
    total_revenue: totalRevenue,
    total_orders: totalOrders,
    pending_orders: pendingOrders,
    total_products: totalProducts,
    total_messages: totalMessages,
    unread_messages: unreadMessages,
    read_messages: readMessages,
    active_carts: activeCartsCount,
    daily_stats: dailyStats
  };
}

export async function getAdminUsers() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const users = await db.collection('users').find().sort({ date_joined: -1 }).toArray();
  return users.map(u => ({
    id: u._id.toString(),
    email: u.email,
    username: u.username,
    first_name: u.first_name || '',
    last_name: u.last_name || '',
    is_superuser: !!u.is_superuser,
    is_staff: !!u.is_staff,
    is_active: !!u.is_active,
    date_joined: u.date_joined,
    last_login: u.last_login
  }));
}

export async function getAdminCarts() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const rawCarts = await db.collection('carts').find({ "items.0": { $exists: true } }).toArray();
  
  const populatedCarts = [];
  for (const cart of rawCarts) {
    const cartUser = await db.collection('users').findOne(getQueryById(cart.user_id));
    if (!cartUser) continue;
    
    const mappedItems = [];
    for (const item of cart.items || []) {
      const p = await db.collection('products').findOne(getQueryById(item.product_id));
      if (p) {
        const variant = (p.variants || []).find(v => String(v.id) === String(item.variant_id)) || (p.variants || [])[0];
        const originalPrice = variant ? (variant.price_override || p.base_price) : p.base_price;
        const discount = p.discount || 0;
        const effectivePrice = Math.round(originalPrice * (1 - discount / 100));
        
        mappedItems.push({
          id: String(item.id || item.variant_id),
          quantity: item.quantity,
          price: Number(effectivePrice),
          product_name: p.name,
          variant_info: variant ? `${variant.size || ''} ${variant.color || ''}`.trim() : ''
        });
      }
    }
    
    if (mappedItems.length > 0) {
      populatedCarts.push({
        id: cart._id.toString(),
        user: {
          id: cartUser._id.toString(),
          email: cartUser.email,
          full_name: cartUser.first_name || cartUser.username
        },
        items: mappedItems,
        updated_at: cart.updated_at
      });
    }
  }
  
  return populatedCarts;
}

export async function getAdminEmailLogs() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const logs = await db.collection('emaillogs').find().sort({ queued_at: -1 }).toArray();
  return logs.map(log => ({
    id: log._id.toString(),
    email_type: log.email_type,
    status: log.status,
    subject: log.subject,
    from_email: log.from_email,
    to_email: log.to_email,
    body_text: log.body_text,
    backend: log.backend,
    attachment_name: log.attachment_name,
    attempts: log.attempts,
    error_message: log.error_message || '',
    queued_at: log.queued_at,
    sent_at: log.sent_at,
    failed_at: log.failed_at,
    user_id: log.user_id,
    order_id: log.order_id
  }));
}

export async function getAdminOrders() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const result = await getOrders();
  return result.results;
}

export async function getAdminOrder(id) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  return getOrder(id);
}

export async function updateAdminOrder(id, payload) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const oldOrder = await db.collection('orders').findOne(getQueryById(id));
  if (!oldOrder) throw new Error('Order not found');
  
  const now = getFormattedDate();
  const updates = {};
  
  const allowedFields = ['status', 'payment_status', 'shipping_address', 'city', 'state', 'pincode'];
  allowedFields.forEach(f => {
    if (payload[f] !== undefined) {
      updates[f] = payload[f];
    }
  });
  
  // Status transitions
  if (payload.status && payload.status !== oldOrder.status) {
    if (payload.status === 'PROCESSING') updates.processing_at = now;
    else if (payload.status === 'SHIPPED') updates.shipped_at = now;
    else if (payload.status === 'DELIVERED') updates.delivered_at = now;
    else if (payload.status === 'CANCELLED') updates.cancelled_at = now;
  }
  
  if (payload.payment_status && payload.payment_status !== oldOrder.payment_status) {
    if (payload.payment_status === 'VERIFIED') {
      updates.payment_verified_at = now;
    }
  }
  
  updates.updated_at = now;
  
  await db.collection('orders').updateOne(getQueryById(id), { $set: updates });
  
  // Trigger email alerts in the background
  const mailOrderData = {
    id: id.toString(),
    customer_name: oldOrder.customer_name || 'Customer',
    customer_email: oldOrder.customer_email || 'customer@example.com',
    user_id: oldOrder.user_id,
    status: payload.status || oldOrder.status,
    payment_status: payload.payment_status || oldOrder.payment_status
  };

  if (payload.status && payload.status !== oldOrder.status) {
    sendOrderStatusEmail(mailOrderData)
      .catch(err => console.error('Background Order Status Email failed:', err));
  }
  
  if (payload.payment_status && payload.payment_status !== oldOrder.payment_status) {
    sendPaymentStatusEmail(mailOrderData)
      .catch(err => console.error('Background Payment Status Email failed:', err));
  }
  
  return getOrder(id);
}

export async function getAdminProducts() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const products = await db.collection('products').find().sort({ created_at: -1 }).toArray();
  
  const results = [];
  for (const p of products) {
    const cat = await db.collection('categories').findOne(getQueryById(p.category_id));
    const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
    const primaryImageObj = (p.images || []).find(img => img.is_primary) || (p.images || [])[0] || null;
    const primary_image = primaryImageObj ? primaryImageObj.image_url : null;
    
    results.push({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      description: p.description,
      base_price: String(p.base_price),
      price_value: Number(p.base_price),
      discount: Number(p.discount || 0),
      is_active: !!p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      stock: totalStock,
      category: cat ? {
        id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug
      } : null,
      category_id: p.category_id,
      primary_image,
      image_url: primary_image,
      gallery_images: (p.images || []).map(img => img.image_url),
      images: (p.images || []).map(img => ({
        id: String(img.id),
        image_url: img.image_url,
        is_primary: !!img.is_primary
      })),
      variants: (p.variants || []).map(v => ({
        id: String(v.id),
        sku: v.sku,
        size: v.size,
        color: v.color,
        price_override: v.price_override ? String(v.price_override) : null,
        stock: v.stock
      }))
    });
  }
  
  return results;
}

export async function createAdminProduct(productData) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const now = getFormattedDate();
  
  let p = productData;
  let uploadedImage = null;
  
  if (productData instanceof FormData) {
    p = {
      name: productData.get('name'),
      slug: productData.get('slug'),
      description: productData.get('description'),
      base_price: Number(productData.get('base_price') || productData.get('price') || 0),
      discount: Number(productData.get('discount') || 0),
      is_active: productData.get('is_active') === 'true',
      category_id: String(productData.get('category_id')),
      variants: JSON.parse(productData.get('variants') || '[]'),
      images: JSON.parse(productData.get('images') || '[]')
    };
    
    // Handle file upload if present
    const imageFile = productData.get('image');
    if (imageFile && typeof imageFile === 'object' && imageFile.name) {
      try {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = path.extname(imageFile.name) || '.jpeg';
        const filename = `products/${crypto.randomUUID()}${ext}`;
        const imageUrl = await uploadFile(buffer, filename, imageFile.type || 'image/jpeg');
        uploadedImage = {
          id: crypto.randomUUID(),
          image_url: imageUrl,
          is_primary: true
        };
      } catch (err) {
        console.error('Failed to upload product image:', err);
      }
    }
  }
  
  const productImages = [];
  if (uploadedImage) {
    productImages.push(uploadedImage);
  }
  const incomingImages = p.images || [];
  incomingImages.forEach((img, idx) => {
    productImages.push({
      id: img.id || crypto.randomUUID(),
      image_url: img.image_url || img,
      is_primary: productImages.length === 0 && idx === 0
    });
  });

  const variantsToSave = (p.variants && p.variants.length > 0) ? p.variants : [{
    sku: `SKU-${(p.slug || p.name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`,
    stock: 20
  }];
  
  const newProduct = {
    name: p.name,
    slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: p.description || '',
    base_price: Number(p.base_price || 0),
    discount: Number(p.discount || 0),
    is_active: p.is_active ? true : false,
    created_at: now,
    updated_at: now,
    category_id: String(p.category_id || p.category?.id || '1'),
    images: productImages,
    variants: variantsToSave.map(v => ({
      id: crypto.randomUUID(),
      sku: v.sku || `SKU-${Math.floor(Math.random() * 100000)}`,
      size: v.size || '',
      color: v.color || '',
      price_override: v.price_override ? Number(v.price_override) : null,
      stock: Number(v.stock || 0)
    }))
  };
  
  const result = await db.collection('products').insertOne(newProduct);
  return getProduct(result.insertedId.toString());
}

export async function updateAdminProduct(id, productData) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const now = getFormattedDate();
  
  let p = productData;
  let uploadedImage = null;
  
  if (productData instanceof FormData) {
    const rawBasePrice = productData.get('base_price') !== null ? productData.get('base_price') : productData.get('price');
    const base_price = (rawBasePrice !== null && rawBasePrice !== '') ? Number(rawBasePrice) : undefined;
    
    p = {
      name: productData.get('name') || undefined,
      slug: productData.get('slug') || undefined,
      description: productData.get('description') || undefined,
      base_price: base_price,
      discount: productData.get('discount') !== null ? Number(productData.get('discount')) : undefined,
      is_active: productData.get('is_active') !== null ? productData.get('is_active') === 'true' : undefined,
      category_id: productData.get('category_id') !== null ? String(productData.get('category_id')) : undefined,
      variants: productData.get('variants') ? JSON.parse(productData.get('variants')) : undefined,
      images: productData.get('images') ? JSON.parse(productData.get('images')) : undefined
    };
    
    // Handle file upload if present
    const imageFile = productData.get('image');
    if (imageFile && typeof imageFile === 'object' && imageFile.name) {
      try {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = path.extname(imageFile.name) || '.jpeg';
        const filename = `products/${crypto.randomUUID()}${ext}`;
        const imageUrl = await uploadFile(buffer, filename, imageFile.type || 'image/jpeg');
        uploadedImage = {
          id: crypto.randomUUID(),
          image_url: imageUrl,
          is_primary: true
        };
      } catch (err) {
        console.error('Failed to upload product image:', err);
      }
    }
  }
  
  const updates = {};
  const allowedFields = ['name', 'slug', 'description', 'base_price', 'discount', 'is_active', 'category_id'];
  allowedFields.forEach(f => {
    if (p[f] !== undefined) updates[f] = p[f];
  });
  
  if (p.category_id === undefined && p.category?.id !== undefined) {
    updates.category_id = String(p.category.id);
  }
  
  updates.updated_at = now;
  
  if (p.variants) {
    const finalVariants = p.variants.length > 0 ? p.variants : [{
      sku: `SKU-${(updates.slug || id).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      stock: 20
    }];
    updates.variants = finalVariants.map(v => ({
      id: v.id || crypto.randomUUID(),
      sku: v.sku,
      size: v.size || '',
      color: v.color || '',
      price_override: v.price_override ? Number(v.price_override) : null,
      stock: Number(v.stock || 0)
    }));
  }
  
  if (uploadedImage) {
    const existing = await db.collection('products').findOne(getQueryById(id));
    const currentImages = existing?.images || [];
    updates.images = [
      uploadedImage,
      ...currentImages.map(img => ({ ...img, is_primary: false }))
    ];
  } else if (p.images) {
    updates.images = p.images.map((img, idx) => ({
      id: img.id || crypto.randomUUID(),
      image_url: img.image_url || img,
      is_primary: idx === 0
    }));
  }
  
  await db.collection('products').updateOne(getQueryById(id), { $set: updates });
  return getProduct(id);
}

export async function deleteAdminProduct(id) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  await db.collection('products').deleteOne(getQueryById(id));
  return { success: true };
}

export async function getAdminMessages() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const messages = await db.collection('contactmessages').find().sort({ created_at: -1 }).toArray();
  return messages.map(m => ({
    ...m,
    id: m._id.toString()
  }));
}

export async function updateAdminMessage(id, messageData) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  const is_read = !!messageData.is_read;
  await db.collection('contactmessages').updateOne(getQueryById(id), { $set: { is_read } });
  
  return { id, ...messageData };
}

export async function deleteAdminMessage(id) {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) throw new Error('Unauthorized');
  
  const db = await getDb();
  await db.collection('contactmessages').deleteOne(getQueryById(id));
  return { success: true };
}
