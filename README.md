# 🎈 Lista Tiket

Sistema de reserva de bilhetes para eventos infantis com pagamento via AppyPay.

## Funcionalidades

- Cadastro do adulto (nome, telefone, email)
- Registro de crianças com idades
- Crianças < 5 anos: **GRÁTIS**
- Crianças 5+ anos e adulto: **1000 Kz** cada
- Pagamento via AppyPay (Multicaixa Express ou QR Code)
- Integração com Google Forms
- Email de confirmação com QR Code
- QR Code do bilhete para entrada no evento

## Deploy na Vercel

### 1. Instalar dependências localmente (para testar)
```bash
npm install
npm run dev
```

### 2. Deploy na Vercel
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 3. Configurar variáveis de ambiente na Vercel

No dashboard da Vercel, vá em Settings > Environment Variables e adicione:

| Variável | Valor |
|----------|-------|
| `APPYPAY_CLIENT_ID` | `5c8bd6f5-3d40-4801-b3e3-2da0b710068f` |
| `APPYPAY_CLIENT_SECRET` | Seu client secret da AppyPay |
| `APPYPAY_API_URL` | `https://gwy-api-tst.appypay.co.ao/v1` |
| `APPYPAY_TOKEN_URL` | `https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token` |
| `EMAILJS_SERVICE_ID` | `service_9ln5ox8` |
| `EMAILJS_TEMPLATE_ID` | `template_ticket` |
| `EMAILJS_PUBLIC_KEY` | `JYydfLhR3cV0oTcQi` |
| `EMAILJS_PRIVATE_KEY` | `XMSbsicK5LrBTWKTEsC8U` |
| `GOOGLE_FORM_ID` | ID do seu Google Form |
| `NEXT_PUBLIC_APP_URL` | URL do seu app na Vercel |

## Configurar Google Forms

1. Crie um novo Google Form em [forms.google.com](https://forms.google.com)
2. Adicione estes campos (na ordem):
   - Nome do Responsável (Resposta curta)
   - Telefone (Resposta curta)
   - Email (Resposta curta)
   - Número de Crianças (Resposta curta)
   - Idades das Crianças (Resposta curta)
   - Número de Bilhetes (Resposta curta)
   - ID da Transação (Resposta curta)
   - Data/Hora (Resposta curta)

3. Obtenha o ID do formulário da URL:
   `https://docs.google.com/forms/d/e/ESTE_E_O_ID/viewform`

4. Adicione o ID na variável `GOOGLE_FORM_ID`

**Nota:** Os IDs dos campos (entry.XXXXXX) são gerados automaticamente. Se precisar personalizar, inspecione o HTML do formulário para encontrar os IDs corretos.

## Configurar EmailJS

1. Crie conta em [emailjs.com](https://www.emailjs.com/)
2. Crie um template de email com estas variáveis:
   - `{{to_name}}` - Nome do cliente
   - `{{to_email}}` - Email do cliente
   - `{{ticket_count}}` - Número de bilhetes
   - `{{total_price}}` - Valor total
   - `{{transaction_id}}` - ID da transação
   - `{{children_ages}}` - Idades das crianças
   - `{{qr_code_image}}` - QR Code (base64)

3. Para incluir o QR no email, use:
   ```html
   <img src="{{qr_code_image}}" alt="QR Code do Bilhete" />
   ```

## Configurar Webhook AppyPay

Configure o webhook no portal AppyPay para:
```
https://seu-app.vercel.app/api/webhook
```

O webhook recebe confirmações de pagamento e:
- Atualiza o status da transação
- Envia dados para Google Forms
- Envia email de confirmação

## Estrutura do Projeto

```
lista-tiket/
├── pages/
│   ├── index.js          # Página principal (React)
│   └── api/
│       ├── payment.js    # API de pagamento
│       └── webhook.js    # Webhook AppyPay
├── package.json
├── vercel.json
├── .env.local            # Variáveis locais
└── README.md
```

## API Endpoints

### POST /api/payment
Processa pagamento e retorna QR Code do bilhete.

### POST /api/webhook
Recebe notificações da AppyPay sobre status de pagamentos.

## Tecnologias

- Next.js 14 (React)
- Vercel (Hosting)
- AppyPay (Pagamentos)
- EmailJS (Emails)
- Google Forms (Armazenamento)
- QRCode.js (Geração de QR)
