import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "registration" | "order_created" | "order_updated";
  data?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, type, data }: EmailRequest = await req.json();

    let emailData;

    switch (type) {
      case "registration":
        emailData = {
          from: "CeluCol <noreply@tudominio.com>",
          to: [to],
          subject: "¡Bienvenido a CeluCol!",
          html: getRegistrationEmail(data),
        };
        break;

      case "order_created":
        emailData = {
          from: "CeluCol <pedidos@tudominio.com>",
          to: [to],
          subject: `Pedido #${data.orderId} - Confirmación`,
          html: getOrderCreatedEmail(data),
        };
        break;

      case "order_updated":
        emailData = {
          from: "CeluCol <pedidos@tudominio.com>",
          to: [to],
          subject: `Pedido #${data.orderId} - ${getStatusText(data.status)}`,
          html: getOrderUpdatedEmail(data),
        };
        break;

      default:
        throw new Error("Tipo de email no válido");
    }

    const result = await resend.emails.send(emailData);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Templates de Email

function getRegistrationEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido a CeluCol! 🎉</h1>
        </div>
        <div class="content">
          <h2>Hola ${data.name},</h2>
          <p>Gracias por registrarte en CeluCol, tu tienda de confianza para accesorios de celulares.</p>
          <p>Tu cuenta ha sido creada exitosamente con el rol de <strong>${data.role}</strong>.</p>
          <p>Ya puedes empezar a explorar nuestro catálogo y hacer tus pedidos.</p>
          <a href="https://tudominio.com" class="button">Ir a la tienda</a>
          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </div>
        <div class="footer">
          <p>CeluCol - Tu tienda de accesorios móviles</p>
          <p>Este correo fue enviado automáticamente, por favor no respondas.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getOrderCreatedEmail(data: any): string {
  const itemsHtml = data.items.map((item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.product.price.toLocaleString()}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.product.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; }
        .order-summary { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .table { width: 100%; border-collapse: collapse; }
        .total { font-size: 18px; font-weight: bold; color: #10b981; text-align: right; padding-top: 10px; border-top: 2px solid #10b981; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ ¡Pedido Confirmado!</h1>
          <p>Pedido #${data.orderId}</p>
        </div>
        <div class="content">
          <h2>Hola,</h2>
          <p>Hemos recibido tu pedido exitosamente. A continuación los detalles:</p>
          
          <div class="order-summary">
            <h3>Resumen del Pedido</h3>
            <table class="table">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Producto</th>
                  <th style="padding: 10px; text-align: center;">Cantidad</th>
                  <th style="padding: 10px; text-align: right;">Precio</th>
                  <th style="padding: 10px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <p class="total">Total: $${data.total.toLocaleString()}</p>
          </div>

          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Información de Envío</h3>
            <p><strong>Dirección:</strong> ${data.shippingAddress}</p>
            <p><strong>Método de Pago:</strong> ${data.paymentMethod === 'tarjeta' ? 'Tarjeta de Crédito' : 'Transferencia Bancaria'}</p>
            <p><strong>Estado:</strong> <span style="color: #f59e0b;">Pendiente</span></p>
          </div>

          <p>Te notificaremos cuando tu pedido sea confirmado y enviado.</p>
        </div>
        <div class="footer">
          <p>CeluCol - Tu tienda de accesorios móviles</p>
          <p>Si no realizaste este pedido, contacta con nosotros inmediatamente.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getOrderUpdatedEmail(data: any): string {
  const statusColors = {
    pendiente: '#f59e0b',
    confirmado: '#3b82f6',
    enviado: '#8b5cf6',
    entregado: '#10b981',
    cancelado: '#ef4444',
  };

  const statusEmojis = {
    pendiente: '⏳',
    confirmado: '✅',
    enviado: '🚚',
    entregado: '📦',
    cancelado: '❌',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColors[data.status]}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .status-badge { display: inline-block; padding: 10px 20px; background: ${statusColors[data.status]}; color: white; border-radius: 20px; font-weight: bold; }
        .timeline { margin: 20px 0; }
        .timeline-item { padding: 15px; background: white; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${statusColors[data.status]}; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusEmojis[data.status]} Estado del Pedido Actualizado</h1>
          <p>Pedido #${data.orderId}</p>
        </div>
        <div class="content">
          <h2>Hola,</h2>
          <p>Tu pedido ha sido actualizado:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <span class="status-badge">${getStatusText(data.status)}</span>
          </div>

          ${getStatusMessage(data.status)}

          <div class="timeline">
            <h3>Línea de Tiempo</h3>
            <div class="timeline-item">
              <strong>Pedido Creado</strong>
              <p style="color: #666; font-size: 14px;">Tu pedido fue recibido exitosamente</p>
            </div>
            ${data.status !== 'pendiente' ? `
            <div class="timeline-item">
              <strong>Pedido Confirmado</strong>
              <p style="color: #666; font-size: 14px;">Tu pedido está siendo preparado</p>
            </div>
            ` : ''}
            ${data.status === 'enviado' || data.status === 'entregado' ? `
            <div class="timeline-item">
              <strong>Pedido Enviado</strong>
              <p style="color: #666; font-size: 14px;">Tu pedido está en camino</p>
            </div>
            ` : ''}
            ${data.status === 'entregado' ? `
            <div class="timeline-item">
              <strong>Pedido Entregado</strong>
              <p style="color: #666; font-size: 14px;">Tu pedido ha sido entregado con éxito</p>
            </div>
            ` : ''}
          </div>

          <p>Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.</p>
        </div>
        <div class="footer">
          <p>CeluCol - Tu tienda de accesorios móviles</p>
          <p>Este correo fue enviado automáticamente, por favor no respondas.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getStatusText(status: string): string {
  const statusTexts = {
    pendiente: 'Pendiente de Confirmación',
    confirmado: 'Confirmado y en Preparación',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  return statusTexts[status] || status;
}

function getStatusMessage(status: string): string {
  const messages = {
    pendiente: '<p>Tu pedido está siendo revisado por nuestro equipo. Te notificaremos una vez sea confirmado.</p>',
    confirmado: '<p>¡Excelente! Tu pedido ha sido confirmado y estamos preparándolo para su envío.</p>',
    enviado: '<p>Tu pedido está en camino. Recibirás tu paquete pronto.</p>',
    entregado: '<p>¡Tu pedido ha sido entregado! Esperamos que disfrutes tus productos. Gracias por confiar en CeluCol.</p>',
    cancelado: '<p>Tu pedido ha sido cancelado. Si esto fue un error o tienes preguntas, contáctanos.</p>',
  };
  return messages[status] || '';
}