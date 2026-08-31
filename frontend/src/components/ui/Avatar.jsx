import { getInitials } from "../../utils/formatters";

export default function Avatar({ name, src, size = "medium" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-label={`${name || "User"} avatar`}>
      {src ? <img src={src} alt="" /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

