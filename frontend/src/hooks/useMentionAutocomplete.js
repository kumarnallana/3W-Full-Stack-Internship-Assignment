import { useEffect, useRef, useState } from "react";
import { usersApi } from "../services/usersApi";
import { getMentionContext, mentionToken } from "../utils/mentions";

export function useMentionAutocomplete({ initialText = "", initialMentions = [] } = {}) {
  const inputRef = useRef(null);
  const [text, setText] = useState(initialText);
  const [selectedMentions, setSelectedMentions] = useState(initialMentions);
  const [context, setContext] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!context) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const users = await usersApi.search(context.query);
        if (active) {
          setSuggestions(users);
          setActiveIndex(0);
        }
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 140);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [context?.query]);

  function updateText(nextText, caret) {
    setText(nextText);
    setSelectedMentions((current) => current.filter((mention) => nextText.includes(mentionToken(mention.username))));
    setContext(getMentionContext(nextText, caret));
  }

  function handleChange(event) {
    updateText(event.target.value, event.target.selectionStart ?? event.target.value.length);
  }

  function selectMention(user) {
    if (!context || !user) return;
    const token = mentionToken(user.username);
    const nextText = `${text.slice(0, context.start)}${token} ${text.slice(context.end)}`;
    const nextCaret = context.start + token.length + 1;
    setText(nextText);
    setSelectedMentions((current) => (
      current.some((mention) => mention.id === user.id) ? current : [...current, user].slice(0, 8)
    ));
    setContext(null);
    setSuggestions([]);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(event) {
    if (!context) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setContext(null);
      setSuggestions([]);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectMention(suggestions[activeIndex]);
    }
  }

  function handleFocus(event) {
    setContext(getMentionContext(text, event.target.selectionStart ?? text.length));
  }

  function reset() {
    setText("");
    setSelectedMentions([]);
    setContext(null);
    setSuggestions([]);
  }

  return {
    inputRef,
    text,
    selectedMentions,
    suggestions,
    activeIndex,
    loading,
    open: Boolean(context),
    handleChange,
    handleFocus,
    handleKeyDown,
    selectMention,
    reset,
  };
}
