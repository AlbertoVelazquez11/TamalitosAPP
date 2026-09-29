/**
 * deploy.js — Script automatizado de despliegue a Vercel
 * Ejecutar con: node deploy.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const authPath = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data', 'auth.json');
  if (!fs.existsSync(authPath)) {
    throw new Error('No se encontró el archivo de autenticación de Vercel en ' + authPath);
  }

  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  if (!auth.token) {
    throw new Error('Token no disponible en auth.json');
  }

  console.log('🚀 Iniciando despliegue a Vercel Producción...');
  // Intentar primero con la sesión activa del CLI de Vercel
  try {
    execSync('npx vercel --prod --yes', { stdio: 'inherit' });
    console.log('✅ Despliegue completado con éxito.');
  } catch (cliErr) {
    if (auth.token) {
      console.log('Reintentando con token explícito...');
      execSync(`npx vercel --token ${auth.token} --prod --yes`, { stdio: 'inherit' });
      console.log('✅ Despliegue completado con éxito.');
    } else {
      throw cliErr;
    }
  }
} catch (error) {
  console.error('❌ Error en el despliegue:', error.message);
  process.exit(1);
}

