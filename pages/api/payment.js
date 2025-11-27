import QRCode from 'qrcode';

// Cache do token AppyPay
let tokenCache = { token: null, expiresAt: 0 };

// Armazenamento temporário de transações (em produção usar DB)
const transactions = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nome, telefone, email, children, paymentMethod, mcxPhone, totalPrice, ticketCount } = req.body;

    // Gerar ID único da transação
    const transactionId = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Guardar dados da transação
    transactions.set(transactionId, {
      nome,
      telefone,
      email,
      children,
      totalPrice,
      ticketCount,
      paymentMethod,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    // Obter token AppyPay
    const token = await getAppyPayToken();

    // Criar cobrança na AppyPay
    const chargeResponse = await createCharge({
      token,
      transactionId,
      amount: totalPrice,
      paymentMethod,
      phoneNumber: mcxPhone,
      description: `Bilhetes Evento Infantil - ${nome}`
    });

    // Se pagamento aprovado (simulação ou real)
    if (chargeResponse.status === 'APPROVED' || process.env.NODE_ENV === 'development') {
      // Atualizar status
      const txData = transactions.get(transactionId);
      txData.status = 'APPROVED';
      transactions.set(transactionId, txData);

      // Gerar QR Code do bilhete
      const ticketQR = await generateTicketQR({
        nome,
        bilhetes: ticketCount,
        transacao: transactionId,
        data: new Date().toISOString()
      });

      // Enviar para Google Forms
      await sendToGoogleForms(txData, transactionId);

      // Enviar email com QR
      await sendConfirmationEmail({
        to: email,
        nome,
        ticketCount,
        totalPrice,
        transactionId,
        children,
        qrCode: ticketQR
      });

      return res.status(200).json({
        success: true,
        transactionId,
        ticketCount,
        qrCode: ticketQR,
        message: 'Pagamento confirmado!'
      });
    }

    // Se QR_CODE, retornar QR de pagamento
    if (paymentMethod === 'QR_CODE' && chargeResponse.qrCode) {
      return res.status(200).json({
        success: true,
        transactionId,
        paymentQR: chargeResponse.qrCode,
        status: 'PENDING'
      });
    }

    return res.status(200).json({
      success: true,
      transactionId,
      status: chargeResponse.status || 'PENDING'
    });

  } catch (error) {
    console.error('Payment error:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar pagamento' });
  }
}

// Obter token de autenticação AppyPay
async function getAppyPayToken() {
  // Verificar cache
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  // Em desenvolvimento, simular token
  if (process.env.NODE_ENV === 'development' && !process.env.APPYPAY_CLIENT_SECRET) {
    return 'dev-token-simulated';
  }

  const tokenUrl = process.env.APPYPAY_TOKEN_URL || 
    'https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token';

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.APPYPAY_CLIENT_ID,
    client_secret: process.env.APPYPAY_CLIENT_SECRET,
    resource: 'https://appypaydev.onmicrosoft.com/appypay-payment-gateway'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error('Falha na autenticação AppyPay');
  }

  const data = await response.json();
  
  // Cache por 50 minutos (token expira em 1 hora)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (50 * 60 * 1000)
  };

  return data.access_token;
}

// Criar cobrança na AppyPay
async function createCharge({ token, transactionId, amount, paymentMethod, phoneNumber, description }) {
  // Em desenvolvimento sem credenciais, simular
  if (process.env.NODE_ENV === 'development' && !process.env.APPYPAY_CLIENT_SECRET) {
    console.log('Simulando pagamento AppyPay:', { transactionId, amount, paymentMethod });
    return { status: 'APPROVED', transactionId };
  }

  const apiUrl = process.env.APPYPAY_API_URL || 'https://gwy-api-tst.appypay.co.ao/v1';
  
  const body = {
    clientId: process.env.APPYPAY_CLIENT_ID,
    merchantTransactionId: transactionId,
    amount: amount,
    currency: 'AOA',
    paymentMethod: paymentMethod,
    description: description
  };

  // Adicionar info específica do método de pagamento
  if (paymentMethod === 'MCX_EXPRESS' && phoneNumber) {
    body.paymentInfo = { phoneNumber: phoneNumber.replace(/\s/g, '') };
  }

  const response = await fetch(`${apiUrl}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na cobrança AppyPay');
  }

  return data;
}

// Gerar QR Code do bilhete
async function generateTicketQR(data) {
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(data), {
      width: 300,
      margin: 2,
      color: { dark: '#667eea', light: '#ffffff' }
    });
    return qrDataUrl;
  } catch (error) {
    console.error('Erro ao gerar QR:', error);
    return null;
  }
}

// Enviar para Google Forms
async function sendToGoogleForms(data, transactionId) {
  const formId = process.env.GOOGLE_FORM_ID;
  if (!formId) {
    console.log('Google Form ID não configurado');
    return;
  }

  const formUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
  
  // IDs dos campos do Google Form (você precisa criar o form e pegar os IDs)
  const formData = new URLSearchParams({
    'entry.1552785722': data.nome,           // Nome
    'entry.1303791748': data.telefone,       // Telefone
    'entry.1499492708': data.email,          // Email
    'entry.1123772826': data.children.length.toString(), // Nº Crianças
    'entry.1626724011': data.children.join(', '),        // Idades
    'entry.39898872': data.ticketCount.toString(),     // Nº Bilhetes
    'entry.827343819': transactionId,       // ID Transação
    'entry.691609952': new Date().toLocaleString('pt-AO') // Data/Hora
  });

  try {
    await fetch(formUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    console.log('Dados enviados para Google Forms');
  } catch (error) {
    console.error('Erro ao enviar para Google Forms:', error);
  }
}

// Enviar email de confirmação com EmailJS
async function sendConfirmationEmail({ to, nome, ticketCount, totalPrice, transactionId, children, qrCode }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_ticket';
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !publicKey) {
    console.log('EmailJS não configurado');
    return;
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: to,
          to_name: nome,
          ticket_count: ticketCount,
          total_price: totalPrice,
          transaction_id: transactionId,
          children_ages: children.join(', '),
          qr_code_image: qrCode // Base64 do QR
        }
      })
    });

    if (response.ok) {
      console.log('Email enviado com sucesso');
    } else {
      console.error('Erro ao enviar email:', await response.text());
    }
  } catch (error) {
    console.error('Erro ao enviar email:', error);
  }
}

// Exportar transactions para o webhook
export { transactions };
