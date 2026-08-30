// Paper-title marquee — a thin band of paper titles that scrolls
// between the Surfaces and Gates sections. Doubled-track CSS so the
// loop is seamless. Hover pauses; reduced-motion collapses to a
// static single title.

const PAPERS = [
  "Attention Is All You Need",
  "BERT: Pre-training of Deep Bidirectional Transformers",
  "GPT-3: Language Models are Few-Shot Learners",
  "DALL-E: Zero-Shot Text-to-Image Generation",
  "Stable Diffusion: Latent Diffusion Models",
  "AlphaFold: Highly Accurate Protein Structure Prediction",
  "Chain-of-Thought Prompting Elicits Reasoning",
  "Constitutional AI: Harmlessness from AI Feedback",
  "The Llama 3 Herd of Models",
  "Mixtral of Experts",
  "Retrieval-Augmented Generation",
  "Segment Anything",
];

export function PaperMarquee() {
  return (
    <aside
      className="relative w-full overflow-hidden border-y py-3"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-background)",
      }}
      aria-label="Recent papers dissected by Recap"
    >
      <div className="rcp-marquee-host">
        <div className="rcp-marquee-track font-heading text-[0.875rem] tracking-[0.02em]">
          {[...PAPERS, ...PAPERS].map((title, i) => (
            <span
              key={i}
              className="px-6 inline-flex items-center gap-3"
              style={{ color: "var(--color-muted-foreground)" }}
              aria-hidden={i >= PAPERS.length ? "true" : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--accent-indigo)" }}
                aria-hidden="true"
              />
              {title}
            </span>
          ))}
        </div>
      </div>
      {/* Accessible list, hidden visually, for AT users who don't see marquee. */}
      <ul
        className="sr-only"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {PAPERS.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </aside>
  );
}