import { describe, expect, it } from "vitest";

import { isMultipartRequestBodyMode } from "./provider-request-body";

describe("provider request body", () => {
  it("recognizes all supported multipart request body modes", () => {
    expect(isMultipartRequestBodyMode("multipart")).toBe(true);
    expect(isMultipartRequestBodyMode("multipart_form_data")).toBe(true);
    expect(isMultipartRequestBodyMode("multipart/form-data")).toBe(true);
    expect(isMultipartRequestBodyMode("json")).toBe(false);
  });
});
