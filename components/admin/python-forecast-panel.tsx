import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import type { ForecastModel } from '@/lib/scm-model';
import { runPythonForecastAction } from '@/app/(admin)/admin/python-forecast/actions';

export default function PythonForecastPanel({ models }: { models: ForecastModel[] }) {
  const pythonModels = models.filter((model) => model.engine === 'PYTHON');
  const enabled = pythonModels.filter((model) => model.enabled);
  return <><div className="model-registry-grid">{pythonModels.map((model) => <div className="kpi-card" key={model.modelId}><div className="kpi-card-label"><span>{model.modelName}</span><Badge status={model.enabled ? 'safe' : 'calculation_unavailable'}>{model.enabled ? 'ENABLED' : 'DISABLED'}</Badge></div><div className="kpi-card-value">{model.modelId}</div><div className="kpi-card-foot">{model.applicableDemandType.join(' · ')}</div></div>)}</div><form action={runPythonForecastAction} className="python-run-form"><input type="hidden" name="model_ids" value={enabled.map((model) => model.modelId).join(',')} /><label>Forecast 기간<input name="horizon" type="number" min="0" defaultValue="6" /></label><Button type="submit" variant="primary">Python Forecast 실행</Button></form></>;
}
