/**
 * Pronuncia didattica del cinese tramite la sintesi vocale del browser.
 * Non lancia mai: su export statico, SSR o browser senza speechSynthesis
 * la chiamata diventa un no-op.
 */
export function speakChinese(text: string): void {
  if (typeof window === "undefined") return;

  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;

  const content = text.trim();
  if (!content) return;

  try {
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;

    if (typeof synth.getVoices === "function") {
      const voices = synth.getVoices();
      const match = voices.find((voice) => {
        const lang = voice.lang.toLowerCase();
        return lang === "zh-cn" || lang.startsWith("zh");
      });
      if (match) utterance.voice = match;
    }

    synth.cancel();
    // Alcuni browser (soprattutto iOS) ignorano speak() se arriva
    // nello stesso tick di cancel().
    window.setTimeout(() => {
      try {
        synth.speak(utterance);
      } catch {
        /* sintesi rifiutata dal browser */
      }
    }, 0);
  } catch {
    /* speechSynthesis assente, bloccato o non inizializzato */
  }
}
