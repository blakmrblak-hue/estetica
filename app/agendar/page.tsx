'use client';
 
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
type Preco = { tipo_veiculo: 'carro' | 'moto'; duracao_minutos: number; preco_centavos: number };
type Servico = { id: string; nome: string; descricao: string | null; servico_precos: Preco[] };
 
const horarios: string[] = [];
for (let h = 8; h < 17; h++) for (const m of [0, 30]) {
  horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}
 
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
 
const campo = {
  width: '100%', padding: 12, borderRadius: 10, border: '1px solid #d1d5db',
  marginBottom: 12, font: 'inherit', boxSizing: 'border-box',
} as const;
 
export default function Agendar() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [form, setForm] = useState({
    nome: '', whatsapp: '', tipo: 'carro' as 'carro' | 'moto', modelo: '',
    placa: '', servicoId: '', data: '', hora: '',
  });
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
 
  useEffect(() => {
    supabase
      .from('servicos')
      .select('id, nome, descricao, servico_precos(tipo_veiculo, duracao_minutos, preco_centavos)')
      .eq('ativo', true)
      .then(({ data }) => setServicos((data as Servico[]) ?? []));
  }, []);
 
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const precoDo = (s: Servico) => s.servico_precos.find(p => p.tipo_veiculo === form.tipo);
  const servicoSel = servicos.find(s => s.id === form.servicoId);
  const precoSel = servicoSel ? precoDo(servicoSel) : undefined;
 
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg('');
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, whatsapp: form.whatsapp.replace(/\D/g, '') }),
    });
    const body = await res.json();
    setEnviando(false);
    setMsg(res.ok
      ? `Agendamento criado. Valor: ${brl(body.valorCentavos)}. Pague via Pix para confirmar.`
      : body.erro);
  }
 
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 20, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22 }}>Agende seu horário</h1>
      <form onSubmit={enviar}>
        <input style={campo} placeholder="Seu nome" value={form.nome}
          onChange={e => set('nome', e.target.value)} required />
        <input style={campo} placeholder="WhatsApp (DDD + número)" value={form.whatsapp}
          onChange={e => set('whatsapp', e.target.value)} required />
        <select style={campo} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="carro">Carro</option>
          <option value="moto">Moto</option>
        </select>
        <input style={campo} placeholder="Modelo (ex.: Honda Civic 2019)" value={form.modelo}
          onChange={e => set('modelo', e.target.value)} required />
        <input style={campo} placeholder="Placa (opcional)" value={form.placa}
          onChange={e => set('placa', e.target.value)} />
        <select style={campo} value={form.servicoId} onChange={e => set('servicoId', e.target.value)} required>
          <option value="">Escolha o serviço</option>
          {servicos.map(s => {
            const p = precoDo(s);
            return p ? <option key={s.id} value={s.id}>{s.nome} · {brl(p.preco_centavos)}</option> : null;
          })}
        </select>
        <input style={campo} type="date" value={form.data}
          onChange={e => set('data', e.target.value)} required />
        <select style={campo} value={form.hora} onChange={e => set('hora', e.target.value)} required>
          <option value="">Escolha o horário</option>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        {precoSel && (
          <p>Total: <strong>{brl(precoSel.preco_centavos)}</strong> · ~{precoSel.duracao_minutos} min</p>
        )}
        <button disabled={enviando} style={{
          width: '100%', padding: 14, borderRadius: 10, border: 0,
          background: '#0b5d57', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>
          {enviando ? 'Enviando...' : 'Agendar'}
        </button>
      </form>
      {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
    </main>
  );
}
