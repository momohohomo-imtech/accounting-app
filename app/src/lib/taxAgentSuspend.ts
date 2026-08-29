// 정지: 100년짜리 ban을 걸어 관리자가 직접 해제하기 전까지 사실상 무기한 로그인 차단.
// tax-agent.ts(서버 액션)와 middleware(proxy)에서 공용으로 쓰기 위해 별도 파일로 분리
// — "use server" 파일은 async 함수만 export할 수 있어 상수를 같이 둘 수 없다.
export const TAX_AGENT_SUSPEND_DURATION = "876000h";
