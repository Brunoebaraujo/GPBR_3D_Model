import { publishVR } from './VRBridge';
import { RoadVRScene } from './RoadScene';
import { useEffect, useState } from "react";
import { GOODPACK_MODELS, type GoodpackModel } from "../data/skus";
import {
  findRoadBatch,
  isContainer,
  bodyOf,
  dimensionsReady,
  hasSideAccess,
  ROAD_REFERENCES,
  sameBody,
  stackIds,
  type CargoBody,
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
const meters = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n / 1000);
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
  const [batchSize, setBatchSize] = useState<1 | 2>(1);
  const [selectStacks, setSelectStacks] = useState(true);
  const [bodyIndex, setBodyIndex] = useState(0);
  const activeCompartment = vehicle.secondBody ? bodyIndex : 0;
  const activeBody = bodyOf(vehicle, activeCompartment)!;
  const reference = ROAD_REFERENCES[vehicle.kind];
  const ready = dimensionsReady(vehicle);
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
  const anchor = chosen[0];
  const selectionBody = bodyOf(vehicle, anchor?.compartment ?? 0) ?? vehicle;
  const mixedBodies = chosen.some((u) => !sameBody(u, chosen[0]));
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
  const select = (id: string, multiple: boolean) => {
    const item = units.find((u) => u.id === id);
    if (!item) return;
    setBodyIndex(item.compartment ?? 0);
    const ids = selectStacks ? stackIds(units, item) : [id];
    setSelected((current) =>
      multiple
        ? ids.every((x) => current.includes(x))
          ? current.filter((x) => !ids.includes(x))
          : [...new Set([...current, ...ids])]
        : ids,
    );
  };
  const changeVehicle = (patch: Partial<RoadVehicle>) =>
    commit({ ...state, vehicle: { ...vehicle, ...patch } });
  const changeBody = (patch: Partial<CargoBody>) =>
    activeCompartment === 0
      ? changeVehicle({ ...patch, confirmed: false })
      : changeVehicle({
          secondBody: { ...activeBody, ...patch },
          confirmed: false,
        });
  const add = (source?: RoadUnit) => {
    const template = source
      ? { ...source, id: crypto.randomUUID(), locked: false }
      : {
          ...makeRoadUnit(model, cargo, crypto.randomUUID()),
          compartment: activeCompartment,
        };
    const count = source ? 1 : batchSize;
    const batch = findRoadBatch(state, template, count);
    if (!batch) {
      setMessage(
        count === 2
          ? "Pilha não incluída: as duas unidades precisam caber juntas. Confira altura, abertura de entrada, peso total, folgas e medidas do compartimento."
          : "Não foi encontrada posição válida. Confira espaço, peso, folgas e erros do cenário.",
      );
      return;
    }
    if (accept([...units, ...batch])) setSelected(batch.map((u) => u.id));
  };
  const translate = (axis: "x" | "y" | "z", value: number) => {
    if (!anchor || mixedBodies) return;
    accept(
      moveRoadUnits(
        state,
        selected,
        { x: 0, y: 0, z: 0, [axis]: value - anchor[axis] },
        false,
      ),
    );
  };
  const rotate = () => {
    if (!chosen.length || mixedBodies) return;
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
      entryLevels: 1 as const,
      locked: false,
    };
    if (accept([...units, next]))
      setSelected(selectStacks ? [unit.id, next.id] : [next.id]);
  };
  const duplicateGroup = () => {
    if (!chosen.length || mixedBodies) return;
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
  useEffect(() => {
    publishVR('road', {
      vehicle,
      scene: ready ? <RoadVRScene state={state} selected={selected} opacity={opacity} roof={roof} sides={sides} onSelect={select} /> : null,
      status: ready ? `${vehicle.name} · ${units.length} caixas · ${message}` : 'Configure as dimensões no desktop ou escolha um contêiner na prancheta.',
      actions: [
        ...Object.values(ROAD_PRESETS).filter(v => dimensionsReady(v)).map(profile => ({ label: profile.name, run: () => { commit({ ...state, vehicle: { ...profile } }); setBodyIndex(0); setSelected([]); } })),
        { label: `Caixa: ${model}`, run: () => setModel(model === 'MB5' ? 'MB6' : 'MB5') },
        { label: `Inclusão: ${batchSize === 1 ? 'unidade' : 'pilha de 2'}`, run: () => setBatchSize(batchSize === 1 ? 2 : 1) },
        { label: `Produto: ${cargo} kg (+50)`, run: () => setCargo(Math.min(1650, cargo + 50)) },
        { label: 'Produto: −50 kg', run: () => setCargo(Math.max(0, cargo - 50)) },
        { label: 'Adicionar Goodpack', run: () => add() },
        { label: 'Selecionar próxima caixa', run: () => { const next = units[(units.findIndex(u => u.id === selected[0]) + 1) % units.length]; if (next) select(next.id, false); } },
        { label: `Selecionar: ${selectStacks ? 'pilha' : 'unidade'}`, run: () => { setSelectStacks(!selectStacks); setSelected([]); } },
        ...(['x', 'y', 'z'] as const).flatMap(axis => [-20, 20].map(delta => ({ label: `${axis.toUpperCase()} ${delta > 0 ? '+' : ''}${delta} mm`, run: () => { if (anchor) translate(axis, anchor[axis] + delta); } }))),
        { label: 'Girar seleção 90°', run: rotate }, { label: 'Empilhar cópia', run: stack }, { label: 'Excluir seleção', run: remove },
        { label: 'Desfazer', run: () => { if (cursor > 0) { setCursor(cursor - 1); setSelected([]); } } },
        { label: `Teto: ${roof ? 'visível' : 'oculto'}`, run: () => setRoof(!roof) },
        { label: `Laterais: ${sides ? 'visíveis' : 'ocultas'}`, run: () => setSides(!sides) },
        ...(vehicle.secondBody ? [{ label: `Compartimento ${activeCompartment + 1}`, run: () => setBodyIndex(activeCompartment === 0 ? 1 : 0) }] : []),
      ],
    });
  });
  const selectedClearance = unit ? roadBounds(unit) : null;
  return (
    <main className="road-workspace">
      <aside className="road-panel road-settings">
        <div>
          <p className="eyebrow">Planejamento rodoviário</p>
          <h1>Estufagem de Goodpacks</h1>
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
                commit({
                  ...state,
                  vehicle: {
                    ...ROAD_PRESETS[kind],
                    ...(ROAD_PRESETS[kind].secondBody
                      ? { secondBody: { ...ROAD_PRESETS[kind].secondBody! } }
                      : {}),
                  },
                });
                setBodyIndex(0);
                setSelected([]);
                setMessage(
                  "Perfil alterado. Revise a carga existente e confirme as medidas.",
                );
              }}
            >
              {Object.values(ROAD_PRESETS).map((profile) => (
                <option key={profile.kind} value={profile.kind}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <div className="road-reference">
            <strong>{isContainer(vehicle) ? "Referência do contêiner" : "Referência da sua tabela"}</strong>
            <span>Carga útil aprox.: {reference.payload}</span>
            <span>Largura interna aprox.: {reference.width}</span>
            <span>Carregamento: {reference.loading}</span>
            <small>
              Faixas informativas; não substituem as medidas e capacidade do
              equipamento real.
            </small>
          </div>
          {vehicle.secondBody && (
            <label>
              Compartimento para configurar e carregar
              <select
                aria-label="Compartimento"
                value={activeCompartment}
                onChange={(e) => {
                  setBodyIndex(Number(e.target.value));
                  setSelected([]);
                }}
              >
                <option value={0}>1 · Dianteiro</option>
                <option value={1}>2 · Traseiro</option>
              </select>
            </label>
          )}
          <label>
            Carroceria / acesso
            <select
              aria-label="Carroceria / acesso"
              value={hasSideAccess(vehicle) ? "side-rear" : "rear"}
              disabled={
                isContainer(vehicle) ||
                vehicle.kind === "vuc" ||
                vehicle.kind === "three-quarter" ||
                vehicle.kind === "sider"
              }
              onChange={(e) =>
                changeVehicle({
                  loading: e.target.value as RoadVehicle["loading"],
                })
              }
            >
              <option value="rear">{isContainer(vehicle) ? "Contêiner · traseiro" : "Baú · traseiro"}</option>
              <option value="side-rear">Sider · lateral e traseiro</option>
            </select>
          </label>
          <p className="muted">
            {vehicle.secondBody
              ? `Medidas do compartimento ${activeCompartment + 1}. Configure os dois antes de carregar.`
              : isContainer(vehicle) ? "Dimensões internas de referência, editáveis conforme o equipamento real." : "Dimensões úteis reais. Comprimento e altura não constam na tabela enviada."}
          </p>
          <div className="road-fields">
            <NumberField
              label="Comprimento útil (mm)"
              value={activeBody.length || null}
              optional
              min={500}
              max={30000}
              onChange={(n) => changeBody({ length: n ?? 0 })}
            />
            <NumberField
              label="Largura útil (mm)"
              value={activeBody.width || null}
              optional
              min={500}
              max={5000}
              onChange={(n) => changeBody({ width: n ?? 0 })}
            />
            <NumberField
              label="Altura útil (mm)"
              value={activeBody.height || null}
              optional
              min={500}
              max={5000}
              onChange={(n) => changeBody({ height: n ?? 0 })}
            />
            <NumberField
              label={
                vehicle.secondBody
                  ? "Capacidade útil do conjunto (kg)"
                  : "Capacidade útil (kg)"
              }
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
            Medidas conferidas com a transportadora / armador
          </label>
          <details>
            <summary>Aberturas e referência</summary>
            {vehicle.sourceUrl && <p className="muted"><a href={vehicle.sourceUrl} target="_blank" rel="noreferrer">Consultar especificações do contêiner</a>. Valores variam por fabricante. Campos vazios precisam ser confirmados.</p>}
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
            {hasSideAccess(vehicle) && (
              <NumberField
                label="Altura livre lateral / trilho (mm)"
                value={vehicle.sideHeight}
                min={1}
                optional
                onChange={(n) => changeVehicle({ sideHeight: n })}
              />
            )}
            {vehicle.secondBody && (
              <p className="muted">
                Informe aqui a menor abertura entre os dois compartimentos. O
                vão da articulação não é área de carga.
              </p>
            )}
            {(vehicle.kind === "truck" || vehicle.kind === "sider") && (
              <p className="muted">
                Medidas iniciais de um equipamento de referência, editáveis.{" "}
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={
                    vehicle.kind === "truck"
                      ? "https://ingencar.com.br/produto/metalfort-bau-para-truck-cod-648/"
                      : "https://bautaruma.com/112100001"
                  }
                >
                  Consultar fonte dimensional
                </a>
              </p>
            )}
            <p className="muted">
              Pilares e outras intrusões devem ser descontados do espaço útil. A
              entrada considera a altura da pilha quando adicionada em pares,
              sem simular manobras.
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
          <div className="road-toggle" aria-label="Modo de inclusão">
            <button
              aria-pressed={batchSize === 1}
              onClick={() => setBatchSize(1)}
            >
              Unidade
            </button>
            <button
              aria-pressed={batchSize === 2}
              onClick={() => setBatchSize(2)}
            >
              Pilha de 2
            </button>
          </div>
          {batchSize === 2 && (
            <p className="road-reference">
              Cada clique adiciona duas caixas alinhadas, já empilhadas:{" "}
              {number(2 * (cargo + GOODPACK_MODELS[model].emptyWeightKg))} kg e{" "}
              {2 * GOODPACK_MODELS[model].externalDimensions.height} mm de
              altura. Não precisa preencher o piso.
            </p>
          )}
          <button
            className="primary-button"
            disabled={!ready}
            onClick={() => add()}
          >
            {batchSize === 2
              ? `+ Adicionar pilha de 2 ${model}`
              : `+ Adicionar ${model}`}
          </button>
          {!ready && (
            <p className="road-error">
              Preencha as dimensões úteis de todos os compartimentos para
              iniciar.
            </p>
          )}
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
          <label className="road-check">
            <input
              type="checkbox"
              checked={selectStacks}
              onChange={(e) => {
                setSelectStacks(e.target.checked);
                setSelected([]);
              }}
            />
            Selecionar pilha inteira ao clicar
          </label>
          <p className="muted">
            Shift + clique adiciona ou remove pilhas da seleção. Desmarque a
            opção para editar só a caixa superior.
          </p>
          <button
            disabled={!units.length}
            onClick={() => {
              commit({ ...state, units: [] });
              setSelected([]);
              setMessage("Carga removida. Use Desfazer para recuperar.");
            }}
          >
            Limpar toda a carga
          </button>
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
                    {vehicle.secondBody
                      ? ` · compart. ${(u.compartment ?? 0) + 1}`
                      : ""}
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
          {ready ? (
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
          ) : (
            <div className="road-setup-empty">
              <strong>{vehicle.name}</strong>
              <h2>Configure o espaço útil</h2>
              <p>
                Informe comprimento, largura e altura{" "}
                {vehicle.secondBody
                  ? "dos dois compartimentos"
                  : "do equipamento"}{" "}
                no painel à esquerda.
              </p>
              <p>
                A tabela fornece faixas de referência, mas não determina essas
                medidas.
              </p>
            </div>
          )}
          <div className="road-scene-badge">
            {vehicle.name}
            <span>
              {ready
                ? vehicle.secondBody
                  ? `2 compartimentos · ${meters(vehicle.length)} m + ${meters(vehicle.secondBody.length)} m úteis`
                  : `${meters(vehicle.length)} × ${meters(vehicle.width)} × ${meters(vehicle.height)} m úteis`
                : "Dimensões pendentes"}
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
          {anchor && !mixedBodies && (
            <>
              <div className="road-fields">
                <NumberField
                  label="Lateral X (mm)"
                  value={anchor.x}
                  min={-30000}
                  onChange={(n) => translate("x", n!)}
                />
                <NumberField
                  label="Longitudinal Y (mm)"
                  value={anchor.y}
                  min={-30000}
                  onChange={(n) => translate("y", n!)}
                />
                <NumberField
                  label="Base Z (mm)"
                  value={anchor.z}
                  onChange={(n) => translate("z", n!)}
                />
                {unit && (
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
                )}
              </div>
              <p className="muted">
                Origem no centro do piso do compartimento. Y negativo aponta
                para a frente do equipamento. Em grupos, coordenadas da primeira unidade; todas
                se movem juntas.
              </p>
              {selectedClearance && (
                <div className="road-clearance">
                  Folgas até as paredes: esquerda{" "}
                  {number(selectedClearance.left + selectionBody.width / 2)} ·
                  direita{" "}
                  {number(selectionBody.width / 2 - selectedClearance.right)} ·
                  frente{" "}
                  {number(selectedClearance.front + selectionBody.length / 2)} ·
                  traseira{" "}
                  {number(selectionBody.length / 2 - selectedClearance.back)} ·
                  teto {number(selectionBody.height - selectedClearance.top)} mm
                </div>
              )}
            </>
          )}
          {mixedBodies && (
            <p className="road-notice">
              Para girar ou duplicar, selecione unidades de um único
              compartimento.
            </p>
          )}
          <div className="road-action-grid">
            <button
              disabled={
                !chosen.length || mixedBodies || chosen.some((u) => u.locked)
              }
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
            <button
              disabled={!chosen.length || mixedBodies}
              onClick={duplicateGroup}
            >
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
            Com a seleção de pilha ativa, mova, gire ou exclua as duas caixas
            juntas. Para retirar somente a base, retire primeiro a unidade
            superior.
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
