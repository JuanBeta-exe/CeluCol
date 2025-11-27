/**
 * WhatsApp Notification Service
 * 
 * Edge Function para enviar mensajes de WhatsApp usando WhatsApp Cloud API
 * 
 * Variables de entorno requeridas:
 * - WHATSAPP_TOKEN: Token de acceso de WhatsApp Business API
 * - WHATSAPP_PHONE_NUMBER_ID: ID del número de teléfono de WhatsApp Business
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Tipos para mejor desarrollo
interface WhatsAppRequest {
  phone: string;
  message: string;
}

interface WhatsAppAPIResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

// Configuración de CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Valida el formato del número de teléfono
 * @param phone Número de teléfono en formato internacional (+57XXXXXXXXX)
 * @returns true si el formato es válido
 */
function isValidPhoneNumber(phone: string): boolean {
  // Formato internacional: debe comenzar con + y tener entre 10 y 15 dígitos
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Envía un mensaje de WhatsApp usando la Cloud API
 * @param phone Número de teléfono destino
 * @param message Mensaje a enviar
 * @param token Token de acceso de WhatsApp
 * @param phoneNumberId ID del número de WhatsApp Business
 * @returns Respuesta de la API de WhatsApp
 */
async function sendWhatsAppMessage(
  phone: string,
  message: string,
  token: string,
  phoneNumberId: string
): Promise<WhatsAppAPIResponse> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: {
      body: message,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `WhatsApp API error: ${response.status} - ${JSON.stringify(errorData)}`
    );
  }

  return await response.json();
}

/**
 * Handler principal de la Edge Function
 */
serve(async (req: Request) => {
  // Manejar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Solo aceptar POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Método no permitido",
        details: "Esta función solo acepta solicitudes POST",
      } as ErrorResponse),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Obtener variables de entorno
    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    // Validar que existan las variables de entorno
    if (!whatsappToken || !phoneNumberId) {
      console.error("Faltan variables de entorno requeridas");
      return new Response(
        JSON.stringify({
          error: "Configuración incompleta",
          details: "Faltan variables de entorno WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID",
        } as ErrorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parsear el body
    let requestData: WhatsAppRequest;
    try {
      requestData = await req.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({
          error: "JSON inválido",
          details: "El cuerpo de la solicitud debe ser un JSON válido",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar parámetros requeridos
    if (!requestData.phone || !requestData.message) {
      return new Response(
        JSON.stringify({
          error: "Parámetros faltantes",
          details: "Se requieren los campos 'phone' y 'message'",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar formato del teléfono
    if (!isValidPhoneNumber(requestData.phone)) {
      return new Response(
        JSON.stringify({
          error: "Formato de teléfono inválido",
          details: "El teléfono debe estar en formato internacional (ej: +573001234567)",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar que el mensaje no esté vacío
    if (requestData.message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "Mensaje vacío",
          details: "El mensaje no puede estar vacío",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Enviar el mensaje
    console.log(`Enviando mensaje a ${requestData.phone}`);
    const result = await sendWhatsAppMessage(
      requestData.phone,
      requestData.message,
      whatsappToken,
      phoneNumberId
    );

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: "Mensaje enviado exitosamente",
        messageId: result.messages[0]?.id,
        whatsappId: result.contacts[0]?.wa_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Manejo de errores generales
    console.error("Error al enviar mensaje de WhatsApp:", error);
    
    return new Response(
      JSON.stringify({
        error: "Error al enviar mensaje",
        details: error instanceof Error ? error.message : "Error desconocido",
      } as ErrorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
