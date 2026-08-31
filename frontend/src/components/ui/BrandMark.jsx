export default function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? " brand-mark--compact" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-mark__name">Mini Social</span>
    </div>
  );
}

