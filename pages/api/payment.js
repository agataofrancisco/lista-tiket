import QRCode from 'qrcode';
import nodemailer from 'nodemailer';

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
    const txData = {
      nome,
      telefone,
      email,
      children,
      totalPrice,
      ticketCount,
      paymentMethod,
      mcxPhone,
      status: 'APPROVED', // Simulação: sempre aprovado
      createdAt: new Date().toISOString()
    };
    transactions.set(transactionId, txData);

    // Simular delay de processamento (1-2 segundos)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Gerar QR Code do bilhete
    const ticketQR = await generateTicketQR({
      nome,
      bilhetes: ticketCount,
      transacao: transactionId,
      data: new Date().toISOString()
    });

    // Enviar para Google Forms
    await sendToGoogleForms(txData, transactionId);

    // Enviar email de confirmação
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

  } catch (error) {
    console.error('Payment error:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar pagamento' });
  }
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

  const formData = new URLSearchParams({
    'entry.1552785722': data.nome,
    'entry.1303791748': data.telefone,
    'entry.1499492708': data.email,
    'entry.1123772826': data.children.length.toString(),
    'entry.1626724011': data.children.join(', '),
    'entry.39898872': data.ticketCount.toString(),
    'entry.827343819': transactionId,
    'entry.691609952': new Date().toLocaleString('pt-AO')
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


// Enviar email de confirmação com Nodemailer
async function sendConfirmationEmail({ to, nome, ticketCount, totalPrice, transactionId, children, qrCode }) {
  // Verificar se SMTP está configurado
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('SMTP não configurado - Email não enviado');
    console.log('Dados do bilhete:', { to, nome, ticketCount, totalPrice, transactionId });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    // Extrair base64 do QR Code para anexar
    const qrBase64 = qrCode ? qrCode.split(',')[1] : null;

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Lista Tiket'}" <${process.env.FROM_EMAIL || smtpUser}>`,
      to: to,
      subject: `Confirmação de Bilhete - ${transactionId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px 15px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Lista Tiket</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Confirmação de Bilhete</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 15px 15px;">
            <h2 style="color: #28a745; margin-top: 0;">Pagamento Confirmado!</h2>
            
            <p>Olá <strong>${nome}</strong>,</p>
            <p>Os seus bilhetes para o evento infantil foram reservados com sucesso.</p>
            
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Detalhes da Compra</h3>
              <p><strong>ID da Transação:</strong> ${transactionId}</p>
              <p><strong>Número de Bilhetes:</strong> ${ticketCount}</p>
              <p><strong>Idades das Crianças:</strong> ${children.join(', ')} anos</p>
              <p><strong>Total Pago:</strong> ${totalPrice.toLocaleString('pt-AO')} Kz</p>
            </div>
            
            ${qrCode ? `
            <div style="text-align: center; margin: 20px 0;">
              <p style="color: #666; margin-bottom: 15px;">Apresente este QR Code na entrada do evento:</p>
              <img src="cid:qrcode" alt="QR Code do Bilhete" style="max-width: 200px; border: 3px dashed #667eea; border-radius: 10px; padding: 10px;">
            </div>
            ` : ''}
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Obrigado por escolher Lista Tiket!<br>
              Em caso de dúvidas, entre em contacto connosco.
            </p>
          </div>
        </div>
      `,
      attachments: qrBase64 ? [{
        filename: `bilhete-${transactionId}.png`,
        content: qrBase64,
        encoding: 'base64',
        cid: 'qrcode'
      }] : []
    };

    await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso para:', to);
  } catch (error) {
    console.error('Erro ao enviar email:', error);
  }
}

// Exportar transactions para o webhook
export { transactions };
