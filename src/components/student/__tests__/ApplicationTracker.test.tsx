import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApplicationTracker } from "../ApplicationTracker";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en" },
  }),
}));

// Mock ProcessTracker
vi.mock("../ProcessTracker", () => ({
  ProcessTracker: ({ currentStatus, compact }: any) => (
    <div data-testid="process-tracker" data-status={currentStatus} data-compact={compact} />
  ),
}));

// Mock UniversityRoom
vi.mock("../UniversityRoom", () => ({
  UniversityRoom: ({ open, initialTab }: any) =>
    open ? <div data-testid="university-room" data-tab={initialTab} /> : null,
}));

const mockApplications = [
  {
    id: "app-1",
    student_id: "stu-1",
    university_id: "uni-1",
    status: "apostille",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    notes: null,
    decision: null,
    decision_at: null,
    submitted_at: null,
    status_history: null,
    university: {
      id: "uni-1",
      name_uz: "Seoul University",
      name_en: "Seoul National University",
      name_ru: "Сеульский университет",
      name_ko: "서울대학교",
      city_uz: "Seoul",
      city_en: "Seoul",
      city_ru: "Сеул",
      city_ko: "서울",
      logo_url: null,
      is_partner: true,
      is_visible_on_map: true,
    },
  },
];

describe("ApplicationTracker", () => {
  it("renders university cards with name and city", () => {
    render(<ApplicationTracker applications={mockApplications as any} />);
    expect(screen.getByText("Seoul National University")).toBeInTheDocument();
    expect(screen.getByText("Seoul")).toBeInTheDocument();
  });

  it("shows ProcessTracker in each card", () => {
    render(<ApplicationTracker applications={mockApplications as any} />);
    const tracker = screen.getByTestId("process-tracker");
    expect(tracker).toHaveAttribute("data-status", "apostille");
    expect(tracker).toHaveAttribute("data-compact", "true");
  });

  it("quick action buttons open room with correct tab", () => {
    render(<ApplicationTracker applications={mockApplications as any} />);
    
    // Click discussion button
    const discussionBtn = screen.getByText("Muhokama");
    fireEvent.click(discussionBtn);
    
    const room = screen.getByTestId("university-room");
    expect(room).toHaveAttribute("data-tab", "discussion");
  });

  it("shows empty state when no applications", () => {
    render(<ApplicationTracker applications={[]} />);
    expect(screen.getByText(/student\.pending/)).toBeInTheDocument();
  });

  it("shows MapPin button when onShowOnMap is provided", () => {
    const onShowOnMap = vi.fn();
    render(<ApplicationTracker applications={mockApplications as any} onShowOnMap={onShowOnMap} />);
    // MapPin button should be present
    const mapButton = screen.getByRole("button", { name: "" }); // icon-only button
    // Click the university name area
    fireEvent.click(screen.getByText("Seoul National University"));
    expect(onShowOnMap).toHaveBeenCalledWith("uni-1");
  });
});
