import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the Daejeon Yuseong move scenario with evidence and safety notice", () => {
    render(<App />);

    expect(screen.getByText("대전 신혼부부 주거비 지원")).toBeInTheDocument();
    expect(screen.getByText("자영업자 고용안정 지원")).toBeInTheDocument();
    expect(screen.getByText("resource://adapters/v1")).toBeInTheDocument();
    expect(screen.getByText("korean-law-evidence")).toBeInTheDocument();
    expect(screen.getByText("parked")).toBeInTheDocument();
    expect(screen.getByText("Apartment rent transaction snapshot")).toBeInTheDocument();
    expect(screen.getByText("EV charger availability")).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("신청 준비 체크리스트")).toBeInTheDocument();
    expect(screen.getByText(/본인인증/)).toBeInTheDocument();
  });
});
