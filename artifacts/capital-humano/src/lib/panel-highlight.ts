export type HighlightCapture = {
  grid_col: number;
  grid_col_label?: string | null;
  grid_row: string;
  quantity: number;
};

export type HighlightPanel = {
  columns: number;
  rows: number;
  column_start?: number | null;
  row_start?: number | null;
  column_labels?: string[] | null;
  row_labels?: string[] | null;
  columns_asc?: boolean | null;
  rows_asc?: boolean | null;
};

export type HighlightedCell = {
  col: number;
  row: number;
  count: number;
};

/**
 * Converts persisted capture labels back to the zero-based cells used by PanelGrid.
 * Explicit labels take precedence so numeric and textual historical labels remain stable.
 */
export function buildHighlighted(
  captures: HighlightCapture[],
  panel: HighlightPanel,
): HighlightedCell[] {
  return captures
    .map((capture) => {
      const colStart = panel.column_start ?? 1;
      const rowStart = panel.row_start ?? 0;
      const columnsAsc = panel.columns_asc ?? true;
      const rowsAsc = panel.rows_asc ?? true;

      const explicitColIndex =
        panel.column_labels?.indexOf(capture.grid_col_label ?? String(capture.grid_col)) ?? -1;
      const colIndex =
        explicitColIndex >= 0
          ? explicitColIndex
          : columnsAsc
            ? capture.grid_col - colStart
            : colStart + panel.columns - 1 - capture.grid_col;

      const explicitRowIndex = panel.row_labels?.indexOf(capture.grid_row) ?? -1;
      const letterIndex = capture.grid_row.toUpperCase().charCodeAt(0) - 65;
      const rowIndex =
        explicitRowIndex >= 0
          ? explicitRowIndex
          : rowsAsc
            ? letterIndex - rowStart
            : rowStart + panel.rows - 1 - letterIndex;

      return { col: colIndex, row: rowIndex, count: capture.quantity };
    })
    .filter(
      (highlighted) =>
        highlighted.col >= 0 &&
        highlighted.col < panel.columns &&
        highlighted.row >= 0 &&
        highlighted.row < panel.rows,
    );
}