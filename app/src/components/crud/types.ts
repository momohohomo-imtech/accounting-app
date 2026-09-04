export type ProjectSearchOption = { value: string; label: string; year: number; siteLabel: string };

export type FieldConfig = {
  name: string;
  label: string;
  /** Shorter header shown in table view; falls back to `label` when omitted. */
  tableLabel?: string;
  type?: "text" | "textarea" | "date" | "tel" | "number" | "select" | "checkbox" | "time" | "project-search";
  required?: boolean;
  /** `color` on an option renders that option's text in that color in the table view. */
  options?: { value: string; label: string; color?: "red" | "blue" | "green" }[];
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
  /** When the row's value at this field name is truthy, render this cell's text in green (table view only). Checked after colorField. */
  secondaryColorField?: string;
  /** When the row's value at this field name is truthy, render this cell's text in amber (table view only). Checked after secondaryColorField. */
  tertiaryColorField?: string;
  /** When this field's own raw value equals this string, render its cell's text in red (table view only). */
  redValue?: string;
  /** For type "checkbox": checking this field unchecks the named sibling checkbox field in the form (mutual exclusivity). */
  exclusiveWith?: string;
  /** Render the whole row with a light background color keyed by this field's raw value (table view only). A value not present in the map gets no special background. */
  rowBackgroundByValue?: Record<string, "red" | "blue">;
  /** Show a checkbox (above the table) letting the user show/hide this column — state is remembered per table. */
  toggleable?: boolean;
  /** Initial shown/hidden state for a `toggleable` column before the user changes it. Defaults to true. */
  defaultVisible?: boolean;
};
