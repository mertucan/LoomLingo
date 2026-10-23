import { generateJson, MODELS } from "../services/gemini";
import { UserFacingError } from "../types";

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
const answer = (value: unknown) => json(200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
const dailyQuota = json(429, { error: { code: 429, details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } });
const options = { apiKey: "test", glossary: [{ id: "1", source: "bobbin", turkish: "masura" }] };
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock as unknown as typeof fetch; });

test("returns parsed JSON and sends the glossary in the system instruction", async () => {
  fetchMock.mockResolvedValueOnce(answer({ ok: 1 }));
  await expect(generateJson(options, [{ text: "x" }], {})).resolves.toEqual({ ok: 1 });
  const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)) as { systemInstruction: { parts: Array<{ text: string }> } };
  expect(body.systemInstruction.parts[0]?.text).toContain("bobbin = masura");
});

test("moves to the next model when the daily quota is used up", async () => {
  fetchMock.mockResolvedValueOnce(dailyQuota).mockResolvedValueOnce(answer({ ok: 2 }));
  await expect(generateJson(options, [{ text: "x" }], {})).resolves.toEqual({ ok: 2 });
  expect(fetchMock.mock.calls[1]?.[0]).toContain(MODELS[1]);
});

test("shows the daily limit message when every model is used up", async () => {
  fetchMock.mockResolvedValue(dailyQuota);
  await expect(generateJson(options, [{ text: "x" }], {})).rejects.toEqual(new UserFacingError("Bugünkü ücretsiz çeviri hakkı doldu.", "quota"));
  expect(fetchMock).toHaveBeenCalledTimes(MODELS.length);
});

test("waits and retries after a per-minute rate limit", async () => {
  jest.useFakeTimers();
  const onWait = jest.fn();
  fetchMock.mockResolvedValueOnce(json(429, { error: { details: [{ retryDelay: "3s" }] } })).mockResolvedValueOnce(answer({ ok: 3 }));
  const promise = generateJson({ ...options, onWait }, [{ text: "x" }], {});
  await jest.advanceTimersByTimeAsync(3000);
  await expect(promise).resolves.toEqual({ ok: 3 });
  expect(onWait).toHaveBeenCalledWith(3);
  jest.useRealTimers();
});

test("stops at once for an invalid key", async () => {
  fetchMock.mockResolvedValue(json(400, { error: { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }));
  await expect(generateJson(options, [{ text: "x" }], {})).rejects.toThrow(/API anahtarı geçersiz/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("reports a missing connection", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await expect(generateJson(options, [{ text: "x" }], {})).rejects.toThrow(/İnternet bağlantısı yok/);
});

test("records a used-up model with Google's limit and skips models known to be used up", async () => {
  const onDailyQuota = jest.fn();
  fetchMock.mockResolvedValueOnce(json(429, { error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250" }] }] } })).mockResolvedValueOnce(answer({ ok: 4 }));
  await expect(generateJson({ ...options, onDailyQuota, isExhausted: m => m === MODELS[0] }, [{ text: "x" }], {})).resolves.toEqual({ ok: 4 });
  expect(fetchMock.mock.calls.map(c => c[0])).toEqual([expect.stringContaining(MODELS[1]), expect.stringContaining(MODELS[2])]);
  expect(onDailyQuota).toHaveBeenCalledWith(MODELS[1], 250);
});
