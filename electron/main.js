// SmartShule — Electron Main Process
// ============================================================
// Encapsule l'application Next.js dans un exécutable desktop Windows.
// Supporte :
//   - Le mode développement (charge localhost:3000)
//   - Le mode production (charge l'app buildée locale ou l'URL distante)
//   - Les mises à jour automatiques via electron-updater + GitHub Releases
//   - La base SQLite locale (offline-first)
//   - La synchronisation avec l'API centrale (via les Server Actions Next.js)
//
// À exécuter via : npm run electron:dev ou npm run electron:build

const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

// ============================================================
// Configuration
// ============================================================

const isDev = !app.isPackaged
const DEV_SERVER_URL = process.env.DEV_SERVER_URL || 'http://localhost:3000'
// En production : charge l'URL distante (Vercel) ou le bundle local
const PROD_LOCAL_PATH = path.join(__dirname, '..', '.next', 'standalone')
const PROD_REMOTE_URL = process.env.PROD_REMOTE_URL || 'https://smart-shule-seven.vercel.app'
const LOCAL_SERVER_PORT = parseInt(process.env.PORT || '3000', 10)
const LOCAL_SERVER_URL = `http://127.0.0.1:${LOCAL_SERVER_PORT}`

let mainWindow
let nextServerProcess = null

// ============================================================
// Serveur Next.js standalone local (production)
// ============================================================

function startLocalNextServer() {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process')
    const serverPath = path.join(PROD_LOCAL_PATH, 'server.js')

    try {
      const fs = require('fs')
      if (!fs.existsSync(serverPath)) {
        console.warn('[SmartShule] server.js introuvable:', serverPath)
        return reject(new Error('server.js introuvable'))
      }

      console.log(`[SmartShule] Démarrage serveur Next.js standalone: ${serverPath}`)
      // Utiliser le runtime Node.js embarqué (extraResources/node-runtime/node.exe)
      // au lieu de SmartShule.exe qui ne peut pas être lancé comme un script Node.js
      const nodeExePath = path.join(process.resourcesPath, 'node-runtime', 'node.exe')
      const fs = require('fs')
      let executable = process.execPath
      let execArgs = [serverPath]
      let execEnv = { ...process.env }

      if (fs.existsSync(nodeExePath)) {
        // Runtime Node.js embarqué trouvé → l'utiliser
        console.log(`[SmartShule] Utilisation du runtime Node.js embarqué : ${nodeExePath}`)
        executable = nodeExePath
      } else {
        // Fallback : utiliser process.execPath avec ELECTRON_RUN_AS_NODE
        console.warn('[SmartShule] node-runtime/node.exe introuvable — fallback ELECTRON_RUN_AS_NODE')
        execEnv.ELECTRON_RUN_AS_NODE = '1'
      }

      const env = {
        ...execEnv,
        NODE_ENV: 'production',
        PORT: String(LOCAL_SERVER_PORT),
        HOSTNAME: '127.0.0.1',
      }
      nextServerProcess = spawn(executable, execArgs, {
        cwd: PROD_LOCAL_PATH,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      nextServerProcess.stdout.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) console.log('[Next.js]', msg)
      })

      nextServerProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) console.error('[Next.js ERR]', msg)
      })

      nextServerProcess.on('error', (err) => {
        console.error('[SmartShule] Erreur serveur Next.js:', err)
        reject(err)
      })

      nextServerProcess.on('exit', (code) => {
        console.log(`[SmartShule] Serveur Next.js arrêté, code=${code}`)
        nextServerProcess = null
      })

      // Wait for server ready (poll HTTP, max 30s)
      const http = require('http')
      let attempts = 0
      const maxAttempts = 60
      const checkInterval = setInterval(() => {
        attempts++
        const req = http.get(`${LOCAL_SERVER_URL}/`, (res) => {
          res.destroy()
          if (res.statusCode < 500) {
            clearInterval(checkInterval)
            console.log(`[SmartShule] Serveur prêt après ${attempts * 500}ms`)
            resolve()
          }
        })
        req.on('error', () => { /* pas encore prêt */ })
        req.setTimeout(500, () => req.destroy())

        if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          console.warn('[SmartShule] Timeout attente serveur local — fallback distant')
          resolve() // On resolve pour pas bloquer l'app
        }
      }, 500)
    } catch (err) {
      console.error('[SmartShule] Erreur démarrage serveur local:', err)
      reject(err)
    }
  })
}

// ============================================================
// Fenêtre principale
// ============================================================

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'SmartShule — Gestion Académique',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // éviter le flash blanc
  })

  // Charger l'app
  if (isDev) {
    console.log(`[SmartShule] Mode développement — chargement de ${DEV_SERVER_URL}`)
    mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // En production : TOUJOURS démarrer le serveur Next.js standalone local
    // JAMAIS de fallback vers Vercel (l'installateur commercial doit être 100% local)
    try {
      const fs = require('fs')
      const serverPath = path.join(PROD_LOCAL_PATH, 'server.js')

      if (fs.existsSync(serverPath)) {
        console.log('[SmartShule] Mode production — démarrage serveur Next.js local')
        await startLocalNextServer()
        console.log(`[SmartShule] Chargement de ${LOCAL_SERVER_URL}`)
        mainWindow.loadURL(LOCAL_SERVER_URL)
      } else {
        console.error(`[SmartShule] ERREUR : server.js introuvable (${serverPath})`)
        console.error('[SmartShule] L\'installation est peut-être corrompue. Réinstallez SmartShule.')
        // Afficher un message d'erreur à l'utilisateur au lieu de fallback sur Vercel
        mainWindow.loadURL('data:text/html,<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>SmartShule — Erreur</h1><p>Le serveur local est introuvable. L\'installation est peut-être corrompue.</p><p>Veuillez réinstaller SmartShule.</p></body></html>')
      }
    } catch (err) {
      console.error('[SmartShule] Erreur de chargement:', err)
      mainWindow.loadURL('data:text/html,<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>SmartShule — Erreur</h1><p>Impossible de démarrer le serveur local.</p><p>' + err.message + '</p></body></html>')
    }
  }

  // Afficher la fenêtre une fois le contenu prêt
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Ouvrir les liens externes dans le navigateur système
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ============================================================
// Menu personnalisé
// ============================================================

function createMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Recharger (sans cache)' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Vérifier les mises à jour',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: 'À propos de SmartShule',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos',
              message: 'SmartShule — Gestion Académique',
              detail: `Version: ${app.getVersion()}\nL'intelligence qui rapproche l'école et la famille.`,
              buttons: ['OK'],
            })
          },
        },
        {
          label: 'Documentation en ligne',
          click: () => shell.openExternal('https://github.com/votre-repo/smartshule#readme'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ============================================================
// Mises à jour automatiques (electron-updater)
// ============================================================

function setupAutoUpdater() {
  if (isDev) {
    console.log('[SmartShule] Mode dev — auto-update désactivé')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[SmartShule] Vérification des mises à jour...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[SmartShule] Mise à jour disponible:', info.version)
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: `La version ${info.version} est disponible.`,
        detail: 'Elle sera téléchargée en arrière-plan et installée au prochain redémarrage.',
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[SmartShule] Aucune mise à jour — version à jour')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[SmartShule] Téléchargement : ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[SmartShule] Mise à jour téléchargée:', info.version)
    if (mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: 'Mise à jour prête',
          message: `Version ${info.version} prête à installer.`,
          detail: 'Redémarrer maintenant pour appliquer la mise à jour ?',
          buttons: ['Redémarrer maintenant', 'Plus tard'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall()
          }
        })
    } else {
      // Pas de fenêtre ouverte : installer silencieusement à la fermeture
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('[SmartShule] Erreur auto-update:', err)
    // Ne pas planter l'app pour autant — l'utilisateur peut continuer à travailler
  })

  // Vérifier au démarrage (après 10s pour laisser l'app se charger)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[SmartShule] checkForUpdates a échoué:', err)
    })
  }, 10000)

  // Vérifier toutes les 4 heures
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

function checkForUpdates(manual = false) {
  if (isDev) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Mode développement',
      message: 'Les mises à jour automatiques ne fonctionnent qu\'en version compilée.',
      buttons: ['OK'],
    })
    return
  }
  if (manual && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Vérification',
      message: 'Vérification des mises à jour en cours...',
      buttons: ['OK'],
    })
  }
  autoUpdater.checkForUpdates().catch((err) => {
    if (manual && mainWindow) {
      dialog.showErrorBox(
        'Erreur de mise à jour',
        `Impossible de vérifier les mises à jour : ${err.message}`
      )
    }
  })
}

// ============================================================
// Cycle de vie de l'app
// ============================================================

app.whenReady().then(() => {
  createWindow()
  createMenu()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Arrêter le serveur Next.js local avant de quitter
  if (nextServerProcess) {
    console.log('[SmartShule] Arrêt du serveur Next.js local...')
    try {
      nextServerProcess.kill('SIGTERM')
      // Force kill si toujours vivant après 2s
      setTimeout(() => {
        if (nextServerProcess) {
          nextServerProcess.kill('SIGKILL')
        }
      }, 2000)
    } catch (err) {
      console.error('[SmartShule] Erreur arrêt serveur:', err)
    }
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Nettoyage du serveur quand l'app se ferme brutalement
app.on('before-quit', () => {
  if (nextServerProcess) {
    try {
      nextServerProcess.kill('SIGKILL')
    } catch (e) {
      // ignore
    }
  }
})

// Sécurité : empêcher la création de fenêtres webview non autorisées
app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
  })
})
