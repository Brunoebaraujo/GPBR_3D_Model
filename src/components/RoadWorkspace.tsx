import { useEffect, useState } from "react";
import { GOODPACK_MODELS, type GoodpackModel } from "../data/skus";
import {
  findRoadPosition,
  footprint,
  makeRoadUnit,
  moveRoadUnits,
  ROAD_PRESETS,
  roadBounds,
  validateRoad,
  type RoadState,
  type RoadUnit,
  type RoadVehicle,
} from "../utils/roadLoading";
import { RoadScene, type RoadCamera } from "./RoadScene";

const initial: RoadState = {
  vehicle: { ...ROAD_PRESETS.truck },
  units: [],
  gap: 10,
};
const meters = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n / 1000);
const number = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  optional = false,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  optional?: boolean;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const n = draft.trim() === "" ? null : Number(draft);
    if (
      (n === null && optional) ||
      (n !== null && Number.isFinite(n) && n >= min && n <= max)
    )
      onChange(n);
    setDraft(value === null ? "" : String(value));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        placeholder={optional ? "Não informado" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
export function RoadWorkspace() {
  const [history, setHistory] = useState<RoadState[]>([initial]);
  const [cursor, setCursor] = useState(0);
  const state = history[cursor],
    { vehicle, units, gap } = state;
  const [selected, setSelected] = useState<string[]>([]);
  const [model, setModel] = useState<GoodpackModel>("MB5");
  const [cargo, setCargo] = useState(1000);
  const [camera, setCamera] = useState<RoadCamera>("perspective");
  const [opacity, setOpacity] = useState(0.12);
  const [roof, setRoof] = useState(true),
    [sides, setSides] = useState(true),
    [snap, setSnap] = useState(true);
  const [message, setMessage] = useState(
    "Escolha o equipamento, confirme as medidas e adicione MB5 ou MB6.",
  );
  const result = validateRoad(state);
  const chosen = units.filter((u) => selected.includes(u.id));
  const unit = chosen.length === 1 ? chosen[0] : null;
  const commit = (next: RoadState) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next].slice(-60));
    setCursor(Math.min(cursor + 1, 59));
  };
  const accept = (next: RoadUnit[]) => {
    const validation = validateRoad({ ...state, units: next });
    if (!validation.valid) {
      setMessage(`Movimento recusado: ${validation.errors[0]}`);
      return false;
    }
    commit({ ...state, units: next });
    setMessage("Configuração atualizada.");
    return true;
  };
  const select = (id: string, multiple: boolean) =>
    setSelected((current) =>
      multiple
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : [id],
    );
  const changeVehicle = (patch: Partial<RoadVehicle>) =>
    commit({ ...state, vehicle: { ...vehicle, ...patch } });
  const add = (source?: RoadUnit) => {
    const template = source
      ? { ...source, id: crypto.randomUUID(), locked: false }
      : makeRoadUnit(model, cargo, crypto.randomUUID());
    const position = findRoadPosition(state, template);
    if (!position) {
      setMessage(
        "Não foi encontrada posição válida. Confira espaço, peso, folgas e erros do cenário.",
      );
      return;
    }
    if (accept([...units, position])) setSelected([position.id]);
  };
  const translate = (axis: "x" | "y" | "z", value: number) => {
    if (!unit) return;
    accept(
      moveRoadUnits(
        state,
        selected,
        { x: 0, y: 0, z: 0, [axis]: value - unit[axis] },
        false,
      ),
    );
  };
  const rotate = () => {
    if (!chosen.length) return;
    const cx = chosen.reduce((s, u) => s + u.x, 0) / chosen.length,
      cy = chosen.reduce((s, u) => s + u.y, 0) / chosen.length;
    accept(
      units.map((u) =>
        selected.includes(u.id) && !u.locked
          ? {
              ...u,
              x: Math.round(cx - (u.y - cy)),
              y: Math.round(cy + (u.x - cx)),
              turned: !u.turned,
            }
          : u,
      ),
    );
  };
  const stack = () => {
    if (!unit || unit.z !== 0) return;
    const next = {
      ...unit,
      id: crypto.randomUUID(),
      z: footprint(unit).height,
      locked: false,
    };
    if (accept([...units, next])) setSelected([next.id]);
  };
  const duplicateGroup = () => {
    if (!chosen.length) return;
    const front = Math.min(...chosen.map((u) => roadBounds(u).front)),
      back = Math.max(...chosen.map((u) => roadBounds(u).back));
    const copies = chosen.map((u) => ({
      ...u,
      id: crypto.randomUUID(),
      y: u.y + back - front + gap,
      locked: false,
    }));
    if (accept([...units, ...copies])) setSelected(copies.map((u) => u.id));
  };
  const remove = () => {
    const ids = selected.filter(
      (id) => !units.find((u) => u.id === id)?.locked,
    );
    if (accept(units.filter((u) => !ids.includes(u.id)))) setSelected([]);
  };
  const selectedClearance = unit ? roadBounds(unit) : null;
  return (
    <main className="road-workspace">
      <aside className="road-panel road-settings">
        <div>
          <p className="eyebrow">Planejamento rodoviário</p>
          <h1>Goodpack no caminhão</h1>
          <p className="muted">MB5 e MB6 montados · até 2 níveis</p>
        </div>
        <section>
          <h2>01 · Equipamento</h2>
          <label>
            Perfil
            <select
              aria-label="Perfil"
              value={vehicle.kind}
              onChange={(e) => {
                const kind = e.target.value as RoadVehicle["kind"];
                commit({ ...state, vehicle: { ...ROAD_PRESETS[kind] } });
                setMessage(
                  "Perfil alterado. Revise a carga existente e confirme as medidas.",
                );
              }}
            >
              <option value="truck">Truck baú</option>
              <option value="sider">Carreta sider</option>
            </select>
          </label>
          <div className="road-fields">
            <NumberField
              label="Comprimento útil (mm)"
              value={vehicle.length}
              min={500}
              max={30000}
              onChange={(n) => changeVehicle({ length: n!, confirmed: false })}
            />
            <NumberField
              label="Largura útil (mm)"
              value={vehicle.width}
              min={500}
              max={5000}
              onChange={(n) => changeVehicle({ width: n!, confirmed: false })}
            />
            <NumberField
              label="Altura útil (mm)"
              value={vehicle.height}
              min={500}
              max={5000}
              onChange={(n) => changeVehicle({ height: n!, confirmed: false })}
            />
            <NumberField
              label="Capacidade útil (kg)"
              value={vehicle.capacityKg}
              min={1}
              optional
              onChange={(n) => changeVehicle({ capacityKg: n })}
            />
          </div>
          <label className="road-check">
            <input
              type="checkbox"
              checked={vehicle.confirmed}
              onChange={(e) => changeVehicle({ confirmed: e.target.checked })}
            />{" "}
            Medidas conferidas com a transportadora
          </label>
          <details>
            <summary>Aberturas e referência</summary>
            <NumberField
              label="Altura da porta traseira (mm)"
              value={vehicle.rearHeight}
              min={1}
              optional
              onChange={(n) => changeVehicle({ rearHeight: n })}
            />
            <NumberField
              label="Largura da porta traseira (mm)"
              value={vehicle.rearWidth}
              min={1}
              optional
              onChange={(n) => changeVehicle({ rearWidth: n })}
            />
            {vehicle.kind === "sider" && (
              <NumberField
                label="Altura livre lateral / trilho (mm)"
                value={vehicle.sideHeight}
                min={1}
                optional
                onChange={(n) => changeVehicle({ sideHeight: n })}
              />
            )}
            <p className="muted">
              Referência de equipamento específico, não padrão universal.{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href={
                  vehicle.kind === "truck"
                    ? "https://ingencar.com.br/produto/metalfort-bau-para-truck-cod-648/"
                    : "https://bautaruma.com/112100001"
                }
              >
                Consultar fonte
              </a>
            </p>
            <p className="muted">
              Pilares e outras intrusões devem ser descontados do espaço útil. A
              entrada é avaliada por unidade, sem simular manobras.
            </p>
          </details>
        </section>
        <section>
          <h2>02 · Adicionar Goodpack</h2>
          <div className="road-toggle">
            <button
              aria-pressed={model === "MB5"}
              onClick={() => setModel("MB5")}
            >
              MB5
            </button>
            <button
              aria-pressed={model === "MB6"}
              onClick={() => setModel("MB6")}
            >
              MB6
            </button>
          </div>
          <p className="muted">
            {GOODPACK_MODELS[model].externalDimensions.depth} ×{" "}
            {GOODPACK_MODELS[model].externalDimensions.width} ×{" "}
            {GOODPACK_MODELS[model].externalDimensions.height} mm · tara{" "}
            {GOODPACK_MODELS[model].emptyWeightKg} kg
          </p>
          <NumberField
            label="Peso do produto por unidade (kg)"
            value={cargo}
            max={1650}
            onChange={(n) => setCargo(n!)}
          />
          <button className="primary-button" onClick={() => add()}>
            + Adicionar {model}
          </button>
          <NumberField
            label="Folga lateral e entre unidades (mm)"
            value={gap}
            max={500}
            onChange={(n) => commit({ ...state, gap: n! })}
          />
          <p className="muted">
            Sem folga vertical entre unidades empilhadas. Limite: duas unidades
            carregadas, alinhadas e do mesmo modelo.
          </p>
        </section>
        <section>
          <h2>03 · Unidades ({units.length})</h2>
          <div className="road-actions">
            <button
              disabled={!units.length}
              onClick={() => setSelected(units.map((u) => u.id))}
            >
              Selecionar todas
            </button>
            <button disabled={!selected.length} onClick={() => setSelected([])}>
              Desmarcar
            </button>
          </div>
          <p className="muted">Shift + clique para selecionar um grupo.</p>
          <div className="road-unit-list">
            {units.length === 0 ? (
              <p className="road-empty">O equipamento está vazio.</p>
            ) : (
              units.map((u, i) => (
                <button
                  key={u.id}
                  aria-pressed={selected.includes(u.id)}
                  onClick={(e) =>
                    select(u.id, e.shiftKey || e.ctrlKey || e.metaKey)
                  }
                >
                  <span>
                    <i
                      style={{
                        background: u.model === "MB5" ? "#2787aa" : "#17a781",
                      }}
                    />
                    {u.model} · {i + 1}
                    {u.locked ? " 🔒" : ""}
                  </span>
                  <small>
                    {number(u.cargoKg + GOODPACK_MODELS[u.model].emptyWeightKg)}{" "}
                    kg · {u.z === 0 ? "piso" : "2º nível"}
                  </small>
                </button>
              ))
            )}
          </div>
        </section>
      </aside>
      <section className="road-stage">
        <div className="road-toolbar">
          <div className="road-toggle">
            {(["perspective", "top", "side", "rear"] as RoadCamera[]).map(
              (c, i) => (
                <button
                  key={c}
                  aria-pressed={camera === c}
                  onClick={() => setCamera(c)}
                >
                  {["Perspectiva", "Superior", "Lateral", "Traseira"][i]}
                </button>
              ),
            )}
          </div>
          <div className="road-actions">
            <button
              disabled={cursor === 0}
              onClick={() => {
                setCursor(cursor - 1);
                setSelected([]);
                setMessage("Alteração desfeita.");
              }}
            >
              ↶ Desfazer
            </button>
            <button
              disabled={cursor === history.length - 1}
              onClick={() => {
                setCursor(cursor + 1);
                setSelected([]);
                setMessage("Alteração refeita.");
              }}
            >
              ↷ Refazer
            </button>
          </div>
        </div>
        <div className="road-canvas">
          <RoadScene
            state={state}
            selected={selected}
            camera={camera}
            opacity={opacity}
            roof={roof}
            sides={sides}
            snap={snap}
            onSelect={select}
            onMove={accept}
            onDragMessage={setMessage}
          />
          <div className="road-scene-badge">
            {vehicle.name}
            <span>
              {meters(vehicle.length)} × {meters(vehicle.width)} ×{" "}
              {meters(vehicle.height)} m úteis
            </span>
          </div>
        </div>
        <div className="road-message" role="status">
          {message}
        </div>
        <div className="road-metrics">
          <div>
            <span>Unidades</span>
            <strong>
              {units.filter((u) => u.model === "MB5").length} MB5 /{" "}
              {units.filter((u) => u.model === "MB6").length} MB6
            </strong>
          </div>
          <div>
            <span>Peso embarcado</span>
            <strong>{number(result.total)} kg</strong>
            <small>
              {number(result.cargo)} produto + {number(result.tare)} tara
            </small>
          </div>
          <div>
            <span>Saldo de capacidade</span>
            <strong>
              {vehicle.capacityKg === null
                ? "Não informado"
                : `${number(vehicle.capacityKg - result.total)} kg`}
            </strong>
          </div>
          <div>
            <span>Ocupação do piso / volume</span>
            <strong>
              {number(result.floorPercent)}% / {number(result.volumePercent)}%
            </strong>
          </div>
        </div>
        <div className="road-weight">
          <span>Frente: {number(result.frontWeight)} kg</span>
          <div>
            <i
              style={{
                width: `${result.total ? (result.frontWeight / result.total) * 100 : 50}%`,
              }}
            />
          </div>
          <span>Traseira: {number(result.rearWeight)} kg</span>
          <small>
            Distribuição espacial estimada com massa uniforme · não é carga por
            eixo
          </small>
        </div>
      </section>
      <aside className="road-panel road-properties">
        <section>
          <h2>Visualização</h2>
          <label>
            Raio X · opacidade {Math.round(opacity * 100)}%
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          <label className="road-check">
            <input
              type="checkbox"
              checked={roof}
              onChange={(e) => setRoof(e.target.checked)}
            />{" "}
            Mostrar teto
          </label>
          <label className="road-check">
            <input
              type="checkbox"
              checked={sides}
              onChange={(e) => setSides(e.target.checked)}
            />{" "}
            Mostrar laterais
          </label>
          <label className="road-check">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />{" "}
            Encaixe assistido ao mover
          </label>
        </section>
        <section>
          <h2>
            {chosen.length
              ? `${chosen.length} unidade(s) selecionada(s)`
              : "Selecione uma unidade"}
          </h2>
          <p className="muted">
            Use as setas do controle 3D para mover e o quadrado do plano para
            arrastar no piso. Giro sempre em pé.
          </p>
          {unit && (
            <>
              <div className="road-fields">
                <NumberField
                  label="Lateral X (mm)"
                  value={unit.x}
                  min={-30000}
                  onChange={(n) => translate("x", n!)}
                />
                <NumberField
                  label="Longitudinal Y (mm)"
                  value={unit.y}
                  min={-30000}
                  onChange={(n) => translate("y", n!)}
                />
                <NumberField
                  label="Base Z (mm)"
                  value={unit.z}
                  onChange={(n) => translate("z", n!)}
                />
                <NumberField
                  label="Produto (kg)"
                  value={unit.cargoKg}
                  max={1650}
                  onChange={(n) => {
                    if (!unit.locked)
                      accept(
                        units.map((u) =>
                          u.id === unit.id ? { ...u, cargoKg: n! } : u,
                        ),
                      );
                  }}
                />
              </div>
              <p className="muted">
                Origem no centro do piso. Y negativo aponta para a cabine.
              </p>
              {selectedClearance && (
                <div className="road-clearance">
                  Folgas até as paredes: esquerda{" "}
                  {number(selectedClearance.left + vehicle.width / 2)} · direita{" "}
                  {number(vehicle.width / 2 - selectedClearance.right)} · frente{" "}
                  {number(selectedClearance.front + vehicle.length / 2)} ·
                  traseira {number(vehicle.length / 2 - selectedClearance.back)}{" "}
                  · teto {number(vehicle.height - selectedClearance.top)} mm
                </div>
              )}
            </>
          )}
          <div className="road-action-grid">
            <button
              disabled={!chosen.length || chosen.some((u) => u.locked)}
              onClick={rotate}
            >
              Girar 90°
            </button>
            <button disabled={!unit} onClick={() => unit && add(unit)}>
              Duplicar unidade
            </button>
            <button disabled={!unit || unit.z !== 0} onClick={stack}>
              Empilhar cópia
            </button>
            <button disabled={!chosen.length} onClick={duplicateGroup}>
              Duplicar fileira / grupo
            </button>
            <button
              disabled={!chosen.length}
              onClick={() =>
                commit({
                  ...state,
                  units: units.map((u) =>
                    selected.includes(u.id)
                      ? { ...u, locked: !chosen.every((c) => c.locked) }
                      : u,
                  ),
                })
              }
            >
              {chosen.length && chosen.every((u) => u.locked)
                ? "Destravar"
                : "Travar posição"}
            </button>
            <button
              disabled={!chosen.length || chosen.every((u) => u.locked)}
              onClick={remove}
            >
              Excluir seleção
            </button>
          </div>
          <p className="muted">
            Para mover uma pilha, selecione a base e a unidade de cima. Para
            retirar a base, retire primeiro a unidade superior.
          </p>
        </section>
        <section
          className={
            result.valid ? "road-validation" : "road-validation has-errors"
          }
        >
          <h2>{result.valid ? "✓ Geometria válida" : "Ajustes necessários"}</h2>
          {result.errors.map((error) => (
            <p key={error} className="road-error">
              {error}
            </p>
          ))}
          {result.notices.map((notice) => (
            <p key={notice} className="road-notice">
              {notice}
            </p>
          ))}
        </section>
      </aside>
    </main>
  );
}
