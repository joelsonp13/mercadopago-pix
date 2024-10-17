import express from 'express';
import 'dotenv/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import path from 'path';

const app = express();

// Adicione este middleware no início do arquivo
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://vercel.live");
  next();
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

async function criarPagamento(valor, descricao) {
	const client = new MercadoPagoConfig({
		accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
		options: { timeout: 5000 }
	});

	const payment = new Payment(client);

	const body = {
		transaction_amount: parseFloat(valor),
		description: descricao,
		payment_method_id: 'pix',
		payer: { email: 'comprador@exemplo.com' },
	};

	try {
		const response = await payment.create({ body });
		console.log('Resposta do Mercado Pago:', JSON.stringify(response, null, 2));
		return response;
	} catch (error) {
		console.error('Erro detalhado ao criar pagamento:', error);
		throw error;
	}
}

app.get('/pagar', async (req, res) => {
	const { id, nome, preco } = req.query;

	try {
		console.log('Iniciando pagamento:', { id, nome, preco });
		const pagamento = await criarPagamento(preco, `Pagamento de ${nome}`);
		console.log('Pagamento criado:', pagamento);
		
		if (!pagamento.point_of_interaction || !pagamento.point_of_interaction.transaction_data) {
			throw new Error('Dados do QR code não encontrados na resposta do Mercado Pago');
		}

		const qrCodeBase64 = pagamento.point_of_interaction.transaction_data.qr_code_base64;
		const qrCode = pagamento.point_of_interaction.transaction_data.qr_code;

		if (!qrCodeBase64 || !qrCode) {
			throw new Error('QR code ou código PIX não encontrados na resposta do Mercado Pago');
		}

		res.render('pix', { 
			nome: nome,
			preco: preco,
			qrCode: qrCode,
			qrCodeBase64: qrCodeBase64
		});
	} catch (error) {
		console.error('Erro detalhado:', error);
		res.status(500).json({ error: error.message, stack: error.stack });
	}
});

// Rota para a página inicial
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'produtos.html'));
});

app.post('/webhook', express.json(), async (req, res) => {
	const { data } = req.body;
	
	if (data.id) {
		try {
			const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
			const payment = new Payment(client);
			const paymentInfo = await payment.get({ id: data.id });
			
			if (paymentInfo.status === 'approved') {
				// Atualize o status do pedido no seu sistema
				console.log(`Pagamento aprovado para o pedido ${paymentInfo.external_reference}`);
			}
			
			res.sendStatus(200);
		} catch (error) {
			console.error('Erro ao processar notificação:', error);
			res.sendStatus(500);
		}
	} else {
		res.sendStatus(400);
	}
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Certifique-se de que esta linha esteja no final do arquivo
export default app;
