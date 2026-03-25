import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnouncementFeed } from "../AnnouncementFeed";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

// Mock the hook
const mockAnnouncements: any[] = [];
vi.mock("@/hooks/useUniversityAnnouncements", () => ({
  useUniversityAnnouncements: () => ({
    announcements: mockAnnouncements,
    loading: false,
  }),
}));

describe("AnnouncementFeed", () => {
  it("shows empty state when no announcements", () => {
    mockAnnouncements.length = 0;
    render(<AnnouncementFeed roomId="room-1" />);
    expect(screen.getByText("Hali e'lonlar yo'q")).toBeInTheDocument();
  });

  it("renders priority badges correctly", () => {
    mockAnnouncements.length = 0;
    mockAnnouncements.push(
      {
        id: "1",
        room_id: "room-1",
        posted_by: "user-1",
        title: "Urgent Announcement",
        content: "This is urgent",
        priority: "urgent",
        is_pinned: false,
        created_at: "2026-01-01T10:00:00Z",
        updated_at: "2026-01-01T10:00:00Z",
        attachment_url: null,
        attachment_name: null,
        poster_name: "Admin",
      },
      {
        id: "2",
        room_id: "room-1",
        posted_by: "user-2",
        title: "High Priority",
        content: "This is high",
        priority: "high",
        is_pinned: false,
        created_at: "2026-01-02T10:00:00Z",
        updated_at: "2026-01-02T10:00:00Z",
        attachment_url: null,
        attachment_name: null,
        poster_name: null,
      }
    );

    render(<AnnouncementFeed roomId="room-1" />);
    expect(screen.getByText("Urgent Announcement")).toBeInTheDocument();
    expect(screen.getByText("High Priority")).toBeInTheDocument();
    // Check priority badge labels
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows pin icon for pinned announcements", () => {
    mockAnnouncements.length = 0;
    mockAnnouncements.push({
      id: "3",
      room_id: "room-1",
      posted_by: "user-1",
      title: "Pinned Post",
      content: "Pinned content",
      priority: "normal",
      is_pinned: true,
      created_at: "2026-01-03T10:00:00Z",
      updated_at: "2026-01-03T10:00:00Z",
      attachment_url: null,
      attachment_name: null,
      poster_name: null,
    });

    const { container } = render(<AnnouncementFeed roomId="room-1" />);
    // Pinned card should have the primary border styling
    const card = container.querySelector(".border-primary\\/50");
    expect(card).toBeInTheDocument();
  });

  it("renders attachment links when present", () => {
    mockAnnouncements.length = 0;
    mockAnnouncements.push({
      id: "4",
      room_id: "room-1",
      posted_by: "user-1",
      title: "With Attachment",
      content: "Has a file",
      priority: "normal",
      is_pinned: false,
      created_at: "2026-01-04T10:00:00Z",
      updated_at: "2026-01-04T10:00:00Z",
      attachment_url: "https://example.com/file.pdf",
      attachment_name: "file.pdf",
      poster_name: null,
    });

    render(<AnnouncementFeed roomId="room-1" />);
    const link = screen.getByText("file.pdf");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "https://example.com/file.pdf");
  });
});
