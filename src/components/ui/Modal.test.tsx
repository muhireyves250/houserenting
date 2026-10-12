import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function setup(onClose = vi.fn()) {
  const trigger = document.createElement("button");
  trigger.textContent = "open";
  document.body.appendChild(trigger);
  trigger.focus();
  const view = render(
    <Modal title="Welcome" closeLabel="Close" onClose={onClose}>
      <input aria-label="Email" />
      <button type="button">Continue</button>
    </Modal>,
  );
  return { onClose, trigger, ...view };
}

describe("Modal", () => {
  it("is a labelled modal dialog that takes focus and locks page scroll", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Welcome" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes with Escape, the close button, or a click on the backdrop (not inside)", async () => {
    const { onClose } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps Tab inside and restores focus and scroll on unmount", async () => {
    const { trigger, unmount } = setup();
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
