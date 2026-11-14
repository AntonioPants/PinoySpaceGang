"use client";
// Screen 9: advisor chat grounded in the plan, with voice input (Web Speech API).
import { useEffect, useRef, useState } from "react";
import { Card, ErrorBox, NeedPlan, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

export default function AdvisorPage() {
  const { t, plan, lang } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const recognition = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.config().then((c) => setMode(c.advisor_mode)).catch(() => undefined);
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  if (!plan) return <NeedPlan />;

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const answer = await api.advisor(question, plan, lang, history);
      setMode(answer.mode);
      const meta = [answer.mode === "llm" ? `${answer.model}${answer.tools_used.length ? ` · tools: ${answer.tools_used.join(", ")}` : ""}` : "", answer.note || ""].filter(Boolean).join(" · ");
      setMessages((m) => [...m, { role: "assistant", content: answer.answer, meta }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleVoice = () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setError(t("adv.noVoice"));
      return;
    }
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Speech();
    rec.lang = lang === "fil" ? "fil-PH" : "en-US";
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setInput(text);
      void ask(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="space-y-4">
      <PageTitle title={t("adv.title")} help={t("adv.help")} />
      {mode && <p className="text-xs text-gray-600">{t(`adv.mode.${mode}` as MessageKey)}</p>}
      <Card>
        <div className="min-h-[16rem] space-y-3" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {(["adv.suggest1", "adv.suggest2", "adv.suggest3", "adv.suggest4"] as MessageKey[]).map((k) => (
                <button key={k} className="rounded-full bg-leaf-50 px-3 py-1.5 text-sm ring-1 ring-leaf-200 hover:bg-leaf-100" onClick={() => ask(t(k))}>
                  {t(k)}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-leaf-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                {m.content}
                {m.meta && <div className="mt-1 text-[11px] opacity-70">{m.meta}</div>}
              </div>
            </div>
          ))}
          {busy && <Spinner />}
          <div ref={endRef} />
        </div>
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <label htmlFor="q" className="sr-only">{t("adv.placeholder")}</label>
          <input id="q" className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("adv.placeholder")} />
          <button type="button" className="btn-secondary" onClick={toggleVoice} aria-pressed={listening}>
            {listening ? t("adv.listening") : `🎤 ${t("adv.voice")}`}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            {t("adv.send")}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-600">{t("common.adviser")}</p>
      </Card>
    </div>
  );
}
