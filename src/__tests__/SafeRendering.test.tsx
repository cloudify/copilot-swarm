import React from "react";
import { render } from "ink-testing-library";
import { SafeText, ErrorText, ConditionalText } from "../components/ui";

describe("Safe Rendering Components", () => {
  describe("SafeText", () => {
    it("should render non-empty text correctly", () => {
      const { lastFrame } = render(<SafeText>Hello World</SafeText>);
      expect(lastFrame()).toBe("Hello World");
    });

    it("should handle empty strings gracefully", () => {
      const { lastFrame } = render(<SafeText>{""}</SafeText>);
      expect(lastFrame()).toBe("");
    });

    it("should handle undefined gracefully", () => {
      const { lastFrame } = render(<SafeText>{undefined}</SafeText>);
      expect(lastFrame()).toBe("");
    });

    it("should handle null gracefully", () => {
      const { lastFrame } = render(<SafeText>{null}</SafeText>);
      expect(lastFrame()).toBe("");
    });

    it("should use fallback text when content is empty", () => {
      const { lastFrame } = render(
        <SafeText fallback="No data">{""}</SafeText>
      );
      expect(lastFrame()).toBe("No data");
    });

    it("should handle arrays of strings", () => {
      const { lastFrame } = render(
        <SafeText>{["Hello", " ", "World"]}</SafeText>
      );
      expect(lastFrame()).toBe("Hello World");
    });

    it("should filter out empty strings from arrays", () => {
      const { lastFrame } = render(
        <SafeText>{["Hello", "", "World"]}</SafeText>
      );
      expect(lastFrame()).toBe("HelloWorld");
    });
  });

  describe("ErrorText", () => {
    it("should render error messages in red", () => {
      const { lastFrame } = render(<ErrorText error="Something went wrong" />);
      expect(lastFrame()).toContain("Something went wrong");
    });

    it("should handle Error objects", () => {
      const error = new Error("Test error");
      const { lastFrame } = render(<ErrorText error={error} />);
      expect(lastFrame()).toContain("Test error");
    });

    it("should not render when error is null", () => {
      const { lastFrame } = render(<ErrorText error={null} />);
      expect(lastFrame()).toBe("");
    });
  });

  describe("ConditionalText", () => {
    it("should render when condition is true and text is non-empty", () => {
      const { lastFrame } = render(
        <ConditionalText condition={true} text="Visible text" />
      );
      expect(lastFrame()).toBe("Visible text");
    });

    it("should not render when condition is false", () => {
      const { lastFrame } = render(
        <ConditionalText condition={false} text="Hidden text" />
      );
      expect(lastFrame()).toBe("");
    });

    it("should not render when text is empty even if condition is true", () => {
      const { lastFrame } = render(
        <ConditionalText condition={true} text="" />
      );
      expect(lastFrame()).toBe("");
    });
  });
});
