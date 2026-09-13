// 대표(소유주) 계정 이메일 — accounts.ts(서버 액션)와 AccountPanel.tsx(클라이언트)에서
// 공용으로 쓰기 위해 별도 파일로 분리 — "use server" 파일은 async 함수만 export할 수
// 있어 상수를 같이 둘 수 없다(taxAgentSuspend.ts와 같은 이유).
export const PROTECTED_OWNER_EMAIL = "momohohomo@gmail.com";
