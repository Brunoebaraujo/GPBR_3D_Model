import type { FitValidationResult } from '../types';
import { formatNumber } from '../utils/unitConversion';

interface StatusPanelProps {
  validation: FitValidationResult;
}

export function StatusPanel({ validation }: StatusPanelProps) {
  return (
    <footer className="status-panel">
      <div className={validation.fits ? 'status-pill positive' : 'status-pill negative'}>
        {validation.fits ? 'Sem alertas' : 'Revisar'}
      </div>
      <div>
        <span>Ocupação da cena</span>
        <strong>{formatNumber(validation.volumeUtilizationPercent)}%</strong>
      </div>
      <div>
        <span>Peso na cena</span>
        <strong>{formatNumber(validation.totalObjectWeightKg)} kg</strong>
      </div>
      <div>
        <span>Carga restante</span>
        <strong>{formatNumber(validation.remainingPayloadKg)} kg</strong>
      </div>
      <div>
        <span>Peças na cena</span>
        <strong>{validation.objectCount}</strong>
      </div>
      <div className="warnings">
        <span>Alertas da cena</span>
        {validation.warnings.length === 0 ? (
          <strong>Nenhum</strong>
        ) : (
          <ul>
            {validation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
