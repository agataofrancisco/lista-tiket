import { useState } from 'react';
import Head from 'next/head';

const TICKET_PRICE = 1000;
const MIN_PAYING_AGE = 5;

export default function Home() {
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: ''
  });
  const [children, setChildren] = useState([{ age: '' }]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [mcxPhone, setMcxPhone] = useState('');
  const [transactionId, setTransactionId] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [error, setError] = useState(null);

  const ages = children.map(c => parseInt(c.age) || 0).filter(a => a > 0);
  const payingChildren = ages.filter(a => a >= MIN_PAYING_AGE).length;
  const freeChildren = ages.filter(a => a < MIN_PAYING_AGE).length;
  const ticketCount = 1 + payingChildren;
  const totalPrice = ticketCount * TICKET_PRICE;

  const addChild = () => setChildren([...children, { age: '' }]);

  const removeChild = (index) => {
    if (children.length > 1) {
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const updateChildAge = (index, age) => {
    const updated = [...children];
    updated[index].age = age;
    setChildren(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (ages.length === 0) {
      alert('Por favor, adicione pelo menos uma criança com idade válida.');
      return;
    }
    setStep('payment');
  };

  const processPayment = async () => {
    setStep('processing');
    setError(null);

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          telefone: formData.telefone,
          email: formData.email,
          children: ages,
          paymentMethod,
          mcxPhone: paymentMethod === 'MCX_EXPRESS' ? mcxPhone : null,
          totalPrice,
          ticketCount
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro no pagamento');

      setTransactionId(data.transactionId);
      setQrCodeUrl(data.qrCode);
      setStep('success');
    } catch (err) {
      setError(err.message);
      setStep('payment');
    }
  };

  return (
    <>
      <Head>
        <title>Lista Tiket - Bilhetes para Evento Infantil</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="container">
        <header>
          <h1>Lista Tiket</h1>
          <p className="subtitle">Compre os seus bilhetes para o evento infantil</p>
        </header>

        <main>
          {/* Formulário */}
          {step === 'form' && (
            <section className="card">
              <h2>Dados do Responsável</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="form-group">
                  <label>Número de Telefone *</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    required
                    placeholder="9XX XXX XXX"
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="seu@email.com"
                  />
                </div>

                <h3>Crianças</h3>
                {children.map((child, index) => (
                  <div key={index} className="child-entry">
                    <label>Idade da Criança {index + 1}:</label>
                    <input
                      type="number"
                      min="0"
                      max="17"
                      value={child.age}
                      onChange={(e) => updateChildAge(index, e.target.value)}
                      placeholder="Idade"
                    />
                    {children.length > 1 && (
                      <button type="button" className="btn-remove" onClick={() => removeChild(index)}>X</button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addChild}>+ Adicionar Criança</button>

                <div className="summary-box">
                  <h3>Resumo</h3>
                  <p>Total de pessoas: {1 + ages.length}</p>
                  <p>Crianças que pagam (5+ anos): {payingChildren}</p>
                  <p>Crianças grátis (&lt;5 anos): {freeChildren}</p>
                  <p>Adulto: 1</p>
                  <p className="total-price">Total a Pagar: {totalPrice.toLocaleString('pt-AO')} Kz</p>
                </div>

                <button type="submit" className="btn-primary">Continuar para Pagamento</button>
              </form>
            </section>
          )}

          {/* Pagamento */}
          {step === 'payment' && (
            <section className="card">
              <h2>Método de Pagamento</h2>
              {error && <div className="error-msg">{error}</div>}

              <div className="payment-methods">
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'MCX_EXPRESS' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('MCX_EXPRESS')}
                >
                  <span className="payment-icon">MCX</span>
                  <span>Multicaixa Express</span>
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'QR_CODE' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('QR_CODE')}
                >
                  <span className="payment-icon">QR</span>
                  <span>Código QR</span>
                </button>
              </div>

              {paymentMethod === 'MCX_EXPRESS' && (
                <div className="payment-form">
                  <h3>Multicaixa Express</h3>
                  <div className="form-group">
                    <label>Número de Telefone (Multicaixa)</label>
                    <input
                      type="tel"
                      value={mcxPhone}
                      onChange={(e) => setMcxPhone(e.target.value)}
                      placeholder="9XX XXX XXX"
                    />
                  </div>
                  <button type="button" className="btn-primary" onClick={processPayment}>Pagar Agora</button>
                </div>
              )}

              {paymentMethod === 'QR_CODE' && (
                <div className="payment-form">
                  <h3>Pagamento por QR Code</h3>
                  <p>Clique para gerar o código QR de pagamento</p>
                  <button type="button" className="btn-primary" onClick={processPayment}>Gerar QR Code</button>
                </div>
              )}

              <button type="button" className="btn-secondary" onClick={() => setStep('form')}>Voltar</button>
            </section>
          )}

          {/* Processando */}
          {step === 'processing' && (
            <section className="card">
              <div className="processing">
                <div className="spinner"></div>
                <h2>Processando Pagamento...</h2>
                <p>Por favor, aguarde enquanto confirmamos o seu pagamento.</p>
              </div>
            </section>
          )}

          {/* Sucesso */}
          {step === 'success' && (
            <section className="card">
              <div className="success">
                <h2>Pagamento Confirmado!</h2>
                <p>Os seus bilhetes foram reservados com sucesso.</p>
                <div className="ticket-info">
                  <p><strong>Nome:</strong> {formData.nome}</p>
                  <p><strong>Número de Bilhetes:</strong> {ticketCount}</p>
                  <p><strong>ID:</strong> {transactionId}</p>
                </div>
                {qrCodeUrl && (
                  <div className="ticket-qr">
                    <img src={qrCodeUrl} alt="QR Code do Bilhete" />
                  </div>
                )}
                <p className="qr-instruction">Apresente este QR Code na entrada do evento</p>
                <a href={qrCodeUrl} download={`bilhete-${transactionId}.png`} className="btn-primary">
                  Baixar Bilhete
                </a>
              </div>
            </section>
          )}
        </main>

        <footer>
          <p>© 2024 Lista Tiket - Todos os direitos reservados</p>
        </footer>
      </div>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
      `}</style>

      <style jsx>{`
        .container { max-width: 600px; margin: 0 auto; }
        header { text-align: center; color: white; margin-bottom: 30px; }
        header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .subtitle { font-size: 1.1rem; opacity: 0.9; }
        .card { background: white; border-radius: 20px; padding: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); margin-bottom: 20px; }
        .card h2 { color: #333; margin-bottom: 20px; font-size: 1.5rem; }
        .card h3 { color: #555; margin: 20px 0 15px; font-size: 1.2rem; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: #555; font-weight: 500; }
        .form-group input { width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 1rem; }
        .form-group input:focus { outline: none; border-color: #667eea; }
        .child-entry { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 10px; }
        .child-entry label { flex: 1; color: #555; }
        .child-entry input { width: 80px; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 8px; text-align: center; }
        .btn-remove { background: #ff6b6b; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold; }
        .btn-primary { display: block; width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 20px; text-align: center; text-decoration: none; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4); }
        .btn-secondary { width: 100%; padding: 12px; background: #f0f0f0; color: #555; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; margin-top: 10px; }
        .summary-box { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%); padding: 20px; border-radius: 15px; margin-top: 25px; }
        .summary-box h3 { margin-top: 0; color: #333; }
        .summary-box p { margin: 8px 0; color: #555; }
        .total-price { font-size: 1.3rem; font-weight: 700; color: #667eea; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #ccc; }
        .payment-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .payment-btn { display: flex; flex-direction: column; align-items: center; padding: 25px 15px; background: #f8f9fa; border: 3px solid #e0e0e0; border-radius: 15px; cursor: pointer; }
        .payment-btn:hover, .payment-btn.active { border-color: #667eea; background: #f0f4ff; }
        .payment-icon { font-size: 1.5rem; margin-bottom: 10px; font-weight: bold; color: #667eea; }
        .payment-form { padding: 20px; background: #f8f9fa; border-radius: 15px; margin-top: 20px; }
        .processing { text-align: center; padding: 40px 20px; }
        .spinner { width: 60px; height: 60px; border: 5px solid #f0f0f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .success { text-align: center; }
        .success h2 { color: #28a745; font-size: 1.8rem; }
        .ticket-info { background: #f8f9fa; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: left; }
        .ticket-info p { margin: 10px 0; }
        .ticket-qr { display: flex; justify-content: center; margin: 20px 0; padding: 20px; background: white; border: 3px dashed #667eea; border-radius: 15px; }
        .ticket-qr img { max-width: 200px; }
        .qr-instruction { color: #666; font-style: italic; margin-bottom: 20px; }
        .error-msg { background: #ffe0e0; color: #c00; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        footer { text-align: center; color: white; opacity: 0.8; margin-top: 30px; padding: 20px; }
        @media (max-width: 480px) { header h1 { font-size: 2rem; } .card { padding: 20px; } .payment-methods { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
