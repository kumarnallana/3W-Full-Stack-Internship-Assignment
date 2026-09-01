export function mentionToken(username = "") {
  return `@${String(username).trim().replace(/\s+/g, "_")}`;
}

export function getMentionContext(text = "", caret = text.length) {
  const beforeCaret = text.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
  if (!match) return null;
  const start = beforeCaret.length - match[2].length - 1;
  return {
    start,
    end: caret,
    query: match[2].replace(/_/g, " "),
  };
}

export function splitMentionText(text = "", mentions = []) {
  const known = mentions
    .filter((mention) => mention?.username)
    .map((mention) => ({ ...mention, token: mentionToken(mention.username) }))
    .sort((left, right) => right.token.length - left.token.length);
  if (!known.length) return [{ text, mention: null }];

  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    let next = null;
    for (const mention of known) {
      const index = text.indexOf(mention.token, cursor);
      if (index >= 0 && (!next || index < next.index)) next = { index, mention };
    }
    if (!next) {
      parts.push({ text: text.slice(cursor), mention: null });
      break;
    }
    if (next.index > cursor) parts.push({ text: text.slice(cursor, next.index), mention: null });
    parts.push({ text: next.mention.token, mention: next.mention });
    cursor = next.index + next.mention.token.length;
  }
  return parts;
}
