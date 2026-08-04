import { normalizeText } from "./analysis.js";

const HEADER_ALIASES = {
  date: ["data", "date", "dia", "data do treino", "training date"],
  workout: ["treino", "rotina", "ficha", "workout", "sessao", "sessão"],
  weekday: ["dia da semana", "dia_da_semana", "weekday", "semana"],
  exercise: ["exercicio", "exercício", "exercise", "movimento"],
  set: ["serie", "série", "set", "numero da serie", "n serie", "nº série"],
  load: ["carga", "peso", "carga kg", "carga_kg", "kg", "load", "weight"],
  reps: ["reps", "repeticoes", "repetições", "repeticao", "repetição", "repetitions"],
  rir: ["rir", "reps em reserva", "reserva"],
  notes: ["observacoes", "observações", "notas", "notes", "comentarios", "comentários"],
};

export function autoMap(headers) {
  const normalized = new Map(headers.filter(Boolean).map(header => [normalizeText(header).replace(/[_-]+/g, " ").replace(/\s+/g, " "), header]));
  const result = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const exact = normalized.get(normalizeText(alias).replace(/[_-]+/g, " ").replace(/\s+/g, " "));
      if (exact) { result[canonical] = exact; break; }
    }
    if (result[canonical]) continue;
    for (const [normalizedHeader, original] of normalized) {
      if (aliases.some(alias => normalizedHeader.includes(normalizeText(alias).replace(/[_-]+/g, " ")))) {
        result[canonical] = original; break;
      }
    }
  }
  return result;
}

function sheetData(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("A aba selecionada não existe.");
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export async function inspectSpreadsheet(file) {
  if (!window.XLSX?.read) throw new Error("O leitor de Excel não carregou. Confira sua internet e tente novamente.");
  if (file.size > 20 * 1024 * 1024) throw new Error("A planilha ultrapassa o limite de 20 MB.");
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true, dense: true });
  const sheets = workbook.SheetNames || [];
  if (!sheets.length) throw new Error("Nenhuma aba foi encontrada na planilha.");
  const selectedSheet = sheets[0];
  const { headers, rows } = sheetData(workbook, selectedSheet);
  if (!headers.length) throw new Error("A primeira aba não possui cabeçalhos reconhecíveis.");
  return {
    filename: file.name,
    workbook,
    sheets,
    selected_sheet: selectedSheet,
    headers,
    rows,
    row_count: rows.length,
    preview: rows.slice(0, 8),
    auto_mapping: autoMap(headers),
  };
}

export function selectSheet(importState, sheetName) {
  const { headers, rows } = sheetData(importState.workbook, sheetName);
  return {
    ...importState,
    selected_sheet: sheetName,
    headers,
    rows,
    row_count: rows.length,
    preview: rows.slice(0, 8),
    auto_mapping: autoMap(headers),
  };
}
