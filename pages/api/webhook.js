import QRCode from 'qrcode';

// Importar o armazenamento de transações
// Em produção, usar um banco de dados real
const transactions = new Map();

export default async function handler(req, res) {
  // AppyPay envia POST para o webhook
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    console.log('Webhook recebido:', JSON.stringify(payload, null, 2));

    // Estrutura do payload AppyPay:
    // {
    //   "merchantTransactionId": "TKT-xxx",
    //   "transactionId": "xxx",
    //   "status": "APPROVED" | "DECLINED" | "PENDING",
    //   "amount": 1000,
    //   "currency": "AOA",
    //   "paymentMethod": "MCX_EXPRESS" | "QR_CODE",
    //   "resultCode": "00",
    //   "resultDescription": "Success"
    // }

    const { merchantTransactionId, status, transactionId: appyPayTxId } = payload;

    if (!merchantTransactionId) {
      return res.status(400).json({ error: 'merchantTransactionId required' });
    }

    // Buscar transação local
    const txData = transactions.get(merchantTransactionId);
    
    if (!txData) {
      console.log('Transação não encontrada:', merchantTransactionId);
      // Ainda assim retornar 200 para AppyPay não reenviar
      return res.status(200).json({ received: true });
    }

    // Atualizar status
    txData.status = status;
    txData.appyPayTransactionId = appyPayTxId;
    txData.updatedAt = new Date().toISOString();
    transactions.set(merchantTransactionId, txData);

    // Se aprovado, processar
    if (status === 'APPROVED') {
      await processApprovedPayment(merchantTransactionId, txData);
    }

    // Responder 200 para confirmar recebimento
    return res.status(200).json({ 
      received: true,
      merchantTransactionId,
      status 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    // Retornar 200 mesmo com erro para evitar reenvios
    return res.status(200).json({ received: true, error: error.message });
  }
}

async function processApprovedPayment(transactionId, txData) {
  try {
    // Gerar QR Code do bilhete
    const ticketQR = await QRCode.toDataURL(JSON.stringify({
      nome: txData.nome,
      bilhetes: txData.ticketCount,
      transacao: transactionId,
      data: new Date().toISOString()
    }), {
      width: 300,
      margin: 2,
      color: { dark: '#667eea', light: '#ffffff' }
    });

    // Enviar para Google Forms
    await sendToGoogleForms(txData, transactionId);

    // Enviar email
    await sendConfirmationEmail({
      to: txData.email,
      nome: txData.nome,
      ticketCount: txData.ticketCount,
      totalPrice: txData.totalPrice,
      transactionId,
      children: txData.children,
      qrCode: ticketQR
    });

    console.log('Pagamento processado com sucesso:', transactionId);
  } catch (error) {
    console.error('Erro ao processar pagamento aprovado:', error);
  }
}

// Enviar para Google Forms
async function sendToGoogleForms(data, transactionId) {
  const formId = process.env.GOOGLE_FORM_ID;
  if (!formId) return;

  const formUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
  
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
  } catch (error) {
    console.error('Erro Google Forms:', error);
  }
}

// Enviar email
async function sendConfirmationEmail({ to, nome, ticketCount, totalPrice, transactionId, children, qrCode }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_ticket';
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !publicKey) return;

  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
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
          qr_code_image: qrCode
        }
      })
    });
  } catch (error) {
    console.error('Erro email:', error);
  }
}
