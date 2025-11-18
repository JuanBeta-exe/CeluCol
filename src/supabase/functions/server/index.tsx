import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';


// ==========================================
// Función para enviar emails con templates específicos
// ==========================================
async function sendEmail(to: string, type: string, data: any) {
  try {
    const templates: { [key: string]: any } = {
      'registration': {
        subject: `¡Bienvenido a El Faro del Saber, ${data.name}!`,
        html: buildWelcomeEmail(data)
      },
      'order_created': {
        subject: `Confirmación de Pedido #${data.orderId.slice(-6)}`,
        html: buildOrderConfirmationEmail(data)
      },
      'order_updated': {
        subject: `Actualización de tu Pedido #${data.orderId.slice(-6)}`,
        html: buildOrderUpdateEmail(data)
      }
    };

    const template = templates[type];
    if (!template) {
      console.error(`Template no encontrado para tipo: ${type}`);
      return;
    }

    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ 
          to, 
          subject: template.subject,
          html: template.html
        }),
      }
    );
    
    if (!response.ok) {
      console.error('❌ Error enviando email:', await response.text());
    } else {
      console.log('✅ Email enviado:', type);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Templates de email mejorados
function buildOrderConfirmationEmail(data: any): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb; text-align: center;">¡Gracias por tu compra en El Faro del Saber!</h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <h3 style="color: #374151; margin-top: 0;">Resumen del Pedido</h3>
        <p><strong>Número de Pedido:</strong> #${data.orderId.slice(-6)}</p>
        <p><strong>Total:</strong> $${data.total}</p>
        <p><strong>Método de Pago:</strong> ${data.paymentMethod}</p>
        <p><strong>Dirección de Envío:</strong> ${data.shippingAddress}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${Deno.env.get('VITE_APP_URL')}/tracking/${data.orderId}" 
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔍 Seguir mi pedido
        </a>
      </div>

      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; color: #6b7280; font-size: 14px;">
        <p>¿Tienes preguntas? Contáctanos en soporte@elfarodelsaber.com</p>
      </div>
    </div>
  `;
}

function buildOrderUpdateEmail(data: any): string {
  const statusColors: { [key: string]: string } = {
    'confirmado': '#10b981',
    'enviado': '#3b82f6', 
    'entregado': '#059669',
    'cancelado': '#ef4444'
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb; text-align: center;">Actualización de tu Pedido</h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; text-align: center;">
        <p>Tu pedido <strong>#${data.orderId.slice(-6)}</strong> ha sido actualizado:</p>
        <div style="background: ${statusColors[data.status] || '#6b7280'}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0;">
          <strong>${data.status.toUpperCase()}</strong>
        </div>
        <p>${data.description}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${Deno.env.get('VITE_APP_URL')}/tracking/${data.orderId}" 
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          📦 Ver detalles completos
        </a>
      </div>
    </div>
  `;
}

function buildWelcomeEmail(data: any): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; text-align: center;">¡Bienvenido a El Faro del Saber!</h2>
      <p>Hola <strong>${data.name}</strong>,</p>
      <p>Tu cuenta ha sido creada exitosamente como <strong>${data.role}</strong>.</p>
      <p>¡Explora nuestro catálogo y descubre grandes libros!</p>
    </div>
  `;
}

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const bucketName = 'make-c2dc5864-products';

// Initialize storage bucket
async function initStorage() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
  if (!bucketExists) {
    await supabase.storage.createBucket(bucketName, { public: false });
    console.log(`Bucket ${bucketName} created`);
  }
}

initStorage();

// Helper function to get user from access token
async function getUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return null;
  }
  return user;
}

// ============= AUTH ROUTES =============

app.post('/make-server-c2dc5864/signup', async (c) => {
  try {
    const { email, password, name, role = 'cliente' } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Enviar email de bienvenida
    await sendEmail(email, 'registration', {
      name: name,
      role: role,
    }).catch(err => console.error('Error enviando email de registro:', err));

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Error in signup route: ${error}`);
    return c.json({ error: 'Error creating user' }, 500);
  }
});

app.get('/make-server-c2dc5864/user', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.json({ user });
  } catch (error) {
    console.log(`Error getting user: ${error}`);
    return c.json({ error: 'Error getting user' }, 500);
  }
});

// ============= PRODUCTS ROUTES =============

app.post('/make-server-c2dc5864/products', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user || user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized. Admin access required.' }, 403);
    }

    const { name, description, price, image, stock } = await c.req.json();
    
    const productId = crypto.randomUUID();
    let imageUrl = null;

    // Handle image upload if provided
    if (image && image.startsWith('data:')) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(':')[1].split(';')[0];
      const ext = mimeType.split('/')[1];
      const fileName = `${productId}.${ext}`;

      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.log(`Error uploading image: ${uploadError.message}`);
        return c.json({ error: 'Error uploading image' }, 500);
      }

      const { data: signedUrlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 31536000); // 1 year

      imageUrl = signedUrlData?.signedUrl;
    }

    const product = {
      id: productId,
      name,
      description,
      price: parseFloat(price),
      imageUrl,
      stock: stock !== undefined ? parseInt(stock) : 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`product:${productId}`, product);

    return c.json({ product });
  } catch (error) {
    console.log(`Error creating product: ${error}`);
    return c.json({ error: 'Error creating product' }, 500);
  }
});

app.get('/make-server-c2dc5864/products', async (c) => {
  try {
    const products = await kv.getByPrefix('product:');
    return c.json({ products });
  } catch (error) {
    console.log(`Error fetching products: ${error}`);
    return c.json({ error: 'Error fetching products' }, 500);
  }
});

app.get('/make-server-c2dc5864/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await kv.get(`product:${id}`);
    
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({ product });
  } catch (error) {
    console.log(`Error fetching product: ${error}`);
    return c.json({ error: 'Error fetching product' }, 500);
  }
});

app.put('/make-server-c2dc5864/products/:id', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user || user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized. Admin access required.' }, 403);
    }

    const id = c.req.param('id');
    const { name, description, price, image, stock } = await c.req.json();
    
    const existingProduct = await kv.get(`product:${id}`);
    if (!existingProduct) {
      return c.json({ error: 'Product not found' }, 404);
    }

    let imageUrl = existingProduct.imageUrl;

    // Handle image upload if provided
    if (image && image.startsWith('data:')) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(':')[1].split(';')[0];
      const ext = mimeType.split('/')[1];
      const fileName = `${id}.${ext}`;

      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.log(`Error uploading image: ${uploadError.message}`);
        return c.json({ error: 'Error uploading image' }, 500);
      }

      const { data: signedUrlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 31536000);

      imageUrl = signedUrlData?.signedUrl;
    }

    const product = {
      ...existingProduct,
      name: name || existingProduct.name,
      description: description || existingProduct.description,
      price: price ? parseFloat(price) : existingProduct.price,
      imageUrl,
      stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`product:${id}`, product);

    return c.json({ product });
  } catch (error) {
    console.log(`Error updating product: ${error}`);
    return c.json({ error: 'Error updating product' }, 500);
  }
});

app.delete('/make-server-c2dc5864/products/:id', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user || user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized. Admin access required.' }, 403);
    }

    const id = c.req.param('id');
    await kv.del(`product:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting product: ${error}`);
    return c.json({ error: 'Error deleting product' }, 500);
  }
});

// ============= CART ROUTES =============

app.get('/make-server-c2dc5864/cart', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    return c.json({ cart });
  } catch (error) {
    console.log(`Error fetching cart: ${error}`);
    return c.json({ error: 'Error fetching cart' }, 500);
  }
});

app.post('/make-server-c2dc5864/cart', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { productId, quantity } = await c.req.json();
    const product = await kv.get(`product:${productId}`);
    
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    // Check stock availability
    if (product.stock !== undefined && product.stock < quantity) {
      return c.json({ error: 'Insufficient stock' }, 400);
    }

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    const existingItemIndex = cart.items.findIndex((item: any) => item.productId === productId);

    if (existingItemIndex >= 0) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      // Check total quantity against stock
      if (product.stock !== undefined && product.stock < newQuantity) {
        return c.json({ error: 'Insufficient stock' }, 400);
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        product
      });
    }

    await kv.set(`cart:${user.id}`, cart);
    return c.json({ cart });
  } catch (error) {
    console.log(`Error adding to cart: ${error}`);
    return c.json({ error: 'Error adding to cart' }, 500);
  }
});

app.put('/make-server-c2dc5864/cart/:productId', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const productId = c.req.param('productId');
    const { quantity } = await c.req.json();

    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    const itemIndex = cart.items.findIndex((item: any) => item.productId === productId);

    if (itemIndex < 0) {
      return c.json({ error: 'Item not found in cart' }, 404);
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      // Validate stock availability
      const product = await kv.get(`product:${productId}`);
      if (product && product.stock !== undefined && product.stock < quantity) {
        return c.json({ error: 'Insufficient stock' }, 400);
      }
      cart.items[itemIndex].quantity = quantity;
    }

    await kv.set(`cart:${user.id}`, cart);
    return c.json({ cart });
  } catch (error) {
    console.log(`Error updating cart: ${error}`);
    return c.json({ error: 'Error updating cart' }, 500);
  }
});

app.delete('/make-server-c2dc5864/cart/:productId', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const productId = c.req.param('productId');
    const cart = await kv.get(`cart:${user.id}`) || { items: [] };
    
    cart.items = cart.items.filter((item: any) => item.productId !== productId);
    
    await kv.set(`cart:${user.id}`, cart);
    return c.json({ cart });
  } catch (error) {
    console.log(`Error removing from cart: ${error}`);
    return c.json({ error: 'Error removing from cart' }, 500);
  }
});

// ============= ORDER ROUTES =============

// ✅ AGREGA ESTE ENDPOINT COMPLETO AQUÍ:
app.post('/make-server-c2dc5864/orders', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { paymentMethod, shippingAddress } = await c.req.json();
    const cart = await kv.get(`cart:${user.id}`);

    if (!cart || cart.items.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }

    // Validate stock availability for all items before creating order
    for (const item of cart.items) {
      const product = await kv.get(`product:${item.productId}`);
      if (!product) {
        return c.json({ error: `Product ${item.productId} not found` }, 404);
      }
      if (product.stock !== undefined && product.stock < item.quantity) {
        return c.json({ error: `Insufficient stock for ${product.name}` }, 400);
      }
    }

    const orderId = crypto.randomUUID();
    const total = cart.items.reduce((sum: number, item: any) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    const order = {
      id: orderId,
      userId: user.id,
      userEmail: user.email,
      items: cart.items,
      total,
      paymentMethod,
      shippingAddress,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };

    // Decrement stock for each product in the order
    for (const item of cart.items) {
      const product = await kv.get(`product:${item.productId}`);
      if (product && product.stock !== undefined) {
        product.stock = Math.max(0, product.stock - item.quantity);
        await kv.set(`product:${item.productId}`, product);
      }
    }

    await kv.set(`order:${orderId}`, order);
    await kv.set(`user:${user.id}:order:${orderId}`, orderId);

    // ✅ ESTE ES EL TERCER PUNTO QUE NECESITAS:
    // Crear evento de tracking inicial
    const initialEventId = crypto.randomUUID();
    const initialTrackingEvent = {
      id: initialEventId,
      orderId: orderId,
      status: 'pendiente',
      description: 'Pedido recibido y en espera de confirmación',
      timestamp: new Date().toISOString(),
    };

    await kv.set(`tracking:${orderId}:${initialEventId}`, initialTrackingEvent);

    // Clear cart
    await kv.set(`cart:${user.id}`, { items: [] });

    // Enviar email de confirmación de orden
    await sendEmail(user.email, 'order_created', {
      orderId: orderId,
      items: cart.items,
      total: total,
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
    }).catch(err => console.error('Error enviando email de orden:', err));

    return c.json({ order });
  } catch (error) {
    console.log(`Error creating order: ${error}`);
    return c.json({ error: 'Error creating order' }, 500);
  }
});

app.get('/make-server-c2dc5864/orders', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allOrders = await kv.getByPrefix('order:');
    
    let orders;
    if (user.user_metadata?.role === 'administrador') {
      orders = allOrders;
    } else {
      orders = allOrders.filter((order: any) => order.userId === user.id);
    }

    return c.json({ orders });
  } catch (error) {
    console.log(`Error fetching orders: ${error}`);
    return c.json({ error: 'Error fetching orders' }, 500);
  }
});

app.get('/make-server-c2dc5864/orders/:id', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('id');
    const order = await kv.get(`order:${orderId}`);

    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (order.userId !== user.id && user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ order });
  } catch (error) {
    console.log(`Error fetching order: ${error}`);
    return c.json({ error: 'Error fetching order' }, 500);
  }
});

app.put('/make-server-c2dc5864/orders/:id/status', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user || user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized. Admin access required.' }, 403);
    }

    const orderId = c.req.param('id');
    const { status } = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    await kv.set(`order:${orderId}`, order);

    // Enviar email de actualización al cliente
    await sendEmail(order.userEmail, 'order_updated', {
      orderId: orderId,
      status: status,
    }).catch(err => console.error('Error enviando email de actualización:', err));

    return c.json({ order });
  } catch (error) {
    console.log(`Error updating order status: ${error}`);
    return c.json({ error: 'Error updating order status' }, 500);
  }
});

// ============= ORDER TRACKING ROUTES =============

app.get('/make-server-c2dc5864/orders/:id/tracking', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('id');
    const order = await kv.get(`order:${orderId}`);

    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Verificar que el usuario es el dueño o admin
    if (order.userId !== user.id && user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Obtener eventos de tracking
    const trackingEvents = await kv.getByPrefix(`tracking:${orderId}:`) || [];
    
    // Ordenar eventos por fecha (más reciente primero)
    trackingEvents.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return c.json({ order, trackingEvents });
  } catch (error) {
    console.log(`Error fetching order tracking: ${error}`);
    return c.json({ error: 'Error fetching order tracking' }, 500);
  }
});

app.post('/make-server-c2dc5864/orders/:id/tracking-events', async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user || user.user_metadata?.role !== 'administrador') {
      return c.json({ error: 'Unauthorized. Admin access required.' }, 403);
    }

    const orderId = c.req.param('id');
    const { status, description, location } = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const eventId = crypto.randomUUID();
    const trackingEvent = {
      id: eventId,
      orderId,
      status,
      description: description || getStatusDescription(status),
      location,
      timestamp: new Date().toISOString(),
    };

    // Guardar evento de tracking
    await kv.set(`tracking:${orderId}:${eventId}`, trackingEvent);

    // Actualizar estado principal del pedido
    order.status = status;
    order.updatedAt = new Date().toISOString();
    await kv.set(`order:${orderId}`, order);

    // Enviar email de actualización al cliente
    await sendEmail(order.userEmail, 'order_updated', {
      orderId: orderId,
      status: status,
      description: trackingEvent.description,
      trackingUrl: `${Deno.env.get('VITE_APP_URL')}/tracking/${orderId}`
    }).catch(err => console.error('Error enviando email de actualización:', err));

    return c.json({ trackingEvent });
  } catch (error) {
    console.log(`Error creating tracking event: ${error}`);
    return c.json({ error: 'Error creating tracking event' }, 500);
  }
});

// ============= HELPER FUNCTIONS =============

function getStatusDescription(status: string): string {
  const descriptions: { [key: string]: string } = {
    'pendiente': 'Pedido recibido y en espera de confirmación',
    'confirmado': 'Pedido confirmado y en proceso de preparación',
    'enviado': 'Pedido enviado a la dirección de entrega',
    'entregado': 'Pedido entregado satisfactoriamente',
    'cancelado': 'Pedido cancelado'
  };
  return descriptions[status] || 'Estado actualizado';
}

Deno.serve(app.fetch);
