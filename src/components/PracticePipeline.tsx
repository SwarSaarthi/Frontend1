"use client";

import "./practice-pipeline.css";

type Props = {
  recording: boolean; processing: boolean; seconds: number;
  complete: boolean; hasCoaching: boolean; speaking: boolean;
  error: string; hindi: boolean; onCancel: () => void;
};

export default function PracticePipeline({ recording, processing, seconds, complete, hasCoaching, speaking, error, hindi, onCancel }: Props) {
  const t = (en: string, hi: string) => hindi ? hi : en;
  const active = recording || processing || speaking;
  const steps = [
    { name: t("Voice capture", "आवाज़ रिकॉर्डिंग"), detail: t("Microphone → audio", "माइक → ऑडियो"), state: recording ? "active" : processing || complete ? "done" : "waiting", mark: "01" },
    { name: t("ASR recognition", "वाक् पहचान"), detail: t("Audio → Hindi transcript", "ऑडियो → हिंदी पाठ"), state: complete ? "done" : processing ? "pending" : "waiting", mark: "02" },
    { name: t("Pronunciation score", "उच्चारण मूल्यांकन"), detail: t("Reference comparison · CER", "सही पाठ से तुलना · अक्षर त्रुटि दर"), state: complete ? "done" : processing ? "pending" : "waiting", mark: "03" },
    { name: t("AI coaching", "एआई मार्गदर्शन"), detail: t("LLM guidance · offline fallback", "एलएलएम सुझाव · वैकल्पिक मार्गदर्शन"), state: complete ? hasCoaching ? "done" : "unavailable" : processing ? "pending" : "waiting", mark: "04" },
    { name: t("Spoken feedback", "बोलकर सुझाव"), detail: t("Text → speech", "पाठ → आवाज़"), state: speaking ? "active" : complete ? "ready" : "waiting", mark: "05" },
  ];
  const status = error ? t("Request interrupted", "अनुरोध रुक गया") : processing ? t("Your recording is with the speech service", "आपकी रिकॉर्डिंग का विश्लेषण हो रहा है") : recording ? t("Listening to your voice", "आपकी आवाज़ सुन रहे हैं") : speaking ? t("Your coach is speaking", "आपके सुझाव सुनाए जा रहे हैं") : complete ? t("Your feedback has arrived", "आपके सुझाव तैयार हैं") : t("From your voice to a little guidance", "आपकी आवाज़ से आपके सुझाव तक");
  return <section className={`studio-pipeline ${active ? "is-active" : ""}`} aria-labelledby="pipeline-heading" data-processing={processing}>
    <header><div><span className="pipeline-eyebrow">{t("BEHIND YOUR PRACTICE", "आपके अभ्यास के पीछे")}</span><h2 id="pipeline-heading">{t("Every sound, understood.", "हर ध्वनि को समझने का प्रयास।")}</h2></div><span className="pipeline-status" role="status"><i />{status}</span></header>
    <ol>{steps.map(step => <li key={step.mark} data-state={step.state}><span className="pipeline-node" aria-hidden="true">{step.state === "done" ? "✓" : step.mark}</span><div><h3>{step.name}</h3><p>{step.detail}</p><small>{step.state === "done" ? t("Received", "प्राप्त") : step.state === "active" ? t("Active", "जारी") : step.state === "pending" ? t("Awaiting server response", "सर्वर के उत्तर की प्रतीक्षा") : step.state === "ready" ? t("Available to listen", "सुनने के लिए उपलब्ध") : step.state === "unavailable" ? t("Summary available", "सारांश उपलब्ध") : t("Ready for your attempt", "आपके प्रयास के लिए तैयार")}</small></div></li>)}</ol>
    <footer><p>{processing ? t("ASR, scoring and coaching return together. The server does not send individual stage updates.", "वाक् पहचान, अंक और सुझाव एक साथ मिलते हैं। सर्वर हर चरण की अलग स्थिति नहीं भेजता।") : t("Explore how your recording becomes feedback. Speech recognition can make mistakes; use the result as a practice guide.", "जानें कि आपकी रिकॉर्डिंग से सुझाव कैसे बनते हैं। वाक् पहचान में गलती हो सकती है; सुझावों को अभ्यास में सहायता मानें।")}</p>{processing && <div><span className="pipeline-elapsed">{seconds}s</span><button onClick={onCancel}>{t("Cancel analysis", "विश्लेषण रद्द करें")} <span aria-hidden="true">×</span></button></div>}</footer>
  </section>;
}
