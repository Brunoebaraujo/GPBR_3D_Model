import type { FitValidationResult } from '../types';
import { formatNumber } from '../utils/unitConversion';

interface StatusPanelProps {
  validation: FitValidationResult;
  missingWeight?: boolean;
}

export function StatusPanel({ validation, missingWeight = false }: StatusPanelProps) {
  return (
    <footer className="status-panel">
      <div className={validation.fits && !missingWeight ? 'status-pill positive' : 'status-pill negative'}>
        {missingWeight ? 'Peso pendente' : validation.fits ? 'Sem alertas' : 'Revisar'}
      </div>
      <div>
        <span>Ocupação da cena</span>
        <strong>{formatNumber(validation.volumeUtilizationPercent)}%</strong>
      </div>
      <div>
        <span>Peso na cena</span>
        <strong>{missingWeight ? 'Parcial / pendente' : `${formatNumber(validation.totalObjectWeightKg)} kg`}</strong>
      </div>
      <div>
        <span>Carga restante</span>
        <strong>{missingWeight ? 'Não validada' : `${formatNumber(validation.remainingPayloadKg)} kg`}</strong>
      </div>
      <div>
        <span>Peças na cena</span>
        <strong>{validation.objectCount}</strong>
      </div>
      <div className="warnings">
        <span>Alertas da cena</span>
        {missingWeight ? <strong>Peso bruto não informado para todos os SKUs.</strong> : validation.warnings.length === 0 ? (
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
