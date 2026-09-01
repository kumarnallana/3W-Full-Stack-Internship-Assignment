import test from "node:test";
import assert from "node:assert/strict";
import { getMentionContext, mentionToken, splitMentionText } from "./mentions.js";

test("mention context works after whitespace and converts underscores for search", () => {
  assert.deepEqual(getMentionContext("Thanks @Mira_S", 14), {
    start: 7,
    end: 14,
    query: "Mira S",
  });
  assert.equal(getMentionContext("email@test", 10), null);
});

test("mention tokens are stable for usernames with spaces", () => {
  assert.equal(mentionToken("Mira Sen"), "@Mira_Sen");
});

test("known stored mentions are split from ordinary comment text", () => {
  const parts = splitMentionText("Hello @Mira_Sen!", [{ id: "mira", username: "Mira Sen" }]);
  assert.equal(parts[1].text, "@Mira_Sen");
  assert.equal(parts[1].mention.id, "mira");
});
