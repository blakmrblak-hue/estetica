'use client';
 
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
type Tipo = 'carro' | 'moto';
type Preco = { tipo_veiculo: Tipo; duracao_minutos: number; preco_centavos: number };
type Servico = { id: string; nome: string; descricao: string | null; servico_precos: Preco[] };
type Veiculo = { tipo: Tipo; modelo: string; ano: string; cor: string; foto: string | null };
type Proximo = { servico: string; quando: string };
 
const TEMPO_PIX = 900; // 15 minutos
 
const HORARIOS: string[] = [];
for (let h = 8; h < 17; h++) for (const m of [0, 30]) {
  HORARIOS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}
 
const HISTORICO = [
  { servico: 'Lavagem completa', data: '12/09/2026', valor: 8000 },
  { servico: 'Vitrificação', data: '03/07/2026', valor: 60000 },
  { servico: 'Limpeza detalhada', data: '15/05/2026', valor: 25000 },
];
 
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string) => iso.split('-').reverse().join('/');
const soDigitos = (v: string) => v.replace(/\D/g, '');
const mascaraWhats = (v: string) =>
  soDigitos(v).slice(0, 11).replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`);
 
const GRADIENTES = [
  'linear-gradient(135deg,#0b5d57,#2dd4bf)',
  'linear-gradient(135deg,#1f2937,#4b5563)',
  'linear-gradient(135deg,#0f766e,#134e4a)',
];
 
function IconeUsuario() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
 
export default function Agendar() {
  const [logado, setLogado] = useState(false);
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [aba, setAba] = useState<'veiculo' | 'agendar'>('veiculo');
 
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [editando, setEditando] = useState(true);
  const [form, setForm] = useState({ tipo: 'carro' as Tipo, modelo: '', ano: '', cor: '' });
  const [fotoCarro, setFotoCarro] = useState<string | null>(null);
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const fileCarro = useRef<HTMLInputElement>(null);
  const filePerfil = useRef<HTMLInputElement>(null);
 
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [srvId, setSrvId] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [slide, setSlide] = useState(0);
 
  const [pix, setPix] = useState<{ valor: number; servico: string; quando: string } | null>(null);
  const [seg, setSeg] = useState(TEMPO_PIX);
  const [proximo, setProximo] = useState<Proximo | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState('');
 
  const hoje = new Date().toLocaleDateString('sv-SE');
  const servicoSel = servicos?.find(s => s.id === srvId) ?? null;
 
  useEffect(() => {
    supabase
      .from('servicos')
      .select('id, nome, descricao, servico_precos(tipo_veiculo, duracao_minutos, preco_centavos)')
      .eq('ativo', true)
      .then(({ data: lista }) => setServicos((lista as Servico[]) ?? []));
  }, []);
 
  useEffect(() => {
    if (!pix) return;
    setSeg(TEMPO_PIX);
    const id = setInterval(() => setSeg(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [pix]);
 
  function notificar(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }
 
  function lerFoto(e: ChangeEvent<HTMLInputElement>, set: (url: string) => void) {
    const f = e.target.files?.[0];
    if (f) set(URL.createObjectURL(f));
  }
 
  function salvarVeiculo() {
    setVeiculo({ tipo: form.tipo, modelo: form.modelo.trim(), ano: form.ano, cor: form.cor.trim(), foto: fotoCarro });
    setEditando(false);
    notificar('Veículo salvo');
  }
 
  function editarVeiculo() {
    if (!veiculo) return;
    setForm({ tipo: veiculo.tipo, modelo: veiculo.modelo, ano: veiculo.ano, cor: veiculo.cor });
    setFotoCarro(veiculo.foto);
    setEditando(true);
  }
 
  async function gerarPix() {
    if (!veiculo || !servicoSel) return;
    setEnviando(true);
    setErro('');
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        whatsapp: soDigitos(whats),
        tipo: veiculo.tipo,
        modelo: veiculo.modelo,
        servicoId: servicoSel.id,
        data,
        hora,
      }),
    });
    const body = await res.json();
    setEnviando(false);
    if (!res.ok) {
      setErro(body.erro ?? 'Não foi possível agendar. Tente de novo.');
      return;
    }
    setPix({ valor: body.valorCentavos, servico: servicoSel.nome, quando: `${fmtData(data)} às ${hora}` });
  }
 
  function confirmarPagamento() {
    if (!pix) return;
    setProximo({ servico: pix.servico, quando: pix.quando });
    setPix(null);
    setSrvId(null);
    setData('');
    setHora('');
    setAba('veiculo');
    notificar('Agendamento confirmado');
  }
 
  const mm = String(Math.floor(seg / 60)).padStart(2, '0');
  const ss = String(seg % 60).padStart(2, '0');
 
  // 1. Entrada com nome e telefone
  if (!logado) {
    return (
      <div className="app">
        <div className="gate enter">
          <h1 className="gate-title">Estética Automotiva Exemplo</h1>
          <p className="gate-sub">Entre com seu nome e telefone para agendar</p>
          <div className="gate-card">
            <label className="label" htmlFor="gNome">Seu nome</label>
            <input id="gNome" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            <label className="label" htmlFor="gWhats">Telefone (WhatsApp)</label>
            <input
              id="gWhats"
              placeholder="(85) 99999-9999"
              inputMode="tel"
              value={whats}
              onChange={e => setWhats(mascaraWhats(e.target.value))}
            />
            <button
              className="btn"
              disabled={!nome.trim() || soDigitos(whats).length < 10}
              onClick={() => { setNome(nome.trim()); setLogado(true); }}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="app">
      {aba === 'veiculo' ? (
        <section className="enter">
          {editando || !veiculo ? (
            <>
              <div className="perfil">
                <div className="avatar" onClick={() => filePerfil.current?.click()}
                  style={fotoPerfil ? { backgroundImage: `url(${fotoPerfil})` } : undefined}>
                  {!fotoPerfil && <IconeUsuario />}
                </div>
                <div>
                  <h1>{nome}</h1>
                  <p>Cliente</p>
                </div>
              </div>
              <input ref={filePerfil} type="file" accept="image/*" hidden onChange={e => lerFoto(e, setFotoPerfil)} />
 
              <div className="panel">
                <div className="foto-carro" onClick={() => fileCarro.current?.click()}
                  style={fotoCarro ? { backgroundImage: `url(${fotoCarro})`, color: 'transparent', borderStyle: 'solid' } : undefined}>
                  {!fotoCarro && 'Toque para adicionar a foto do carro ou moto'}
                </div>
                <input ref={fileCarro} type="file" accept="image/*" hidden onChange={e => lerFoto(e, setFotoCarro)} />
 
                <div className="card">
                  <h2>Seu veículo</h2>
                  <label className="label">Tipo</label>
                  <div className="seg">
                    <button type="button" className={form.tipo === 'carro' ? 'sel' : ''}
                      onClick={() => setForm({ ...form, tipo: 'carro' })}>Carro</button>
                    <button type="button" className={form.tipo === 'moto' ? 'sel' : ''}
                      onClick={() => setForm({ ...form, tipo: 'moto' })}>Moto</button>
                  </div>
                  <label className="label" htmlFor="vModelo">Nome do veículo</label>
                  <input id="vModelo" placeholder="Ex.: Honda Civic" value={form.modelo}
                    onChange={e => setForm({ ...form, modelo: e.target.value })} />
                  <div className="row2">
                    <div>
                      <label className="label" htmlFor="vAno">Ano</label>
                      <input id="vAno" placeholder="2019" inputMode="numeric" maxLength={4} value={form.ano}
                        onChange={e => setForm({ ...form, ano: soDigitos(e.target.value).slice(0, 4) })} />
                    </div>
                    <div>
                      <label className="label" htmlFor="vCor">Cor</label>
                      <input id="vCor" placeholder="Preto" value={form.cor}
                        onChange={e => setForm({ ...form, cor: e.target.value })} />
                    </div>
                  </div>
                  <button className="btn" disabled={!form.modelo.trim()} onClick={salvarVeiculo}>Salvar veículo</button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel">
              <div className="hero" style={veiculo.foto ? { backgroundImage: `url(${veiculo.foto})` } : undefined}>
                <div className="hero-perfil">
                  <div className="avatar" style={fotoPerfil ? { backgroundImage: `url(${fotoPerfil})` } : undefined}>
                    {!fotoPerfil && <IconeUsuario />}
                  </div>
                  <h1>{nome}</h1>
                </div>
              </div>
 
              <div className="card veiculo-card">
                <button className="lapis" onClick={editarVeiculo} title="Editar veículo" aria-label="Editar veículo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <strong>{veiculo.modelo}</strong>
                {veiculo.ano && <span>{veiculo.ano}</span>}
                {veiculo.cor && <span>{veiculo.cor}</span>}
              </div>
 
              <h3 className="hist-title">Próximo agendamento</h3>
              {proximo ? (
                <div className="card proximo">
                  <span className="chip">Confirmado</span>
                  <strong>{proximo.servico}</strong>
                  <small>{proximo.quando}</small>
                </div>
              ) : (
                <div className="card aviso">Nenhum agendamento marcado.</div>
              )}
 
              <h3 className="hist-title">Histórico</h3>
              {HISTORICO.map(h => (
                <div key={h.servico + h.data} className="card hist-item">
                  <div>
                    <strong>{h.servico}</strong>
                    <small>{h.data}</small>
                  </div>
                  <span>{brl(h.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="enter">
          <div className="carrossel-wrap">
            <div className="carrossel"
              onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
              {GRADIENTES.map((g, i) => (
                <div key={i} className="slide" style={{ backgroundImage: g }} />
              ))}
            </div>
            <div className="dots">
              {GRADIENTES.map((_, i) => (
                <span key={i} className={i === slide ? 'on' : ''} />
              ))}
            </div>
          </div>
 
          <div className="estetica">
            <div className="avatar">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17h14M6 17l1.5-5.5A2 2 0 0 1 9.4 10h5.2a2 2 0 0 1 1.9 1.5L18 17" />
              </svg>
            </div>
            <div>
              <h1>Estética Automotiva Exemplo</h1>
              <p>Seg a Sáb, 8h às 17h</p>
            </div>
          </div>
 
          <div className="panel" style={{ paddingTop: 12 }}>
            {!veiculo ? (
              <div className="card aviso">
                Cadastre seu veículo na aba <strong>Meu veículo</strong> para ver os preços e agendar.
              </div>
            ) : pix ? (
              <div className="card pix-box">
                <h2>Pague com Pix para confirmar</h2>
                <p className="amount">{brl(pix.valor)}</p>
                <div className="countdown">
                  {seg > 0 ? `Expira em ${mm}:${ss}` : 'Cobrança expirada. Gere uma nova.'}
                </div>
                <div className="qr">QR Code aparece aqui quando o gateway de Pix estiver ligado</div>
                <div className="copy">Código copia e cola aparece aqui quando o gateway estiver ligado</div>
                <button className="btn block" onClick={confirmarPagamento}>Simular pagamento (teste)</button>
                <button className="btn ghost block" onClick={() => setPix(null)}>Voltar</button>
                <p className="muted" style={{ marginTop: 12 }}>A confirmação chega sozinha assim que o Pix for identificado.</p>
              </div>
            ) : (
              <>
                <div className="card">
                  <h2>Escolha o serviço</h2>
                  {servicos === null ? (
                    <>
                      <div className="skeleton skel-row" />
                      <div className="skeleton skel-row" />
                      <div className="skeleton skel-row" />
                    </>
                  ) : servicos.length === 0 ? (
                    <p className="muted">Nenhum serviço cadastrado ainda.</p>
                  ) : (
                    <div className="lista">
                      {servicos.map(s => {
                        const p = s.servico_precos.find(x => x.tipo_veiculo === veiculo.tipo);
                        if (!p) return null;
                        return (
                          <button key={s.id} className={`servico ${srvId === s.id ? 'sel' : ''}`}
                            onClick={() => setSrvId(s.id)}>
                            <div>
                              <strong>{s.nome}</strong>
                              <small>{s.descricao} · ~{p.duracao_minutos} min</small>
                            </div>
                            <div className="preco">{brl(p.preco_centavos)}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
 
                {srvId && (
                  <div className="card">
                    <h2>Dia e horário</h2>
                    <input type="date" min={hoje} value={data}
                      onChange={e => { setData(e.target.value); setHora(''); }} />
                    {data && (
                      <div className="slots">
                        {HORARIOS.map(h => (
                          <button key={h} className={`slot ${hora === h ? 'sel' : ''}`} onClick={() => setHora(h)}>
                            {h}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
 
                {srvId && data && hora && servicoSel && (
                  <div className="card">
                    <h2>Confirme seu agendamento</h2>
                    <div className="resumo">
                      <div>
                        <span>Veículo</span>
                        <span>
                          {veiculo.tipo === 'carro' ? 'Carro' : 'Moto'} · {veiculo.modelo}
                          {veiculo.ano ? ` · ${veiculo.ano}` : ''}
                          {veiculo.cor ? ` · ${veiculo.cor}` : ''}
                        </span>
                      </div>
                      <div>
                        <span>Serviço</span>
                        <span>{servicoSel.nome}</span>
                      </div>
                      <div>
                        <span>Quando</span>
                        <span>{fmtData(data)} às {hora}</span>
                      </div>
                      <div>
                        <span>Total</span>
                        <span>
                          <strong>
                            {brl(servicoSel.servico_precos.find(x => x.tipo_veiculo === veiculo.tipo)?.preco_centavos ?? 0)}
                          </strong>
                        </span>
                      </div>
                    </div>
                    {erro && <p className="erro">{erro}</p>}
                    <button className="btn" disabled={enviando} onClick={gerarPix}>
                      {enviando ? 'Enviando...' : 'Gerar Pix'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
 
      <nav className="tabs">
        <button className={aba === 'veiculo' ? 'on' : ''} onClick={() => setAba('veiculo')}>Meu veículo</button>
        <button className={aba === 'agendar' ? 'on' : ''} onClick={() => setAba('agendar')}>Estética e agendar</button>
      </nav>
 
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
