'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

type Estado = 'ocioso' | 'ouvindo' | 'processando' | 'respondendo' | 'erro';

const rotulos: Record<Estado, string> = {
  ocioso: 'SISTEMA Ô.M.E.G.A PRONTO · TOQUE PARA INICIAR',
  ouvindo: 'CAPTANDO FLUXO DE VOZ NEURAL · TOQUE PARA CONCLUIR',
  processando: 'SINTETIZANDO DADOS E DECODIFICANDO MATRIX',
  respondendo: 'TRANSMITINDO RESPOSTA NÚCLEO Ô.M.E.G.A',
  erro: 'ALERTA DE SISTEMA · FALHA NO SUBSISTEMA DE VOZ',
};

export function VoiceModeOverlay({
  assistantName = 'Ô.M.E.G.A',
  onClose,
  salvarHistorico = true,
}: {
  assistantName?: string;
  onClose: () => void;
  salvarHistorico?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [mensagemErro, setMensagemErro] = useState('');
  const [analisador, setAnalisador] = useState<AnalyserNode | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function contexto() {
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  function falhar(msg: string) {
    setMensagemErro(msg);
    setEstado('erro');
    setAnalisador(null);
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = contexto();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(an);
      setAnalisador(an);

      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        void enviar(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setEstado('ouvindo');
    } catch {
      falhar('Permita o uso do microfone nas configurações do navegador.');
    }
  }

  function pararGravacao() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setEstado('processando');
    setAnalisador(null);
  }

  async function enviar(blob: Blob) {
    try {
      const res = await api.chatVoice(blob, salvarHistorico);
      if (!res.audioReal || !res.audioUrl) {
        falhar('Voz não configurada no backend.');
        return;
      }
      tocar(`${api.baseUrl}${res.audioUrl}`);
    } catch (e) {
      falhar((e as Error).message);
    }
  }

  function tocar(url: string) {
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;

    try {
      const ctx = contexto();
      const fonte = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      fonte.connect(an);
      an.connect(ctx.destination);
      setAnalisador(an);
    } catch {
      // Fallback para reutilização de media element
    }

    a.onended = () => {
      setAnalisador(null);
      setEstado('ocioso');
    };
    a.onerror = () => falhar('Não foi possível reproduzir a resposta.');
    setEstado('respondendo');
    a.play().catch(() => falhar('Erro ao executar reprodução de áudio.'));
  }

  function alternar() {
    if (estado === 'ouvindo') {
      pararGravacao();
    } else if (estado === 'processando') {
      return;
    } else {
      audioRef.current?.pause();
      void iniciarGravacao();
    }
  }

  function fechar() {
    audioRef.current?.pause();
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }

  useEffect(() => {
    const porTecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', porTecla);
    return () => {
      window.removeEventListener('keydown', porTecla);
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryColor =
    estado === 'erro'
      ? '#ef4444'
      : estado === 'ouvindo'
      ? '#f59e0b'
      : '#00f0ff';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background:
            'radial-gradient(circle at 50% 50%, #030d1a 0%, #010408 85%, #000000 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '32px 24px',
          color: primaryColor,
          userSelect: 'none',
          overflow: 'hidden',
          fontFamily: "'Chakra Petch', 'Courier New', monospace",
        }}
      >
        {/* Background Blueprint Grid (Estilo Planta Baixa Holográfica) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.08) 0%, transparent 60%),
              linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 30px 30px, 30px 30px',
            pointerEvents: 'none',
          }}
        />

        {/* Canto Superior Esquerdo - Telemetria HUD */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            fontSize: 10,
            letterSpacing: '0.15em',
            opacity: 0.6,
            lineHeight: 1.6,
            display: 'none',
            
          }}
          className="hud-telemetry-left"
        >
          <div>SYS.VER // 4.0.9</div>
          <div>CORE CLEARANCE // TOP SECRET</div>
          <div>NEURAL SYNC // 99.84%</div>
        </div>

        {/* Canto Superior Direito - Fechar e Status */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            zIndex: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textAlign: 'right',
              letterSpacing: '0.15em',
              opacity: 0.6,
            }}
          >
            <div>STATUS // {estado.toUpperCase()}</div>
            <div>LINK // STABLE</div>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar HUD Ô.M.E.G.A"
            style={{
              background: 'rgba(0, 240, 255, 0.05)',
              border: `1px solid ${primaryColor}`,
              borderRadius: '50%',
              width: 42,
              height: 42,
              color: primaryColor,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 15px ${primaryColor}40`,
              transition: 'all 0.3s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Header Central Sup */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.5em',
              opacity: 0.8,
              borderBottom: `1px solid ${primaryColor}40`,
              paddingBottom: 4,
            }}
          >
            INTELESENSE CORE ARCHITECTURE
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '0.4em',
              textShadow: `0 0 20px ${primaryColor}`,
            }}
          >
            {assistantName}
          </div>
        </motion.div>

        {/* HUD Central Jarvis Arc Reactor */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            position: 'relative',
          }}
        >
          <OmegaHud
            estado={estado}
            analisador={analisador}
            assistantName={assistantName}
            primaryColor={primaryColor}
            onToggle={alternar}
          />
        </div>

        {/* Rodapé: Rótulo de Status Dinâmico */}
        <motion.div
          key={estado}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            zIndex: 10,
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(0, 15, 30, 0.75)',
              border: `1px solid ${primaryColor}60`,
              padding: '10px 24px',
              borderRadius: '4px',
              boxShadow: `0 0 20px ${primaryColor}20`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.25em',
                fontWeight: 700,
                color: primaryColor,
                textShadow: `0 0 10px ${primaryColor}`,
              }}
            >
              {estado === 'erro' ? mensagemErro : rotulos[estado]}
            </span>
          </div>

          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.3em',
              opacity: 0.4,
              fontFamily: 'monospace',
            }}
          >
            VOICE MODE ACTIVE · TOUCH CORE TO INTERACT
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

{/* SUB-COMPONENTE DA HUD TÁTICA / ARC REACTOR */}
function OmegaHud({
  estado,
  analisador,
  assistantName,
  primaryColor,
  onToggle,
}: {
  estado: Estado;
  analisador: AnalyserNode | null;
  assistantName: string;
  primaryColor: string;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Renderizador em Canvas 2D da Onda/Espectro Radial (JARVIS Radial Waveform)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dados = new Uint8Array(analisador?.frequencyBinCount ?? 64);
    let animationId: number;

    const desenhar = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const raioBase = 110;

      ctx.clearRect(0, 0, w, h);

      if (analisador) {
        analisador.getByteFrequencyData(dados);
      } else {
        dados.fill(0);
      }

      const totalBarras = 64;
      const anguloPasso = (Math.PI * 2) / totalBarras;

      for (let i = 0; i < totalBarras; i++) {
        const valor = dados[i % dados.length] / 255;
        const alturaBarra = Math.max(4, valor * 45);
        const angulo = i * anguloPasso;

        const xInicio = cx + Math.cos(angulo) * raioBase;
        const yInicio = cy + Math.sin(angulo) * raioBase;
        const xFim = cx + Math.cos(angulo) * (raioBase + alturaBarra);
        const yFim = cy + Math.sin(angulo) * (raioBase + alturaBarra);

        ctx.beginPath();
        ctx.moveTo(xInicio, yInicio);
        ctx.lineTo(xFim, yFim);
        ctx.lineWidth = 2;
        ctx.strokeStyle =
          estado === 'ouvindo'
            ? `rgba(245, 158, 11, ${0.4 + valor * 0.6})`
            : estado === 'erro'
            ? `rgba(239, 68, 68, ${0.4 + valor * 0.6})`
            : `rgba(0, 240, 255, ${0.3 + valor * 0.7})`;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(desenhar);
    };

    desenhar();
    return () => cancelAnimationFrame(animationId);
  }, [analisador, estado]);

  // Velocidades e Animações baseadas no estado da IA
  const speed =
    estado === 'processando' ? 2 : estado === 'ouvindo' ? 6 : 14;

  return (
    <div
      style={{
        position: 'relative',
        width: 380,
        height: 380,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Visualizador Radial de Áudio (Canvas 2D) */}
      <canvas
        ref={canvasRef}
        width={380}
        height={380}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Anel Externo Com Escala de Graus / Ticks */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: speed * 2, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `1px dashed ${primaryColor}40`,
          boxShadow: `0 0 15px ${primaryColor}15`,
        }}
      />

      {/* Anel Secundário Segmentado Estilo JARVIS (com arco Amarelo/Dourado) */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: speed * 1.5, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 18,
          borderRadius: '50%',
          border: `2px solid transparent`,
          borderTopColor: primaryColor,
          borderBottomColor: '#f59e0b', // Arco amarelado conforme foto
          borderRightColor: primaryColor,
          filter: `drop-shadow(0 0 8px ${primaryColor})`,
        }}
      />

      {/* Anel Interno Pulsante com Marcas Táticas */}
      <motion.div
        animate={{ rotate: 360, scale: estado === 'processando' ? [1, 1.04, 1] : 1 }}
        transition={{
          rotate: { repeat: Infinity, duration: speed, ease: 'linear' },
          scale: { repeat: Infinity, duration: 0.8 },
        }}
        style={{
          position: 'absolute',
          inset: 42,
          borderRadius: '50%',
          border: `1px solid ${primaryColor}80`,
          borderStyle: 'double',
        }}
      />

      {/* Mira Tática Secundária (Crosshair Overlay) */}
      <div
        style={{
          position: 'absolute',
          inset: 60,
          borderRadius: '50%',
          border: `1px dotted ${primaryColor}50`,
          pointerEvents: 'none',
        }}
      />

      {/* NÚCLEO BOTÃO INTERATIVO (ARC REACTOR CENTER) */}
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={estado === 'processando'}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        style={{
          width: 170,
          height: 170,
          borderRadius: '50%',
          border: `2px solid ${primaryColor}`,
          background: `radial-gradient(circle, ${primaryColor}25 0%, rgba(1, 10, 25, 0.9) 75%)`,
          boxShadow: `0 0 50px ${primaryColor}50, inset 0 0 30px ${primaryColor}30`,
          cursor: estado === 'processando' ? 'wait' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          zIndex: 10,
          outline: 'none',
          position: 'relative',
        }}
      >
        {/* Glow Pulsante do Núcleo */}
        <motion.div
          animate={{
            opacity: estado === 'respondendo' || estado === 'ouvindo' ? [0.4, 0.9, 0.4] : [0.2, 0.5, 0.2],
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Nome Ô.M.E.G.A no centro */}
        <span
          style={{
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.3em',
            color: '#ffffff',
            textShadow: `0 0 12px ${primaryColor}`,
          }}
        >
          {assistantName}
        </span>

        {/* Ícone ou Indicador de Estado */}
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: primaryColor,
            fontWeight: 700,
            opacity: 0.8,
          }}
        >
          {estado === 'ouvindo'
            ? '● GRAVANDO'
            : estado === 'processando'
            ? 'BUSY...'
            : estado === 'respondendo'
            ? 'FALANDO'
            : 'TOQUE'}
        </span>
      </motion.button>
    </div>
  );
}