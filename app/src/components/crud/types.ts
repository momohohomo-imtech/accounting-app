export type ProjectSearchOption = { value: string; label: string; year: number; siteLabel: string };

export type FieldConfig = {
  name: string;
  label: string;
  /** Shorter header shown in table view; falls back to `label` when omitted. */
  tableLabel?: string;
  type?: "text" | "textarea" | "date" | "tel" | "number" | "select" | "checkbox" | "time" | "project-search";
  required?: boolean;
  /** `color: "red"` on an option renders that option's text in red in the table view. */
  options?: { value: string; label: string; color?: "red" }[];
  /** Options for type "project-search", grouped/filterable by year + site. */
  projectSearchOptions?: ProjectSearchOption[];
  step?: string;
  placeholder?: string;
  readOnly?: boolean;
  display?: "progress";
  /** Format numbers with thousands separators in the table view. */
  format?: "currency";
  /** Hide this column from the table view (still available in the create/edit form). */
  hideInTable?: boolean;
  /** CSS width (e.g. "8%") applied to this column when present. */
  width?: string;
  /** When the row's value at this field name is truthy, render this cell's text in red (table view only). */
  colorField?: string;
};
