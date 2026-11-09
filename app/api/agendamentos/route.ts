// Cria um agendamento. Roda no servidor com a service role,
// então o cliente nunca grava direto no banco.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
// Chave de serviço: fica só no servidor (variável de ambiente), nunca no navegador
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
 
type Entrada = {
  nome: string;
  whatsapp: string;          // só dígitos, com DDD
  tipo: 'carro' | 'moto';
  modelo: string;
  placa?: string;
  servicoId: string;
  data: string;              // 'AAAA-MM-DD'
  hora: string;              // 'HH:MM'
  observacoes?: string;
};
 
export async function POST(req: Request) {
  const e = (await req.json()) as Entrada;
 
  // 1. Validação básica dos dados
  if (!e.nome?.trim() || !/^\d{10,11}$/.test(e.whatsapp ?? '')) {
    return NextResponse.json({ erro: 'Nome ou WhatsApp inválido.' }, { status: 400 });
  }
  if (!['carro', 'moto'].includes(e.tipo) || !e.modelo?.trim()) {
    return NextResponse.json({ erro: 'Veículo incompleto.' }, { status: 400 });
  }
 
  // 2. Preço e duração vêm do banco, nunca do navegador
  const { data: preco, error: erroPreco } = await supabase
    .from('servico_precos')
    .select('duracao_minutos, preco_centavos')
    .eq('servico_id', e.servicoId)
    .eq('tipo_veiculo', e.tipo)
    .single();
  if (erroPreco || !preco) {
    return NextResponse.json({ erro: 'Serviço indisponível para este veículo.' }, { status: 400 });
  }
 
  // 3. Horário precisa estar dentro do funcionamento e respeitar a antecedência mínima
  const inicio = new Date(`${e.data}T${e.hora}:00-03:00`); // ajuste conforme o fuso da estética
  const fim = new Date(inicio.getTime() + preco.duracao_minutos * 60_000);
  const { data: config } = await supabase.from('configuracao').select('antecedencia_minima_minutos').eq('id', 1).single();
  const agora = Date.now();
  if (inicio.getTime() < agora + (config?.antecedencia_minima_minutos ?? 60) * 60_000) {
    return NextResponse.json({ erro: 'Horário muito próximo. Escolha outro.' }, { status: 400 });
  }
 
  const diaSemana = inicio.getDay();
  const { data: funcionamento } = await supabase
    .from('horarios_funcionamento')
    .select('abre, fecha')
    .eq('dia_semana', diaSemana)
    .single();
  if (!funcionamento) {
    return NextResponse.json({ erro: 'A estética não funciona nesse dia.' }, { status: 400 });
  }
 
  // 4. Cliente: cria ou reaproveita pelo WhatsApp
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .upsert({ nome: e.nome.trim(), whatsapp: e.whatsapp }, { onConflict: 'whatsapp' })
    .select('id')
    .single();
  if (erroCliente || !cliente) {
    return NextResponse.json({ erro: 'Não foi possível salvar o cliente.' }, { status: 500 });
  }
 
  // 5. Veículo ligado ao cliente
  const { data: veiculo, error: erroVeiculo } = await supabase
    .from('veiculos')
    .insert({ cliente_id: cliente.id, tipo: e.tipo, modelo: e.modelo.trim(), placa: e.placa?.toUpperCase() ?? null })
    .select('id')
    .single();
  if (erroVeiculo || !veiculo) {
    return NextResponse.json({ erro: 'Não foi possível salvar o veículo.' }, { status: 500 });
  }
 
  // 6. Agendamento. A constraint do banco impede dois horários sobrepostos.
  const { data: agendamento, error: erroAg } = await supabase
    .from('agendamentos')
    .insert({
      cliente_id: cliente.id,
      veiculo_id: veiculo.id,
      servico_id: e.servicoId,
      periodo: `[${inicio.toISOString()},${fim.toISOString()})`,
      valor_centavos: preco.preco_centavos,   // preço congelado na reserva
      status: 'pendente',
      observacoes: e.observacoes ?? null,
    })
    .select('id')
    .single();
  if (erroAg || !agendamento) {
    return NextResponse.json({ erro: 'Esse horário acabou de ser reservado. Escolha outro.' }, { status: 409 });
  }
 
  // 7. Cobrança Pix (TODO: integrar o gateway escolhido: Asaas, Efí ou Mercado Pago)
  // Aqui entra a chamada que gera o QR Code e o código copia e cola, e grava em `pagamentos`.
  // A confirmação chega depois, por webhook, e muda o status para 'confirmado'.
 
  return NextResponse.json({ agendamentoId: agendamento.id, valorCentavos: preco.preco_centavos });
