export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "tel" | "number" | "select" | "checkbox" | "time";
  required?: boolean;
  options?: { value: string; label: string }[];
  step?: string;
  placeholder?: string;
  readOnly?: boolean;
  display?: "progress";
};
