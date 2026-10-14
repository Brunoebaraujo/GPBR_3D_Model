# GPBR 3D Model

Main repository: [Brunoebaraujo/GPBR_3D_Model](https://github.com/Brunoebaraujo/GPBR_3D_Model)

Web-based 3D packing simulator MVP for validating simplified product mock-ups inside a Goodpack MB5 container.

## Stack

- React
- TypeScript
- Vite
- React Three Fiber
- Drei
- Three.js
- npm

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Open From GitHub Pages

After GitHub Pages is enabled with GitHub Actions as the source, the app will be available at:

```text
https://brunoebaraujo.github.io/GPBR_3D_Model/
```

To enable it:

1. Open the GitHub repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Run the **Deploy to GitHub Pages** workflow from the **Actions** tab, or push to `main`.

## MVP Features

- Transparent MB5 external and internal usable 3D volumes
- Orbit, zoom, pan, floor grid, and basic lighting
- Add rectangular blocks, cubes, and cylinders
- Select objects directly in the 3D scene
- Edit name, dimensions, weight, position, and rotation
- Validate fitment against MB5 usable dimensions
- Track volume utilization, total payload, remaining payload, and warnings

## Unit System

All UI inputs and displayed values use millimeters and kilograms.

For rendering only:

```text
1000 mm = 1 Three.js unit
```

Unit conversion lives in `src/utils/unitConversion.ts`.

## Project Structure

```text
src/
├── components/
│   ├── Scene3D.tsx
│   ├── MB5Container.tsx
│   ├── PackingObject.tsx
│   ├── Sidebar.tsx
│   ├── ObjectPropertiesPanel.tsx
│   └── StatusPanel.tsx
├── data/
│   └── skus.ts
├── utils/
│   ├── unitConversion.ts
│   └── fitValidation.ts
├── types/
│   └── index.ts
├── styles/
│   └── global.css
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

## Where To Add Future Features

- New 3D visuals or interactions: `src/components/Scene3D.tsx` and related scene components
- New object types: `src/types/index.ts`, `src/components/PackingObject.tsx`, and object creation logic in `src/App.tsx`
- Fitment and business rules: `src/utils/fitValidation.ts`
- SKU presets and reusable product data: `src/data/skus.ts`
- App-level layout and state orchestration: `src/App.tsx`
- Global styling and layout tokens: `src/styles/global.css`

## Current Scope Limits

This MVP intentionally does not include login, authentication, database storage, CAD upload, physics, drag-and-drop, PDF export, or automatic packing optimization.


## Product studio

Use **Criar produto** to open the dedicated editor. Draw one square, rectangle or circle on the XY plane by dragging, or enter exact millimeter dimensions. Set extrusion height along Z, then choose **Extrudar perfil**. A square extrusion can have an independent height; it is a square-based prism, not necessarily a cube.

In the 3D view, rotate the solid using the transform rings or X/Y/Z degree fields. Camera orbit and object rotation remain separate. Choose a top face from the selector or click a face after enabling **Definir topo**. Green identifies the chosen top and orange its opposite. Cylinders support either flat cap as top. The optional **Manter topo para cima** constraint filters nesting orientations; manual rotation can violate it, but fill is blocked until corrected or optimized.

**Usar no nesting** adds or updates the product and selects it. **Buscar melhor orientação** compares the current rotation plus unique orthogonal orientations; **Preencher Goodpack** previews one selected product with the requested clearance. Product definitions are retained when clearing a fill. Definitions and drafts currently live in the active browser session; refreshing the page resets them.

### Calculation behavior and limits

- Preserves the repository's MB5 specification: usable 1090 × 1437 × 1020 mm, payload 1650 kg. No additional Goodpack SKUs are inferred.
- Rectangular solids use a uniform grid with analytical rotated bounds. Vertical circular cylinders also compare staggered rows in both planar directions and row phases.
- Rank by payload-limited quantity, then geometric capacity. These are heuristic candidates, not a proof of global optimality. Mixed SKUs, irregular profiles, holes and Boolean composition are not supported. Mixed orientations are available through the residual-space mode described below.
- Actual material volume determines utilization, independent of rotation; cylinder volume uses πr²h. Search utilization uses the payload-limited count. The footer describes only objects currently rendered.
- Fill never exceeds payload. At most 1200 pieces are rendered; the exact computed capacity and truncation warning remain visible.
- Validates container bounds, required top orientation, payload, box collisions and upright cylinder collisions. Tilted cylinders and cylinder/block pairs use conservative oriented envelopes and are labeled as possible overlaps.
- Does not model compression, deformation, load bearing, stability, dunnage or handling restrictions beyond the explicit top constraint and spacing.

### Verification

Run `npm test` for calculation regression coverage and `npm run build` for TypeScript and production compilation. Tests cover top constraints on every face, rotated bounds, payload, cylinder spacing, overlaps, geometric capacity and bounded preview generation.


## Nesting modes

The filling panel now offers two explicit modes:

- **Orientação única** preserves the previous behavior: every product uses the same rotation, with grid or staggered vertical-cylinder rows.
- **Orientações combinadas** keeps the maximal rectangular grid in the current principal rotation, then fills the remaining disjoint spaces with other allowed orthogonal orientations. **Buscar melhor combinação** also compares principal rotations before filling. The template is not mutated by either calculation.

The combined search evaluates six orders of partitioning the remaining volume into side/end/top slabs, then greedily fills residual regions with up to 32 grid batches. Analytical envelopes and explicit clearance between regions prevent overlap. This is a bounded heuristic; it does not remove rows from the principal block or promise global optimality. Circular cylinders use conservative rectangular envelopes for mixed batches, and the original single-orientation solution, including hexagonal rows, is retained whenever the combined candidate does not improve its geometric capacity.

Each generated piece carries its own rotation. Principal pieces retain their product color; supplementary orientations use purple body faces while the selected top remains green. The panel compares allowed capacity against the uniform solution with the same principal rotation and clearance, and reports geometric and payload-limited counts per orientation. Primary pieces receive payload allocation first. If payload removes the operational gain, this is explicitly reported. A truncated preview reserves representation for supplementary regions, while the summary retains complete calculated counts.

**Manter topo para cima** remains authoritative: turning a box on its side is permitted only if the selected top can remain upward or that restriction is disabled. Stability, bearing surfaces, stack strength and handling sequence remain outside the geometric model.

Regression coverage includes a 400 × 300 × 220 mm / 1 kg MB5 example (32 uniform versus 47 combined), clearance between residual batches, every selectable top, payload allocation, large previews, cylinder fallback, mode switching and deterministic varied dimensions/rotations.

## MB6 e planejamento rodoviário

A navegação separa **Produto no Goodpack** de **Goodpack no caminhão**. O primeiro
ambiente aceita MB5 e MB6 e recalcula o nesting com as dimensões internas do modelo.
O ambiente rodoviário usa as dimensões externas e soma a tara ao peso do produto.

| Modelo | Externo C × L × A (mm) | Interno C × L × A (mm) | Tara nominal | Carga útil |
| --- | --- | --- | --- | --- |
| MB5 | 1465 × 1150 × 1098 | 1437 × 1090 × 1020 | 132 kg | 1650 kg |
| MB6 | 1220 × 1120 × 1076 | 1187 × 1069 × 981 | 115 kg, incluindo tampa | 1650 kg |

Fontes: fichas Goodpack GP TDS MB5 (02/05/2021) e GP TDS MB6 (27/02/2023),
fornecidas pelo proprietário do projeto. As taras de catálogo têm tolerâncias de
±4 kg e ±3 kg, respectivamente; o cálculo usa os valores nominais.

### Perfis rodoviários de referência

- **Truck baú:** 8280 × 2500 × 2600 mm úteis. Referência:
  [Metalfort / Ingencar](https://ingencar.com.br/produto/metalfort-bau-para-truck-cod-648/).
- **Carreta sider:** 14700 × 2480 × 2760 mm úteis; altura traseira 2690 mm;
  altura lateral no trilho 2700 mm. Referência:
  [Facchini / Baú Tarumã](https://bautaruma.com/112100001).

São equipamentos específicos, não dimensões universais. Confirme medidas,
capacidade útil e aberturas com a transportadora. A capacidade de carga começa
sem valor e nunca é presumida a partir do tipo de equipamento.

### Operação

1. Escolha o equipamento, revise as medidas úteis e informe a capacidade útil.
2. Escolha MB5 ou MB6, informe o peso do produto e clique em **Adicionar**.
3. Selecione a unidade na cena ou lista. Shift/Ctrl + clique seleciona grupos.
4. Mova pelos eixos ou plano do controle 3D, ou use coordenadas em milímetros.
   X é lateral, Y é longitudinal (negativo para a cabine), Z é a altura da base.
5. Gire 90°, duplique unidades/fileiras ou empilhe uma cópia. Para mover uma
   pilha, selecione os dois níveis. A unidade superior deve ser removida antes
   de sua base.
6. Ajuste o raio X, o teto/laterais e as vistas superior, lateral ou traseira.
   Desfazer/refazer mantém até 60 estados durante a sessão.

O encaixe assistido procura paredes e unidades próximas (80 mm), com grade de
10 mm fora dessas regiões. Folgas se aplicam ao piso e às laterais entre
unidades, sem afastar os apoios de uma pilha. Movimentos inválidos ficam vermelhos
e retornam à posição anterior ao soltar. Unidades travadas não se movem.

### Validação e limites da primeira entrega

- Caixas montadas e carregadas, sempre em pé; giros de 90° no piso.
- Até dois níveis do mesmo modelo, alinhados e apoiados sobre uma unidade no piso.
- Colisões, limites externos, folgas, carga útil por caixa e peso total embarcado.
- Entrada avaliada por unidade ou pela altura total de uma pilha adicionada em par.
  Não simula trajetória, manobra da empilhadeira, pilares, amarração, resistência do piso ou cargas
  por eixo. Desconte intrusões das dimensões úteis antes de simular.
- A divisão frente/traseira assume massa uniforme no envelope de cada unidade;
  não é um cálculo de reações nos eixos.
- Limite de 200 unidades para manter a interação responsiva.
- A troca de equipamento mantém a carga e destaca incompatibilidades. As duas
  seções preservam seu estado ao alternar abas; recarregar a página reinicia a sessão.
- Otimização automática completa e salvar/reabrir cenários são etapas posteriores.

`src/utils/roadLoading.ts` concentra as regras geométricas sem dependência da
interface. `npm test` cobre MB6, tara, limites, folgas, apoio, grupos, aberturas,
posicionamento assistido e distribuição espacial, além dos testes do nesting.

### Frota ampliada e inclusão direta de pilhas

O seletor inclui os nove perfis da tabela fornecida pelo usuário:

| Perfil | Carga útil aproximada, apenas referência | Largura interna aproximada | Acesso de referência |
| --- | --- | --- | --- |
| VUC | 1,5–3 t | 1,80–2,10 m | Traseiro |
| Caminhão 3/4 | 3–4 t | 2,00–2,30 m | Traseiro |
| Toco | 6–8 t | 2,30–2,48 m | Traseiro ou sider |
| Truck (truque) | 12–14 t | 2,40–2,50 m | Traseiro ou sider |
| Bitruck | 14–18 t | 2,40–2,50 m | Traseiro ou sider |
| Carreta LS (3 eixos) | 25–28 t | 2,45–2,50 m | Traseiro ou sider |
| Carreta sider (3 eixos) | 28–32 t | 2,45–2,50 m | Lateral e traseiro |
| Bitrem | 35–38 t | 2,45–2,50 m | Traseiro ou sider |
| Rodotrem | 45–50 t | 2,45–2,50 m | Traseiro ou sider |

Essas faixas foram transcritas da imagem enviada em 14/10/2026. Não são limites
legais certificados nem especificações de um veículo particular. Não alimentam
automaticamente o limite de peso. Comprimento e altura não estavam na imagem;
os novos perfis exigem informar as três dimensões úteis antes de carregar.
Truck e sider mantêm os exemplos dimensionais da entrega anterior; a silhueta é
esquemática e não certifica configuração de eixos.

Bitrem e rodotrem têm **dois compartimentos independentes**, com comprimento,
largura e altura próprios. Escolha o compartimento antes de configurar ou
adicionar. As coordenadas são locais a cada piso. O vão visual entre carrocerias
(1,8 m no bitrem e 3 m no rodotrem) é apenas esquemático e nunca entra na área ou
no volume útil. Colisões e apoio são avaliados dentro de cada compartimento;
uma caixa em outro compartimento nunca serve de apoio. O peso total é somado
no conjunto; não há validação dos limites individuais dos implementos.

Em **Adicionar Goodpack**, escolha **Pilha de 2**. Cada clique inclui uma base e
uma caixa superior alinhada do mesmo modelo, mesmo com o piso vazio. A inclusão
é atômica: as duas precisam caber e respeitar juntas o limite de peso; se não,
nenhuma é incluída. A abertura informada precisa comportar a altura total da
pilha. Com aberturas desconhecidas, o cenário mantém o aviso de validação
incompleta. Para duas carrocerias, informe a menor abertura de ambas.

**Selecionar pilha inteira ao clicar** permite mover, girar, duplicar ou excluir
as duas caixas juntas. Desative para editar uma caixa individual. As coordenadas
de um grupo usam a primeira caixa como referência. O modo **Unidade** e o botão
**Empilhar cópia** continuam disponíveis para montagem individual. Desfazer/refazer
trata a inclusão de uma pilha como uma única ação. **Limpar toda a carga** também
pode ser desfeito, facilitando a troca para um perfil ainda sem dimensões.
