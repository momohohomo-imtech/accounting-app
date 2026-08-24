export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = String(v ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
}

// UTF-16LE + BOM으로 인코딩한다. 구버전/한국어 Excel이 UTF-8 BOM CSV를
// 깨진 글자로 읽는 경우가 있어, Excel이 더 안정적으로 인식하는 UTF-16을 사용한다.
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const text = toCsv(rows);
  const buf = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buf);
  view.setUint16(0, 0xfeff, true);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  }
  const blob = new Blob([buf], { type: "text/csv;charset=utf-16le;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
