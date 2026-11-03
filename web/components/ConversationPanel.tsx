'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { VoiceModeOverlay } from './VoiceModeOverlay';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  offline?: boolean;
  tools?: string[];
  coder?: boolean;
  previewUrl?: string | null;
}

/** Ondas sonoras enquanto o assistente "pensa" (eco do painel de voz do app). */
function Waveform() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          style={{ width: 3, borderRadius: 2, background: 'var(--color-amber)' }}
          animate={{ height: [6, 18, 6] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function ConversationPanel({ assistantName }: { assistantName: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [saveOff, setSaveOff] = useState(false); // modo privado (não salva histórico)
  const [voiceOpen, setVoiceOpen] = useState(false); // modo conversa por áudio (tela cheia)
  const { t } = useI18n();
  const logRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggleMute() {
    setMuted((m) => {
      mutedRef.current = !m;
      if (mutedRef.current) audioRef.current?.pause();
      return !m;
    });
  }

  // Modo privado (não salvar histórico) — persistido no localStorage.
  useEffect(() => {
    setSaveOff(localStorage.getItem('chat-saveoff') === '1');
  }, []);
  function toggleSaveOff() {
    setSaveOff((v) => {
      localStorage.setItem('chat-saveoff', v ? '0' : '1');
      return !v;
    });
  }

  // Limpa a conversa (contexto): apaga o histórico no backend e o log local.
  async function clearConversation() {
    if (thinking) return;
    audioRef.current?.pause();
    await api.clearChatHistory().catch(() => {});
    setMessages([]);
  }

  // Salva a conversa atual como documento na base de conhecimento.
  async function saveConversation() {
    if (thinking || messages.length === 0) return;
    const title = window.prompt('Título da conversa:', 'Conversa ' + new Date().toLocaleDateString('pt-BR'));
    if (!title) return;
    const folder = window.prompt('Pasta (opcional, ex.: trabalho, saas, pessoal):', '') || undefined;
    try {
      const r = await api.saveConversation({
        folder,
        title,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `💾 Conversa salva na base de conhecimento: ${r.saved}` },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Falha ao salvar: ${(e as Error).message}`, offline: true }]);
    }
  }

  // Toca a voz (Piper) da resposta, se houver e não estiver mudo.
  function speak(url: string | null) {
    if (!url || mutedRef.current) return;
    audioRef.current?.pause();
    const a = new Audio(`${api.baseUrl}${url}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setThinking(true);
    try {
      const res = await api.chat(text, {
        saveHistory: !saveOff,
        context: saveOff ? messages.map((m) => ({ role: m.role, content: m.content })) : undefined,
      });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          offline: !res.ok,
          tools: res.toolsUsed,
          coder: res.coder,
          previewUrl: res.previewUrl,
        },
      ]);
      speak(res.audioUrl);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Falha ao contatar o backend (${(err as Error).message}). Ele está rodando em ${api.baseUrl}?`,
          offline: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <section
      className="panel reveal"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, animationDelay: '0.1s' }}
    >
      <div className="panel-head">
        <div>
          <div className="eyebrow">{t('conversation.eyebrow')}</div>
          <div className="panel-title">{t('conversation.title', { name: assistantName })}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={saveConversation}
            disabled={thinking || messages.length === 0}
            aria-label="Salvar conversa"
            title="Salvar esta conversa na base de conhecimento"
            className="btn"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.9rem' }}
          >
            💾
          </button>
          <button
            type="button"
            onClick={toggleSaveOff}
            aria-label={saveOff ? 'Ativar salvamento' : 'Modo privado'}
            title={saveOff ? 'Modo privado ligado — nada é salvo (clique para salvar histórico)' : 'Histórico é salvo — clique para modo privado'}
            className="btn"
            style={{
              padding: '0.35rem 0.55rem',
              fontSize: '0.9rem',
              borderColor: saveOff ? 'var(--color-amber)' : undefined,
              background: saveOff ? 'rgba(232,161,58,0.12)' : undefined,
            }}
          >
            {saveOff ? '🕶️' : '💬'}
          </button>
          <button
            type="button"
            onClick={clearConversation}
            disabled={thinking || messages.length === 0}
            aria-label="Nova conversa"
            title="Limpar conversa e resetar o contexto"
            className="btn"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.9rem' }}
          >
            🧹
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Ativar voz' : 'Silenciar voz'}
            title={muted ? 'Voz desligada — clique para ligar' : 'Voz ligada — clique para silenciar'}
            className="btn"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.9rem', opacity: muted ? 0.5 : 1 }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="chip">
            <span className={`dot ${thinking ? 'warn' : 'on'}`} />
            {thinking ? t('conversation.thinking') : t('conversation.idle')}
          </span>
        </div>
      </div>

      <div
        ref={logRef}
        className="scroll"
        style={{
          flex: 1,
          minHeight: 240,
          // Limita a altura para o log rolar internamente em vez de esticar a página.
          maxHeight: '52vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          paddingRight: 4,
        }}
      >
        {messages.length === 0 && !thinking && (
          <div
            className="mono"
            style={{ color: 'var(--color-muted)', fontSize: '0.82rem', margin: 'auto', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}
          >
            {t('chat.hintLine1')}
            <br />
            {t('chat.hintLine2')}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
            >
              <div className="eyebrow" style={{ marginBottom: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                {m.role === 'user' ? t('chat.you') : assistantName}
              </div>
              <div
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background:
                    m.role === 'user'
                      ? 'rgba(127,200,216,0.08)'
                      : m.offline
                        ? 'rgba(224,106,91,0.08)'
                        : 'rgba(232,161,58,0.08)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}
              >
                {m.content}
                {m.tools && m.tools.length > 0 && (
                  <div className="mono" style={{ marginTop: 6, fontSize: '0.66rem', color: 'var(--color-ice)' }}>
                    ⚙ {m.tools.join(', ')}
                  </div>
                )}
                {m.coder && (
                  <div className="mono" style={{ marginTop: 6, fontSize: '0.66rem', color: 'var(--color-amber)' }}>
                    ⌨ coder
                  </div>
                )}
                {m.previewUrl && (
                  <a
                    href={`${api.baseUrl}${m.previewUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-amber"
                    style={{ display: 'inline-block', marginTop: 8, fontSize: '0.7rem', padding: '0.4rem 0.7rem' }}
                  >
                    ▶ Abrir preview
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {assistantName}
            </div>
            <div style={{ padding: '0.7rem 0.9rem', borderRadius: 12, border: '1px solid var(--line)', background: 'rgba(232,161,58,0.06)' }}>
              <Waveform />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          disabled={thinking}
          aria-label="Conversar por áudio"
          title="Conversar por áudio"
          className="btn"
          style={{ padding: '0.5rem 0.7rem' }}
        >
          🎙
        </button>
        <input
          className="field mono"
          placeholder={t('conversation.placeholder', { name: assistantName })}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn btn-amber" onClick={send} disabled={thinking || !input.trim()}>
          {t('conversation.send')}
        </button>
      </div>

      {voiceOpen && (
        <VoiceModeOverlay
          assistantName={assistantName}
          salvarHistorico={!saveOff}
          onClose={() => setVoiceOpen(false)}
        />
      )}
    </section>
  );
}