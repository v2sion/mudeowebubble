import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mudeowebubble',
  brand: {
    displayName: '무더위 버블 타임',
    primaryColor: '#00C2A8',
    icon: 'https://mudeowebubble.vercel.app/logo.png',
  },
  web: {
    host: 'localhost',
    port: 5176,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  // 위치 권한: F1-2 우리 동네 하늘 기능에서 선택적으로 사용.
  // 거부해도 "가장 핫한 하늘" 대체 경로가 있어 필수 권한이 아님.
  permissions: [{ name: 'geolocation', access: 'access' }],
  outdir: 'dist',
});
