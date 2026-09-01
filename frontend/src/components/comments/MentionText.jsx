import { splitMentionText } from "../../utils/mentions";

export default function MentionText({ text, mentions }) {
  return splitMentionText(text, mentions).map((part, index) => (
    part.mention
      ? <span className="mention" key={`${part.mention.id}-${index}`}>{part.text}</span>
      : <span key={`text-${index}`}>{part.text}</span>
  ));
}
