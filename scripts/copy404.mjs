import { cp } from 'node:fs/promises'
try {
  await cp('dist/index.html', 'dist/404.html')
  console.log('Created dist/404.html for SPA routing.')
} catch (e) {
  console.warn('Could not create 404.html:', e.message)
}
