import BrandMark from "../ui/BrandMark";

export default function LoadingScreen({ label = "Loading" }) {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <BrandMark />
      <span className="loading-screen__pulse" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

