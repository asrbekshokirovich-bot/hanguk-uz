import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProcessTracker } from "../ProcessTracker";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

describe("ProcessTracker", () => {
  it("renders all 7 steps", () => {
    const { container } = render(
      <ProcessTracker currentStatus="documents_collection" />
    );
    const labels = [
      "Hujjat yig'ish",
      "Tarjima",
      "Apostil",
      "Topshirildi",
      "Javob",
      "Viza",
      "Tayyor",
    ];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("marks correct steps as completed/current/upcoming for 'apostille'", () => {
    const { container } = render(
      <ProcessTracker currentStatus="apostille" />
    );
    // apostille is index 2 — steps 0,1 completed, step 2 current, steps 3-6 upcoming
    const dots = container.querySelectorAll(".rounded-full.flex.items-center.justify-center");
    // Completed dots (index 0, 1) should have bg-success
    expect(dots[0]).toHaveClass("bg-success");
    expect(dots[1]).toHaveClass("bg-success");
    // Current dot (index 2) should have bg-primary
    expect(dots[2]).toHaveClass("bg-primary");
    // Upcoming dots (index 3+) should have border-2
    expect(dots[3]).toHaveClass("border-2");
    expect(dots[4]).toHaveClass("border-2");
  });

  it("falls back to first step for unknown status", () => {
    const { container } = render(
      <ProcessTracker currentStatus="some_unknown_status" />
    );
    const dots = container.querySelectorAll(".rounded-full.flex.items-center.justify-center");
    // First step should be current (bg-primary), not completed
    expect(dots[0]).toHaveClass("bg-primary");
    // Second step should be upcoming
    expect(dots[1]).toHaveClass("border-2");
  });

  it("renders smaller dots in compact mode", () => {
    const { container } = render(
      <ProcessTracker currentStatus="documents_collection" compact />
    );
    const dots = container.querySelectorAll(".rounded-full.flex.items-center.justify-center");
    dots.forEach((dot) => {
      expect(dot).toHaveClass("h-5", "w-5");
    });
  });

  it("renders larger dots in normal mode", () => {
    const { container } = render(
      <ProcessTracker currentStatus="documents_collection" />
    );
    const dots = container.querySelectorAll(".rounded-full.flex.items-center.justify-center");
    dots.forEach((dot) => {
      expect(dot).toHaveClass("h-7", "w-7");
    });
  });
});
