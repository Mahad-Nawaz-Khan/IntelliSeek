import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  resetUserPreferences,
  updateUserPreferences,
} from "./preferences";

describe("user preferences store", () => {
  beforeEach(() => {
    resetUserPreferences();
  });

  it("updates and persists individual preferences", () => {
    const updated = updateUserPreferences({ compactMessages: true, sendOnEnter: false });
    expect(updated).toEqual({
      ...DEFAULT_PREFERENCES,
      compactMessages: true,
      sendOnEnter: false,
    });
  });

  it("resets preferences back to defaults", () => {
    updateUserPreferences({ citationPreviews: false, autoScrollOnStream: false });
    const reset = resetUserPreferences();
    expect(reset).toEqual(DEFAULT_PREFERENCES);
  });

  it("defaults Knowledge Base availability to enabled and persists toggling it off", () => {
    expect(DEFAULT_PREFERENCES.includeKnowledgeBase).toBe(true);
    const updated = updateUserPreferences({ includeKnowledgeBase: false });
    expect(updated.includeKnowledgeBase).toBe(false);

    const reset = resetUserPreferences();
    expect(reset.includeKnowledgeBase).toBe(true);
  });
});
