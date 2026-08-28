import { requireAdmin } from './auth';

function serviceConfig() {
  const url = process.env.FORECAST_SERVICE_URL;
  const token = process.env.FORECAST_SERVICE_TOKEN;
  if (!url || !token) throw new Error('Python Forecast Service 환경변수가 설정되지 않았습니다.');
  return { url: url.replace(/\/$/, ''), token };
}

async function callService(path: string, body: unknown) {
  const config = serviceConfig();
  const response = await fetch(`${config.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forecast-token': config.token }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Python Forecast Service 오류(${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function runPythonForecast(input: { modelIds?: string[]; horizon?: number }) {
  const actor = await requireAdmin();
  return { result: await callService('/forecast/run', { model_ids: input.modelIds, horizon: input.horizon, triggered_email: actor.email }), actor: actor.userId };
}

export async function runPythonBacktest(input: { forecastRunId: string; metric?: string }) {
  const actor = await requireAdmin();
  return { result: await callService('/backtest/run', { forecast_run_id: input.forecastRunId, metric: input.metric }), actor: actor.userId };
}
