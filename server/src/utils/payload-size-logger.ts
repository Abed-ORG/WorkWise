const shouldLogPayloadSize = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const logResponsePayloadSize = (label: string, payload: unknown) => {
  if (!shouldLogPayloadSize) {
    return;
  }

  try {
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    console.log("[payload]", { label, bytes });
  } catch {
    console.log("[payload]", { label, bytes: "unknown" });
  }
};
