export default function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? " brand-mark--compact" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C10.5909 20 9.26629 19.6358 8.11306 19M8.11306 19L4.47161 20.3705C4.08643 20.5155 3.73177 20.126 3.9056 19.749L5.34007 16.6384C4.48443 15.3149 4 13.7143 4 12V12Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      </span>
      <span className="brand-mark__name">Mini Social</span>
    </div>
  );
}

