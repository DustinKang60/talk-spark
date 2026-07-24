// TalkSpark 자체 API(api/*.js) 호출 시 함께 보내는 클라이언트 식별 토큰.
// api/_shared.js의 CLIENT_TOKEN과 반드시 동일해야 한다.
// 완전한 인증이 아니라, URL만 보고 두드리는 자동화된 스크래핑/할당량 남용을 막기 위한 최소 장치.
export const CLIENT_TOKEN = "tsk_82f1c9a4e7d3b6f0";
