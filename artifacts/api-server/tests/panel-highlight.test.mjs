import assert from "node:assert/strict";
import test from "node:test";
import { buildHighlighted } from "../../capital-humano/src/lib/panel-highlight.ts";

test("resalta capturas históricas con etiquetas numéricas y textuales", () => {
  const highlighted = buildHighlighted(
    [
      { grid_col: 10, grid_col_label: "10", grid_row: "Superior", quantity: 2 },
      { grid_col: 11, grid_col_label: "Centro", grid_row: "Inferior", quantity: 1 },
    ],
    {
      columns: 2,
      rows: 2,
      column_labels: ["10", "Centro"],
      row_labels: ["Superior", "Inferior"],
    },
  );

  assert.deepEqual(highlighted, [
    { col: 0, row: 0, count: 2 },
    { col: 1, row: 1, count: 1 },
  ]);
});

test("mantiene compatibilidad con paneles antiguos sin etiquetas explícitas", () => {
  const highlighted = buildHighlighted(
    [{ grid_col: 8, grid_row: "C", quantity: 3 }],
    {
      columns: 3,
      rows: 3,
      column_start: 7,
      row_start: 2,
      columns_asc: true,
      rows_asc: true,
    },
  );

  assert.deepEqual(highlighted, [{ col: 1, row: 0, count: 3 }]);
});