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
// En production, on peut soit :
//   - Charger l'app buildée localement (fichiers .next/standalone)
//   - Charger l'URL distante (Cloudflare Pages / Render)
const PROD_LOCAL_PATH = path.join(__dirname, '..', '.next', 'standalone')
const PROD_REMOTE_URL = process.env.PROD_REMOTE_URL || 'https://your-app.pages.dev'

let mainWindow

// ============================================================
// Fenêtre principale
// ============================================================

function createWindow() {
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
    // En production : essayer le bundle local d'abord, sinon fallback URL distante
    try {
      const standaloneIndex = path.join(PROD_LOCAL_PATH, 'index.html')
      const fs = require('fs')
      if (fs.existsSync(standaloneIndex)) {
        console.log('[SmartShule] Mode production — chargement du bundle local')
        mainWindow.loadFile(standaloneIndex)
      } else {
        console.log(`[SmartShule] Mode production — chargement distant ${PROD_REMOTE_URL}`)
        mainWindow.loadURL(PROD_REMOTE_URL)
      }
    } catch (err) {
      console.error('[SmartShule] Erreur de chargement, fallback distant:', err)
      mainWindow.loadURL(PROD_REMOTE_URL)
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
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Sécurité : empêcher la création de fenêtres webview non autorisées
app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
  })
})
